import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useSessions } from '@/hooks/useSessions';
import { useWaitlist, WaitlistEntry } from '@/hooks/useWaitlist';
import { addStrikeForClient } from '@/hooks/useStrikes';
import { useAvailability } from '@/hooks/useAvailability';
import { Colors, Typography } from '@/constants/theme';

const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', color: Colors.accent },
  pending:   { label: 'Pending',   color: '#FFA500' },
  absent:    { label: 'Absent',    color: '#FF4D4D' },
} as const;

function isWithin3Hours(sessionDate: string, scheduledTime: string | null): boolean {
  if (!scheduledTime) return false;
  const [h, m] = scheduledTime.split(':').map(Number);
  const [y, mo, d] = sessionDate.split('-').map(Number);
  const sessionDT = new Date(y, mo - 1, d, h, m, 0);
  const diff = (sessionDT.getTime() - Date.now()) / 3600000;
  return diff > 0 && diff <= 3;
}

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

type ScheduledSession = {
  id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  scheduled_at: string;
  duration_minutes: number;
  session_type: 'gym' | 'home';
  notes: string | null;
  client_confirmed_at: string | null;
  status: 'pending' | 'client_confirmed' | 'reschedule_pending';
  reschedule_proposed_at: string | null;
  original_scheduled_at: string | null;
  reschedule_reason: string | null;
};

