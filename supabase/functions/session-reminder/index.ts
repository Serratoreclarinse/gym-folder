/**
 * session-reminder
 *
 * Triggered by a Supabase database webhook on INSERT into workout_sessions.
 *
 * Fires at 3 / 2 / 1 sessions remaining:
 *  - Push notification  → client (polite renewal nudge)
 *  - Push notification  → coach  (heads-up to close the renewal)
 *  - In-app notification → both
 *  - Email              → client
 *
 * Dedup: UNIQUE(package_id, trigger_type) on email_logs prevents duplicate sends.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Types ───────────────────────────────────────────────────

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: {
    id: string;
    package_id: string;
    client_id: string;
    coach_id: string;
    session_date: string;
    duration_minutes: number;
  };
  old_record: null | Record<string, unknown>;
};

type TriggerType = '3_remaining' | '2_remaining' | '1_remaining' | '0_remaining';

const PKG_LABEL: Record<string, string> = {
  '30min': '30-minute',
  '45min': '45-minute',
  '1hr':   '1-hour',
};

// ─── Push notification helpers ────────────────────────────────

function clientPushMessage(remaining: number, coachName: string) {
  if (remaining === 3) return {
    title: '⚡ 3 Sessions Left',
    body:  `Keep the momentum going! Talk to ${coachName} about renewing your package.`,
  };
  if (remaining === 2) return {
    title: '⏳ 2 Sessions Left',
    body:  `Your package is almost done. Don't let your training stop — ask ${coachName} about a renewal.`,
  };
  if (remaining === 1) return {
    title: '🚨 Last Session!',
    body:  `This is your final session. Contact ${coachName} now to keep going!`,
  };
  return {
    title: '📦 Package Expired',
    body:  `Your package has been fully used. Reach out to ${coachName} to renew and continue training!`,
  };
}

function coachPushMessage(remaining: number, clientName: string) {
  if (remaining === 3) return {
    title: '📋 Renewal Heads-Up',
    body:  `${clientName} has 3 sessions left — a great time to start the renewal conversation.`,
  };
  if (remaining === 2) return {
    title: '⚠️ Client Running Low',
    body:  `${clientName} has only 2 sessions left. Follow up to secure the renewal!`,
  };
  if (remaining === 1) return {
    title: '🚨 Last Session Today',
    body:  `${clientName} has 1 session remaining — last chance to close the renewal!`,
  };
  return {
    title: '📦 Package Expired',
    body:  `${clientName}'s package has been fully used. Time to close a renewal!`,
  };
}

async function sendPushAndInApp(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  token: string | undefined,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  // In-app notification (shows in notification bell)
  await supabase.from('notifications').insert({ user_id: userId, title, body, data });

  if (!token) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify([{ to: token, title, body, data, sound: 'default' }]),
  }).then(async (res) => {
    if (!res.ok) return;
    const json = await res.json().catch(() => null);
    const results: any[] = Array.isArray(json?.data) ? json.data : json?.data ? [json.data] : [];
    const stale = results
      .filter((r: any) => r?.details?.error === 'DeviceNotRegistered')
      .map(() => token);
    if (stale.length > 0) {
      await supabase.from('push_tokens').delete().in('token', stale);
    }
  }).catch(() => {/* non-critical — email still sends */});
}

// ─── Email HTML builder ───────────────────────────────────────

