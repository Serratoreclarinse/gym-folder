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
    if (callerProfile?.role !== 'coach') throw new Error('Only coaches can create clients');

    const { name, email, phone, package_type, total_sessions } = await req.json();

    if (!name || !email || !package_type || !total_sessions) {
      throw new Error('Missing required fields: name, email, package_type, total_sessions');
    }
    if (total_sessions < 1) throw new Error('total_sessions must be at least 1');

    // Create the auth user (email confirmed, invite email sent automatically)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name, role: 'client' },
    });
    if (createErr) throw new Error(createErr.message);

    const userId = newUser.user.id;

    // Update profile: set phone (trigger already set name + email)
    if (phone) {
      await adminClient
        .from('profiles')
        .update({ phone })
        .eq('id', userId);
    }

    // Create the package
    const { data: pkg, error: pkgErr } = await adminClient
      .from('packages')
      .insert({
        client_id: userId,
        coach_id: caller.id,
        package_type,
        total_sessions: Number(total_sessions),
        start_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();
    if (pkgErr) throw new Error(pkgErr.message);

    // Send password-reset so client can set their own password
    await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

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
