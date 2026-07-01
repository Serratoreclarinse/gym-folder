import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify the caller is an authenticated coach
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller's JWT using the anon client
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) throw new Error('Unauthorized');

    // Check caller is a coach
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (!['coach', 'admin'].includes(callerProfile?.role)) throw new Error('Unauthorized');

    const { name, email, phone, package_type, total_sessions, duration_weeks, coach_id } = await req.json();

    if (!name || !email || !package_type || !total_sessions) {
      throw new Error('Missing required fields: name, email, package_type, total_sessions');
    }
    if (total_sessions < 1) throw new Error('total_sessions must be at least 1');

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('email', normalizedEmail)
      .maybeSingle();

    let userId: string;
    let isNewUser = false;

    if (existingProfile) {
      if (existingProfile.role === 'coach') {
        throw new Error('This email belongs to a coach account and cannot be added as a client.');
      }
      // Existing client — reuse their account, just add a new package
      userId = existingProfile.id;
    } else {
      // New user — create auth account
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { name, role: 'client' },
      });
      if (createErr) throw new Error(createErr.message);
      userId = newUser.user.id;
      isNewUser = true;

      // Update profile: set phone (trigger already set name + email)
      if (phone) {
        await adminClient.from('profiles').update({ phone }).eq('id', userId);
      }
    }

    // Admin passes coach_id explicitly; coach uses their own ID
    const resolvedCoachId = callerProfile.role === 'admin' ? coach_id : caller.id;
    if (!resolvedCoachId) throw new Error('coach_id is required');

    // Create the package
    const { data: pkg, error: pkgErr } = await adminClient
      .from('packages')
      .insert({
        client_id: userId,
        coach_id: resolvedCoachId,
        package_type,
        total_sessions: Number(total_sessions),
        start_date: new Date().toISOString().split('T')[0],
        ...(duration_weeks && Number(duration_weeks) > 0 ? { duration_weeks: Number(duration_weeks) } : {}),
      })
      .select()
      .single();
    if (pkgErr) throw new Error(pkgErr.message);

    // Send password-reset link only for new users
    if (isNewUser) {
      await adminClient.auth.admin.generateLink({ type: 'recovery', email: normalizedEmail });
    }

    return new Response(
      JSON.stringify({ user_id: userId, package_id: pkg.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
