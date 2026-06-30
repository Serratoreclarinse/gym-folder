import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useClientData, type ClientPackage } from '@/hooks/useClientData';
import { useClientAnnouncements } from '@/hooks/useClientAnnouncements';
import { useClientBookingRequests } from '@/hooks/useBookingRequests';
import { ErrorBanner } from '@/components/ErrorBanner';
import { supabase } from '@/lib/supabase';
import { registerPushToken, sendPushNotification } from '@/lib/pushNotifications';
import { Colors, Typography } from '@/constants/theme';
import { HP, rs } from '@/constants/responsive';
import { Ionicons } from '@expo/vector-icons';

// ─── Package type labels ─────────────────────────────────────
const PKG_LABEL: Record<string, string> = {
  '30min': '30-Minute Sessions',
  '45min': '45-Minute Sessions',
  '1hr':   '1-Hour Sessions',
};

const TYPE_ICON: Record<string, { name: string; color: string }> = {
  emergency: { name: 'warning-outline',   color: '#FF4D4D' },
  holiday:   { name: 'calendar-outline',  color: '#4CAF50' },
  promo:     { name: 'pricetag-outline',  color: '#9C27B0' },
  general:   { name: 'megaphone-outline', color: Colors.accent },
};

// ─── Status helpers ──────────────────────────────────────────
function packageColor(pkg: ClientPackage): string {
  if (pkg.status === 'expired')        return Colors.textSecondary;
  if (pkg.sessions_remaining <= 3)     return '#FFA500';
  return Colors.accent;
}

function packageStatusLabel(pkg: ClientPackage): string {
  if (pkg.status === 'expired')        return 'EXPIRED';
  if (pkg.sessions_remaining === 0)    return 'ALL DONE';
  if (pkg.sessions_remaining <= 3)     return 'ALMOST OUT';
  return 'ACTIVE';
}

// ─── Package card ────────────────────────────────────────────
function PackageCard({ pkg }: { pkg: ClientPackage }) {
  const color       = packageColor(pkg);
  const pct         = pkg.total_sessions > 0 ? pkg.sessions_used / pkg.total_sessions : 0;
  const statusLabel = packageStatusLabel(pkg);
  const segments    = Math.min(pkg.total_sessions, 20);
  const filledSegs  = Math.round(pct * segments);

  return (
    <View style={[styles.pkgCard, { borderColor: color + '40' }]}>
      <View style={styles.pkgTop}>
        <Text style={styles.pkgType}>{PKG_LABEL[pkg.package_type] ?? pkg.package_type}</Text>
        <View style={[styles.statusPill, { backgroundColor: color + '18', borderColor: color + '50' }]}>
          <Text style={[styles.statusText, { color }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.heroRow}>
        <Text style={[styles.heroNumber, { color }]}>{pkg.sessions_remaining}</Text>
        <Text style={styles.heroLabel}>sessions{'\n'}remaining</Text>
      </View>

      <View style={styles.segmentRow}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < filledSegs ? color : Colors.border },
              { width: `${(1 / segments) * 100 - 1.5}%` },
            ]}
          />
        ))}
      </View>

      <View style={styles.statsRow}>
        <Stat label="TOTAL"     value={String(pkg.total_sessions)} />
        <View style={styles.statDivider} />
        <Stat label="USED"      value={String(pkg.sessions_used)} color={color} />
        <View style={styles.statDivider} />
        <Stat label="REMAINING" value={String(pkg.sessions_remaining)} color={color} />
      </View>

      <Text style={styles.startDate}>
        Package started{' '}
        {new Date(pkg.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </Text>

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
                <Text style={[styles.timelineTrackText, !onTrack && { color: '#FFA500' }]}>
                  {onTrack ? '✓ On Track' : '⚠ Behind'}
                </Text>
              </View>
            </View>
            <Text style={styles.timelineWeek}>Week {currentWeek} of {pkg.duration_weeks}</Text>
            <View style={styles.timelineBar}>
              <View style={[styles.timelineFill, { width: `${timelinePct * 100}%` }]} />
            </View>
          </View>
        );
      })()}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Recent session row ──────────────────────────────────────
