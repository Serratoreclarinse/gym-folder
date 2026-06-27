/**
 * session-reminder
 *
 * Triggered by a Supabase database webhook on INSERT into workout_sessions.
 * Payload shape: https://supabase.com/docs/guides/database/webhooks#payload
 *
 * Logic:
 *  1. Verify webhook secret (mandatory — rejects if env var is missing)
 *  2. Read the inserted session → get package_id
 *  3. Load the package (sessions_remaining, client_id, coach_id, package_type)
 *     → use pkg.client_id / pkg.coach_id, NOT the payload values, to prevent
 *       an attacker from redirecting emails to arbitrary users
 *  4. Determine which trigger fires (2_remaining | 1_remaining | none)
 *  5. Claim the send slot via upsert + ignoreDuplicates — the UNIQUE constraint
 *     on (package_id, trigger_type) is the atomic dedup guard
 *  6. Load client + coach profiles for personalisation
 *  7. Send the email via Resend
 *  8. On Resend failure, roll back the email_logs row so the next session retries
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

type TriggerType = '2_remaining' | '1_remaining';

const PKG_LABEL: Record<string, string> = {
  '30min': '30-minute',
  '45min': '45-minute',
  '1hr':   '1-hour',
};

// ─── Email HTML builders ──────────────────────────────────────

function buildEmail(
  triggerType: TriggerType,
  clientName: string,
  coachName: string,
  packageType: string,
  sessionsRemaining: number,
): { subject: string; html: string } {
  const pkgLabel    = PKG_LABEL[packageType] ?? packageType;
  const isLastOne   = triggerType === '1_remaining';
  // Sanitise names for HTML context
  const safeName    = clientName.replace(/[<>&"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]!));
  const safeCoach   = coachName.replace(/[<>&"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]!));
  const firstName   = safeName.split(' ')[0];

  const subject = isLastOne
    ? `Last session coming up — renew now!`
    : `You have 2 sessions left — time to renew!`;

  const urgencyLine = isLastOne
    ? `<p style="color:#FF4D4D;font-weight:700;font-size:18px;margin:0 0 16px;">⚠️ This is your LAST session.</p>`
    : `<p style="color:#FFA500;font-weight:700;font-size:18px;margin:0 0 16px;">⏳ You have <strong>2 sessions</strong> remaining.</p>`;

  const bodyLine = isLastOne
    ? `After your next session your current package will be fully used up. Don't lose momentum — reach out to ${safeCoach} <strong>today</strong> to secure your next block of sessions.`
    : `Your ${pkgLabel} coaching package with ${safeCoach} is almost done. Renewing now means zero gap in your training — no lost progress, no scheduling headaches.`;

  const ctaText = isLastOne ? 'Renew My Package Now' : 'Get In Touch to Renew';

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
        <!-- Accent bar -->
        <tr><td style="background:#00FF87;padding:6px 32px;">
          <p style="margin:0;color:#0A0A0A;font-size:11px;font-weight:800;letter-spacing:3px;">GYMCOACH</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 32px 28px;">
          <p style="margin:0 0 6px;color:#888;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Package Reminder</p>
          <h1 style="margin:0 0 28px;color:#FFFFFF;font-size:26px;font-weight:800;line-height:1.2;">
            ${isLastOne ? `This is it,<br>${firstName}.` : `Almost there,<br>${firstName}.`}
          </h1>
          ${urgencyLine}
          <!-- Session counter -->
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
          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#00FF87;border-radius:10px;padding:14px 28px;">
              <a href="mailto:" style="color:#0A0A0A;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">${ctaText}</a>
            </td></tr>
          </table>
          <p style="margin:0;color:#555;font-size:13px;line-height:1.5;">
            Simply reply to this email or message your coach directly to arrange your renewal. Keep the momentum going — you're doing great! 💪
          </p>
        </td></tr>
        <!-- Footer -->
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
    // ── 0. Mandatory webhook secret verification ──────────────
    // Always required — fail hard if not configured so misconfiguration
    // is caught immediately rather than silently accepting open requests.
    const webhookSecret = Deno.env.get('SUPABASE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[session-reminder] SUPABASE_WEBHOOK_SECRET is not set — refusing all requests');
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

    // ── 1. Load + validate package ───────────────────────────
    // Use the DB-verified package row for client_id/coach_id — never trust
    // values from the webhook payload for determining email recipients.
    const { data: pkg, error: pkgErr } = await supabase
      .from('packages')
      .select('id, package_type, sessions_remaining, status, client_id, coach_id')
      .eq('id', package_id)
      .single();

    if (pkgErr || !pkg) {
      console.error('[session-reminder] Package fetch failed:', pkgErr?.message);
      return new Response(JSON.stringify({ error: 'Package not found' }), { status: 200 });
    }

    // ── 2. Determine trigger type ────────────────────────────
    let triggerType: TriggerType | null = null;
    if (pkg.sessions_remaining === 2) triggerType = '2_remaining';
    if (pkg.sessions_remaining === 1) triggerType = '1_remaining';

    if (!triggerType) {
      return new Response(
        JSON.stringify({ skipped: 'no threshold', sessions_remaining: pkg.sessions_remaining }),
        { status: 200 },
      );
    }

    // ── 3. Atomic dedup via upsert + ignoreDuplicates ────────
    // The UNIQUE(package_id, trigger_type) constraint is the real guard.
    // upsert with ignoreDuplicates: true = INSERT ... ON CONFLICT DO NOTHING.
    // If the conflict fires, Supabase returns an empty data array → we skip.
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

    // Empty array → row already existed → duplicate send → skip
    if (!logData || logData.length === 0) {
      return new Response(
        JSON.stringify({ skipped: 'already sent', trigger: triggerType }),
        { status: 200 },
      );
    }

    // ── 4. Load profiles using IDs from the DB-verified pkg row ──
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', [pkg.client_id, pkg.coach_id]);

    if (profilesErr || !profiles) {
      console.error('[session-reminder] Profiles fetch failed:', profilesErr?.message);
      // Roll back the log row so we can retry on the next session
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

    // ── 5. Build + send email ─────────────────────────────────
    const { subject, html } = buildEmail(
      triggerType,
      client.name  ?? client.email,
      coach?.name  ?? 'Your Coach',
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
        from: fromAddress,
        to: client.email,
        reply_to: coach?.email,  // client can reply directly to their coach
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      // Roll back so the next session insert can retry
      await supabase.from('email_logs').delete()
        .eq('package_id', package_id).eq('trigger_type', triggerType);
      console.error('[session-reminder] Resend error:', resendData);
      return new Response(JSON.stringify({ error: resendData.message ?? 'Resend failed' }), { status: 200 });
    }

    console.log(`[session-reminder] Sent ${triggerType} to ${client.email} (id: ${resendData.id})`);

    return new Response(
      JSON.stringify({ sent: true, trigger: triggerType, resend_id: resendData.id, recipient: client.email }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    // Return 200 on all errors — non-2xx triggers Supabase webhook retries,
    // which would cause duplicate sends once the error clears.
    console.error('[session-reminder] Unhandled error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 200 });
  }
});
