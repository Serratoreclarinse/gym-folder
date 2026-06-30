import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useActiveSessionContext } from '@/context/ActiveSessionContext';
import { ActiveSessionCard } from '@/components/ActiveSessionCard';
import { ImpromptuSessionModal } from '@/components/ImpromptuSessionModal';
import { NoShowModal } from '@/components/NoShowModal';
import { NextSessionCard } from '@/components/NextSessionCard';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Colors, Typography } from '@/constants/theme';
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
              const statusColor = isExpired ? Colors.danger : isLow ? '#FF9800' : '#4CAF50';
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
  const firstName = profile?.name?.split(' ')[0] ?? 'Coach';
  const { clients, loading: cLoading, error: cError, refetch: refetchClients } = useClients();
  const { sessions, loading: sLoading, error: sError, refetch: refetchSessions } = useSessions();
  const { alerts: strikeAlerts, refetch: refetchStrikes } = useStrikeAlerts();
  const { totalCount: waitlistCount, refetch: refetchWaitlist } = useWaitlist(profile?.id);
  const { requests: bookingRequests, refetch: refetchBookingReqs, respond: respondToRequest } = useCoachBookingRequests();
  const { pinnedAnnouncement, togglePin } = useAnnouncements();
  const { activeSession, nextSession, extendSession, endSession, cancelSession, pauseSession, resumeSession, refetch: refetchTimer } = useActiveSessionContext();
  const [impromptuVisible, setImpromptuVisible] = useState(false);
  const [noShowVisible, setNoShowVisible] = useState(false);
  const [pausedWorkout, setPausedWorkout] = useState<any | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const refreshing = cLoading || sLoading;
  const onRefresh = () => { refetchClients(); refetchSessions(); refetchStrikes(); refetchWaitlist(); refetchTimer(); refetchBookingReqs(); };

  useFocusEffect(useCallback(() => {
    refetchClients(); refetchSessions(); refetchStrikes(); refetchWaitlist(); refetchTimer();
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
    <>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <Pressable style={styles.addBtn} onPress={() => setShowPicker(true)}>
            <Ionicons name="menu-outline" size={22} color={Colors.accent} />
          </Pressable>
          <View>
            <Text style={styles.greeting}>Hey, {firstName} 👊</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={styles.addBtn} onPress={() => router.push('/(coach)/announcements' as any)}>
            <Ionicons name="megaphone-outline" size={20} color={Colors.accent} />
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => router.push('/(coach)/add-client')}>
            <Ionicons name="person-add-outline" size={20} color={Colors.accent} />
          </Pressable>
        </View>
      </View>

      {/* Errors */}
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
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </Pressable>
      )}

      {/* Active session timer */}
      {activeSession && (
        <ActiveSessionCard
          activeSession={activeSession}
          nextSession={nextSession}
          onExtend={extendSession}
          onPause={pauseSession}
          onResume={resumeSession}
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
            color={pinnedAnnouncement.type === 'emergency' ? Colors.danger : Colors.accent}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.pinnedTitle, pinnedAnnouncement.type === 'emergency' && { color: Colors.danger }]}>
              {pinnedAnnouncement.title}
            </Text>
            <Text style={styles.pinnedMsg} numberOfLines={1}>{pinnedAnnouncement.message}</Text>
          </View>
          <Pressable onPress={() => togglePin(pinnedAnnouncement.id, true)} hitSlop={10}>
            <Ionicons name="close-circle-outline" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* 2×2 Quick actions */}
      <View style={styles.actionsGrid}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/(coach)/log-session')}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.bg} />
          <Text style={styles.actionPrimaryText}>LOG SESSION</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.actionOrange, pressed && { opacity: 0.85 }]}
          onPress={() => setImpromptuVisible(true)}
        >
          <Ionicons name="flash" size={20} color="#fff" />
          <Text style={styles.actionWhiteText}>QUICK</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.actionBorder, pressed && { opacity: 0.85 }]}
          onPress={() => setNoShowVisible(true)}
        >
          <Ionicons name="person-remove-outline" size={20} color="#FFA500" />
          <Text style={styles.actionWarningText}>NO-SHOW</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.actionBorder, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/(coach)/revenue')}
        >
          <Ionicons name="bar-chart-outline" size={20} color={Colors.accent} />
          <Text style={styles.actionAccentText}>REVENUE</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.emergencyBtn}
        onPress={() => router.push({ pathname: '/(coach)/announcements', params: { preset: 'emergency' } } as any)}
      >
        <Ionicons name="warning-outline" size={18} color="#fff" />
        <Text style={styles.emergencyBtnText}>EMERGENCY NOTICE</Text>
      </Pressable>

      <ImpromptuSessionModal
        visible={impromptuVisible}
        onClose={() => setImpromptuVisible(false)}
      />
      <NoShowModal
        visible={noShowVisible}
        onClose={() => setNoShowVisible(false)}
        onLogged={() => { refetchSessions(); refetchClients(); }}
      />

      {/* Client Requests */}
      {bookingRequests.length > 0 && (
        <>
          <View style={styles.strikeSectionHeader}>
            <Text style={styles.sectionTitle}>CLIENT REQUESTS</Text>
            <View style={[styles.strikeBadge, { backgroundColor: Colors.accent + '20', borderColor: Colors.accent + '50' }]}>
              <Text style={[styles.strikeBadgeText, { color: Colors.accent }]}>{bookingRequests.length}</Text>
            </View>
          </View>
          {bookingRequests.map((req) => (
            <View key={req.id} style={styles.reqCard}>
              <View style={styles.reqCardTop}>
                <View style={[styles.reqTypeBadge, req.type === 'renewal' && styles.reqTypeBadgeRenew]}>
                  <Ionicons
                    name={req.type === 'renewal' ? 'refresh-outline' : 'calendar-outline'}
                    size={13}
                    color={req.type === 'renewal' ? '#4CAF50' : Colors.accent}
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
            const color = isMax ? Colors.danger : '#FFA500';
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
                    <View key={i} style={[styles.strikePip, { backgroundColor: i < alert.strike_count ? color : Colors.border }]} />
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
            const color = isExpired ? Colors.danger : '#FF9800';
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
          <Ionicons name="people-outline" size={16} color={Colors.accent} />
          <Text style={styles.waitlistNoticeText}>
            {waitlistCount} client{waitlistCount !== 1 ? 's' : ''} on waitlist — check Calendar for open slots
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
        </Pressable>
      )}
    </ScrollView>
    <ClientPickerModal
      visible={showPicker}
      clients={clients}
      onClose={() => setShowPicker(false)}
      onSelect={(id) => { setShowPicker(false); router.push(`/(coach)/client/${id}` as any); }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  resumeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#4CAF5015', borderWidth: 1.5, borderColor: '#4CAF5050',
    borderRadius: 16, padding: 14, marginBottom: 10,
  },
  resumeIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  resumeTitle: { color: '#4CAF50', fontWeight: '800', fontSize: 13, letterSpacing: 0.5, marginBottom: 3 },
  resumeSub: { color: Colors.textSecondary, fontSize: 13 },

  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: HP, paddingBottom: rs(40) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(28) },
  greeting: { ...Typography.title, color: Colors.textPrimary, marginBottom: 4 },
  date: { ...Typography.body, color: Colors.textSecondary },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent + '15',
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: rs(16), paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...Typography.title, color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  statDiv: { width: 1, height: 32, backgroundColor: Colors.border },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  actionBtn: {
    width: '47.5%', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 15,
  },
  actionPrimary: { backgroundColor: Colors.accent },
  actionPrimaryText: { color: Colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  actionOrange: { backgroundColor: '#FF8C00' },
  actionWhiteText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  actionBorder: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  actionWarningText: { color: '#FFA500', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  actionAccentText: { color: Colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary },
  strikeSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  strikeBadge: {
    backgroundColor: Colors.danger + '20',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.danger + '50',
  },
  strikeBadgeText: { color: Colors.danger, fontSize: 11, fontWeight: '800' },
  strikeAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
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
  strikeAlertName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  strikeAlertDate: { ...Typography.caption, color: Colors.textSecondary },
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
    backgroundColor: Colors.accent + '12',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.accent + '35',
  },
  waitlistNoticeText: { ...Typography.caption, color: Colors.accent, flex: 1 },

  // Booking request cards
  reqCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  reqCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: Colors.accent + '18', borderWidth: 1, borderColor: Colors.accent + '40',
  },
  reqTypeBadgeRenew: { backgroundColor: '#4CAF5018', borderColor: '#4CAF5040' },
  reqTypeText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  reqClientName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', flex: 1 },
  reqDateTime: { ...Typography.caption, color: Colors.textSecondary },
  reqNotes: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
  reqActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  reqDeclineBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  reqDeclineBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  reqAcceptBtn: {
    flex: 2, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  reqAcceptBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 13 },
  // Emergency button
  emergencyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.danger, borderRadius: 14, paddingVertical: 13, marginBottom: 32,
  },
  emergencyBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  // Pinned announcement banner
  pinnedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.accent + '12', borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.accent + '35',
  },
  pinnedBannerEmergency: {
    backgroundColor: Colors.danger + '10', borderColor: Colors.danger + '40',
  },
  pinnedTitle: { ...Typography.caption, color: Colors.accent, fontWeight: '700', marginBottom: 1 },
  pinnedMsg: { ...Typography.caption, color: Colors.textSecondary },

});

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
    color: Colors.textSecondary, flex: 1,
  },
  sheetBadge: {
    backgroundColor: Colors.accent + '20', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  sheetBadgeText: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
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
