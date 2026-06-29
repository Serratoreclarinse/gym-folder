import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/context/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useSessions } from '@/hooks/useSessions';
import { useStrikeAlerts } from '@/hooks/useStrikeAlerts';
import { useWaitlist } from '@/hooks/useWaitlist';
import { useBirthdays, getDaysUntilBirthday, formatBirthday } from '@/hooks/useBirthdays';
import { useAvailability } from '@/hooks/useAvailability';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useActiveSessionContext } from '@/context/ActiveSessionContext';
import { ActiveSessionCard } from '@/components/ActiveSessionCard';
import { ImpromptuSessionModal } from '@/components/ImpromptuSessionModal';
import { NextSessionCard } from '@/components/NextSessionCard';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Colors, Typography } from '@/constants/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const MAX_STRIKES = 3;
const BIRTHDAY_GOLD = '#FFD700';

function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={[styles.cardValue, accent && styles.cardValueAccent]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export default function CoachDashboard() {
  const { profile } = useAuth();
  const firstName = profile?.name?.split(' ')[0] ?? 'Coach';
  const { clients, loading: cLoading, error: cError, refetch: refetchClients } = useClients();
  const { sessions, loading: sLoading, error: sError, refetch: refetchSessions } = useSessions();
  const { alerts: strikeAlerts, refetch: refetchStrikes } = useStrikeAlerts();
  const { totalCount: waitlistCount, refetch: refetchWaitlist } = useWaitlist(profile?.id);
  const { all: allBirthdays } = useBirthdays(clients);
  const { getTodayInfo } = useAvailability();
  const todaySchedule = getTodayInfo();
  const { pinnedAnnouncement, togglePin } = useAnnouncements();
  const { activeSession, nextSession, extendSession, endSession, cancelSession, pauseSession, resumeSession, refetch: refetchTimer } = useActiveSessionContext();
  const [impromptuVisible, setImpromptuVisible] = useState(false);
  const [pausedWorkout, setPausedWorkout] = useState<any | null>(null);

  const refreshing = cLoading || sLoading;
  const onRefresh = () => { refetchClients(); refetchSessions(); refetchStrikes(); refetchWaitlist(); refetchTimer(); };

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
  const expiringCount = packageAlertClients.length;

  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => s.session_date === today).length;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSessions = sessions.filter((s) => new Date(s.session_date) >= weekAgo).length;

  const recentSessions = sessions.slice(0, 5);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {firstName} 👊</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
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

      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatCard label="Active Clients" value={String(activeClients)} accent />
        <StatCard label="Sessions Today" value={String(todaySessions)} />
        <StatCard label="This Week" value={String(weekSessions)} />
        <StatCard label="Expiring Soon" value={expiringCount > 0 ? `⚠ ${expiringCount}` : '—'} />
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

      {/* Today's availability */}
      {todaySchedule && (
        <Pressable style={styles.availBanner} onPress={() => router.push('/(coach)/availability')}>
          <View style={styles.availDot} />
          <Text style={styles.availText}>
            Available today: {fmt12(todaySchedule.startTime)} – {fmt12(todaySchedule.endTime)}
          </Text>
          <Ionicons name="chevron-forward" size={13} color="#4CAF50" />
        </Pressable>
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

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <Pressable style={[styles.quickBtn, styles.quickBtnPrimary]} onPress={() => router.push('/(coach)/log-session')}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.bg} />
          <Text style={styles.quickBtnPrimaryText}>LOG SESSION</Text>
        </Pressable>
        <Pressable style={[styles.quickBtn, styles.quickBtnSecondary]} onPress={() => router.push('/(coach)/revenue')}>
          <Ionicons name="bar-chart-outline" size={20} color={Colors.accent} />
          <Text style={styles.quickBtnSecondaryText}>REVENUE</Text>
        </Pressable>
      </View>

      {/* Quick session */}
      <Pressable
        style={({ pressed }) => [styles.impromptuBtn, pressed && { opacity: 0.8 }]}
        onPress={() => setImpromptuVisible(true)}
      >
        <Ionicons name="flash" size={18} color={Colors.bg} />
        <Text style={styles.impromptuBtnText}>QUICK SESSION</Text>
      </Pressable>

      <ImpromptuSessionModal
        visible={impromptuVisible}
        onClose={() => setImpromptuVisible(false)}
      />

      {/* Emergency notice quick action */}
      <Pressable
        style={styles.emergencyBtn}
        onPress={() => router.push({ pathname: '/(coach)/announcements', params: { preset: 'emergency' } } as any)}
      >
        <Ionicons name="warning-outline" size={18} color="#fff" />
        <Text style={styles.emergencyBtnText}>EMERGENCY NOTICE</Text>
      </Pressable>

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
                style={({ pressed }) => [
                  styles.strikeAlertCard,
                  { borderColor: color + '50' },
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => router.push(`/(coach)/client/${c.id}`)}
              >
                <View style={[styles.strikeAvatar, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                  <Text style={[styles.strikeAvatarText, { color }]}>{initials}</Text>
                </View>
                <View style={styles.strikeAlertInfo}>
                  <Text style={styles.strikeAlertName}>{c.name}</Text>
                  <Text style={[styles.strikeAlertDate, { color }]}>
                    {isExpired
                      ? 'Package expired — tap to renew'
                      : `${c.activePackage!.sessions_remaining} session${c.activePackage!.sessions_remaining !== 1 ? 's' : ''} remaining`}
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
            const latestDate = new Date(alert.latest_strike_date).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            });
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
                    <View
                      key={i}
                      style={[styles.strikePip, { backgroundColor: i < alert.strike_count ? color : Colors.border }]}
                    />
                  ))}
                  <Text style={[styles.strikeCountText, { color }]}>
                    {alert.strike_count}/{MAX_STRIKES}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <View style={{ height: 8 }} />
        </>
      )}

      {/* Upcoming Birthdays */}
      {allBirthdays.length > 0 && (
        <>
          <View style={styles.strikeSectionHeader}>
            <Text style={styles.sectionTitle}>UPCOMING BIRTHDAYS</Text>
            <View style={[styles.strikeBadge, styles.birthdayBadge]}>
              <Text style={[styles.strikeBadgeText, styles.birthdayBadgeText]}>{allBirthdays.length}</Text>
            </View>
          </View>
          {allBirthdays.map((b) => {
            const isToday = b.daysUntil === 0;
            const initials = b.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
            return (
              <View key={b.id} style={[styles.birthdayCard, isToday && styles.birthdayCardToday]}>
                <View style={[styles.birthdayAvatar, isToday && styles.birthdayAvatarToday]}>
                  <Text style={[styles.birthdayAvatarText, isToday && { color: BIRTHDAY_GOLD }]}>{initials}</Text>
                </View>
                <View style={styles.birthdayInfo}>
                  <Text style={styles.birthdayName}>{b.name}</Text>
                  <Text style={[styles.birthdayDate, isToday && { color: BIRTHDAY_GOLD }]}>
                    {isToday
                      ? '🎂 Today!'
                      : `${formatBirthday(b.birthday!)} · in ${b.daysUntil} day${b.daysUntil !== 1 ? 's' : ''}`}
                  </Text>
                </View>
                {b.phone ? (
                  <Pressable
                    style={[styles.whatsappBtn, isToday && styles.whatsappBtnToday]}
                    onPress={() => {
                      const msg = `Happy Birthday ${b.name}! 🎂🎉 Wishing you a wonderful day! 💪`;
                      Linking.openURL(`whatsapp://send?phone=${encodeURIComponent(b.phone!)}&text=${encodeURIComponent(msg)}`);
                    }}
                  >
                    <Text style={[styles.whatsappBtnText, isToday && { color: BIRTHDAY_GOLD }]}>Send 🎉</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          <View style={{ height: 8 }} />
        </>
      )}

      {/* Waitlist notice */}
      {waitlistCount > 0 && (
        <Pressable
          style={styles.waitlistNotice}
          onPress={() => router.push('/(coach)/(tabs)/calendar')}
        >
          <Ionicons name="people-outline" size={16} color={Colors.accent} />
          <Text style={styles.waitlistNoticeText}>
            {waitlistCount} client{waitlistCount !== 1 ? 's' : ''} on waitlist — check Calendar for open slots
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
        </Pressable>
      )}

      {/* Recent sessions */}
      <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
      {recentSessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No sessions logged yet</Text>
        </View>
      ) : (
        recentSessions.map((s) => (
          <Pressable
            key={s.id}
            style={styles.sessionRow}
            onPress={() => router.push(`/(coach)/client/${s.client_id}`)}
          >
            <View style={styles.sessionDot} />
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionClient}>{s.client_name}</Text>
              <Text style={styles.sessionMeta}>
                {new Date(s.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {'  ·  '}{s.duration_minutes} min{'  ·  '}{s.exercises.length} exercises
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </Pressable>
        ))
      )}
    </ScrollView>
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
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  card: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardAccent: { backgroundColor: Colors.accent + '12', borderColor: Colors.accent + '40' },
  cardValue: { ...Typography.title, color: Colors.textPrimary, marginBottom: 4 },
  cardValueAccent: { color: Colors.accent },
  cardLabel: { ...Typography.caption, color: Colors.textSecondary },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 7,
    borderRadius: 14, paddingVertical: 14,
  },
  quickBtnPrimary: { backgroundColor: Colors.accent },
  quickBtnPrimaryText: { color: Colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  quickBtnSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.accent + '50',
  },
  quickBtnSecondaryText: { color: Colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 12 },
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
  emptyState: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textSecondary },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  sessionInfo: { flex: 1 },
  sessionClient: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  sessionMeta: { ...Typography.caption, color: Colors.textSecondary },

  // Availability banner
  availBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#4CAF5012', borderRadius: 12, padding: 11, marginBottom: 16,
    borderWidth: 1, borderColor: '#4CAF5035',
  },
  availDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  availText: { ...Typography.caption, color: '#4CAF50', flex: 1 },

  // Impromptu session button
  impromptuBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FF8C00', borderRadius: 14, paddingVertical: 14, marginBottom: 16,
  },
  impromptuBtnText: { color: Colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1 },

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

  // Birthday section
  birthdayBadge: { backgroundColor: BIRTHDAY_GOLD + '20', borderColor: BIRTHDAY_GOLD + '50' },
  birthdayBadgeText: { color: BIRTHDAY_GOLD },
  birthdayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  birthdayCardToday: { backgroundColor: BIRTHDAY_GOLD + '10', borderColor: BIRTHDAY_GOLD + '40' },
  birthdayAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center',
  },
  birthdayAvatarToday: { backgroundColor: BIRTHDAY_GOLD + '18', borderWidth: 1.5, borderColor: BIRTHDAY_GOLD + '50' },
  birthdayAvatarText: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary },
  birthdayInfo: { flex: 1 },
  birthdayName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  birthdayDate: { ...Typography.caption, color: Colors.textSecondary },
  whatsappBtn: {
    backgroundColor: Colors.bg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.border,
  },
  whatsappBtnToday: { backgroundColor: BIRTHDAY_GOLD + '15', borderColor: BIRTHDAY_GOLD + '50' },
  whatsappBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
});