function RecentSessionRow({
  session,
}: {
  session: { session_date: string; duration_minutes: number; exercises: { exercise_name: string }[]; coach_name: string; status: string | null };
}) {
  const isNoShow = session.status === 'absent';
  const date = new Date(session.session_date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
  const topExercises = session.exercises.slice(0, 2).map((e) => e.exercise_name).join(', ');
  const extra = session.exercises.length > 2 ? ` +${session.exercises.length - 2}` : '';

  return (
    <View style={[styles.recentRow, isNoShow && styles.recentRowNoShow]}>
      <View style={[styles.recentDot, isNoShow && { backgroundColor: '#FFA500' }]} />
      <View style={styles.recentInfo}>
        <Text style={styles.recentDate}>{date}{!isNoShow && `  ·  ${session.duration_minutes} min`}</Text>
        <Text style={[styles.recentExercises, isNoShow && { color: '#FFA500' }]} numberOfLines={1}>
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
export default function ClientProgressScreen() {
  const { profile, user } = useAuth();
  const firstName = profile?.name?.split(' ')[0] ?? 'there';
  const { pkg, sessions, coachInfo, nextScheduled, upcomingScheduled, loading, error, refetch } = useClientData();
  const { announcements } = useClientAnnouncements(pkg?.coach_id ?? null);
  const { requests: bookingRequests, submitRequest, refetch: refetchRequests } = useClientBookingRequests(
    pkg?.coach_id ?? null,
    pkg?.id ?? null,
  );

  const recentSessions = sessions.slice(0, 3);

  // ── Push token registration ─────────────────────────────────
  useEffect(() => {
    if (user?.id) registerPushToken(user.id);
  }, [user?.id]);

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
    setRequestModal(null);
    setReqDate(''); setReqTime(''); setReqNotes('');
    Alert.alert('Sent!', `Your ${requestModal === 'renewal' ? 'renewal' : 'booking'} request has been sent to your coach.`);
  };

  // ── Countdown timer ─────────────────────────────────────────
  const [secondsUntil, setSecondsUntil] = useState<number>(0);
  const [confirming, setConfirming] = useState(false);
  const [localConfirmed, setLocalConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

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

  const handleConfirm = async () => {
    if (!nextScheduled || confirming) return;
    setConfirming(true);
    const { error: err } = await supabase.rpc('client_confirm_session', { p_session_id: nextScheduled.id });
    if (!err) {
      setLocalConfirmed(true);
      refetch();
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
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Let's go, {firstName} 💪</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Strike warning */}
      {strikeCount > 0 && (
        <View style={styles.strikeBanner}>
          <Ionicons name="warning-outline" size={16} color="#FFA500" />
          <Text style={styles.strikeBannerText}>
            {strikeCount} of 3 strike{strikeCount !== 1 ? 's' : ''} — 3 strikes deducts 1 session
          </Text>
        </View>
      )}

      {/* Quick actions */}
      {pkg && coachInfo && (
        <View style={styles.quickActions}>
          <Pressable style={styles.quickBtn} onPress={() => setRequestModal('booking')}>
            <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
            <Text style={styles.quickBtnText}>Request Session</Text>
          </Pressable>
          {(pkg.sessions_remaining <= 3) && (
            <Pressable style={[styles.quickBtn, styles.quickBtnRenew]} onPress={() => setRequestModal('renewal')}>
              <Ionicons name="refresh-outline" size={16} color="#4CAF50" />
              <Text style={[styles.quickBtnText, { color: '#4CAF50' }]}>Renew Package</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Pending requests (recent) */}
      {bookingRequests.filter((r) => r.status === 'pending').length > 0 && (
        <View style={styles.pendingRequestBanner}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.pendingRequestText}>
            {bookingRequests.filter((r) => r.status === 'pending').length} request
            {bookingRequests.filter((r) => r.status === 'pending').length !== 1 ? 's' : ''} pending — waiting for coach
          </Text>
        </View>
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
              placeholderTextColor={Colors.textSecondary + '60'}
            />

            <Text style={styles.reqLabel}>PREFERRED TIME</Text>
            <TextInput
              style={styles.reqInput}
              value={reqTime}
              onChangeText={setReqTime}
              placeholder="e.g. 9:00 AM (optional)"
              placeholderTextColor={Colors.textSecondary + '60'}
            />

            <Text style={styles.reqLabel}>NOTES</Text>
            <TextInput
              style={[styles.reqInput, { height: 72, textAlignVertical: 'top' }]}
              value={reqNotes}
              onChangeText={setReqNotes}
              placeholder={requestModal === 'renewal' ? 'Preferred package type or anything else…' : 'Anything specific you want to work on?'}
              placeholderTextColor={Colors.textSecondary + '60'}
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

      {/* Next scheduled session */}
      {nextScheduled && (
        <View style={styles.nextCard}>
          <View style={styles.nextCardTop}>
            <View style={styles.nextIcon}>
              <Ionicons name="calendar" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextLabel}>NEXT SESSION</Text>
              <Text style={styles.nextDate}>{formatScheduled(nextScheduled.scheduled_at)}</Text>
              {nextScheduled.notes ? (
                <Text style={styles.nextNotes}>{nextScheduled.notes}</Text>
              ) : null}
            </View>
          </View>

          {/* Live countdown */}
          <View style={styles.countdownRow}>
            <Ionicons name="time-outline" size={13} color={Colors.accent} />
            <Text style={styles.countdownText}>{formatCountdown(secondsUntil)}</Text>
          </View>

          {/* Confirm attendance */}
          {(nextScheduled.client_confirmed_at || localConfirmed) ? (
            <View style={styles.confirmedBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#4CAF50" />
              <Text style={styles.confirmedText}>Attendance Confirmed</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.confirmBtn, confirming && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={confirming}
            >
              <Ionicons name="checkmark" size={15} color={Colors.bg} />
              <Text style={styles.confirmBtnText}>{confirming ? 'Confirming…' : 'Confirm Attendance'}</Text>
            </Pressable>
          )}

          {/* Cancel button */}
          {secondsUntil > 10800 ? (
            <Pressable
              style={[styles.cancelBtn, cancelling === nextScheduled.id && { opacity: 0.5 }]}
              onPress={() => handleCancel(nextScheduled.id)}
              disabled={cancelling === nextScheduled.id}
            >
              <Ionicons name="close-circle-outline" size={15} color={Colors.accent} />
              <Text style={styles.cancelBtnText}>
                {cancelling === nextScheduled.id ? 'Cancelling…' : 'Cancel Session'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.cancelBtnLocked}>
              <Ionicons name="lock-closed-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.cancelBtnLockedText}>Cannot cancel — less than 3 hrs away</Text>
            </View>
          )}
        </View>
      )}

      {/* Additional upcoming sessions */}
      {upcomingScheduled.length > 1 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 4 }]}>UPCOMING SESSIONS</Text>
          {upcomingScheduled.slice(1).map((s) => {
            const secsUntil = Math.max(0, Math.floor((new Date(s.scheduled_at).getTime() - Date.now()) / 1000));
            const canCancel = secsUntil > 10800;
            const isConfirmed = !!s.client_confirmed_at;
            return (
              <View key={s.id} style={styles.upcomingCard}>
                <View style={styles.upcomingCardHeader}>
                  <View style={styles.upcomingIcon}>
                    <Ionicons name="calendar-outline" size={15} color={Colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingDate}>{formatScheduled(s.scheduled_at)}</Text>
                    <Text style={styles.upcomingMeta}>{s.duration_minutes} min</Text>
                  </View>
                  {isConfirmed && (
                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  )}
                </View>
                <View style={styles.upcomingActions}>
                  {!isConfirmed && (
                    <Pressable
                      style={styles.upcomingConfirmBtn}
                      onPress={async () => {
                        const { error: err } = await supabase.rpc('client_confirm_session', { p_session_id: s.id });
                        if (!err) refetch();
                        else Alert.alert('Error', 'Could not confirm.');
                      }}
                    >
                      <Ionicons name="checkmark" size={13} color={Colors.bg} />
                      <Text style={styles.upcomingConfirmBtnText}>Confirm</Text>
                    </Pressable>
                  )}
                  {canCancel ? (
                    <Pressable
                      style={[styles.upcomingCancelBtn, cancelling === s.id && { opacity: 0.5 }]}
                      onPress={() => handleCancel(s.id)}
                      disabled={cancelling === s.id}
                    >
                      <Ionicons name="close" size={13} color={Colors.accent} />
                      <Text style={styles.upcomingCancelBtnText}>
                        {cancelling === s.id ? 'Cancelling…' : 'Cancel'}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.upcomingLockedCancel}>
                      <Ionicons name="lock-closed-outline" size={12} color={Colors.textSecondary} />
                      <Text style={styles.upcomingLockedText}>Too late to cancel</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* Coach announcements */}
      {announcements.length > 0 && announcements.slice(0, 2).map((ann) => {
        const icon = TYPE_ICON[ann.type] ?? TYPE_ICON.general;
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
          <Ionicons name="cube-outline" size={32} color={Colors.border} />
          <Text style={styles.emptyText}>No package assigned yet</Text>
          <Text style={styles.emptySub}>Your coach will set up your package</Text>
        </View>
      ) : pkg ? (
        <PackageCard pkg={pkg} />
      ) : null}

      {/* Recent workouts */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>RECENT WORKOUTS</Text>
      {!loading && recentSessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="barbell-outline" size={32} color={Colors.border} />
          <Text style={styles.emptyText}>No sessions logged yet</Text>
        </View>
      ) : (
        <View style={styles.recentCard}>
          {recentSessions.map((s, i) => (
            <View key={s.id}>
              <RecentSessionRow session={s} />
              {i < recentSessions.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
          {sessions.length > 3 && (
            <Text style={styles.viewAllHint}>See all {sessions.length} sessions in Workouts tab</Text>
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
                  <Ionicons name="call-outline" size={20} color={Colors.accent} />
                </Pressable>
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: Colors.bg },
  content:  { padding: HP, paddingBottom: rs(48) },

  header:   { marginBottom: 20 },
  greeting: { ...Typography.title, color: Colors.textPrimary, marginBottom: 4 },
  date:     { ...Typography.body, color: Colors.textSecondary },

  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 14 },

  // Next session card
  nextCard: {
    backgroundColor: Colors.accent + '12',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    gap: 12,
  },
  nextCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  nextIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accent + '20',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  nextLabel: { ...Typography.label, color: Colors.accent, fontSize: 10, marginBottom: 3 },
  nextDate:  { ...Typography.body, color: Colors.textPrimary, fontWeight: '700' },
  nextNotes: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3 },

  // Countdown
  countdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  countdownText: { ...Typography.label, color: Colors.accent, fontWeight: '800', fontSize: 13 },

  // Confirm
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 10,
  },
  confirmBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14 },
  confirmedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#4CAF5015', borderRadius: 10, paddingVertical: 10,
    justifyContent: 'center', borderWidth: 1, borderColor: '#4CAF5040',
  },
  confirmedText: { color: '#4CAF50', fontWeight: '700', fontSize: 14 },

  // Announcement banner
  annBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.accent + '10',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  annBannerEmergency: {
    backgroundColor: '#FF4D4D12',
    borderColor: '#FF4D4D40',
  },
  annTitle: { ...Typography.caption, fontWeight: '700', marginBottom: 2 },
  annMsg:   { ...Typography.caption, color: Colors.textSecondary, lineHeight: 17 },

  // Package card
  pkgCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 4,
  },
  pkgTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pkgType: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600', flex: 1, marginRight: 8 },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  heroRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 20 },
  heroNumber: { fontSize: 64, fontWeight: '800', lineHeight: 68, letterSpacing: -2 },
  heroLabel:  { ...Typography.body, color: Colors.textSecondary, marginBottom: 8, lineHeight: 20 },

  segmentRow: { flexDirection: 'row', gap: 3, marginBottom: 20 },
  segment:    { height: 6, borderRadius: 3 },

  statsRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stat:        { flex: 1, alignItems: 'center' },
  statValue:   { ...Typography.subtitle, color: Colors.textPrimary, marginBottom: 2 },
  statLabel:   { ...Typography.label, color: Colors.textSecondary, fontSize: 10 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  startDate: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },

  timeline: {
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14,
  },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  timelineLabel: { ...Typography.label, color: Colors.textSecondary, fontSize: 10 },
  timelineTrack: {
    backgroundColor: '#4CAF5015', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#4CAF5040',
  },
  timelineTrackBehind: { backgroundColor: '#FFA50015', borderColor: '#FFA50040' },
  timelineTrackText: { fontSize: 11, fontWeight: '700', color: '#4CAF50' },
  timelineWeek: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 8 },
  timelineBar: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  timelineFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 2 },

  // Recent sessions
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  recentRowNoShow: { backgroundColor: '#FFA50008' },
  recentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  noShowBadge: {
    backgroundColor: '#FFA50020',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FFA50050',
  },
  noShowBadgeText: { color: '#FFA500', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  recentInfo: { flex: 1 },
  recentDate: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 2 },
  recentExercises: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  recentCoach: { ...Typography.caption, color: Colors.textSecondary },
  rowDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 35 },
  viewAllHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  // Coach card
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coachAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.accent + '18',
    borderWidth: 1.5, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  coachInitials: { fontSize: 16, fontWeight: '800', color: Colors.accent },
  coachName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  coachSub:  { ...Typography.caption, color: Colors.textSecondary },
  coachActions: { flexDirection: 'row', gap: 8 },
  coachActionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },

  // Strike warning
  strikeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFA50012', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#FFA50040',
  },
  strikeBannerText: { color: '#FFA500', fontSize: 13, fontWeight: '600', flex: 1 },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.accent + '50',
    backgroundColor: Colors.accent + '08',
  },
  quickBtnRenew: { borderColor: '#4CAF5050', backgroundColor: '#4CAF5008' },
  quickBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 13 },

  // Pending requests banner
  pendingRequestBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.surface, borderRadius: 10, padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  pendingRequestText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },

  // Booking request modal (bottom sheet)
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20,
  },
  modalSheetTitle: {
    ...Typography.subtitle, color: Colors.textPrimary,
    fontWeight: '700', marginBottom: 20,
  },
  reqLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  reqInput: {
    backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, color: Colors.textPrimary, fontSize: 15,
  },
  reqSubmitBtn: {
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  reqSubmitBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 16 },
  reqCancelBtn: { paddingVertical: 12, alignItems: 'center' },
  reqCancelBtnText: { color: Colors.textSecondary, fontSize: 14 },

  // Cancel button (next session card)
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.accent + '50',
  },
  cancelBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  cancelBtnLocked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderRadius: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnLockedText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },

  // Upcoming sessions
  upcomingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14,
    marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
    gap: 12,
  },
  upcomingCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  upcomingIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  upcomingDate: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  upcomingMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  upcomingActions: { flexDirection: 'row', gap: 8 },
  upcomingConfirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: Colors.accent, borderRadius: 9, paddingVertical: 8,
  },
  upcomingConfirmBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },
  upcomingCancelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderRadius: 9, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.accent + '50',
  },
  upcomingCancelBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  upcomingLockedCancel: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderRadius: 9, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  upcomingLockedText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },

  // Empty states
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { ...Typography.body, color: Colors.textPrimary, marginTop: 8 },
  emptySub:  { ...Typography.caption, color: Colors.textSecondary },
});
