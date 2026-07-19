import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) throw new Error('Unauthorized');

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfile?.role !== 'admin') throw new Error('Unauthorized');

    const { user_id, new_email } = await req.json();
    if (!user_id || !new_email) throw new Error('Missing user_id or new_email');

    const normalizedEmail = new_email.trim().toLowerCase();

    // Check if the new email is already taken by a different account
    const { data: existing } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .neq('id', user_id)
      .maybeSingle();
    if (existing) throw new Error('This email is already used by another account.');

    // Update email in auth.users (email_confirm skips confirmation email)
    const { error: authUpdateErr } = await adminClient.auth.admin.updateUserById(user_id, {
      email: normalizedEmail,
      email_confirm: true,
    });
    if (authUpdateErr) throw new Error(authUpdateErr.message);

    // Keep profiles.email in sync
    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({ email: normalizedEmail })
      .eq('id', user_id);
    if (profileErr) throw new Error(profileErr.message);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
