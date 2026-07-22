/**
 * sales-closing-reminder
 *
 * Called by pg_cron on two schedules:
 *   - 28th of each month at 09:00 UTC  → type="warning"  (7-day heads-up)
 *   - 4th  of each month at 09:00 UTC  → type="closing"  (deadline day)
 *
 * Auth: requires Authorization: Bearer <SALES_REMINDER_SECRET> header.
 *       Set SALES_REMINDER_SECRET in Supabase Edge Function secrets.
 *       Use the same value in the pg_cron SQL (see migration 017).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SALES_REMINDER_SECRET');
  const auth   = req.headers.get('Authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let type: 'warning' | 'closing' = 'warning';
  try {
    const body = await req.json();
    if (body.type === 'closing') type = 'closing';
  } catch { /* default to warning */ }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Fetch all active coaches
  const { data: coaches, error: coachErr } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'coach')
    .is('deactivated_at', null);

  if (coachErr || !coaches?.length) {
    console.log('[sales-closing-reminder] No active coaches found');
    return new Response(
      JSON.stringify({ sent: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const coachIds: string[] = coaches.map((c: any) => c.id);

  // Fetch push tokens for all coaches
  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', coachIds);

  const tokenMap = new Map<string, string>(
    (tokenRows ?? []).map((t: any) => [t.user_id, t.token]),
  );

  // Build message text
  const now = new Date();
  const nextMonthName = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toLocaleDateString('en-US', { month: 'long' });

  const title = type === 'warning' ? 'Sales Closing Soon ⚠️' : '🔴 Sales Deadline Today!';
  const body  = type === 'warning'
    ? `Submit all package renewals by the 4th of ${nextMonthName}. 7-day warning.`
    : 'Today is the monthly sales closing — last chance to submit renewals and new packages!';

  // Insert in-app notifications for all coaches
  await supabase.from('notifications').insert(
    coaches.map((c: any) => ({
      user_id: c.id,
      title,
      body,
      data: { type: 'sales_closing', reminder: type },
    })),
  );

  // Batch push to coaches with registered tokens
  const pushMessages = coaches
    .filter((c: any) => tokenMap.has(c.id))
    .map((c: any) => ({
      to:    tokenMap.get(c.id)!,
      title,
      body,
      data:  { type: 'sales_closing', reminder: type },
      sound: 'default',
    }));

  let pushSent = 0;
  if (pushMessages.length > 0) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(pushMessages),
    });

    if (res.ok) {
      pushSent = pushMessages.length;
      // Remove stale tokens flagged as DeviceNotRegistered
      const json = await res.json().catch(() => null);
      const results: any[] = Array.isArray(json?.data) ? json.data : json?.data ? [json.data] : [];
      const stale = results
        .map((r: any, i: number) => r?.details?.error === 'DeviceNotRegistered' ? pushMessages[i]?.to : null)
        .filter(Boolean) as string[];
      if (stale.length > 0) {
        await supabase.from('push_tokens').delete().in('token', stale);
      }
    }
  }

  console.log(`[sales-closing-reminder] type=${type} coaches=${coaches.length} push=${pushSent}`);
  return new Response(
    JSON.stringify({ type, sent: coaches.length, push_sent: pushSent }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