export default function CalendarScreen() {
  const todayISO = toISO(new Date());
  const { profile } = useAuth();

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);

  // Waitlist modal state — single modal with view/add modes
  const [waitlistSessionId, setWaitlistSessionId] = useState<string | null>(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [wlModalMode, setWlModalMode] = useState<'view' | 'add'>('view');

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledSession | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const { sessions, loading, refetch } = useSessions();
  const {
    entries: wlEntries,
    countBySession,
    addToWaitlist,
    updateStatus: updateWLStatus,
    removeEntry: removeWLEntry,
    loading: wlLoading,
    refetch: refetchWaitlist,
  } = useWaitlist(profile?.id);
  const { clients } = useClients();
  const { isDateBlocked } = useAvailability();

  const mapRow = (row: any): ScheduledSession => ({
    id: row.id,
    client_id: row.client_id,
    client_name: (row.client as any)?.name ?? 'Unknown',
    client_phone: (row.client as any)?.phone ?? null,
    scheduled_at: row.scheduled_at,
    duration_minutes: row.duration_minutes,
    session_type: (row.session_type as 'gym' | 'home') ?? 'gym',
    notes: row.notes ?? null,
    client_confirmed_at: row.client_confirmed_at ?? null,
    status: row.status as ScheduledSession['status'],
    reschedule_proposed_at: row.reschedule_proposed_at ?? null,
    original_scheduled_at: row.original_scheduled_at ?? null,
    reschedule_reason: row.reschedule_reason ?? null,
  });

  const fetchScheduled = useCallback(async () => {
    if (!profile?.id) return;
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    const selectFields = `
      id, client_id, scheduled_at, duration_minutes, session_type, notes,
      client_confirmed_at, status, reschedule_proposed_at, original_scheduled_at, reschedule_reason,
      client:profiles!scheduled_sessions_client_id_fkey(name, phone)
    `;

    const { data: upcoming } = await supabase
      .from('scheduled_sessions')
      .select(selectFields)
      .eq('coach_id', profile.id)
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)
      .in('status', ['pending', 'client_confirmed', 'reschedule_pending'])
      .order('scheduled_at', { ascending: true });

    setScheduledSessions((upcoming ?? []).map(mapRow));
  }, [profile?.id]);

  const processOverdue = useCallback(async () => {
    if (!profile?.id) return;
    await supabase.rpc('process_overdue_sessions', { p_coach_id: profile.id });
  }, [profile?.id]);

  useFocusEffect(useCallback(() => {
    refetch();
    refetchWaitlist();
    fetchScheduled();
    processOverdue();
  }, []));

  const handleConfirm = async (sessionId: string) => {
    await supabase.from('workout_sessions').update({ status: 'confirmed' }).eq('id', sessionId);
    refetch();
  };

  const handleMarkAbsent = (
    sessionId: string,
    clientId: string,
    clientName: string,
    scheduledTime: string | null,
    sessionDate: string,
  ) => {
    Alert.alert(
      'Mark as Absent',
      `Mark ${clientName}'s session as absent? This will add 1 strike.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Absent',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('workout_sessions').update({ status: 'absent' }).eq('id', sessionId);
            if (profile?.id) {
              const result = await addStrikeForClient(clientId, profile.id, 'No-show / Late absence');
              if (result.autoDeducted) {
                Alert.alert('3 Strikes!', `${clientName} reached 3 strikes — 1 session auto-deducted and strikes reset.`);
              }
            }
            refetch();
            refetchWaitlist();

            // Direct query for fresh data since hook state is async
            const { data: waitingRows } = await supabase
              .from('waitlist')
              .select(`id, client:profiles!waitlist_client_id_fkey(name, phone)`)
              .eq('session_id', sessionId)
              .eq('status', 'waiting')
              .order('position', { ascending: true })
              .limit(1);

            if (waitingRows && waitingRows.length > 0) {
              const first = waitingRows[0];
              const firstName = (first.client as { name: string; phone: string | null } | null)?.name ?? 'Unknown';
              const firstPhone = (first.client as { name: string; phone: string | null } | null)?.phone ?? null;
              setTimeout(() => {
                Alert.alert(
                  'Slot is Open!',
                  `${firstName} is #1 on the waitlist. Notify via WhatsApp?`,
                  [
                    { text: 'Not Now', style: 'cancel' },
                    {
                      text: 'Notify',
                      onPress: () => {
                        if (!firstPhone) {
                          Alert.alert('No phone number', `${firstName} has no phone saved.`);
                          return;
                        }
                        const time = formatTime(scheduledTime) ?? 'your slot';
                        const msg = encodeURIComponent(
                          `Hi ${firstName}! A training slot just opened up at ${time} on ${sessionDate}. Would you like to take it? Please reply ASAP!`
                        );
                        supabase.from('waitlist').update({ status: 'notified' }).eq('id', first.id);
                        refetchWaitlist();
                        Linking.openURL(`whatsapp://send?phone=${cleanPhone(firstPhone)}&text=${msg}`)
                          .catch(() => Alert.alert('WhatsApp not found', 'Please make sure WhatsApp is installed.'));
                      },
                    },
                  ]
                );
              }, 600);
            }
          },
        },
      ],
    );
  };

  const handleWhatsApp = (phone: string | null, clientName: string, sessionDate: string, scheduledTime: string | null) => {
    if (!phone) {
      Alert.alert('No phone number', `${clientName} has no phone number saved in their profile.`);
      return;
    }
    const time = scheduledTime ? formatTime(scheduledTime) : 'today';
    const msg = encodeURIComponent(`Hi ${clientName}, your training session is scheduled at ${time} on ${sessionDate}. Please confirm your attendance. Thank you!`);
    Linking.openURL(`whatsapp://send?phone=${cleanPhone(phone)}&text=${msg}`).catch(() =>
      Alert.alert('WhatsApp not found', 'Please make sure WhatsApp is installed on this device.')
    );
  };

  const handleNotifyWaitlist = (entry: WaitlistEntry, scheduledTime: string | null, sessionDate: string) => {
    if (!entry.client_phone) {
      Alert.alert('No phone number', `${entry.client_name} has no phone number saved.`);
      return;
    }
    const time = formatTime(scheduledTime) ?? 'your slot';
    const msg = encodeURIComponent(
      `Hi ${entry.client_name}! A training slot just opened up at ${time} on ${sessionDate}. Would you like to take it? Please reply ASAP!`
    );
    updateWLStatus(entry.id, 'notified');
    Linking.openURL(`whatsapp://send?phone=${cleanPhone(entry.client_phone)}&text=${msg}`)
      .catch(() => Alert.alert('WhatsApp not found', 'Please make sure WhatsApp is installed.'));
  };

  const openWaitlistModal = (sessionId: string) => {
    setWaitlistSessionId(sessionId);
    setWlModalMode('view');
    setShowWaitlistModal(true);
  };

  const openRescheduleModal = (ss: ScheduledSession) => {
    const d = new Date(ss.scheduled_at);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const h = d.getHours();
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    setRescheduleDate(`${y}-${mo}-${dy}`);
    setRescheduleTime(`${h12}:${mi} ${ampm}`);
    setRescheduleReason('');
    setRescheduleTarget(ss);
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget) return;
    const dateMatch = rescheduleDate.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!dateMatch) { Alert.alert('Invalid date', 'Use format YYYY-MM-DD, e.g. 2025-08-10'); return; }
    const time12 = rescheduleTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const time24 = rescheduleTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    let h = 0, m = 0;
    if (time12) {
      h = parseInt(time12[1]); m = parseInt(time12[2]);
      if (time12[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (time12[3].toUpperCase() === 'AM' && h === 12) h = 0;
    } else if (time24) {
      h = parseInt(time24[1]); m = parseInt(time24[2]);
    } else {
      Alert.alert('Invalid time', 'Use format like 9:00 AM or 14:30'); return;
    }
    const proposed = new Date(
      parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]), h, m, 0
    );
    if (isNaN(proposed.getTime()) || proposed <= new Date()) {
      Alert.alert('Invalid time', 'Please pick a future date and time.'); return;
    }
    setRescheduling(true);
    const { error } = await supabase
      .from('scheduled_sessions')
      .update({
        reschedule_proposed_at: proposed.toISOString(),
        original_scheduled_at: rescheduleTarget.original_scheduled_at ?? rescheduleTarget.scheduled_at,
        reschedule_reason: rescheduleReason.trim() || null,
        status: 'reschedule_pending',
      })
      .eq('id', rescheduleTarget.id);
    if (error) {
      Alert.alert('Error', error.message);
      setRescheduling(false);
      return;
    }
    const { sendPushNotification } = await import('@/lib/pushNotifications');
    await sendPushNotification(rescheduleTarget.client_id, {
      title: '📅 Session Rescheduled',
      body: `Your coach has proposed a new time for your session. Open the app to accept or decline.`,
    });
    setRescheduling(false);
    setRescheduleTarget(null);
    fetchScheduled();
  };

  const closeWaitlistModal = () => {
    setShowWaitlistModal(false);
    setWlModalMode('view');
  };

  // Group sessions by date
  const byDate: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    if (!byDate[s.session_date]) byDate[s.session_date] = [];
    byDate[s.session_date].push(s);
  }

  // Group scheduled sessions by date
  const scheduledByDate: Record<string, ScheduledSession[]> = {};
  for (const ss of scheduledSessions) {
    const date = new Date(ss.scheduled_at).toISOString().split('T')[0];
    if (!scheduledByDate[date]) scheduledByDate[date] = [];
    scheduledByDate[date].push(ss);
  }

  const selectedScheduled = scheduledByDate[selectedDate] ?? [];

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekLabel = (() => {
    const s = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${s} – ${e}`;
  })();

  const selectedSessions = byDate[selectedDate] ?? [];

  const selectedDateDisplay = parseLocalDate(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Waitlist modal data
  const waitlistSession = sessions.find((s) => s.id === waitlistSessionId);
  const sessionWaitlist = wlEntries.filter((e) => e.session_id === waitlistSessionId);
  const existingWLIds = new Set(sessionWaitlist.map((e) => e.client_id));
  const availableForWaitlist = clients.filter(
    (c) => c.id !== waitlistSession?.client_id && !existingWLIds.has(c.id)
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />
        }
      >
        {/* ── Week navigation ─────────────────────────────────── */}
        <View style={styles.weekNav}>
          <Pressable
            style={styles.navBtn}
            hitSlop={12}
            onPress={() => setWeekStart((w) => addDays(w, -7))}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          <Pressable
            style={styles.navBtn}
            hitSlop={12}
            onPress={() => setWeekStart((w) => addDays(w, 7))}
          >
            <Ionicons name="chevron-forward" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>

        {/* ── Day strip ───────────────────────────────────────── */}
        <View style={styles.dayStrip}>
          {weekDays.map((day, i) => {
            const iso = toISO(day);
            const isSelected = iso === selectedDate;
            const isToday = iso === todayISO;
            const count = byDate[iso]?.length ?? 0;
            const isBlocked = isDateBlocked(iso);
            return (
              <Pressable key={iso} style={styles.dayCol} onPress={() => setSelectedDate(iso)}>
                <Text style={[styles.dayAbbr, isSelected && styles.dayAbbrActive]}>
                  {DAY_ABBR[i]}
                </Text>
                <View style={[
                  styles.dayNumWrap,
                  isSelected && styles.dayNumWrapSelected,
                  isToday && !isSelected && styles.dayNumWrapToday,
                  isBlocked && !isSelected && { backgroundColor: Colors.danger + '18' },
                ]}>
                  <Text style={[styles.dayNum, isSelected && styles.dayNumSelected, isBlocked && !isSelected && { color: Colors.danger }]}>
                    {day.getDate()}
                  </Text>
                </View>
                {isBlocked ? (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger }} />
                ) : count > 0 ? (
                  <View style={[styles.dot, isSelected && styles.dotSelected]} />
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>



        {/* ── Daily header ─────────────────────────────────────── */}
        <View style={styles.dayHeader}>
          <View>
            <Text style={styles.dayHeaderText}>{selectedDateDisplay}</Text>
            <Text style={styles.sessionCount}>
              {selectedSessions.length} session{selectedSessions.length !== 1 ? 's' : ''}
              {selectedScheduled.length > 0 ? `  ·  ${selectedScheduled.length} scheduled` : ''}
            </Text>
          </View>
          <Pressable
            style={styles.scheduleBtn}
            onPress={() =>
              router.push({ pathname: '/(coach)/schedule-session' as any, params: { date: selectedDate } })
            }
          >
            <Ionicons name="calendar-outline" size={13} color={Colors.accent} />
            <Text style={styles.scheduleBtnText}>Schedule</Text>
          </Pressable>
        </View>

        {/* ── Scheduled sessions ─────────────────────────────── */}
        {selectedScheduled.map((ss) => {
          const isConfirmed = !!ss.client_confirmed_at;
          const time = new Date(ss.scheduled_at).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit',
          });
          return (
            <View key={ss.id} style={styles.scheduledCard}>
              <View style={styles.scheduledCardMain}>
                <View style={[styles.avatar, { backgroundColor: '#4CAF5018', borderColor: '#4CAF5040' }]}>
                  <Text style={[styles.avatarText, { color: '#4CAF50' }]}>{initials(ss.client_name)}</Text>
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.clientName}>{ss.client_name}</Text>
                  <Text style={styles.sessionMeta}>
                    {time}  ·  {ss.duration_minutes} min  ·  {ss.session_type}
                  </Text>
                  {ss.notes ? <Text style={styles.sessionMeta} numberOfLines={1}>{ss.notes}</Text> : null}
                </View>
                {ss.status === 'reschedule_pending' ? (
                  <View style={styles.awaitingRescheduleBadge}>
                    <Ionicons name="time-outline" size={11} color="#FFA500" />
                    <Text style={styles.awaitingRescheduleText}>Pending</Text>
                  </View>
                ) : isConfirmed ? (
                  <View style={styles.clientConfirmedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#4CAF50" />
                    <Text style={styles.clientConfirmedText}>Confirmed</Text>
                  </View>
                ) : (
                  <View style={styles.awaitingBadge}>
                    <Text style={styles.awaitingText}>Awaiting</Text>
                  </View>
                )}
              </View>
              {ss.status === 'reschedule_pending' && ss.reschedule_proposed_at ? (
                <View style={styles.rescheduledToRow}>
                  <Ionicons name="arrow-forward-outline" size={12} color="#FFA500" />
                  <Text style={styles.rescheduledToText}>
                    Proposed: {new Date(ss.reschedule_proposed_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                    })}
                  </Text>
                </View>
              ) : null}
              <View style={styles.scheduledActions}>
                <Pressable
                  style={styles.scheduledActionLog}
                  onPress={() =>
                    router.push({
                      pathname: '/(coach)/log-session' as any,
                      params: { date: selectedDate, clientId: ss.client_id },
                    })
                  }
                >
                  <Ionicons name="barbell-outline" size={12} color={Colors.bg} />
                  <Text style={styles.scheduledActionLogText}>Log Session</Text>
                </Pressable>
                {ss.status !== 'reschedule_pending' && (
                  <Pressable
                    style={styles.scheduledActionReschedule}
                    onPress={() => openRescheduleModal(ss)}
                  >
                    <Ionicons name="calendar-outline" size={12} color={Colors.accent} />
                    <Text style={styles.scheduledActionRescheduleText}>Reschedule</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.scheduledActionCancel}
                  onPress={() =>
                    Alert.alert('Cancel Scheduled Session', `Cancel ${ss.client_name}'s session?`, [
                      { text: 'Keep', style: 'cancel' },
                      {
                        text: 'Cancel Session', style: 'destructive',
                        onPress: async () => {
                          await supabase.from('scheduled_sessions').delete().eq('id', ss.id);
                          fetchScheduled();
                        },
                      },
                    ])
                  }
                >
                  <Ionicons name="close" size={12} color="#FF4D4D" />
                  <Text style={styles.scheduledActionCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {/* ── Open slots banner ──────────────────────────────── */}
        {selectedSessions.some((s) => s.status === 'absent') && (
          <View style={styles.openSlotBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#FFA500" />
            <Text style={styles.openSlotText}>
              {selectedSessions.filter((s) => s.status === 'absent').length} open slot(s) — tap + to assign another client
            </Text>
          </View>
        )}

        {/* ── Session cards ────────────────────────────────────── */}
        {selectedSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={52} color={Colors.border} />
            <Text style={styles.emptyTitle}>No sessions scheduled</Text>
            <Text style={styles.emptySub}>Tap + to log a session for this day</Text>
          </View>
        ) : (
          selectedSessions.map((s) => {
            const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.confirmed;
            const urgent = s.status === 'pending' && isWithin3Hours(s.session_date, s.scheduled_time);
            const wlCount = countBySession[s.id] ?? 0;
            return (
              <View key={s.id} style={[styles.sessionCard, urgent && styles.sessionCardUrgent]}>
                {/* Main row — tappable → client profile */}
                <Pressable
                  style={({ pressed }) => [styles.sessionCardMain, pressed && { opacity: 0.75 }]}
                  onPress={() => router.push(`/(coach)/client/${s.client_id}`)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(s.client_name)}</Text>
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.clientName}>{s.client_name}</Text>
                    <Text style={styles.sessionMeta}>
                      {formatTime(s.scheduled_time) ?? s.duration_minutes + ' min'}
                      {s.exercises.length > 0
                        ? `  ·  ${s.exercises.length} exercise${s.exercises.length !== 1 ? 's' : ''}`
                        : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '40' }]}>
                    <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </Pressable>

                {/* Action row — pending sessions */}
                {s.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.actionBtnConfirm}
                      onPress={() => handleConfirm(s.id)}
                    >
                      <Ionicons name="checkmark" size={13} color={Colors.bg} />
                      <Text style={styles.actionBtnConfirmText}>Confirm</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionBtnAbsent}
                      onPress={() => handleMarkAbsent(s.id, s.client_id, s.client_name, s.scheduled_time, s.session_date)}
                    >
                      <Ionicons name="close" size={13} color="#FF4D4D" />
                      <Text style={styles.actionBtnAbsentText}>Absent</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtnWhatsapp, urgent && styles.actionBtnWhatsappUrgent]}
                      onPress={() => handleWhatsApp(s.client_phone, s.client_name, s.session_date, s.scheduled_time)}
                    >
                      <Ionicons name="logo-whatsapp" size={13} color={urgent ? Colors.bg : '#25D366'} />
                      <Text style={[styles.actionBtnWhatsappText, urgent && { color: Colors.bg }]}>
                        {urgent ? 'Remind NOW' : 'Remind'}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Open slot notice — absent sessions */}
                {s.status === 'absent' && (
                  <View style={styles.openSlotRow}>
                    <Ionicons name="lock-open-outline" size={12} color="#FFA500" />
                    <Text style={styles.openSlotRowText}>Slot open — assign another client via +</Text>
                  </View>
                )}

                {/* Waitlist row — always visible */}
                <Pressable style={styles.waitlistRow} onPress={() => openWaitlistModal(s.id)}>
                  <Ionicons
                    name="people-outline"
                    size={13}
                    color={wlCount > 0 ? Colors.accent : Colors.textSecondary}
                  />
                  <Text style={[styles.waitlistRowText, wlCount > 0 && { color: Colors.accent }]}>
                    {wlCount > 0 ? `Waitlist · ${wlCount} waiting` : 'Waitlist · none'}
                  </Text>
                  {wlCount > 0 && (
                    <View style={styles.wlCountPill}>
                      <Text style={styles.wlCountPillText}>{wlCount}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={12} color={Colors.textSecondary} />
                </Pressable>
              </View>
            );
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: '/(coach)/log-session',
            params: { date: selectedDate },
          })
        }
      >
        <Ionicons name="add" size={28} color={Colors.bg} />
      </Pressable>

      {/* ── Waitlist Modal ── */}
      <Modal
        visible={showWaitlistModal}
        transparent
        animationType="slide"
        onRequestClose={closeWaitlistModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalOverlay} onPress={closeWaitlistModal} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* VIEW MODE: list of waitlisted clients */}
            {wlModalMode === 'view' && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>WAITLIST</Text>
                    {waitlistSession && (
                      <Text style={styles.modalSub}>
                        {waitlistSession.client_name}
                        {waitlistSession.scheduled_time
                          ? `  ·  ${formatTime(waitlistSession.scheduled_time)}`
                          : ''}
                      </Text>
                    )}
                  </View>
                  <Pressable style={styles.addToWLBtn} onPress={() => setWlModalMode('add')}>
                    <Ionicons name="person-add-outline" size={14} color={Colors.bg} />
                    <Text style={styles.addToWLBtnText}>Add</Text>
                  </Pressable>
                </View>

                {wlLoading ? (
                  <ActivityIndicator color={Colors.accent} style={{ padding: 32 }} />
                ) : sessionWaitlist.length === 0 ? (
                  <View style={styles.wlEmpty}>
                    <Ionicons name="people-outline" size={40} color={Colors.border} />
                    <Text style={styles.wlEmptyText}>No one on the waitlist</Text>
                    <Text style={styles.wlEmptySub}>Tap Add to put a client on standby</Text>
                  </View>
                ) : (
                  <FlatList
                    data={sessionWaitlist}
                    keyExtractor={(item) => item.id}
                    style={styles.wlList}
                    renderItem={({ item }) => (
                      <View style={styles.wlEntry}>
                        <View style={styles.wlPosition}>
                          <Text style={styles.wlPositionText}>{item.position}</Text>
                        </View>
                        <View style={styles.wlEntryInfo}>
                          <Text style={styles.wlEntryName}>{item.client_name}</Text>
                          <Text style={styles.wlEntryStatus}>
                            {item.status === 'notified' ? '📱 Notified' : '⏳ Waiting'}
                          </Text>
                        </View>
                        <View style={styles.wlActions}>
                          <Pressable
                            style={styles.wlNotifyBtn}
                            onPress={() =>
                              handleNotifyWaitlist(
                                item,
                                waitlistSession?.scheduled_time ?? null,
                                waitlistSession?.session_date ?? '',
                              )
                            }
                          >
                            <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                          </Pressable>
                          <Pressable
                            style={styles.wlRemoveBtn}
                            onPress={() =>
                              Alert.alert(
                                'Remove from Waitlist',
                                `Remove ${item.client_name}?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Remove', style: 'destructive', onPress: () => removeWLEntry(item.id) },
                                ]
                              )
                            }
                          >
                            <Ionicons name="close" size={14} color={Colors.textSecondary} />
                          </Pressable>
                        </View>
                      </View>
                    )}
                  />
                )}
                <View style={{ height: 24 }} />
              </>
            )}

            {/* ADD MODE: pick a client */}
            {wlModalMode === 'add' && (
              <>
                <Pressable style={styles.backBtn} onPress={() => setWlModalMode('view')}>
                  <Ionicons name="chevron-back" size={16} color={Colors.textSecondary} />
                  <Text style={styles.backBtnText}>Back to Waitlist</Text>
                </Pressable>
                <Text style={styles.modalTitle}>ADD TO WAITLIST</Text>
                <Text style={[styles.modalSub, { marginBottom: 16 }]}>
                  Select a client to add to the standby list
                </Text>

                {availableForWaitlist.length === 0 ? (
                  <View style={styles.wlEmpty}>
                    <Text style={styles.wlEmptyText}>No available clients</Text>
                    <Text style={styles.wlEmptySub}>
                      All clients are already booked or on the waitlist
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={availableForWaitlist}
                    keyExtractor={(item) => item.id}
                    style={styles.wlList}
                    renderItem={({ item }) => (
                      <Pressable
                        style={({ pressed }) => [styles.clientPickRow, pressed && { opacity: 0.7 }]}
                        onPress={async () => {
                          if (!waitlistSessionId) return;
                          await addToWaitlist(waitlistSessionId, item.id);
                          setWlModalMode('view');
                        }}
                      >
                        <View style={styles.clientPickAvatar}>
                          <Text style={styles.clientPickInitials}>
                            {item.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                          </Text>
                        </View>
                        <View style={styles.clientPickInfo}>
                          <Text style={styles.clientPickName}>{item.name}</Text>
                          {item.activePackage && (
                            <Text style={styles.clientPickMeta}>
                              {item.activePackage.sessions_remaining} sessions left
                            </Text>
                          )}
                        </View>
                        <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
                      </Pressable>
                    )}
                  />
                )}
                <View style={{ height: 24 }} />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Reschedule Modal ── */}
      <Modal
        visible={rescheduleTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setRescheduleTarget(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalOverlay} onPress={() => setRescheduleTarget(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>PROPOSE RESCHEDULE</Text>
            {rescheduleTarget && (
              <Text style={styles.modalSub}>
                {rescheduleTarget.client_name} · currently {new Date(rescheduleTarget.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </Text>
            )}

            <Text style={styles.rsLabel}>NEW DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.rsInput}
              value={rescheduleDate}
              onChangeText={setRescheduleDate}
              placeholder="e.g. 2025-08-10"
              placeholderTextColor={Colors.textSecondary + '60'}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />

            <Text style={styles.rsLabel}>NEW TIME</Text>
            <TextInput
              style={styles.rsInput}
              value={rescheduleTime}
              onChangeText={setRescheduleTime}
              placeholder="e.g. 9:00 AM or 14:30"
              placeholderTextColor={Colors.textSecondary + '60'}
              autoCorrect={false}
            />

            <Text style={styles.rsLabel}>REASON (OPTIONAL)</Text>
            <TextInput
              style={[styles.rsInput, { height: 68, textAlignVertical: 'top' }]}
              value={rescheduleReason}
              onChangeText={setRescheduleReason}
              placeholder="e.g. Coach unavailable due to personal reason"
              placeholderTextColor={Colors.textSecondary + '60'}
              multiline
              autoCorrect={false}
            />

            <Pressable
              style={[styles.rsSubmitBtn, rescheduling && { opacity: 0.5 }]}
              onPress={handleReschedule}
              disabled={rescheduling}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.bg} />
              <Text style={styles.rsSubmitText}>
                {rescheduling ? 'SENDING…' : 'PROPOSE RESCHEDULE'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.rsCancelBtn}
              onPress={() => setRescheduleTarget(null)}
            >
              <Text style={styles.rsCancelText}>Cancel</Text>
            </Pressable>
            <View style={{ height: 24 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },

  // Week navigation
  weekNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  weekLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },

  // Day strip
  dayStrip: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 10, marginBottom: 24,
  },
  dayCol: { flex: 1, alignItems: 'center', gap: 4 },
  dayAbbr: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5 },
  dayAbbrActive: { color: Colors.accent },
  dayNumWrap: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dayNumWrapSelected: { backgroundColor: Colors.accent },
  dayNumWrapToday: { borderWidth: 1.5, borderColor: Colors.accent },
  dayNum: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  dayNumSelected: { color: Colors.bg },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.textSecondary },
  dotSelected: { backgroundColor: Colors.accent },
  dotPlaceholder: { width: 5, height: 5 },

  // Day header
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  dayHeaderText: { ...Typography.subtitle, color: Colors.textPrimary },
  sessionCount: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  // Schedule button
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  scheduleBtnText: { fontSize: 12, fontWeight: '700', color: Colors.accent },

  // Scheduled session card
  scheduledCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#4CAF5030', overflow: 'hidden',
  },
  scheduledCardMain: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  clientConfirmedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#4CAF5015', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: '#4CAF5040',
  },
  clientConfirmedText: { fontSize: 10, fontWeight: '700', color: '#4CAF50' },
  awaitingBadge: {
    backgroundColor: '#FFA50015', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: '#FFA50040',
  },
  awaitingText: { fontSize: 10, fontWeight: '700', color: '#FFA500' },
  scheduledActions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12,
  },
  scheduledActionLog: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.accent, borderRadius: 8, paddingVertical: 7,
  },
  scheduledActionLogText: { color: Colors.bg, fontSize: 12, fontWeight: '700' },
  scheduledActionCancel: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#FF4D4D15', borderRadius: 8, paddingVertical: 7,
    borderWidth: 1, borderColor: '#FF4D4D40',
  },
  scheduledActionCancelText: { color: '#FF4D4D', fontSize: 12, fontWeight: '700' },
  scheduledActionReschedule: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.accent + '15', borderRadius: 8, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  scheduledActionRescheduleText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  awaitingRescheduleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFA50015', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: '#FFA50050',
  },
  awaitingRescheduleText: { fontSize: 10, fontWeight: '700', color: '#FFA500' },
  rescheduledToRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingBottom: 6,
  },
  rescheduledToText: { fontSize: 12, color: '#FFA500', fontWeight: '600' },

  // Reschedule modal inputs
  rsLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  rsInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    color: Colors.textPrimary, fontSize: 14,
  },
  rsSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, marginTop: 20,
  },
  rsSubmitText: { color: Colors.bg, fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },
  rsCancelBtn: { alignItems: 'center', paddingVertical: 14 },
  rsCancelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },

  // Open slot banner
  openSlotBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFA50015', borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: '#FFA50040',
  },
  openSlotText: { ...Typography.caption, color: '#FFA500', flex: 1 },

  // Session card
  sessionCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  sessionCardUrgent: { borderColor: '#FFA50060' },
  sessionCardMain: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.accent + '18', borderWidth: 1.5, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: Colors.accent },
  sessionInfo: { flex: 1 },
  clientName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  sessionMeta: { ...Typography.caption, color: Colors.textSecondary },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Action row
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  actionBtnConfirm: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.accent, borderRadius: 8, paddingVertical: 7,
  },
  actionBtnConfirmText: { color: Colors.bg, fontSize: 12, fontWeight: '700' },
  actionBtnAbsent: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#FF4D4D15', borderRadius: 8, paddingVertical: 7,
    borderWidth: 1, borderColor: '#FF4D4D40',
  },
  actionBtnAbsentText: { color: '#FF4D4D', fontSize: 12, fontWeight: '700' },
  actionBtnWhatsapp: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#25D36615', borderRadius: 8, paddingVertical: 7,
    borderWidth: 1, borderColor: '#25D36640',
  },
  actionBtnWhatsappUrgent: { backgroundColor: '#25D366', borderColor: '#25D366' },
  actionBtnWhatsappText: { color: '#25D366', fontSize: 12, fontWeight: '700' },
  openSlotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingBottom: 8,
  },
  openSlotRowText: { ...Typography.caption, color: '#FFA500' },

  // Waitlist row on each card
  waitlistRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  waitlistRowText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  wlCountPill: {
    backgroundColor: Colors.accent + '22', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.accent + '50',
  },
  wlCountPillText: { color: Colors.accent, fontSize: 10, fontWeight: '800' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },

  // Modal
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: '72%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 18,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  modalTitle: { ...Typography.label, color: Colors.textPrimary, fontWeight: '800', letterSpacing: 1.5 },
  modalSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3 },
  addToWLBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accent, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  addToWLBtnText: { color: Colors.bg, fontSize: 12, fontWeight: '700' },

  // Waitlist entries
  wlList: { maxHeight: 320 },
  wlEmpty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  wlEmptyText: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  wlEmptySub: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  wlEntry: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  wlPosition: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.accent + '20', borderWidth: 1, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  wlPositionText: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  wlEntryInfo: { flex: 1 },
  wlEntryName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  wlEntryStatus: { ...Typography.caption, color: Colors.textSecondary },
  wlActions: { flexDirection: 'row', gap: 6 },
  wlNotifyBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#25D36618', borderWidth: 1, borderColor: '#25D36640',
    justifyContent: 'center', alignItems: 'center',
  },
  wlRemoveBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },

  // Client picker (add mode)
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  backBtnText: { ...Typography.caption, color: Colors.textSecondary },
  clientPickRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  clientPickAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.accent + '18', borderWidth: 1.5, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  clientPickInitials: { fontSize: 13, fontWeight: '800', color: Colors.accent },
  clientPickInfo: { flex: 1 },
  clientPickName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  clientPickMeta: { ...Typography.caption, color: Colors.textSecondary },
});
