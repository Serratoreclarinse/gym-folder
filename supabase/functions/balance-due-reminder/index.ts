/**
 * balance-due-reminder
 *
 * Called daily by pg_cron at 8:00 UTC (noon Gulf/Oman time).
 * Sends push + in-app notifications to coaches whose clients have a
 * partial-payment balance approaching or already past its due date.
 *
 * Triggers:
 *   - 3 days before due date → "Balance Due Soon" warning
 *   - On or after due date   → "Balance Due Today / Overdue" alert
 *
 * Dedup: balance_notif_warning_sent / balance_notif_due_sent flags on
 *        renewal_requests prevent duplicate sends.
 *
 * Auth: Authorization: Bearer <BALANCE_DUE_SECRET>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('BALANCE_DUE_SECRET');
  const auth   = req.headers.get('Authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now       = new Date();
  const today     = now.toISOString().split('T')[0];
  const in3Days   = new Date(now.getTime() + 3 * 86_400_000).toISOString().split('T')[0];

  // Fetch all partial renewals with a balance due date
  const { data: renewals, error } = await supabase
    .from('renewal_requests')
    .select(`
      id, coach_id, client_id, amount_paid, balance_due_date,
      balance_notif_warning_sent, balance_notif_due_sent,
      client:profiles!renewal_requests_client_id_fkey(name)
    `)
    .eq('payment_status', 'partial')
    .not('balance_due_date', 'is', null);

  if (error) {
    console.error('[balance-due-reminder] fetch error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Filter to renewals that need a notification
  const toProcess = (renewals ?? []).filter((r: any) => {
    const due = r.balance_due_date as string;
    const needsWarning = due === in3Days && !r.balance_notif_warning_sent;
    const needsDue     = due <= today    && !r.balance_notif_due_sent;
    return needsWarning || needsDue;
  });

  if (!toProcess.length) {
    console.log('[balance-due-reminder] nothing to send today');
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // Fetch push tokens for all affected coaches + clients
  const allUserIds = [
    ...new Set([
      ...toProcess.map((r: any) => r.coach_id as string),
      ...toProcess.map((r: any) => r.client_id as string),
    ]),
  ];
  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', allUserIds);

  const tokenMap = new Map<string, string>(
    (tokenRows ?? []).map((t: any) => [t.user_id as string, t.token as string]),
  );

  let pushSent = 0;

  for (const r of toProcess) {
    const due        = r.balance_due_date as string;
    const clientName = (r.client as any)?.name ?? 'Client';
    const balanceStr = r.amount_paid ? `OMR ${Number(r.amount_paid).toFixed(3)} already paid. ` : '';

    const isWarning  = due === in3Days && !r.balance_notif_warning_sent;
    const isDue      = due <= today    && !r.balance_notif_due_sent;
    const isOverdue  = due < today;

    let flag: 'balance_notif_warning_sent' | 'balance_notif_due_sent';

    // --- CLIENT messages (reminder to pay) ---
    let clientTitle: string;
    let clientBody:  string;

    // --- COACH messages (heads-up to collect) ---
    let coachTitle: string;
    let coachBody:  string;

    if (isWarning && !isDue) {
      flag        = 'balance_notif_warning_sent';
      clientTitle = '💳 Balance Payment Reminder';
      clientBody  = `Hi! Your package balance is due in 3 days (${due}). ${balanceStr}Please settle before the due date.`;
      coachTitle  = '💳 Balance Due in 3 Days';
      coachBody   = `${clientName}'s balance is due on ${due}. ${balanceStr}`;
    } else {
      flag        = 'balance_notif_due_sent';
      if (isOverdue) {
        clientTitle = '⚠️ Balance Payment Overdue';
        clientBody  = `Your package balance was due on ${due}. ${balanceStr}Please settle ASAP to keep your membership active.`;
        coachTitle  = '⚠️ Balance Overdue!';
        coachBody   = `${clientName}'s balance was due on ${due}. ${balanceStr}Please follow up.`;
      } else {
        clientTitle = '💳 Balance Due Today!';
        clientBody  = `Your package balance is due today. ${balanceStr}Please settle to keep your membership active.`;
        coachTitle  = '💳 Balance Due Today';
        coachBody   = `${clientName}'s balance is due today. ${balanceStr}Ready to collect?`;
      }
    }

    // Mark dedup flag
    await supabase
      .from('renewal_requests')
      .update({ [flag]: true })
      .eq('id', r.id);

    const notifData = { type: 'balance_due', renewal_id: r.id, client_id: r.client_id };

    // In-app notifications
    await supabase.from('notifications').insert([
      { user_id: r.client_id, title: clientTitle, body: clientBody, data: notifData },
      { user_id: r.coach_id,  title: coachTitle,  body: coachBody,  data: notifData },
    ]);

    // Batch push to both client and coach
    const pushMessages = [
      { userId: r.client_id, title: clientTitle, body: clientBody },
      { userId: r.coach_id,  title: coachTitle,  body: coachBody  },
    ]
      .filter((m) => tokenMap.has(m.userId))
      .map((m) => ({
        to:    tokenMap.get(m.userId)!,
        title: m.title,
        body:  m.body,
        sound: 'default',
        data:  notifData,
      }));

    if (pushMessages.length > 0) {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(pushMessages),
      });

      if (res.ok) {
        pushSent += pushMessages.length;
        const json = await res.json().catch(() => null);
        const results: any[] = Array.isArray(json?.data) ? json.data : json?.data ? [json.data] : [];
        const stale = results
          .map((result: any, i: number) =>
            result?.details?.error === 'DeviceNotRegistered' ? pushMessages[i]?.to : null)
          .filter(Boolean) as string[];
        if (stale.length > 0) {
          await supabase.from('push_tokens').delete().in('token', stale);
        }
      }
    }

    console.log(`[balance-due-reminder] ${flag} → client ${r.client_id} + coach ${r.coach_id} (${clientName}) due ${due}`);
  }

  return new Response(
    JSON.stringify({ processed: toProcess.length, push_sent: pushSent }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
