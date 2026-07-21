import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useClientData, type ClientPackage } from '@/hooks/useClientData';
import { useClientAnnouncements } from '@/hooks/useClientAnnouncements';
import { useClientBookingRequests } from '@/hooks/useBookingRequests';
import { ErrorBanner } from '@/components/ErrorBanner';
import { MilestonesSection } from '@/components/MilestonesSection';
import { supabase } from '@/lib/supabase';
import { registerPushToken, sendPushNotification } from '@/lib/pushNotifications';
import * as Notifications from 'expo-notifications';
import { Typography } from '@/constants/theme';
import type { ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { HP, rs } from '@/constants/responsive';
import { Ionicons } from '@expo/vector-icons';

// ─── Package type labels ─────────────────────────────────────
const PKG_LABEL: Record<string, string> = {
  '30min': '30-Minute Sessions',
  '45min': '45-Minute Sessions',
  '1hr':   '1-Hour Sessions',
};

function getTypeIcon(c: ColorScheme): Record<string, { name: string; color: string }> {
  return {
    emergency: { name: 'warning-outline',   color: c.danger },
    holiday:   { name: 'calendar-outline',  color: c.success },
    promo:     { name: 'pricetag-outline',  color: '#9C27B0' },
    general:   { name: 'megaphone-outline', color: c.accent },
  };
}

// ─── Package card ────────────────────────────────────────────
function PackageCard({ pkg, styles, colors }: { pkg: ClientPackage; styles: ReturnType<typeof makeStyles>; colors: ColorScheme }) {
  const progressPct = pkg.total_sessions > 0 ? Math.min(pkg.sessions_used / pkg.total_sessions, 1) : 0;

  return (
    <View style={styles.pkgCard}>
      <View style={styles.pkgTop}>
        <View>
          <Text style={styles.pkgLabel}>ACTIVE PACKAGE</Text>
          <Text style={styles.pkgType}>{PKG_LABEL[pkg.package_type] ?? pkg.package_type}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          pkg.sessions_remaining <= 3 && pkg.sessions_remaining > 0 && styles.statusWarning,
          pkg.sessions_remaining === 0 && styles.statusExpired,
        ]}>
          <Text style={[
            styles.statusText,
            pkg.sessions_remaining <= 3 && pkg.sessions_remaining > 0 && styles.statusTextWarning,
            pkg.sessions_remaining === 0 && styles.statusTextExpired,
          ]}>
            {pkg.sessions_remaining} REMAINING
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct * 100}%` as any }]} />
      </View>
      <Text style={styles.progressLabel}>{pkg.sessions_used} of {pkg.total_sessions} sessions used</Text>

      {pkg.duration_weeks && (() => {
        const days = Math.max(0, Math.floor((Date.now() - new Date(pkg.start_date + 'T00:00:00').getTime()) / 86_400_000));
        const currentWeek = Math.min(Math.ceil((days + 1) / 7), pkg.duration_weeks);
        const rate = pkg.total_sessions / pkg.duration_weeks;
        const expected = Math.min(pkg.total_sessions, (days / 7) * rate);
        const onTrack = pkg.sessions_used >= Math.floor(expected);
        const timelinePct = Math.min(currentWeek / pkg.duration_weeks, 1);
        const paceLabel = Number.isInteger(rate) ? `${rate}x/week` : `${Math.floor(rate)}-${Math.ceil(rate)}x/week`;
        return (
          <View style={styles.timeline}>
            <View style={styles.timelineHeader}>
              <Text style={styles.timelineLabel}>SCHEDULE · {paceLabel}</Text>
              <View style={[styles.timelineTrack, !onTrack && styles.timelineTrackBehind]}>
                <Text style={[styles.timelineTrackText, !onTrack && { color: colors.warning }]}>
                  {onTrack ? '✓ On Track' : '⚠ Behind'}
                </Text>
              </View>
            </View>
            <Text style={styles.timelineWeek}>Week {currentWeek} of {pkg.duration_weeks}</Text>
            <View style={styles.timelineBar}>
              <View style={[styles.timelineFill, { width: `${timelinePct * 100}%` as any }]} />
            </View>
          </View>
        );
      })()}
    </View>
  );
}

// ─── Recent session row ──────────────────────────────────────
function RecentSessionRow({
  session, styles, colors,
}: {
  session: { session_date: string; duration_minutes: number; exercises: { exercise_name: string }[]; coach_name: string; status: string | null };
  styles: ReturnType<typeof makeStyles>;
  colors: ColorScheme;
}) {
  const isNoShow = session.status === 'absent';
  const date = new Date(session.session_date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
  const topExercises = session.exercises.slice(0, 2).map((e) => e.exercise_name).join(', ');
  const extra = session.exercises.length > 2 ? ` +${session.exercises.length - 2}` : '';

  return (
    <View style={[styles.recentRow, isNoShow && styles.recentRowNoShow]}>
      <View style={[styles.recentDot, isNoShow && { backgroundColor: colors.warning }]} />
      <View style={styles.recentInfo}>
        <Text style={styles.recentDate}>{date}{!isNoShow && `  ·  ${session.duration_minutes} min`}</Text>
        <Text style={[styles.recentExercises, isNoShow && { color: colors.warning }]} numberOfLines={1}>
          {isNoShow ? 'No-show — 1 session deducted' : (topExercises || 'No exercises recorded') + extra}
        </Text>
      </View>
      {isNoShow
        ? <View style={styles.noShowBadge}><Text style={styles.noShowBadgeText}>NO-SHOW</Text></View>
        : <Text style={styles.recentCoach}>{session.coach_name}</Text>
      }
    </View>
  );
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return 'Starting now!';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// ─── Screen ──────────────────────────────────────────────────
function computeStreak(sessions: { session_date: string; status: string | null }[]): number {
  const attended = sessions.filter(s => s.status !== 'absent');
  if (attended.length === 0) return 0;
  function weekKey(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return d.getUTCFullYear() * 100 + Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
  const weekSet = new Set<number>();
  for (const s of attended) weekSet.add(weekKey(new Date(s.session_date + 'T00:00:00')));
  const now = new Date();
  let check = new Date(now);
  if (!weekSet.has(weekKey(check))) {
    check.setDate(check.getDate() - 7);
    if (!weekSet.has(weekKey(check))) return 0;
  }
  let streak = 0;
  while (weekSet.has(weekKey(check)) && streak < 200) {
    streak++;
    check.setDate(check.getDate() - 7);
  }
  return streak;
}

export default function ClientProgressScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const firstName = profile?.name?.split(' ')[0] ?? 'there';
  const { pkg, sessions, coachInfo, nextScheduled, upcomingScheduled, loading, error, refetch } = useClientData();
  const { announcements } = useClientAnnouncements(pkg?.coach_id ?? null);
  const { requests: bookingRequests, submitRequest, cancelRequest, refetch: refetchRequests } = useClientBookingRequests(
    pkg?.coach_id ?? null,
    pkg?.id ?? null,
  );
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const typeIcon = useMemo(() => getTypeIcon(colors), [colors]);

  const recentSessions = sessions.slice(0, 3);

  // ── Push token registration ─────────────────────────────────
  useEffect(() => {
    if (user?.id) registerPushToken(user.id);
  }, [user?.id]);

  // ── Session reminders (3hr, 30min, 15min before each upcoming session) ───
  useEffect(() => {
    if (!upcomingScheduled.length) return;
    let cancelled = false;
    (async () => {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (cancelled) return;
      for (const s of upcomingScheduled) {
        const sessionDt = new Date(s.scheduled_at);
        const time = sessionDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const reminders = [
          { ms: 3 * 60 * 60 * 1000, title: '📅 Session Reminder',      body: `Hi! Just a heads up — your training session is at ${time} today. See you there! 💪` },
          { ms: 30 * 60 * 1000,      title: '⏰ Almost Time!',           body: `Your session starts in 30 minutes at ${time}. Time to get moving! 🏋️` },
          { ms: 15 * 60 * 1000,      title: '🔔 15 Minutes to Go!',      body: `Your session is starting soon at ${time}. Don't forget to hydrate! 💧` },
        ];
        for (const r of reminders) {
          const fireAt = new Date(sessionDt.getTime() - r.ms);
          if (fireAt > new Date()) {
            await Notifications.scheduleNotificationAsync({
              content: { title: r.title, body: r.body, sound: true },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
            });
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [upcomingScheduled]);

  // ── Strike count ────────────────────────────────────────────
  const [strikeCount, setStrikeCount] = useState(0);
  useEffect(() => {
    if (!user?.id || !pkg?.coach_id) return;
    supabase
      .from('strikes')
      .select('id', { count: 'exact' })
      .eq('client_id', user.id)
      .eq('coach_id', pkg.coach_id)
      .then(({ count }) => setStrikeCount(count ?? 0));
  }, [user?.id, pkg?.coach_id]);

  // ── Active session timer (client sees their live session) ───
  const [clientActiveSession, setClientActiveSession] = useState<{
    start_time: string;
    current_duration: number;
    is_paused: boolean;
    pause_started_at: string | null;
  } | null>(null);
  const [sessionRemainingSecs, setSessionRemainingSecs] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Tracks the start_time of a session we already locally dismissed at 0:00.
  // Prevents re-fetch (useFocusEffect / realtime) from reinstating the banner
  // while the coach hasn't tapped End Session yet.
  const expiredSessionRef = useRef<string | null>(null);

  const fetchActiveSession = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('active_sessions')
      .select('start_time, current_duration, is_paused, pause_started_at')
      .eq('client_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    // If this is the same session we already dismissed at 0:00, don't reinstate it
    if (data && data.start_time === expiredSessionRef.current) return;

    // New session or real end — clear the expired marker
    expiredSessionRef.current = null;
    setClientActiveSession(data ?? null);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchActiveSession(); }, [fetchActiveSession]));

  // Realtime: auto-hide banner when coach ends session
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`client-active-session-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions', filter: `client_id=eq.${user.id}` }, () => fetchActiveSession())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchActiveSession]);

  useEffect(() => {
    if (!clientActiveSession || clientActiveSession.is_paused) return;
    const endMs = new Date(clientActiveSession.start_time).getTime() + clientActiveSession.current_duration * 60_000;
    const tick = () => setSessionRemainingSecs(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [clientActiveSession?.start_time, clientActiveSession?.current_duration, clientActiveSession?.is_paused]);

  // When timer hits 0 (and not paused), dismiss after 10s grace period.
  // Mark the session as expired first so re-fetches don't reinstate the banner.
  useEffect(() => {
    if (sessionRemainingSecs > 0 || !clientActiveSession || clientActiveSession.is_paused) return;
    expiredSessionRef.current = clientActiveSession.start_time;
    const t = setTimeout(() => setClientActiveSession(null), 10_000);
    return () => clearTimeout(t);
  }, [sessionRemainingSecs > 0, !!clientActiveSession, clientActiveSession?.is_paused]);

  useEffect(() => {
    if (!clientActiveSession) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [clientActiveSession]);

  const sessionMins = Math.floor(sessionRemainingSecs / 60);
  const sessionSecs = String(sessionRemainingSecs % 60).padStart(2, '0');

  // ── Booking request modal ────────────────────────────────────
  const [requestModal, setRequestModal] = useState<'booking' | 'renewal' | null>(null);
  const [reqDate, setReqDate] = useState('');
  const [reqTime, setReqTime] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const handleSubmitRequest = async () => {
    if (!requestModal) return;
    setSubmittingRequest(true);
    const { error: reqErr } = await submitRequest({
      type: requestModal,
      preferred_date: reqDate || undefined,
      preferred_time: reqTime || undefined,
      notes: reqNotes || undefined,
    });
    setSubmittingRequest(false);
    if (reqErr) {
      Alert.alert('Error', reqErr);
      return;
    }
    // Notify coach
    if (pkg?.coach_id) {
      await sendPushNotification(pkg.coach_id, {
        title: requestModal === 'renewal' ? '🔄 Package Renewal Request' : '📅 Session Booking Request',
        body: `${profile?.name ?? 'A client'} has sent a ${requestModal === 'renewal' ? 'renewal' : 'booking'} request.`,
      });
    }
    // Notify admin — FYI
    const { data: adminForReq } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
    if (adminForReq?.[0]?.id) {
      await sendPushNotification(adminForReq[0].id, {
        title: requestModal === 'renewal' ? '🔄 Renewal Request' : '📅 Booking Request',
        body: `${profile?.name ?? 'A client'} sent a ${requestModal === 'renewal' ? 'renewal' : 'booking'} request to their coach.`,
        data: { type: 'client_request' },
      });
    }
    setRequestModal(null);
    setReqDate(''); setReqTime(''); setReqNotes('');
    Alert.alert('Sent!', `Your ${requestModal === 'renewal' ? 'renewal' : 'booking'} request has been sent to your coach.`);
  };

  // ── Countdown timer ─────────────────────────────────────────
  const [secondsUntil, setSecondsUntil] = useState<number>(0);
  const [confirming, setConfirming] = useState(false);
  const [localConfirmed, setLocalConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [requestingReschedule, setRequestingReschedule] = useState<string | null>(null);
  const [acceptingReschedule, setAcceptingReschedule] = useState<string | null>(null);
  const [decliningReschedule, setDecliningReschedule] = useState<string | null>(null);

  useEffect(() => {
    setLocalConfirmed(false);
    if (!nextScheduled) { setSecondsUntil(0); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(nextScheduled.scheduled_at).getTime() - Date.now()) / 1000));
      setSecondsUntil(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [nextScheduled?.scheduled_at]);

  const handleAcceptReschedule = async (sessionId: string) => {
    setAcceptingReschedule(sessionId);
    const { data, error: err } = await supabase.rpc('client_accept_reschedule', { p_session_id: sessionId });
    setAcceptingReschedule(null);
    if (!err && data === 'ok') {
      setLocalConfirmed(false);
      refetch();
    } else {
      Alert.alert('Error', 'Could not accept reschedule. Please try again.');
    }
  };

  const handleDeclineReschedule = async (sessionId: string) => {
    setDecliningReschedule(sessionId);
    const { data, error: err } = await supabase.rpc('client_decline_reschedule', { p_session_id: sessionId });
    setDecliningReschedule(null);
    if (!err && data === 'ok') {
      refetch();
    } else {
      Alert.alert('Error', 'Could not decline reschedule. Please try again.');
    }
  };

  const handleConfirm = async () => {
    if (!nextScheduled || confirming) return;
    setConfirming(true);
    const { error: err } = await supabase.rpc('client_confirm_session', { p_session_id: nextScheduled.id });
    if (!err) {
      setLocalConfirmed(true);
      refetch();
      if (pkg?.coach_id) {
        const dateStr = new Date(nextScheduled.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = new Date(nextScheduled.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        await sendPushNotification(pkg.coach_id, {
          title: '✅ Session Confirmed',
          body: `${profile?.name ?? 'Your client'} confirmed attendance for ${dateStr} at ${timeStr}.`,
          data: { type: 'session_confirmed', session_id: nextScheduled.id },
        });
      }
    } else {
      Alert.alert('Error', 'Could not confirm. Please try again.');
    }
    setConfirming(false);
  };

  const handleCancel = (id: string) => {
    if (cancelling) return;
    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel this session?',
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Cancel Session', style: 'destructive',
          onPress: async () => {
            setCancelling(id);
            const { data, error: err } = await supabase.rpc('client_cancel_session', { p_session_id: id });
            setCancelling(null);
            if (err) {
              Alert.alert('Error', 'Could not cancel. Please try again.');
            } else if (data === 'too_late') {
              Alert.alert('Too Late', 'Sessions can only be cancelled more than 3 hours before they start.');
            } else {
              refetch();
            }
          },
        },
      ],
    );
  };

  const formatScheduled = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      + ' at '
      + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Let's go, {firstName} 💪</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {error && <ErrorBanner message={error} onRetry={refetch} />}


      {/* Active session banner */}
      {clientActiveSession && (
        <View style={styles.activeSessionBanner}>
          <Animated.View style={[styles.activePulseDot, { opacity: pulseAnim }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeSessionTitle}>SESSION IN PROGRESS</Text>
            <Text style={styles.activeSessionTime}>
              {clientActiveSession.is_paused
                ? 'Paused'
                : `${sessionMins}:${sessionSecs} remaining`}
            </Text>
          </View>
          {coachInfo && (
            <Text style={styles.activeSessionCoach}>{coachInfo.name}</Text>
          )}
        </View>
      )}

      {/* Strike warning */}
      {strikeCount > 0 && (
        <View style={styles.strikeBanner}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} />
          <Text style={styles.strikeBannerText}>
            {strikeCount} of 3 strike{strikeCount !== 1 ? 's' : ''} — 3 strikes deducts 1 session
          </Text>
        </View>
      )}

      {/* Quick actions */}
      {pkg && coachInfo && (
        <View style={styles.quickActions}>
          <Pressable style={styles.quickBtn} onPress={() => setRequestModal('booking')}>
            <Ionicons name="calendar-outline" size={16} color={colors.accent} />
            <Text style={styles.quickBtnText}>Request Session</Text>
          </Pressable>
          {(pkg.sessions_remaining <= 3) && (
            <Pressable style={[styles.quickBtn, styles.quickBtnRenew]} onPress={() => setRequestModal('renewal')}>
              <Ionicons name="refresh-outline" size={16} color={colors.success} />
              <Text style={[styles.quickBtnText, { color: colors.success }]}>Renew Package</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Pending requests (recent) */}
      {bookingRequests.filter((r) => r.status === 'pending').length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.pendingRequestBanner, pressed && { opacity: 0.75 }]}
          onPress={() => setShowPendingModal(true)}
        >
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.pendingRequestText, { flex: 1 }]}>
            {bookingRequests.filter((r) => r.status === 'pending').length} request
            {bookingRequests.filter((r) => r.status === 'pending').length !== 1 ? 's' : ''} pending — waiting for coach
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </Pressable>
      )}

      {/* Booking request modal */}
      <Modal visible={requestModal !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHandle} />
            <Text style={styles.modalSheetTitle}>
              {requestModal === 'renewal' ? 'Request Package Renewal' : 'Request a Session'}
            </Text>

            <Text style={styles.reqLabel}>PREFERRED DATE</Text>
            <TextInput
              style={styles.reqInput}
              value={reqDate}
              onChangeText={setReqDate}
              placeholder="e.g. July 5, 2025 (optional)"
              placeholderTextColor={colors.textSecondary + '60'}
            />

            <Text style={styles.reqLabel}>PREFERRED TIME</Text>
            <TextInput
              style={styles.reqInput}
              value={reqTime}
              onChangeText={setReqTime}
              placeholder="e.g. 9:00 AM (optional)"
              placeholderTextColor={colors.textSecondary + '60'}
            />

            <Text style={styles.reqLabel}>NOTES</Text>
            <TextInput
              style={[styles.reqInput, { height: 72, textAlignVertical: 'top' }]}
              value={reqNotes}
              onChangeText={setReqNotes}
              placeholder={requestModal === 'renewal' ? 'Preferred package type or anything else…' : 'Anything specific you want to work on?'}
              placeholderTextColor={colors.textSecondary + '60'}
              multiline
            />

            <Pressable
              style={[styles.reqSubmitBtn, submittingRequest && { opacity: 0.5 }]}
              onPress={handleSubmitRequest}
              disabled={submittingRequest}
            >
              <Text style={styles.reqSubmitBtnText}>
                {submittingRequest ? 'Sending…' : 'Send Request to Coach'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.reqCancelBtn}
              onPress={() => { setRequestModal(null); setReqDate(''); setReqTime(''); setReqNotes(''); }}
            >
              <Text style={styles.reqCancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Pending requests modal */}
      <Modal visible={showPendingModal} transparent animationType="slide" onRequestClose={() => setShowPendingModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setShowPendingModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHandle} />
            <Text style={styles.modalSheetTitle}>Pending Requests</Text>
            {bookingRequests.filter((r) => r.status === 'pending').map((r) => (
              <View key={r.id} style={styles.pendingReqRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingReqType}>
                    {r.type === 'renewal' ? 'Package Renewal' : 'Session Booking'}
                  </Text>
                  {r.preferred_date ? (
                    <Text style={styles.pendingReqMeta}>Date: {r.preferred_date}{r.preferred_time ? ` at ${r.preferred_time}` : ''}</Text>
                  ) : null}
                  {r.notes ? <Text style={styles.pendingReqMeta} numberOfLines={2}>{r.notes}</Text> : null}
                  <Text style={styles.pendingReqDate}>
                    Sent {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.pendingReqCancelBtn, (cancellingId === r.id || pressed) && { opacity: 0.5 }]}
                  disabled={cancellingId === r.id}
                  onPress={async () => {
                    setCancellingId(r.id);
                    const { error } = await cancelRequest(r.id);
                    setCancellingId(null);
                    if (error) Alert.alert('Error', error);
                    if (bookingRequests.filter((x) => x.status === 'pending').length <= 1) setShowPendingModal(false);
                  }}
                >
                  <Text style={styles.pendingReqCancelText}>
                    {cancellingId === r.id ? '…' : 'Cancel'}
                  </Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.reqCancelBtn} onPress={() => setShowPendingModal(false)}>
              <Text style={styles.reqCancelBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Next scheduled session */}
      {nextScheduled && (
        <View style={styles.nextCard}>
          {/* Header row */}
          <View style={styles.nextCardTop}>
            <View style={styles.nextIcon}>
              <Ionicons name="calendar" size={18} color={colors.accent} />
            </View>
            <Text style={styles.nextLabel}>NEXT SESSION</Text>
          </View>

          {/* Date + Time prominent display */}
          <View style={styles.nextDateBlock}>
            <Text style={styles.nextDateText}>
              {new Date(nextScheduled.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Text style={styles.nextTimeText}>
              {new Date(nextScheduled.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>

          {/* Big countdown */}
          <View style={styles.countdownRow}>
            <Ionicons name="timer-outline" size={16} color={colors.accent} />
            <Text style={styles.countdownText}>{formatCountdown(secondsUntil)}</Text>
          </View>

          {nextScheduled.notes ? (
            <Text style={styles.nextNotes}>{nextScheduled.notes}</Text>
          ) : null}

          {/* Reschedule pending UI */}
          {nextScheduled.status === 'reschedule_pending' ? (
            <View style={styles.reschedulePending}>
              <View style={styles.rescheduleHeader}>
                <Ionicons name="calendar-outline" size={14} color={colors.warning} />
                <Text style={styles.rescheduleHeaderText}>Coach Proposed a New Time</Text>
              </View>
              <Text style={styles.rescheduleFrom}>
                Original: {formatScheduled(nextScheduled.scheduled_at)}
              </Text>
              <Text style={styles.rescheduleTo}>
                New: {formatScheduled(nextScheduled.reschedule_proposed_at!)}
              </Text>
              {nextScheduled.reschedule_reason ? (
                <Text style={styles.rescheduleReason}>Reason: {nextScheduled.reschedule_reason}</Text>
              ) : null}
              <View style={styles.rescheduleActions}>
                <Pressable
                  style={[styles.rescheduleAcceptBtn, acceptingReschedule === nextScheduled.id && { opacity: 0.5 }]}
                  onPress={() => handleAcceptReschedule(nextScheduled.id)}
                  disabled={!!acceptingReschedule || !!decliningReschedule}
                >
                  <Ionicons name="checkmark" size={14} color={colors.bg} />
                  <Text style={styles.rescheduleAcceptText}>
                    {acceptingReschedule === nextScheduled.id ? 'Accepting…' : 'Accept'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.rescheduleDeclineBtn, decliningReschedule === nextScheduled.id && { opacity: 0.5 }]}
                  onPress={() => handleDeclineReschedule(nextScheduled.id)}
                  disabled={!!acceptingReschedule || !!decliningReschedule}
                >
                  <Ionicons name="close" size={14} color={colors.danger} />
                  <Text style={styles.rescheduleDeclineText}>
                    {decliningReschedule === nextScheduled.id ? 'Declining…' : 'Decline'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {/* Confirm attendance */}
              {(nextScheduled.client_confirmed_at || localConfirmed) ? (
                <View style={styles.confirmedBadge}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                  <Text style={styles.confirmedText}>Attendance Confirmed</Text>
                </View>
              ) : (
                <Pressable
                  style={[styles.confirmBtn, confirming && { opacity: 0.5 }]}
                  onPress={handleConfirm}
                  disabled={confirming}
                >
                  <Ionicons name="checkmark" size={15} color={colors.bg} />
                  <Text style={styles.confirmBtnText}>{confirming ? 'Confirming…' : 'Confirm Attendance'}</Text>
                </Pressable>
              )}

              {/* Reschedule button */}
              {secondsUntil > 14400 ? (
                <Pressable
                  style={[styles.cancelBtn, requestingReschedule === nextScheduled.id && { opacity: 0.5 }]}
                  onPress={() => {
                    Alert.alert(
                      'Request Reschedule',
                      'Send your coach a request to move this session to a different time?',
                      [
                        { text: 'No', style: 'cancel' },
                        {
                          text: 'Request', onPress: async () => {
                            setRequestingReschedule(nextScheduled.id);
                            const dateStr = new Date(nextScheduled.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                            const timeStr = new Date(nextScheduled.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            if (pkg?.coach_id) {
                              await sendPushNotification(pkg.coach_id, {
                                title: '🔄 Reschedule Request',
                                body: `${profile?.name ?? 'Your client'} wants to reschedule their session on ${dateStr} at ${timeStr}.`,
                                data: { type: 'reschedule_request', session_id: nextScheduled.id },
                              });
                            }
                            setRequestingReschedule(null);
                            Alert.alert('Sent!', 'Your coach has been notified and will reach out with a new time.');
                          },
                        },
                      ]
                    );
                  }}
                  disabled={requestingReschedule === nextScheduled.id}
                >
                  <Ionicons name="refresh-outline" size={15} color={colors.accent} />
                  <Text style={styles.cancelBtnText}>
                    {requestingReschedule === nextScheduled.id ? 'Sending…' : 'Request Reschedule'}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.cancelBtnLocked}>
                  <Ionicons name="lock-closed-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.cancelBtnLockedText}>Cannot reschedule — less than 4 hrs away</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Additional upcoming sessions */}
      {upcomingScheduled.length > 1 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>UPCOMING SESSIONS</Text>
          {upcomingScheduled.slice(1).map((s) => {
            const secsUntil = Math.max(0, Math.floor((new Date(s.scheduled_at).getTime() - Date.now()) / 1000));
            const canCancel = secsUntil > 14400;
            const isConfirmed = !!s.client_confirmed_at;
            return (
              <View key={s.id} style={styles.upcomingCard}>
                <View style={styles.upcomingCardHeader}>
                  <View style={styles.upcomingIcon}>
                    <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingDate}>{formatScheduled(s.scheduled_at)}</Text>
                    <Text style={styles.upcomingMeta}>{s.duration_minutes} min</Text>
                    {s.status === 'reschedule_pending' && s.reschedule_proposed_at ? (
                      <Text style={styles.upcomingRescheduledTo}>
                        → New: {formatScheduled(s.reschedule_proposed_at)}
                      </Text>
                    ) : null}
                  </View>
                  {s.status === 'reschedule_pending' ? (
                    <View style={styles.rescheduleBadge}>
                      <Text style={styles.rescheduleBadgeText}>RESCHEDULED</Text>
                    </View>
                  ) : isConfirmed ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  ) : null}
                </View>
                <View style={styles.upcomingActions}>
                  {s.status === 'reschedule_pending' ? (
                    <>
                      <Pressable
                        style={[styles.upcomingConfirmBtn, acceptingReschedule === s.id && { opacity: 0.5 }]}
                        onPress={() => handleAcceptReschedule(s.id)}
                        disabled={!!acceptingReschedule || !!decliningReschedule}
                      >
                        <Ionicons name="checkmark" size={13} color={colors.bg} />
                        <Text style={styles.upcomingConfirmBtnText}>
                          {acceptingReschedule === s.id ? 'Accepting…' : 'Accept Reschedule'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.upcomingCancelBtn, decliningReschedule === s.id && { opacity: 0.5 }]}
                        onPress={() => handleDeclineReschedule(s.id)}
                        disabled={!!acceptingReschedule || !!decliningReschedule}
                      >
                        <Ionicons name="close" size={13} color={colors.accent} />
                        <Text style={styles.upcomingCancelBtnText}>
                          {decliningReschedule === s.id ? 'Declining…' : 'Decline'}
                        </Text>
                      </Pressable>
                    </>
                  ) : !isConfirmed ? (
                    <Pressable
                      style={styles.upcomingConfirmBtn}
                      onPress={async () => {
                        const { error: err } = await supabase.rpc('client_confirm_session', { p_session_id: s.id });
                        if (!err) refetch();
                        else Alert.alert('Error', 'Could not confirm.');
                      }}
                    >
                      <Ionicons name="checkmark" size={13} color={colors.bg} />
                      <Text style={styles.upcomingConfirmBtnText}>Confirm</Text>
                    </Pressable>
                  ) : null}
                  {s.status !== 'reschedule_pending' && (canCancel ? (
                    <Pressable
                      style={[styles.upcomingCancelBtn, requestingReschedule === s.id && { opacity: 0.5 }]}
                      onPress={() => {
                        Alert.alert(
                          'Request Reschedule',
                          'Send your coach a request to move this session to a different time?',
                          [
                            { text: 'No', style: 'cancel' },
                            {
                              text: 'Request', onPress: async () => {
                                setRequestingReschedule(s.id);
                                const dateStr = new Date(s.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                const timeStr = new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                if (pkg?.coach_id) {
                                  await sendPushNotification(pkg.coach_id, {
                                    title: '🔄 Reschedule Request',
                                    body: `${profile?.name ?? 'Your client'} wants to reschedule their session on ${dateStr} at ${timeStr}.`,
                                    data: { type: 'reschedule_request', session_id: s.id },
                                  });
                                }
                                setRequestingReschedule(null);
                                Alert.alert('Sent!', 'Your coach has been notified and will reach out with a new time.');
                              },
                            },
                          ],
                        );
                      }}
                      disabled={requestingReschedule === s.id}
                    >
                      <Ionicons name="refresh-outline" size={13} color={colors.accent} />
                      <Text style={styles.upcomingCancelBtnText}>
                        {requestingReschedule === s.id ? 'Sending…' : 'Request Reschedule'}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.upcomingLockedCancel}>
                      <Ionicons name="lock-closed-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.upcomingLockedText}>Too late to reschedule</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* Coach announcements */}
      {announcements.length > 0 && announcements.slice(0, 2).map((ann) => {
        const icon = typeIcon[ann.type] ?? typeIcon.general;
        return (
          <View
            key={ann.id}
            style={[
              styles.annBanner,
              ann.type === 'emergency' && styles.annBannerEmergency,
            ]}
          >
            <Ionicons name={icon.name as any} size={16} color={icon.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.annTitle, { color: icon.color }]}>{ann.title}</Text>
              <Text style={styles.annMsg} numberOfLines={2}>{ann.message}</Text>
            </View>
            {ann.is_pinned && (
              <Ionicons name="pin" size={12} color={icon.color} style={{ opacity: 0.7 }} />
            )}
          </View>
        );
      })}

      {/* Package status */}
      <Text style={styles.sectionTitle}>MY PACKAGE</Text>
      {!loading && !pkg ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cube-outline" size={32} color={colors.border} />
          <Text style={styles.emptyText}>No package assigned yet</Text>
          <Text style={styles.emptySub}>Your coach will set up your package</Text>
        </View>
      ) : pkg ? (
        <PackageCard pkg={pkg} styles={styles} colors={colors} />
      ) : null}

      {/* Attendance streak */}
      {(() => {
        const streak = computeStreak(sessions);
        if (streak === 0) return null;
        return (
          <View style={styles.streakCard}>
            <Text style={styles.streakFlame}>🔥</Text>
            <View style={styles.streakInfo}>
              <Text style={styles.streakNum}>{streak}</Text>
              <Text style={styles.streakLabel}>week streak</Text>
            </View>
            <Text style={styles.streakSub}>
              {streak >= 4 ? 'Unstoppable!' : streak >= 2 ? 'Keep it up!' : 'Great start!'}
            </Text>
          </View>
        );
      })()}

      {/* Milestones */}
      {profile?.id && (
        <View style={{ marginTop: 24, marginBottom: 16 }}>
          <MilestonesSection clientId={profile.id} />
        </View>
      )}

      {/* Recent workouts */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>RECENT WORKOUTS</Text>
      {!loading && recentSessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="barbell-outline" size={32} color={colors.border} />
          <Text style={styles.emptyText}>No sessions logged yet</Text>
        </View>
      ) : (
        <View style={styles.recentCard}>
          {recentSessions.map((s, i) => (
            <View key={s.id}>
              <RecentSessionRow session={s} styles={styles} colors={colors} />
              {i < recentSessions.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
          {sessions.length > 3 && (
            <Pressable
              onPress={() => router.push('/(client)/session-history')}
              style={styles.viewAllBtn}
            >
              <Text style={styles.viewAllBtnText}>View all {sessions.length} sessions →</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Coach contact shortcut */}
      {coachInfo && (coachInfo.phone || coachInfo.whatsapp) && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>MY COACH</Text>
          <View style={styles.coachCard}>
            <View style={styles.coachAvatar}>
              <Text style={styles.coachInitials}>
                {coachInfo.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coachName}>{coachInfo.name}</Text>
              <Text style={styles.coachSub}>Your personal trainer</Text>
            </View>
            <View style={styles.coachActions}>
              {coachInfo.whatsapp && (
                <Pressable
                  style={styles.coachActionBtn}
                  onPress={() => Linking.openURL(`whatsapp://send?phone=${coachInfo.whatsapp!.replace(/\D/g, '')}`)}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                </Pressable>
              )}
              {coachInfo.phone && (
                <Pressable
                  style={styles.coachActionBtn}
                  onPress={() => Linking.openURL(`tel:${coachInfo.phone}`)}
                >
                  <Ionicons name="call-outline" size={20} color={colors.accent} />
                </Pressable>
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll:   { flex: 1, backgroundColor: c.bg },
    content:  { padding: HP, paddingBottom: rs(48) },

    header:   { marginBottom: 20 },
    greeting: { ...Typography.title, color: c.textPrimary, marginBottom: 4 },
    date:     { ...Typography.body, color: c.textSecondary },

    sectionTitle: { ...Typography.label, color: c.textSecondary, marginBottom: 14 },

    streakCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#FF6B3514',
      borderRadius: 14, borderWidth: 1, borderColor: '#FF6B3530',
      paddingVertical: 14, paddingHorizontal: 16,
      marginTop: 10, gap: 12,
    },
    streakFlame: { fontSize: 28 },
    streakInfo: { alignItems: 'center', minWidth: 44 },
    streakNum: { ...Typography.title, color: '#FF6B35', fontWeight: '800', lineHeight: 30 },
    streakLabel: { ...Typography.label, color: '#FF6B35', fontSize: 10, opacity: 0.8 },
    streakSub: { ...Typography.body, color: c.textSecondary, flex: 1, textAlign: 'right' },

    // Next session card
    nextCard: {
      backgroundColor: c.accent + '12',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.accent + '40',
      gap: 12,
    },
    nextCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    nextIcon: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.accent + '20',
      justifyContent: 'center', alignItems: 'center',
      flexShrink: 0,
    },
    nextLabel: { ...Typography.label, color: c.accent, fontSize: 11, flex: 1 },
    nextDateBlock: { gap: 2 },
    nextDateText: { ...Typography.body, color: c.textPrimary, fontWeight: '700', fontSize: 15 },
    nextTimeText: { fontSize: 26, fontWeight: '800', color: c.accent, letterSpacing: 0.5 },
    nextDate:  { ...Typography.body, color: c.textPrimary, fontWeight: '700' },
    nextNotes: { ...Typography.caption, color: c.textSecondary },

    // Countdown
    countdownRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.accent + '18', borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
      alignSelf: 'stretch',
    },
    countdownText: { ...Typography.label, color: c.accent, fontWeight: '800', fontSize: 16, flex: 1 },

    // Confirm
    confirmBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: c.accent, borderRadius: 10, paddingVertical: 10,
    },
    confirmBtnText: { color: c.bg, fontWeight: '800', fontSize: 14 },
    confirmedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.success + '15', borderRadius: 10, paddingVertical: 10,
      justifyContent: 'center', borderWidth: 1, borderColor: c.success + '40',
    },
    confirmedText: { color: c.success, fontWeight: '700', fontSize: 14 },

    // Announcement banner
    annBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: c.accent + '10',
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.accent + '30',
    },
    annBannerEmergency: {
      backgroundColor: c.danger + '12',
      borderColor: c.danger + '40',
    },
    annTitle: { ...Typography.caption, fontWeight: '700', marginBottom: 2 },
    annMsg:   { ...Typography.caption, color: c.textSecondary, lineHeight: 17 },

    // Package card
    pkgCard: { backgroundColor: c.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: c.accent + '30', marginBottom: 4 },
    pkgTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    pkgLabel: { ...Typography.label, color: c.accent, marginBottom: 4 },
    pkgType: { ...Typography.subtitle, color: c.textPrimary },
    statusBadge: { backgroundColor: c.accent + '18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: c.accent + '40' },
    statusWarning: { backgroundColor: c.warning + '18', borderColor: c.warning + '50' },
    statusExpired: { backgroundColor: c.border + '80', borderColor: c.border },
    statusText: { fontSize: 12, fontWeight: '700', color: c.accent },
    statusTextWarning: { color: c.warning },
    statusTextExpired: { color: c.textSecondary },
    progressTrack: { height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', backgroundColor: c.accent, borderRadius: 3 },
    progressLabel: { ...Typography.caption, color: c.textSecondary, marginBottom: 10 },

    timeline: {
      borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14,
    },
    timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    timelineLabel: { ...Typography.label, color: c.textSecondary, fontSize: 10 },
    timelineTrack: {
      backgroundColor: c.success + '15', borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1, borderColor: c.success + '40',
    },
    timelineTrackBehind: { backgroundColor: c.warning + '15', borderColor: c.warning + '40' },
    timelineTrackText: { fontSize: 11, fontWeight: '700', color: c.success },
    timelineWeek: { ...Typography.caption, color: c.textSecondary, marginBottom: 8 },
    timelineBar: { height: 4, backgroundColor: c.border, borderRadius: 2, overflow: 'hidden' },
    timelineFill: { height: '100%', backgroundColor: c.success, borderRadius: 2 },

    // Recent sessions
    recentCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    recentRowNoShow: { backgroundColor: c.warning + '08' },
    recentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent },
    noShowBadge: {
      backgroundColor: c.warning + '20',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: c.warning + '50',
    },
    noShowBadgeText: { color: c.warning, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    recentInfo: { flex: 1 },
    recentDate: { ...Typography.caption, color: c.textSecondary, marginBottom: 2 },
    recentExercises: { ...Typography.body, color: c.textPrimary, fontWeight: '500' },
    recentCoach: { ...Typography.caption, color: c.textSecondary },
    rowDivider: { height: 1, backgroundColor: c.border, marginLeft: 35 },
    viewAllHint: {
      ...Typography.caption,
      color: c.textSecondary,
      textAlign: 'center',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    viewAllBtn: {
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    viewAllBtnText: {
      ...Typography.caption,
      color: c.accent,
      fontWeight: '700',
    },

    // Coach card
    coachCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    coachAvatar: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: c.accent + '18',
      borderWidth: 1.5, borderColor: c.accent + '40',
      justifyContent: 'center', alignItems: 'center',
    },
    coachInitials: { fontSize: 16, fontWeight: '800', color: c.accent },
    coachName: { ...Typography.body, color: c.textPrimary, fontWeight: '700', marginBottom: 2 },
    coachSub:  { ...Typography.caption, color: c.textSecondary },
    coachActions: { flexDirection: 'row', gap: 8 },
    coachActionBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.bg,
      borderWidth: 1, borderColor: c.border,
      justifyContent: 'center', alignItems: 'center',
    },

    // Active session banner
    activeSessionBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.accent + '12', borderRadius: 14, padding: 14, marginBottom: 12,
      borderWidth: 1, borderColor: c.accent + '35',
    },
    activePulseDot: {
      width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent,
    },
    activeSessionTitle: {
      fontSize: 11, fontWeight: '800', letterSpacing: 1, color: c.accent,
    },
    activeSessionTime: {
      fontSize: 22, fontWeight: '700', color: c.textPrimary, marginTop: 2,
      fontVariant: ['tabular-nums'] as any,
    },
    activeSessionCoach: {
      fontSize: 12, color: c.textSecondary, fontWeight: '500',
    },

    // Strike warning
    strikeBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.warning + '12', borderRadius: 10, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: c.warning + '40',
    },
    strikeBannerText: { color: c.warning, fontSize: 13, fontWeight: '600', flex: 1 },

    // Quick actions
    quickActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    quickBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      borderRadius: 12, paddingVertical: 10,
      borderWidth: 1, borderColor: c.accent + '50',
      backgroundColor: c.accent + '08',
    },
    quickBtnRenew: { borderColor: c.success + '50', backgroundColor: c.success + '08' },
    quickBtnText: { color: c.accent, fontWeight: '700', fontSize: 13 },

    // Pending requests banner
    pendingRequestBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      backgroundColor: c.surface, borderRadius: 10, padding: 10, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    pendingRequestText: { color: c.textSecondary, fontSize: 12, fontWeight: '500' },
    pendingReqRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    pendingReqType: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    pendingReqMeta: { ...Typography.caption, color: c.textSecondary, marginBottom: 1 },
    pendingReqDate: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic', marginTop: 2 },
    pendingReqCancelBtn: {
      backgroundColor: c.danger + '20', borderWidth: 1, borderColor: c.danger + '50',
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
    },
    pendingReqCancelText: { color: c.danger, fontSize: 12, fontWeight: '700' },

    // Booking request modal (bottom sheet)
    modalOverlay: {
      flex: 1, backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40,
      borderWidth: 1, borderColor: c.border,
    },
    modalSheetHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: 20,
    },
    modalSheetTitle: {
      ...Typography.subtitle, color: c.textPrimary,
      fontWeight: '700', marginBottom: 20,
    },
    reqLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 6, marginTop: 14 },
    reqInput: {
      backgroundColor: c.bg, borderRadius: 12, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 14, paddingVertical: 12, color: c.textPrimary, fontSize: 15,
    },
    reqSubmitBtn: {
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 15,
      alignItems: 'center', marginTop: 20,
    },
    reqSubmitBtnText: { color: c.bg, fontWeight: '800', fontSize: 16 },
    reqCancelBtn: { paddingVertical: 12, alignItems: 'center' },
    reqCancelBtnText: { color: c.textSecondary, fontSize: 14 },

    // Cancel button (next session card)
    cancelBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      borderRadius: 10, paddingVertical: 8,
      borderWidth: 1, borderColor: c.accent + '50',
    },
    cancelBtnText: { color: c.accent, fontWeight: '700', fontSize: 13 },
    cancelBtnLocked: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      borderRadius: 10, paddingVertical: 8,
      borderWidth: 1, borderColor: c.border,
    },
    cancelBtnLockedText: { color: c.textSecondary, fontSize: 12, fontWeight: '500' },

    // Upcoming sessions
    upcomingCard: {
      backgroundColor: c.surface,
      borderRadius: 14, padding: 14,
      marginBottom: 10,
      borderWidth: 1, borderColor: c.border,
      gap: 12,
    },
    upcomingCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    upcomingIcon: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.border,
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    upcomingDate: { ...Typography.body, color: c.textPrimary, fontWeight: '600', fontSize: 13 },
    upcomingMeta: { ...Typography.caption, color: c.textSecondary, marginTop: 1 },
    upcomingActions: { flexDirection: 'row', gap: 8 },
    upcomingConfirmBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      backgroundColor: c.accent, borderRadius: 9, paddingVertical: 8,
    },
    upcomingConfirmBtnText: { color: c.bg, fontWeight: '700', fontSize: 13 },
    upcomingCancelBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      borderRadius: 9, paddingVertical: 8,
      borderWidth: 1, borderColor: c.accent + '50',
    },
    upcomingCancelBtnText: { color: c.accent, fontWeight: '700', fontSize: 13 },
    upcomingLockedCancel: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      borderRadius: 9, paddingVertical: 8,
      borderWidth: 1, borderColor: c.border,
    },
    upcomingLockedText: { color: c.textSecondary, fontSize: 12, fontWeight: '500' },
    upcomingRescheduledTo: { fontSize: 12, color: c.warning, fontWeight: '600', marginTop: 2 },

    // Reschedule pending
    rescheduleBadge: {
      backgroundColor: c.warning + '18', borderRadius: 6, borderWidth: 1,
      borderColor: c.warning + '50', paddingHorizontal: 7, paddingVertical: 3,
    },
    rescheduleBadgeText: { fontSize: 10, fontWeight: '700', color: c.warning },
    reschedulePending: {
      backgroundColor: c.warning + '10', borderRadius: 12, borderWidth: 1,
      borderColor: c.warning + '40', padding: 12, marginTop: 8, gap: 4,
    },
    rescheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    rescheduleHeaderText: { fontSize: 13, fontWeight: '700', color: c.warning },
    rescheduleFrom: { fontSize: 12, color: c.textSecondary },
    rescheduleTo: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
    rescheduleReason: { fontSize: 12, color: c.textSecondary, fontStyle: 'italic', marginTop: 2 },
    rescheduleActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    rescheduleAcceptBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 5, backgroundColor: c.accent, borderRadius: 10, paddingVertical: 10,
    },
    rescheduleAcceptText: { color: c.bg, fontSize: 13, fontWeight: '700' },
    rescheduleDeclineBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 5, backgroundColor: c.danger + '18', borderRadius: 10, paddingVertical: 10,
      borderWidth: 1, borderColor: c.danger + '40',
    },
    rescheduleDeclineText: { color: c.danger, fontSize: 13, fontWeight: '700' },

    // Empty states
    emptyCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 32,
      alignItems: 'center',
      gap: 8,
    },
    emptyText: { ...Typography.body, color: c.textPrimary, marginTop: 8 },
    emptySub:  { ...Typography.caption, color: c.textSecondary },
  });
}