function buildEmail(
  triggerType: TriggerType,
  clientName: string,
  coachName: string,
  packageType: string,
  sessionsRemaining: number,
): { subject: string; html: string } {
  const pkgLabel  = PKG_LABEL[packageType] ?? packageType;
  const safeName  = clientName.replace(/[<>&"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]!));
  const safeCoach = coachName.replace(/[<>&"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]!));
  const firstName = safeName.split(' ')[0];

  const isExpired = triggerType === '0_remaining';

  const subject = isExpired
    ? `Your package has expired — renew to keep training!`
    : `Last session coming up — renew now!`;

  const urgencyLine = isExpired
    ? `<p style="color:#FF4D4D;font-weight:700;font-size:18px;margin:0 0 16px;">📦 Your package has been fully used.</p>`
    : `<p style="color:#FF4D4D;font-weight:700;font-size:18px;margin:0 0 16px;">🚨 This is your LAST session.</p>`;

  const bodyLine = isExpired
    ? `Your ${pkgLabel} coaching package with ${safeCoach} has been fully used up. Don't let your progress stall — reach out to ${safeCoach} <strong>today</strong> to renew and keep the momentum going.`
    : `After your next session your current package will be fully used up. Don't lose momentum — reach out to ${safeCoach} <strong>today</strong> to secure your next block of sessions.`;

  const ctaText = isExpired ? 'Renew My Package Now' : 'Renew My Package Now';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#141414;border-radius:16px;overflow:hidden;border:1px solid #2A2A2A;">
        <tr><td style="background:#00FF87;padding:6px 32px;">
          <p style="margin:0;color:#0A0A0A;font-size:11px;font-weight:800;letter-spacing:3px;">GYMCOACH</p>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <p style="margin:0 0 6px;color:#888;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Package Reminder</p>
          <h1 style="margin:0 0 28px;color:#FFFFFF;font-size:26px;font-weight:800;line-height:1.2;">
            ${isExpired ? `Time to renew,<br>${firstName}.` : `This is it,<br>${firstName}.`}
          </h1>
          ${urgencyLine}
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;border-radius:12px;border:1px solid #2A2A2A;margin-bottom:24px;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 4px;color:#888;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Sessions Remaining</p>
                <p style="margin:0;color:#00FF87;font-size:48px;font-weight:800;line-height:1;">${sessionsRemaining}</p>
              </td>
              <td style="padding:20px 24px;border-left:1px solid #2A2A2A;">
                <p style="margin:0 0 4px;color:#888;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Package</p>
                <p style="margin:0;color:#FFFFFF;font-size:16px;font-weight:700;">${pkgLabel}</p>
                <p style="margin:4px 0 0;color:#888;font-size:13px;">with ${safeCoach}</p>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 28px;color:#AAAAAA;font-size:15px;line-height:1.6;">${bodyLine}</p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#00FF87;border-radius:10px;padding:14px 28px;">
              <a href="mailto:" style="color:#0A0A0A;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">${ctaText}</a>
            </td></tr>
          </table>
          <p style="margin:0;color:#555;font-size:13px;line-height:1.5;">
            Simply reply to this email or message your coach directly to arrange your renewal. Keep the momentum going — you're doing great! 💪
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #2A2A2A;">
          <p style="margin:0;color:#444;font-size:12px;line-height:1.5;">
            You received this automated reminder because you have an active coaching package.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ─── Main handler ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[session-reminder] WEBHOOK_SECRET is not set');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const signature = req.headers.get('x-supabase-signature');
    if (signature !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const payload: WebhookPayload = await req.json();

    if (payload.type !== 'INSERT' || payload.table !== 'workout_sessions') {
      return new Response(JSON.stringify({ skipped: 'not a workout_sessions INSERT' }), { status: 200 });
    }

    const { package_id } = payload.record;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 1. Load package ──────────────────────────────────────
    const { data: pkg, error: pkgErr } = await supabase
      .from('packages')
      .select('id, package_type, sessions_remaining, status, client_id, coach_id')
      .eq('id', package_id)
      .single();

    if (pkgErr || !pkg) {
      console.error('[session-reminder] Package fetch failed:', pkgErr?.message);
      return new Response(JSON.stringify({ error: 'Package not found' }), { status: 200 });
    }

    // ── 2. Determine trigger ─────────────────────────────────
    let triggerType: TriggerType | null = null;
    if (pkg.sessions_remaining === 3) triggerType = '3_remaining';
    if (pkg.sessions_remaining === 2) triggerType = '2_remaining';
    if (pkg.sessions_remaining === 1) triggerType = '1_remaining';
    if (pkg.sessions_remaining === 0) triggerType = '0_remaining';

    if (!triggerType) {
      return new Response(
        JSON.stringify({ skipped: 'no threshold', sessions_remaining: pkg.sessions_remaining }),
        { status: 200 },
      );
    }

    // ── 3. Atomic dedup ──────────────────────────────────────
    const { data: logData, error: logErr } = await supabase
      .from('email_logs')
      .upsert(
        { package_id, trigger_type: triggerType },
        { onConflict: 'package_id,trigger_type', ignoreDuplicates: true },
      )
      .select('id');

    if (logErr) {
      console.error('[session-reminder] email_logs upsert error:', logErr.message);
      return new Response(JSON.stringify({ error: logErr.message }), { status: 200 });
    }

    if (!logData || logData.length === 0) {
      return new Response(
        JSON.stringify({ skipped: 'already sent', trigger: triggerType }),
        { status: 200 },
      );
    }

    // ── 4. Load profiles ─────────────────────────────────────
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', [pkg.client_id, pkg.coach_id]);

    if (profilesErr || !profiles) {
      console.error('[session-reminder] Profiles fetch failed:', profilesErr?.message);
      await supabase.from('email_logs').delete()
        .eq('package_id', package_id).eq('trigger_type', triggerType);
      return new Response(JSON.stringify({ error: 'Profiles not found' }), { status: 200 });
    }

    const client = profiles.find((p) => p.id === pkg.client_id);
    const coach  = profiles.find((p) => p.id === pkg.coach_id);

    if (!client?.email) {
      console.error('[session-reminder] Client email missing for id:', pkg.client_id);
      await supabase.from('email_logs').delete()
        .eq('package_id', package_id).eq('trigger_type', triggerType);
      return new Response(JSON.stringify({ error: 'Client email missing' }), { status: 200 });
    }

    // ── 5. Load push tokens for client + coach ───────────────
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', [pkg.client_id, pkg.coach_id]);

    const tokenMap = new Map<string, string>(
      (tokenRows ?? []).map((t: any) => [t.user_id, t.token]),
    );

    // ── 6. Push + in-app notifications ───────────────────────
    const coachName  = coach?.name  ?? 'Your Coach';
    const clientName = client.name  ?? client.email;

    const clientMsg = clientPushMessage(pkg.sessions_remaining, coachName);
    const coachMsg  = coachPushMessage(pkg.sessions_remaining, clientName);

    await Promise.all([
      sendPushAndInApp(
        supabase,
        pkg.client_id,
        tokenMap.get(pkg.client_id),
        clientMsg.title,
        clientMsg.body,
        { type: 'session_reminder', remaining: String(pkg.sessions_remaining) },
      ),
      sendPushAndInApp(
        supabase,
        pkg.coach_id,
        tokenMap.get(pkg.coach_id),
        coachMsg.title,
        coachMsg.body,
        { type: 'session_reminder', clientId: pkg.client_id, remaining: String(pkg.sessions_remaining) },
      ),
    ]);

    // ── 7. Email to client — only at 1 and 0 remaining ──────
    if (triggerType !== '1_remaining' && triggerType !== '0_remaining') {
      console.log(`[session-reminder] ${triggerType} → push only (no email)`);
      return new Response(
        JSON.stringify({ sent: true, trigger: triggerType, email: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { subject, html } = buildEmail(
      triggerType,
      clientName,
      coachName,
      pkg.package_type,
      pkg.sessions_remaining,
    );

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('[session-reminder] RESEND_API_KEY is not set');
      await supabase.from('email_logs').delete()
        .eq('package_id', package_id).eq('trigger_type', triggerType);
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 200 });
    }

    const fromAddress = Deno.env.get('RESEND_FROM_ADDRESS') ?? 'GymCoach <noreply@example.com>';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:     fromAddress,
        to:       client.email,
        reply_to: coach?.email,
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      await supabase.from('email_logs').delete()
        .eq('package_id', package_id).eq('trigger_type', triggerType);
      console.error('[session-reminder] Resend error:', resendData);
      return new Response(JSON.stringify({ error: resendData.message ?? 'Resend failed' }), { status: 200 });
    }

    console.log(`[session-reminder] ${triggerType} → push+email sent for client ${pkg.client_id}`);

    return new Response(
      JSON.stringify({ sent: true, trigger: triggerType, resend_id: resendData.id, recipient: client.email }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[session-reminder] Unhandled error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 200 });
  }
});
