import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/context/AuthContext';
import { useClients, type ClientWithPackage } from '@/hooks/useClients';
import { useSessions } from '@/hooks/useSessions';
import { useStrikeAlerts } from '@/hooks/useStrikeAlerts';
import { useWaitlist } from '@/hooks/useWaitlist';
import { useCoachBookingRequests } from '@/hooks/useBookingRequests';
import { getDaysUntilBirthday } from '@/hooks/useBirthdays';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushNotifications';
import { useActiveSessionContext } from '@/context/ActiveSessionContext';
import { ActiveSessionCard } from '@/components/ActiveSessionCard';
import { NextSessionCard } from '@/components/NextSessionCard';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { HP, rs } from '@/constants/responsive';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const MAX_STRIKES = 3;

const AVATAR_COLORS = [
  '#E8001D', '#4CAF50', '#9C27B0', '#FF9800',
  '#00BCD4', '#F44336', '#2196F3', '#FF5722',
  '#8BC34A', '#E91E63', '#FFC107', '#795548',
];

function ClientPickerModal({
  visible, clients, onClose, onSelect,
}: {
  visible: boolean;
  clients: ClientWithPackage[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ps.container}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={ps.sheet}>
          <View style={ps.handle} />
          <View style={ps.sheetHead}>
            <Text style={ps.sheetTitle}>MY CLIENTS</Text>
            <View style={ps.sheetBadge}>
              <Text style={ps.sheetBadgeText}>{clients.length}</Text>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            {clients.map((c, i) => {
              const initials = c.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const pkg = c.activePackage;
              const isActive = pkg?.status === 'active';
              const isExpired = pkg?.status === 'expired';
              const isLow = isActive && (pkg?.sessions_remaining ?? 0) <= 3;
              const statusColor = isExpired ? '#E8001D' : isLow ? '#FF9800' : '#4CAF50';
              const statusLabel = isExpired
                ? 'EXPIRED'
                : isActive
                ? `${pkg!.sessions_remaining} session${pkg!.sessions_remaining !== 1 ? 's' : ''} left`
                : 'No package';
              return (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [ps.row, pressed && { opacity: 0.65 }]}
                  onPress={() => onSelect(c.id)}
                >
                  <View style={[ps.avatar, { backgroundColor: color + '20', borderColor: color + '55' }]}>
                    <Text style={[ps.avatarText, { color }]}>{initials}</Text>
                  </View>
                  <View style={ps.rowInfo}>
                    <Text style={ps.rowName} numberOfLines={1}>{c.name}</Text>
                    <View style={ps.rowStatusRow}>
                      <View style={[ps.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[ps.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#444" />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


export default function CoachDashboard() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const firstName = profile?.name?.split(' ')[0] ?? 'Coach';
  const { clients, loading: cLoading, error: cError, refetch: refetchClients } = useClients();
  const { sessions, loading: sLoading, error: sError, refetch: refetchSessions } = useSessions();
  const { alerts: strikeAlerts, refetch: refetchStrikes } = useStrikeAlerts();
  const { totalCount: waitlistCount, refetch: refetchWaitlist } = useWaitlist(profile?.id);
  const { requests: bookingRequests, refetch: refetchBookingReqs, respond: respondToRequest } = useCoachBookingRequests();
  const { pinnedAnnouncement, togglePin } = useAnnouncements();
  const { activeSession, nextSession, extendSession, endSession, cancelSession, refetch: refetchTimer } = useActiveSessionContext();
  const [pausedWorkout, setPausedWorkout] = useState<any | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [incomingTransfers, setIncomingTransfers] = useState<{
    id: string; client_name: string; from_coach_id: string; from_coach_name: string;
    package_type: string; sessions_remaining: number; notes: string | null;
  }[]>([]);

  const fetchIncomingTransfers = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('client_transfers')
      .select(`
        id, notes, from_coach_id,
        client:profiles!client_transfers_client_id_fkey(name),
        from_coach:profiles!client_transfers_from_coach_id_fkey(name),
        package:packages!client_transfers_package_id_fkey(package_type, sessions_remaining)
      `)
      .eq('status', 'pending_coach')
      .eq('to_coach_id', profile.id);
    setIncomingTransfers(
      (data ?? []).map((row: any) => ({
        id: row.id,
        from_coach_id: row.from_coach_id,
        client_name: row.client?.name ?? '—',
        from_coach_name: row.from_coach?.name ?? '—',
        package_type: row.package?.package_type ?? '—',
        sessions_remaining: row.package?.sessions_remaining ?? 0,
        notes: row.notes,
      })),
    );
  }, [profile?.id]);

  const handleAcceptTransfer = async (transferId: string) => {
    const t = incomingTransfers.find((x) => x.id === transferId);
    const { error } = await supabase.rpc('coach_accept_transfer', { p_transfer_id: transferId });
    if (error) { Alert.alert('Error', error.message); return; }
    if (t?.from_coach_id) {
      await sendPushNotification(t.from_coach_id, {
        title: '✅ Transfer Accepted',
        body: `${profile?.name ?? 'The new coach'} accepted the transfer of ${t.client_name}.`,
      });
    }
    fetchIncomingTransfers();
    refetchClients();
    Alert.alert('Transfer Accepted', 'The client is now in your roster.');
  };

  const handleRejectTransfer = (transferId: string) => {
    const t = incomingTransfers.find((x) => x.id === transferId);
    Alert.alert('Reject Transfer', 'Decline this client transfer request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('coach_reject_transfer', { p_transfer_id: transferId });
          if (error) { Alert.alert('Error', error.message); return; }
          if (t?.from_coach_id) {
            await sendPushNotification(t.from_coach_id, {
              title: '❌ Transfer Declined',
              body: `${profile?.name ?? 'The coach'} declined the transfer of ${t.client_name}.`,
            });
          }
          fetchIncomingTransfers();
        },
      },
    ]);
  };

  const refreshing = cLoading || sLoading;
  const onRefresh = () => { refetchClients(); refetchSessions(); refetchStrikes(); refetchWaitlist(); refetchTimer(); refetchBookingReqs(); fetchIncomingTransfers(); };

  useFocusEffect(useCallback(() => {
    refetchClients(); refetchSessions(); refetchStrikes(); refetchWaitlist(); refetchTimer(); refetchBookingReqs(); fetchIncomingTransfers();
    AsyncStorage.getItem('@elevat3/paused_workout').then((data) => {
      if (data) {
        const w = JSON.parse(data);
        if (Date.now() - w.savedAt < 24 * 60 * 60 * 1000) {
          setPausedWorkout(w);
        } else {
          AsyncStorage.removeItem('@elevat3/paused_workout');
          setPausedWorkout(null);
        }
      } else {
        setPausedWorkout(null);
      }
    });
  }, []));

  // fire a local notification once per calendar day for today's client birthdays
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (notifiedRef.current || cLoading) return;
    notifiedRef.current = true;
    (async () => {
      const todayKey = `bdnotif_${new Date().toISOString().slice(0, 10)}`;
      const done = await AsyncStorage.getItem(todayKey);
      if (done) return;
      const todayBdays = clients.filter((c) => c.birthday != null && getDaysUntilBirthday(c.birthday) === 0);
      if (todayBdays.length === 0) return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      for (const c of todayBdays) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🎂 Birthday Today!',
            body: `Today is ${c.name}'s birthday! Don't forget to send a greeting 🎉`,
          },
          trigger: null,
        });
      }
      await AsyncStorage.setItem(todayKey, '1');
    })();
  }, [cLoading]);

  const activeClients = clients.filter((c) => c.activePackage?.status === 'active').length;
  const packageAlertClients = clients.filter(
    (c) => c.activePackage && c.activePackage.sessions_remaining <= 3,
  );

  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => s.session_date === today).length;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSessions = sessions.filter((s) => new Date(s.session_date) >= weekAgo).length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
    <View style={styles.fixedTop}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <Pressable style={styles.addBtn} onPress={() => setShowPicker(true)}>
            <Ionicons name="menu-outline" size={22} color={colors.accent} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>Hi Coach, {firstName} 👊</Text>
            <Text style={styles.date} numberOfLines={1}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/(coach)/exercise-library' as any)}>
            <Ionicons name="library-outline" size={18} color={colors.accent} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/(coach)/announcements' as any)}>
            <Ionicons name="megaphone-outline" size={18} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      {(cError || sError) && (
        <ErrorBanner message={cError ?? sError!} onRetry={onRefresh} />
      )}

      {/* Compact stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeClients}</Text>
          <Text style={styles.statLabel}>Clients</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{todaySessions}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{weekSessions}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>
    </View>

      {/* Quick actions */}
      <Pressable
        style={({ pressed }) => [styles.logSessionBtn, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/(coach)/log-session')}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.bg} />
        <Text style={styles.logSessionText}>LOG SESSION</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.emergencyBtn, pressed && { opacity: 0.8 }]}
        onPress={() => router.push({ pathname: '/(coach)/announcements', params: { preset: 'emergency' } } as any)}
      >
        <Ionicons name="warning-outline" size={16} color={colors.danger} />
        <Text style={styles.emergencyBtnText}>EMERGENCY NOTICE</Text>
      </Pressable>

      {/* Resume paused workout */}
      {pausedWorkout && (
        <Pressable
          style={({ pressed }) => [styles.resumeCard, pressed && { opacity: 0.8 }]}
          onPress={() => router.push({
            pathname: '/(coach)/guided-workout',
            params: {
              exercises: JSON.stringify(pausedWorkout.exercises),
              clientId: pausedWorkout.clientId,
              pkgId: pausedWorkout.pkgId,
              coachId: pausedWorkout.coachId,
              sessionDate: pausedWorkout.sessionDate,
              durationMinutes: pausedWorkout.durationMinutes,
              sessionNotes: pausedWorkout.sessionNotes ?? '',
              clientName: pausedWorkout.clientName,
              resume: 'true',
            },
          } as any)}
        >
          <View style={styles.resumeIcon}>
            <Ionicons name="play-circle" size={28} color="#4CAF50" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.resumeTitle}>RESUME WORKOUT</Text>
            <Text style={styles.resumeSub}>
              {pausedWorkout.clientName} · Exercise {pausedWorkout.exIdx + 1} of {pausedWorkout.exercises?.length ?? '?'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      )}

      {/* Active session timer */}
      {activeSession && (
        <ActiveSessionCard
          activeSession={activeSession}
          nextSession={nextSession}
          onExtend={extendSession}
          onEnd={async () => {
            const result = await endSession();
            if (!result.error) refetchTimer();
            return result;
          }}
          onCancel={async () => {
            const result = await cancelSession();
            if (!result.error) refetchTimer();
            return result;
          }}
        />
      )}

      {/* Next scheduled session */}
      {nextSession && (
        <NextSessionCard nextSession={nextSession} />
      )}

      {/* Pinned announcement banner */}
      {pinnedAnnouncement && (
        <View style={[
          styles.pinnedBanner,
          pinnedAnnouncement.type === 'emergency' && styles.pinnedBannerEmergency,
        ]}>
          <Ionicons
            name={pinnedAnnouncement.type === 'emergency' ? 'warning-outline' : 'megaphone-outline'}
            size={16}
            color={pinnedAnnouncement.type === 'emergency' ? colors.danger : colors.accent}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.pinnedTitle, pinnedAnnouncement.type === 'emergency' && { color: colors.danger }]}>
              {pinnedAnnouncement.title}
            </Text>
            <Text style={styles.pinnedMsg} numberOfLines={1}>{pinnedAnnouncement.message}</Text>
          </View>
          <Pressable onPress={() => togglePin(pinnedAnnouncement.id, true)} hitSlop={10}>
            <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Incoming Transfers */}
      {incomingTransfers.length > 0 && (
        <>
          <View style={styles.strikeSectionHeader}>
            <Text style={styles.sectionTitle}>INCOMING TRANSFERS</Text>
            <View style={[styles.strikeBadge, { backgroundColor: '#9C27B020', borderColor: '#9C27B060' }]}>
              <Text style={[styles.strikeBadgeText, { color: '#9C27B0' }]}>{incomingTransfers.length}</Text>
            </View>
          </View>
          {incomingTransfers.map((t) => {
            const initials = t.client_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
            return (
              <View key={t.id} style={styles.reqCard}>
                <View style={styles.reqCardTop}>
                  <View style={[styles.reqTypeBadge, { borderColor: '#9C27B050', backgroundColor: '#9C27B015' }]}>
                    <Ionicons name="swap-horizontal-outline" size={13} color="#9C27B0" />
                    <Text style={[styles.reqTypeText, { color: '#9C27B0' }]}>Transfer</Text>
                  </View>
                  <Text style={styles.reqClientName}>{t.client_name}</Text>
                </View>
                <Text style={styles.reqDateTime}>
                  From {t.from_coach_name} · {t.package_type} · {t.sessions_remaining} sessions
                </Text>
                {t.notes ? <Text style={styles.reqNotes}>{t.notes}</Text> : null}
                <View style={styles.reqActions}>
                  <Pressable style={styles.reqDeclineBtn} onPress={() => handleRejectTransfer(t.id)}>
                    <Text style={styles.reqDeclineBtnText}>Decline</Text>
                  </Pressable>
                  <Pressable style={styles.reqAcceptBtn} onPress={() => handleAcceptTransfer(t.id)}>
                    <Text style={styles.reqAcceptBtnText}>Accept</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* Client Requests */}
      {bookingRequests.length > 0 && (
        <>
          <View style={styles.strikeSectionHeader}>
            <Text style={styles.sectionTitle}>CLIENT REQUESTS</Text>
            <View style={[styles.strikeBadge, { backgroundColor: colors.accent + '20', borderColor: colors.accent + '50' }]}>
              <Text style={[styles.strikeBadgeText, { color: colors.accent }]}>{bookingRequests.length}</Text>
            </View>
          </View>
          {bookingRequests.map((req) => (
            <View key={req.id} style={styles.reqCard}>
              <View style={styles.reqCardTop}>
                <View style={[styles.reqTypeBadge, req.type === 'renewal' && styles.reqTypeBadgeRenew]}>
                  <Ionicons
                    name={req.type === 'renewal' ? 'refresh-outline' : 'calendar-outline'}
                    size={13}
                    color={req.type === 'renewal' ? '#4CAF50' : colors.accent}
                  />
                  <Text style={[styles.reqTypeText, req.type === 'renewal' && { color: '#4CAF50' }]}>
                    {req.type === 'renewal' ? 'Renewal' : 'Booking'}
                  </Text>
                </View>
                <Text style={styles.reqClientName}>{req.client_name}</Text>
              </View>
              {(req.preferred_date || req.preferred_time) && (
                <Text style={styles.reqDateTime}>
                  {[req.preferred_date, req.preferred_time].filter(Boolean).join(' · ')}
                </Text>
              )}
              {req.notes && <Text style={styles.reqNotes}>{req.notes}</Text>}
              <View style={styles.reqActions}>
                <Pressable style={styles.reqDeclineBtn} onPress={() => respondToRequest(req.id, 'declined')}>
                  <Text style={styles.reqDeclineBtnText}>Decline</Text>
                </Pressable>
                <Pressable style={styles.reqAcceptBtn} onPress={() => respondToRequest(req.id, 'accepted')}>
                  <Text style={styles.reqAcceptBtnText}>Accept</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Strike Alerts */}
      {strikeAlerts.length > 0 && (
        <>
          <View style={styles.strikeSectionHeader}>
            <Text style={styles.sectionTitle}>STRIKE ALERTS</Text>
            <View style={styles.strikeBadge}>
              <Text style={styles.strikeBadgeText}>{strikeAlerts.length}</Text>
            </View>
          </View>
          {strikeAlerts.map((alert) => {
            const isMax = alert.strike_count >= MAX_STRIKES;
            const color = isMax ? colors.danger : '#FFA500';
            const initials = alert.client_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
            const latestDate = new Date(alert.latest_strike_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <Pressable
                key={alert.client_id}
                style={({ pressed }) => [styles.strikeAlertCard, { borderColor: color + '50' }, pressed && { opacity: 0.75 }]}
                onPress={() => router.push(`/(coach)/client/${alert.client_id}`)}
              >
                <View style={[styles.strikeAvatar, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                  <Text style={[styles.strikeAvatarText, { color }]}>{initials}</Text>
                </View>
                <View style={styles.strikeAlertInfo}>
                  <Text style={styles.strikeAlertName}>{alert.client_name}</Text>
                  <Text style={styles.strikeAlertDate}>Last strike: {latestDate}</Text>
                </View>
                <View style={[styles.strikeCountBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                  {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                    <View key={i} style={[styles.strikePip, { backgroundColor: i < alert.strike_count ? color : colors.border }]} />
                  ))}
                  <Text style={[styles.strikeCountText, { color }]}>{alert.strike_count}/{MAX_STRIKES}</Text>
                </View>
              </Pressable>
            );
          })}
          <View style={{ height: 8 }} />
        </>
      )}

      {/* Package Alerts */}
      {packageAlertClients.length > 0 && (
        <>
          <View style={styles.strikeSectionHeader}>
            <Text style={styles.sectionTitle}>PACKAGE ALERTS</Text>
            <View style={[styles.strikeBadge, { backgroundColor: '#FF980020', borderColor: '#FF980060' }]}>
              <Text style={[styles.strikeBadgeText, { color: '#FF9800' }]}>{packageAlertClients.length}</Text>
            </View>
          </View>
          {packageAlertClients.map((c) => {
            const isExpired = c.activePackage!.sessions_remaining === 0;
            const color = isExpired ? colors.danger : '#FF9800';
            const initials = c.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
            return (
              <Pressable
                key={c.id}
                style={({ pressed }) => [styles.strikeAlertCard, { borderColor: color + '50' }, pressed && { opacity: 0.75 }]}
                onPress={() => router.push(`/(coach)/client/${c.id}`)}
              >
                <View style={[styles.strikeAvatar, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                  <Text style={[styles.strikeAvatarText, { color }]}>{initials}</Text>
                </View>
                <View style={styles.strikeAlertInfo}>
                  <Text style={styles.strikeAlertName}>{c.name}</Text>
                  <Text style={[styles.strikeAlertDate, { color }]}>
                    {isExpired ? 'Package expired — tap to renew' : `${c.activePackage!.sessions_remaining} session${c.activePackage!.sessions_remaining !== 1 ? 's' : ''} remaining`}
                  </Text>
                </View>
                <View style={[styles.pkgAlertBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                  <Text style={[styles.pkgAlertBadgeText, { color }]}>
                    {isExpired ? 'EXPIRED' : `${c.activePackage!.sessions_remaining} LEFT`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <View style={{ height: 8 }} />
        </>
      )}

      {/* Waitlist notice */}
      {waitlistCount > 0 && (
        <Pressable style={styles.waitlistNotice} onPress={() => router.push('/(coach)/(tabs)/calendar')}>
          <Ionicons name="people-outline" size={16} color={colors.accent} />
          <Text style={styles.waitlistNoticeText}>
            {waitlistCount} client{waitlistCount !== 1 ? 's' : ''} on waitlist — check Calendar for open slots
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </Pressable>
      )}
    <ClientPickerModal
      visible={showPicker}
      clients={clients}
      onClose={() => setShowPicker(false)}
      onSelect={(id) => { setShowPicker(false); router.push(`/(coach)/client/${id}` as any); }}
    />
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    resumeCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: '#4CAF5015', borderWidth: 1.5, borderColor: '#4CAF5050',
      borderRadius: 16, padding: 14, marginBottom: 10,
    },
    resumeIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    resumeTitle: { color: '#4CAF50', fontWeight: '800', fontSize: 13, letterSpacing: 0.5, marginBottom: 3 },
    resumeSub: { color: c.textSecondary, fontSize: 13 },

    fixedTop: {
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      marginBottom: 4,
    },
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: HP, paddingBottom: rs(40) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(12) },
    greeting: { ...Typography.title, color: c.textPrimary, marginBottom: 4 },
    date: { ...Typography.body, color: c.textSecondary },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.accent + '15',
      borderWidth: 1,
      borderColor: c.accent + '40',
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.accent + '15',
      borderWidth: 1,
      borderColor: c.accent + '40',
      justifyContent: 'center',
      alignItems: 'center',
    },
    statsStrip: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 1, borderColor: c.border,
      marginBottom: rs(16), paddingVertical: 16,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { ...Typography.title, color: c.textPrimary, fontSize: 22, fontWeight: '800' },
    statLabel: { ...Typography.caption, color: c.textSecondary, marginTop: 2 },
    statDiv: { width: 1, height: 32, backgroundColor: c.border },
    logSessionBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16,
      marginTop: 12, marginBottom: 12,
    },
    logSessionText: { color: c.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
    sectionTitle: { ...Typography.label, color: c.textSecondary },
    strikeSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    strikeBadge: {
      backgroundColor: c.danger + '20',
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: c.danger + '50',
    },
    strikeBadgeText: { color: c.danger, fontSize: 11, fontWeight: '800' },
    strikeAlertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
    },
    strikeAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    strikeAvatarText: { fontSize: 14, fontWeight: '800' },
    strikeAlertInfo: { flex: 1 },
    strikeAlertName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    strikeAlertDate: { ...Typography.caption, color: c.textSecondary },
    strikeCountBadge: {
      alignItems: 'center',
      gap: 6,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
    },
    strikePip: { width: 7, height: 7, borderRadius: 4 },
    strikeCountText: { fontSize: 11, fontWeight: '800' },
    pkgAlertBadge: {
      borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
      borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    pkgAlertBadgeText: { fontSize: 11, fontWeight: '800' },
    waitlistNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.accent + '12',
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: c.accent + '35',
    },
    waitlistNoticeText: { ...Typography.caption, color: c.accent, flex: 1 },

    // Booking request cards
    reqCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: c.border, gap: 8,
    },
    reqCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reqTypeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
      backgroundColor: c.accent + '18', borderWidth: 1, borderColor: c.accent + '40',
    },
    reqTypeBadgeRenew: { backgroundColor: '#4CAF5018', borderColor: '#4CAF5040' },
    reqTypeText: { fontSize: 12, fontWeight: '700', color: c.accent },
    reqClientName: { ...Typography.body, color: c.textPrimary, fontWeight: '700', flex: 1 },
    reqDateTime: { ...Typography.caption, color: c.textSecondary },
    reqNotes: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic' },
    reqActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    reqDeclineBtn: {
      flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
      borderWidth: 1, borderColor: c.border,
    },
    reqDeclineBtnText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
    reqAcceptBtn: {
      flex: 2, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
      backgroundColor: c.accent,
    },
    reqAcceptBtnText: { color: c.bg, fontWeight: '800', fontSize: 13 },
    // Emergency button
    emergencyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
      backgroundColor: c.danger + '15', borderRadius: 14, paddingVertical: 13, marginBottom: 20,
      borderWidth: 1, borderColor: c.danger + '50',
    },
    emergencyBtnText: { color: c.danger, fontSize: 13, fontWeight: '800', letterSpacing: 1 },

    // Pinned announcement banner
    pinnedBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.accent + '12', borderRadius: 12, padding: 12, marginBottom: 16,
      borderWidth: 1, borderColor: c.accent + '35',
    },
    pinnedBannerEmergency: {
      backgroundColor: c.danger + '10', borderColor: c.danger + '40',
    },
    pinnedTitle: { ...Typography.caption, color: c.accent, fontWeight: '700', marginBottom: 1 },
    pinnedMsg: { ...Typography.caption, color: c.textSecondary },
  });
}

const ps = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32, maxHeight: '70%',
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: '#2A2A2A',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#444', alignSelf: 'center', marginVertical: 12,
  },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A', marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 12, fontWeight: '800', letterSpacing: 1.5,
    color: '#888', flex: 1,
  },
  sheetBadge: {
    backgroundColor: '#E8001D20', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: '#E8001D40',
  },
  sheetBadgeText: { color: '#E8001D', fontSize: 11, fontWeight: '800' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#242424',
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, flexShrink: 0,
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  rowInfo: { flex: 1 },
  rowName: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  rowStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
});
