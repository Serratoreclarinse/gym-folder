import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatBirthday } from '@/hooks/useBirthdays';
import {
  Alert,
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
import { useAuth } from '@/context/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useSessions } from '@/hooks/useSessions';
import { useStrikes } from '@/hooks/useStrikes';
import { useScheduledSessions } from '@/hooks/useScheduledSessions';
import { scheduleSessionReminder, cancelSessionReminder } from '@/lib/notifications';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ClientProgressTab } from '@/components/ClientProgressTab';
import { ClientNotesTab } from '@/components/ClientNotesTab';
import { ClientFilesTab } from '@/components/ClientFilesTab';
import { ClientGoalsTab } from '@/components/ClientGoalsTab';
import { Colors, Typography } from '@/constants/theme';
import { sendPushNotification } from '@/lib/pushNotifications';

const PACKAGE_LABEL: Record<string, string> = {
  '30min': '30 min',
  '45min': '45 min',
  '1hr': '1 hour',
};

type PackageType = '30min' | '45min' | '1hr';
const PACKAGE_OPTIONS: { value: PackageType; label: string }[] = [
  { value: '30min', label: '30 min' },
  { value: '45min', label: '45 min' },
  { value: '1hr', label: '1 hr' },
];

type PaymentMethod = 'cash' | 'bank_muscat' | 'nbo' | 'oab' | 'bank_dhofar' | 'ahli_bank' | 'sohar' | 'hsbc' | 'bank_nizwa' | 'other';
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',        label: 'Cash' },
  { value: 'bank_muscat', label: 'Bank Muscat' },
  { value: 'nbo',         label: 'NBO' },
  { value: 'oab',         label: 'OAB' },
  { value: 'bank_dhofar', label: 'Bank Dhofar' },
  { value: 'ahli_bank',   label: 'Ahli Bank' },
  { value: 'sohar',       label: 'Sohar Intl' },
  { value: 'hsbc',        label: 'HSBC Oman' },
  { value: 'bank_nizwa',  label: 'Bank Nizwa' },
  { value: 'other',       label: 'Other' },
];
const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', bank_muscat: 'Bank Muscat', nbo: 'NBO', oab: 'OAB',
  bank_dhofar: 'Bank Dhofar', ahli_bank: 'Ahli Bank', sohar: 'Sohar Intl',
  hsbc: 'HSBC Oman', bank_nizwa: 'Bank Nizwa', other: 'Other',
};

type Tab = 'overview' | 'sessions' | 'progress' | 'goals' | 'notes' | 'files';

const MAX_STRIKES = 3;

// Defined OUTSIDE parent so its component type reference never changes.
// If defined inside, every parent re-render creates a new function reference →
// React unmounts + remounts it → TextInput loses focus on every keystroke.
function StrikeInputForm({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <View style={styles.strikeInputCard}>
      <Text style={styles.strikeInputLabel}>Reason (optional)</Text>
      <TextInput
        style={styles.strikeInputField}
        value={reason}
        onChangeText={setReason}
        placeholder="e.g. missed session, late payment…"
        placeholderTextColor={Colors.textSecondary}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => onConfirm(reason)}
      />
      <View style={styles.strikeInputBtns}>
        <Pressable style={styles.strikeInputCancel} onPress={onCancel}>
          <Text style={styles.strikeInputCancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.strikeInputConfirm} onPress={() => onConfirm(reason)}>
          <Text style={styles.strikeInputConfirmText}>Add Strike</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BirthdayEditForm({
  value,
  onChangeText,
  onSave,
  onCancel,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.bdEditCard}>
      <Text style={styles.bdEditHint}>Format: MM-DD  (e.g. 12-25 for Dec 25)</Text>
      <TextInput
        style={styles.bdEditInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="MM-DD"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={onSave}
      />
      <View style={styles.bdEditBtns}>
        <Pressable style={styles.bdEditCancel} onPress={onCancel}>
          <Text style={styles.bdEditCancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.bdEditSave} onPress={onSave}>
          <Text style={styles.bdEditSaveText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RenewForm({
  initialType,
  initialWeeks,
  onConfirm,
  onCancel,
}: {
  initialType: PackageType;
  initialWeeks: string;
  onConfirm: (type: PackageType, sessions: string, weeks: string) => void;
  onCancel: () => void;
}) {
  const [pkgType, setPkgType] = useState<PackageType>(initialType);
  const [sessions, setSessions] = useState('');
  const [weeks, setWeeks] = useState(initialWeeks);
  const isValid = sessions.trim() !== '' && Number(sessions) > 0;
  return (
    <View style={styles.renewCard}>
      <Text style={styles.renewTitle}>NEW PACKAGE</Text>
      <View style={styles.renewSegmented}>
        {PACKAGE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.renewSegment, pkgType === opt.value && styles.renewSegmentActive]}
            onPress={() => setPkgType(opt.value)}
          >
            <Text style={[styles.renewSegmentText, pkgType === opt.value && styles.renewSegmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.renewLabel}>Total Sessions</Text>
      <TextInput
        style={styles.renewInput}
        value={sessions}
        onChangeText={(v) => setSessions(v.replace(/[^0-9]/g, ''))}
        placeholder="e.g. 12"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="number-pad"
        autoFocus
        returnKeyType="next"
      />
      <Text style={styles.renewLabel}>Duration (weeks) <Text style={{ color: Colors.textSecondary, fontWeight: '400' }}>— optional</Text></Text>
      <TextInput
        style={styles.renewInput}
        value={weeks}
        onChangeText={(v) => setWeeks(v.replace(/[^0-9]/g, ''))}
        placeholder="e.g. 6"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="number-pad"
        returnKeyType="done"
        onSubmitEditing={() => isValid && onConfirm(pkgType, sessions, weeks)}
      />
      <View style={styles.renewBtns}>
        <Pressable style={styles.renewCancel} onPress={onCancel}>
          <Text style={styles.renewCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.renewConfirm, !isValid && { opacity: 0.4 }]}
          disabled={!isValid}
          onPress={() => onConfirm(pkgType, sessions, weeks)}
        >
          <Text style={styles.renewConfirmText}>RENEW</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ScheduleForm({
  onConfirm,
  onCancel,
}: {
  onConfirm: (date: string, time: string, notes: string) => void;
  onCancel: () => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  return (
    <View style={styles.scheduleCard}>
      <Text style={styles.scheduleFormTitle}>SCHEDULE SESSION</Text>
      <Text style={styles.scheduleFormLabel}>Date (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.scheduleFormInput}
        value={date}
        onChangeText={setDate}
        placeholder="2024-01-15"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        autoFocus
      />
      <Text style={styles.scheduleFormLabel}>Time (24h, e.g. 14:30)</Text>
      <TextInput
        style={styles.scheduleFormInput}
        value={time}
        onChangeText={setTime}
        placeholder="09:00"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
      <Text style={styles.scheduleFormLabel}>Notes (optional)</Text>
      <TextInput
        style={styles.scheduleFormInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. Chest day, bring towel"
        placeholderTextColor={Colors.textSecondary}
        returnKeyType="done"
        onSubmitEditing={() => onConfirm(date, time, notes)}
      />
      <View style={styles.scheduleBtns}>
        <Pressable style={styles.scheduleCancel} onPress={onCancel}>
          <Text style={styles.scheduleCancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.scheduleConfirm} onPress={() => onConfirm(date, time, notes)}>
          <Text style={styles.scheduleConfirmText}>SCHEDULE</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ClientDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showStrikeInput, setShowStrikeInput] = useState(false);
  const [showBirthdayEdit, setShowBirthdayEdit] = useState(false);
  const [bdInput, setBdInput] = useState('');
  const [showRenewForm, setShowRenewForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferCoaches, setTransferCoaches] = useState<{ id: string; name: string }[]>([]);
  const [selectedTransferCoachId, setSelectedTransferCoachId] = useState<string | null>(null);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferring, setTransferring] = useState(false);

  type Payment = { id: string; amount: number; payment_method: string; notes: string | null; paid_at: string };
  const [clientPayments, setClientPayments] = useState<Payment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payNotes, setPayNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const { profile } = useAuth();
  const { clients, loading: clientsLoading, error: clientsError, refetch: refetchClients } = useClients();
  const { sessions, loading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useSessions(id);
  const { strikes, refetch: refetchStrikes, addStrike, removeStrike } = useStrikes(id);
  const { sessions: scheduledSessions, scheduleSession, deleteSession: deleteScheduledSession } = useScheduledSessions(id);

  const client = clients.find((c) => c.id === id);
  const pkg = client?.activePackage;
  const initials = client?.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  const progressPct = pkg ? Math.min(pkg.sessions_used / pkg.total_sessions, 1) : 0;

  useEffect(() => {
    if (client?.name) navigation.setOptions({ title: client.name });
  }, [client?.name]);

  useEffect(() => { fetchPayments(); }, [id]);

  const refreshing = clientsLoading || sessionsLoading;
  const onRefresh = () => { refetchClients(); refetchSessions(); refetchStrikes(); fetchPayments(); };

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('payments')
      .select('id, amount, payment_method, notes, paid_at')
      .eq('client_id', id)
      .order('paid_at', { ascending: false })
      .limit(10);
    setClientPayments((data ?? []) as Payment[]);
  };

  const openTransferModal = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'coach')
      .neq('id', profile?.id ?? '')
      .order('name');
    setTransferCoaches((data ?? []) as { id: string; name: string }[]);
    setSelectedTransferCoachId(null);
    setTransferNotes('');
    setShowTransferModal(true);
  };

  const handleInitiateTransfer = async () => {
    if (!selectedTransferCoachId || !pkg?.id || !id) return;
    setTransferring(true);
    const { error } = await supabase.rpc('coach_initiate_transfer', {
      p_client_id: id,
      p_to_coach_id: selectedTransferCoachId,
      p_package_id: pkg.id,
      p_notes: transferNotes.trim() || null,
    });
    setTransferring(false);
    if (error) { Alert.alert('Error', error.message); return; }
    // Notify admin
    const { data: adminRows } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
    if (adminRows?.[0]?.id) {
      const targetName = transferCoaches.find((c) => c.id === selectedTransferCoachId)?.name ?? 'another coach';
      await sendPushNotification(adminRows[0].id, {
        title: '🔄 Transfer Request',
        body: `${profile?.name ?? 'A coach'} wants to transfer ${client?.name ?? 'a client'} to ${targetName}.`,
      });
    }
    setShowTransferModal(false);
    Alert.alert('Transfer Requested', 'Your request has been sent to admin for approval.');
  };

  const renewPackage = async (pkgType: PackageType, totalSessions: number, durationWeeks: string | null) => {
    if (!profile?.id) return;
    setShowRenewForm(false);
    if (pkg) {
      await supabase.from('packages').update({ status: 'expired' }).eq('id', pkg.id);
    }
    await supabase.from('packages').insert({
      coach_id: profile.id,
      client_id: id,
      package_type: pkgType,
      total_sessions: totalSessions,
      sessions_used: 0,
      status: 'active',
      start_date: new Date().toISOString().slice(0, 10),
      ...(durationWeeks && Number(durationWeeks) > 0 ? { duration_weeks: Number(durationWeeks) } : {}),
    });
    refetchClients();
  };

  const handleScheduleSession = async (date: string, time: string, notes: string) => {
    const dt = new Date(`${date.trim()}T${time.trim()}:00`);
    if (isNaN(dt.getTime())) {
      Alert.alert('Invalid format', 'Use YYYY-MM-DD for date and HH:MM for time.');
      return;
    }
    if (dt <= new Date()) {
      Alert.alert('Past date', 'Please schedule a future session.');
      return;
    }
    setShowScheduleForm(false);
    const { error, session } = await scheduleSession(dt, notes);
    if (error) { Alert.alert('Error', error); return; }
    if (session && client?.name) {
      scheduleSessionReminder(client.name, dt, session.id);
    }
  };

  const handleAddStrike = () => {
    if (strikes.length >= MAX_STRIKES) {
      Alert.alert('Max strikes reached', 'This client already has 3 strikes.');
      return;
    }
    setShowStrikeInput(true);
  };

  const confirmAddStrike = async (reason: string) => {
    setShowStrikeInput(false);
    const result = await addStrike(reason);
    if (result.autoDeducted) {
      Alert.alert('3 Strikes!', `${client?.name ?? 'Client'} reached 3 strikes — 1 session auto-deducted from their package and strikes reset to 0.`);
      await sendPushNotification(id, {
        title: '⚡ 3 Strikes — Session Deducted',
        body: '3 strikes recorded. 1 session has been deducted from your package. Strikes reset to 0.',
      });
    } else {
      const newCount = strikes.length + 1;
      await sendPushNotification(id, {
        title: `⚡ Strike ${newCount} of ${MAX_STRIKES} Recorded`,
        body: reason
          ? `Reason: ${reason}`
          : `You now have ${newCount} of ${MAX_STRIKES} strikes.`,
      });
    }
  };

  const handleFreeSession = () => {
    if (!pkg) return;
    Alert.alert(
      'Give Free Session',
      `Add 1 complimentary session to ${client?.name ?? 'this client'}'s package?\n\nThis won't deduct from their purchased count — it's a bonus session from you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Give Free Session',
          onPress: async () => {
            const { error } = await supabase
              .from('packages')
              .update({
                total_sessions: pkg.total_sessions + 1,
              })
              .eq('id', pkg.id)
              .eq('coach_id', profile?.id ?? '');
            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            await refetchClients();
          },
        },
      ],
    );
  };

  const handleRemoveStrike = (strikeId: string) => {
    Alert.alert('Remove Strike', 'Remove this strike from the client?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeStrike(strikeId) },
    ]);
  };

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Invalid amount', 'Enter a valid amount greater than 0.'); return; }
    if (!profile?.id) return;
    setSavingPayment(true);
    const { error } = await supabase.from('payments').insert({
      client_id: id,
      coach_id: profile.id,
      package_id: pkg?.id ?? null,
      amount: amt,
      payment_method: payMethod,
      notes: payNotes.trim() || null,
      recorded_by: profile.id,
    });
    setSavingPayment(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowPaymentModal(false);
    setPayAmount('');
    setPayNotes('');
    setPayMethod('cash');
    fetchPayments();
  };

  // ── Client Header (always visible) ──────────────────────────
  const ClientHeader = () => (
    <View style={styles.clientHeader}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.clientMeta}>
        <Text style={styles.clientName}>{client?.name ?? '—'}</Text>
        <Text style={styles.clientEmail}>{client?.email ?? ''}</Text>
        {client?.phone ? <Text style={styles.clientPhone}>{client.phone}</Text> : null}
      </View>
      <View style={styles.contactBtns}>
        <Pressable
          style={styles.contactBtn}
          onPress={() => router.push({ pathname: '/(coach)/chat', params: { clientId: id, clientName: client?.name ?? '' } } as any)}
          hitSlop={6}
        >
          <Ionicons name="chatbubbles-outline" size={22} color={Colors.accent} />
        </Pressable>
        {client?.phone && (
          <>
            <Pressable
              style={styles.contactBtn}
              onPress={() => Linking.openURL(`whatsapp://send?phone=${encodeURIComponent(client.phone!)}`)}
              hitSlop={6}
            >
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </Pressable>
            <Pressable
              style={styles.contactBtn}
              onPress={() => Linking.openURL(`tel:${client.phone}`)}
              hitSlop={6}
            >
              <Ionicons name="call-outline" size={22} color={Colors.accent} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );

  // ── Overview Tab ─────────────────────────────────────────────
  const OverviewContent = () => (
    <>
      {/* Package card */}
      {pkg ? (
        <View style={styles.packageCard}>
          <View style={styles.packageTop}>
            <View>
              <Text style={styles.packageLabel}>ACTIVE PACKAGE</Text>
              <Text style={styles.packageType}>{PACKAGE_LABEL[pkg.package_type]} sessions</Text>
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
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {pkg.sessions_used} of {pkg.total_sessions} sessions used
          </Text>
          {pkg.duration_weeks && (() => {
            const days = Math.max(0, Math.floor((Date.now() - new Date(pkg.start_date + 'T00:00:00').getTime()) / 86_400_000));
            const currentWeek = Math.min(Math.ceil((days + 1) / 7), pkg.duration_weeks);
            const rate = pkg.total_sessions / pkg.duration_weeks;
            const expected = Math.min(pkg.total_sessions, (days / 7) * rate);
            const onTrack = pkg.sessions_used >= Math.floor(expected);
            const paceLabel = Number.isInteger(rate) ? `${rate}x/week` : `${Math.floor(rate)}-${Math.ceil(rate)}x/week`;
            return (
              <View style={styles.durationRow}>
                <Text style={styles.durationInfo}>{pkg.total_sessions} sessions · {pkg.duration_weeks} weeks · {paceLabel}</Text>
                <View style={[styles.trackBadge, !onTrack && styles.trackBadgeBehind]}>
                  <Text style={[styles.trackText, !onTrack && styles.trackTextBehind]}>
                    Week {currentWeek}/{pkg.duration_weeks} · {onTrack ? 'On Track' : 'Behind'}
                  </Text>
                </View>
              </View>
            );
          })()}
          {pkg.sessions_remaining === 0 && !showRenewForm && (
            <Pressable style={styles.renewInlineBtn} onPress={() => setShowRenewForm(true)}>
              <Ionicons name="refresh-outline" size={15} color={Colors.bg} />
              <Text style={styles.renewInlineBtnText}>RENEW PACKAGE</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No active package</Text>
          {!showRenewForm && (
            <Pressable style={[styles.renewInlineBtn, { marginTop: 12 }]} onPress={() => setShowRenewForm(true)}>
              <Ionicons name="add-outline" size={15} color={Colors.bg} />
              <Text style={styles.renewInlineBtnText}>ADD PACKAGE</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Package renewal form */}
      {showRenewForm && (
        <RenewForm
          initialType={pkg?.package_type ?? '1hr'}
          initialWeeks={pkg?.duration_weeks ? String(pkg.duration_weeks) : ''}
          onConfirm={(type, sessStr, weeksStr) => renewPackage(type, Number(sessStr), weeksStr || null)}
          onCancel={() => setShowRenewForm(false)}
        />
      )}

      {/* Log session CTA */}
      {pkg && pkg.sessions_remaining > 0 && (
        <Pressable
          style={styles.logBtn}
          onPress={() => router.push({ pathname: '/(coach)/log-session', params: { clientId: id } })}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.bg} />
          <Text style={styles.logBtnText}>LOG A SESSION</Text>
        </Pressable>
      )}

      {/* Give free session */}
      {pkg && (
        <Pressable style={styles.freeSessionBtn} onPress={handleFreeSession}>
          <Ionicons name="gift-outline" size={16} color="#4CAF50" />
          <Text style={styles.freeSessionBtnText}>Give Free Session</Text>
        </Pressable>
      )}

      {/* Upcoming scheduled sessions */}
      <View style={[styles.sectionRow, { marginTop: 20, marginBottom: 10 }]}>
        <Text style={styles.sectionTitle}>UPCOMING SESSIONS</Text>
        {!showScheduleForm && (
          <Pressable style={styles.scheduleAddBtn} onPress={() => setShowScheduleForm(true)}>
            <Ionicons name="add" size={14} color={Colors.bg} />
            <Text style={styles.scheduleAddBtnText}>SCHEDULE</Text>
          </Pressable>
        )}
      </View>
      {showScheduleForm && (
        <ScheduleForm
          onConfirm={handleScheduleSession}
          onCancel={() => setShowScheduleForm(false)}
        />
      )}
      {scheduledSessions.length === 0 && !showScheduleForm ? (
        <View style={[styles.emptyCard, { marginBottom: 20 }]}>
          <Text style={styles.emptyText}>No upcoming sessions scheduled</Text>
        </View>
      ) : (
        scheduledSessions.map((s) => {
          const dt = new Date(s.scheduled_at);
          const dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <Pressable
              key={s.id}
              style={styles.scheduledCard}
              onLongPress={() =>
                Alert.alert('Remove Session', 'Delete this scheduled session?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete', style: 'destructive', onPress: () => {
                      cancelSessionReminder(s.id);
                      deleteScheduledSession(s.id);
                    },
                  },
                ])
              }
            >
              <View style={styles.scheduledIconWrap}>
                <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduledDate}>{dateStr} · {timeStr}</Text>
                {s.notes ? <Text style={styles.scheduledNotes}>{s.notes}</Text> : null}
              </View>
              <Text style={styles.scheduledHold}>Hold to delete</Text>
            </Pressable>
          );
        })
      )}

      {/* Birthday */}
      <View style={[styles.sectionRow, { marginBottom: 8 }]}>
        <Text style={styles.sectionTitle}>BIRTHDAY</Text>
        {!showBirthdayEdit && (
          <Pressable
            onPress={() => { setBdInput(client?.birthday ?? ''); setShowBirthdayEdit(true); }}
            hitSlop={8}
          >
            <Ionicons name="pencil-outline" size={16} color={Colors.accent} />
          </Pressable>
        )}
      </View>
      {showBirthdayEdit ? (
        <BirthdayEditForm
          value={bdInput}
          onChangeText={setBdInput}
          onSave={() => {
            const trimmed = bdInput.trim();
            setShowBirthdayEdit(false);
            supabase.from('profiles').update({ birthday: trimmed || null }).eq('id', id)
              .then(() => refetchClients());
          }}
          onCancel={() => setShowBirthdayEdit(false)}
        />
      ) : (
        <View style={styles.bdDisplay}>
          {client?.birthday ? (
            <>
              <Text style={{ fontSize: 18 }}>🎂</Text>
              <Text style={styles.bdText}>{formatBirthday(client.birthday)}</Text>
            </>
          ) : (
            <Text style={styles.bdEmpty}>Not set — tap ✏ to add</Text>
          )}
        </View>
      )}

      {/* Strikes section */}
      <View style={[styles.sectionRow, { marginTop: 20 }]}>
        <Text style={styles.sectionTitle}>STRIKES</Text>
        {!showStrikeInput && (
          <Pressable style={styles.addStrikeBtn} onPress={handleAddStrike}>
            <Ionicons name="add" size={14} color={Colors.bg} />
            <Text style={styles.addStrikeBtnText}>ADD</Text>
          </Pressable>
        )}
      </View>

      {/* Inline strike reason form — StrikeInputForm defined outside parent to prevent keyboard flicker */}
      {showStrikeInput && (
        <StrikeInputForm
          onConfirm={confirmAddStrike}
          onCancel={() => setShowStrikeInput(false)}
        />
      )}

      <View style={styles.strikesCard}>
        {/* Strike indicator dots */}
        <View style={styles.strikeDots}>
          {Array.from({ length: MAX_STRIKES }).map((_, i) => (
            <View
              key={i}
              style={[styles.strikeDot, i < strikes.length && styles.strikeDotFilled]}
            />
          ))}
          <Text style={[
            styles.strikeCount,
            strikes.length >= MAX_STRIKES && styles.strikeCountMax,
          ]}>
            {strikes.length} / {MAX_STRIKES} strikes
          </Text>
        </View>

        {/* Strike history */}
        {strikes.length === 0 ? (
          <Text style={styles.noStrikesText}>No strikes — great client!</Text>
        ) : (
          strikes.map((s, i) => (
            <Pressable key={s.id} style={styles.strikeRow} onLongPress={() => handleRemoveStrike(s.id)}>
              <View style={styles.strikeIcon}>
                <Text style={styles.strikeIconText}>⚡</Text>
              </View>
              <View style={styles.strikeInfo}>
                <Text style={styles.strikeLabel}>Strike {i + 1}</Text>
                <Text style={styles.strikeDate}>
                  {new Date(s.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
                {s.reason ? <Text style={styles.strikeReason}>{s.reason}</Text> : null}
              </View>
            </Pressable>
          ))
        )}
        {strikes.length > 0 && (
          <Text style={styles.strikeTip}>Hold a strike to remove it</Text>
        )}
      </View>

      {/* Payments */}
      <View style={[styles.sectionRow, { marginTop: 20 }]}>
        <Text style={styles.sectionTitle}>PAYMENTS</Text>
        <Pressable style={styles.addStrikeBtn} onPress={() => setShowPaymentModal(true)}>
          <Ionicons name="add" size={14} color={Colors.bg} />
          <Text style={styles.addStrikeBtnText}>Record</Text>
        </Pressable>
      </View>
      {clientPayments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No payments recorded yet</Text>
        </View>
      ) : (
        <View style={styles.paymentsCard}>
          {clientPayments.slice(0, 5).map((p, i) => (
            <View
              key={p.id}
              style={[styles.paymentRow, i < Math.min(clientPayments.length, 5) - 1 && styles.paymentRowBorder]}
            >
              <View style={styles.paymentLeft}>
                <Text style={styles.paymentMethodText}>{METHOD_LABEL[p.payment_method] ?? p.payment_method}</Text>
                <Text style={styles.paymentDate}>
                  {new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                {p.notes ? <Text style={styles.paymentNotes}>{p.notes}</Text> : null}
              </View>
              <Text style={styles.paymentAmount}>
                OMR {p.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
          {clientPayments.length > 5 && (
            <Text style={styles.paymentMore}>+{clientPayments.length - 5} more payments</Text>
          )}
        </View>
      )}

      {/* Transfer client */}
      {pkg && (
        <>
          <View style={[styles.sectionRow, { marginTop: 28 }]}>
            <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          </View>
          <Pressable style={styles.transferBtn} onPress={openTransferModal}>
            <Ionicons name="swap-horizontal-outline" size={16} color={Colors.danger} />
            <Text style={styles.transferBtnText}>Transfer Client to Another Coach</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.danger} />
          </Pressable>
        </>
      )}
    </>
  );

  // ── Sessions Tab ─────────────────────────────────────────────
  const SessionsContent = () => (
    <>
      <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>
        SESSION HISTORY{sessions.length > 0 ? `  (${sessions.length})` : ''}
      </Text>

      {sessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No sessions logged yet</Text>
        </View>
      ) : (
        sessions.map((s) => {
          const dateStr = new Date(s.session_date).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          });
          return (
            <View key={s.id} style={styles.sessionCard}>
              <View style={styles.sessionCardTop}>
                <Text style={styles.sessionDate}>{dateStr}</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <View style={[styles.sessionTypeChip, s.session_type === 'home' && styles.sessionTypeChipHome]}>
                    <Ionicons
                      name={s.session_type === 'home' ? 'home-outline' : 'barbell-outline'}
                      size={11}
                      color={s.session_type === 'home' ? '#2196F3' : Colors.accent}
                    />
                    <Text style={[styles.sessionTypeText, s.session_type === 'home' && { color: '#2196F3' }]}>
                      {s.session_type === 'home' ? 'Home' : 'Gym'}
                    </Text>
                  </View>
                  <View style={styles.durationChip}>
                    <Ionicons name="time-outline" size={12} color={Colors.accent} />
                    <Text style={styles.durationText}>{s.duration_minutes} min</Text>
                  </View>
                </View>
              </View>
              {s.exercises.map((ex, i) => (
                <View key={i} style={styles.exRow}>
                  <View style={styles.exBullet} />
                  <View style={styles.exDetails}>
                    <Text style={styles.exName}>{ex.exercise_name}</Text>
                    <Text style={styles.exMeta}>
                      {[
                        ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : null,
                        ex.weight ?? null,
                        ex.notes ?? null,
                      ].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                </View>
              ))}
              {s.notes ? <Text style={styles.sessionNotes}>{s.notes}</Text> : null}
              {s.rating != null && (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= s.rating! ? 'star' : 'star-outline'}
                      size={14}
                      color={star <= s.rating! ? '#FFD700' : Colors.border}
                    />
                  ))}
                  <Text style={styles.ratingLabel}>Client rating</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </>
  );


  return (
    <>
    {/* Payment Modal */}
    <Modal
      visible={showPaymentModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowPaymentModal(false)}
    >
      <View style={styles.transferOverlay}>
        <View style={styles.transferSheet}>
          <View style={styles.transferHandle} />
          <View style={styles.transferHead}>
            <Text style={styles.transferTitle}>RECORD PAYMENT</Text>
            <Pressable onPress={() => setShowPaymentModal(false)}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.transferSub}>
            {client?.name}{pkg ? ` — ${PACKAGE_LABEL[pkg.package_type]}` : ''}
          </Text>

          <Text style={styles.transferNotesLabel}>Amount (OMR)</Text>
          <TextInput
            style={styles.renewInput}
            value={payAmount}
            onChangeText={(v) => setPayAmount(v.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 3000"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="decimal-pad"
            autoFocus
          />

          <Text style={styles.transferNotesLabel}>Payment Method</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {PAYMENT_METHODS.map((m) => (
              <Pressable
                key={m.value}
                style={[styles.methodChip, payMethod === m.value && styles.methodChipActive]}
                onPress={() => setPayMethod(m.value)}
              >
                <Text style={[styles.methodChipText, payMethod === m.value && styles.methodChipTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.transferNotesLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.transferNotesInput}
            value={payNotes}
            onChangeText={setPayNotes}
            placeholder="e.g. monthly payment for July…"
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={2}
          />
          <Pressable
            style={[styles.transferSubmitBtn, (!payAmount || savingPayment) && { opacity: 0.45 }]}
            onPress={handleRecordPayment}
            disabled={!payAmount || savingPayment}
          >
            <Ionicons name="cash-outline" size={16} color={Colors.bg} />
            <Text style={styles.transferSubmitText}>{savingPayment ? 'Saving…' : 'Record Payment'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>

    <Modal
      visible={showTransferModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowTransferModal(false)}
    >
      <View style={styles.transferOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowTransferModal(false)} />
        <View style={styles.transferSheet}>
          <View style={styles.transferHandle} />
          <View style={styles.transferHead}>
            <Text style={styles.transferTitle}>TRANSFER CLIENT</Text>
            <Pressable onPress={() => setShowTransferModal(false)}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.transferSub}>
            Select the coach to transfer {client?.name ?? 'this client'} to
          </Text>
          <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
            {transferCoaches.length === 0 ? (
              <Text style={styles.transferEmpty}>No other coaches found</Text>
            ) : (
              transferCoaches.map((coach) => (
                <Pressable
                  key={coach.id}
                  style={[styles.transferCoachRow, selectedTransferCoachId === coach.id && styles.transferCoachRowSel]}
                  onPress={() => setSelectedTransferCoachId(coach.id)}
                >
                  <View style={styles.transferCoachAvatar}>
                    <Text style={styles.transferCoachAvatarText}>
                      {coach.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <Text style={styles.transferCoachName}>{coach.name}</Text>
                  {selectedTransferCoachId === coach.id && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>
          <Text style={styles.transferNotesLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.transferNotesInput}
            value={transferNotes}
            onChangeText={setTransferNotes}
            placeholder="Reason for transfer…"
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={2}
          />
          <Pressable
            style={[styles.transferSubmitBtn, (!selectedTransferCoachId || transferring) && { opacity: 0.45 }]}
            onPress={handleInitiateTransfer}
            disabled={!selectedTransferCoachId || transferring}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={Colors.bg} />
            <Text style={styles.transferSubmitText}>{transferring ? 'Submitting…' : 'Initiate Transfer'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {(clientsError || sessionsError) && (
        <ErrorBanner message={clientsError ?? sessionsError!} onRetry={onRefresh} />
      )}

      {client && <ClientHeader />}

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {(['overview', 'sessions', 'progress', 'goals', 'notes', 'files'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'overview' ? 'Overview'
                : tab === 'sessions' ? `Sessions${sessions.length > 0 ? ` (${sessions.length})` : ''}`
                : tab === 'progress' ? 'Progress'
                : tab === 'goals' ? 'Goals'
                : tab === 'notes' ? 'Notes'
                : 'Files'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewContent />}
      {activeTab === 'sessions' && <SessionsContent />}
      {activeTab === 'progress' && <ClientProgressTab clientId={id} />}
      {activeTab === 'goals' && <ClientGoalsTab clientId={id} />}
      {activeTab === 'notes' && <ClientNotesTab clientId={id} />}
      {activeTab === 'files' && <ClientFilesTab clientId={id} />}
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },

  // Client header
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  contactBtns: { flexDirection: 'row', gap: 8, marginLeft: 'auto' as any },
  contactBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  avatar: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.accent + '18', borderWidth: 2, borderColor: Colors.accent + '50',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: Colors.accent },
  clientMeta: { flex: 1 },
  clientName: { ...Typography.subtitle, color: Colors.textPrimary, marginBottom: 2 },
  clientEmail: { ...Typography.caption, color: Colors.textSecondary },
  clientPhone: { ...Typography.caption, color: Colors.textSecondary },

  // Tab bar
  tabBar: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBarContent: { flexDirection: 'row', padding: 4 },
  tabBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Colors.accent },
  tabLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  tabLabelActive: { color: Colors.bg },

  // Package card
  packageCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.accent + '30', marginBottom: 14,
  },
  packageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  packageLabel: { ...Typography.label, color: Colors.accent, marginBottom: 4 },
  packageType: { ...Typography.subtitle, color: Colors.textPrimary },
  statusBadge: {
    backgroundColor: Colors.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accent + '40',
  },
  statusWarning: { backgroundColor: '#FFA50018', borderColor: '#FFA50050' },
  statusExpired: { backgroundColor: Colors.border + '80', borderColor: Colors.border },
  statusText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  statusTextWarning: { color: '#FFA500' },
  statusTextExpired: { color: Colors.textSecondary },
  progressTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  progressLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 10 },
  durationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  durationInfo: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  trackBadge: {
    backgroundColor: '#4CAF5018', borderRadius: 7,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#4CAF5040',
  },
  trackBadgeBehind: { backgroundColor: '#FFA50018', borderColor: '#FFA50040' },
  trackText: { fontSize: 11, fontWeight: '700', color: '#4CAF50' },
  trackTextBehind: { color: '#FFA500' },

  // Log button
  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 13, paddingVertical: 14, marginBottom: 28,
  },
  logBtnText: { color: Colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },

  freeSessionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 13, paddingVertical: 12, marginTop: -18, marginBottom: 28,
    borderWidth: 1, borderColor: '#4CAF5050',
    backgroundColor: '#4CAF5010',
  },
  freeSessionBtnText: { color: '#4CAF50', fontSize: 13, fontWeight: '700' },

  // Section
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary },
  addStrikeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF4D4D', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  addStrikeBtnText: { color: Colors.bg, fontSize: 11, fontWeight: '800' },

  // Strikes
  strikesCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  strikeDots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  strikeDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent',
  },
  strikeDotFilled: { backgroundColor: '#FF4D4D', borderColor: '#FF4D4D' },
  strikeCount: { ...Typography.caption, color: Colors.textSecondary, marginLeft: 4 },
  strikeCountMax: { color: '#FF4D4D', fontWeight: '700' },
  noStrikesText: { ...Typography.body, color: Colors.textSecondary, fontStyle: 'italic' },
  strikeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  strikeIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FF4D4D20', borderWidth: 1, borderColor: '#FF4D4D40',
    justifyContent: 'center', alignItems: 'center',
  },
  strikeIconText: { fontSize: 14 },
  strikeInfo: { flex: 1 },
  strikeLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  strikeDate: { ...Typography.caption, color: Colors.textSecondary },
  strikeReason: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  strikeTip: { ...Typography.caption, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },

  // Sessions
  sessionCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  sessionCardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sessionDate: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  durationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  durationText: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  sessionTypeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent + '12', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.accent + '30',
  },
  sessionTypeChipHome: { backgroundColor: '#2196F312', borderColor: '#2196F330' },
  sessionTypeText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  exRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  exBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 6 },
  exDetails: { flex: 1 },
  exName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  exMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  sessionNotes: {
    ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  ratingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  ratingLabel: { ...Typography.caption, color: Colors.textSecondary, marginLeft: 6 },

  // Strike inline input
  strikeInputCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FF4D4D50', marginBottom: 12,
  },
  strikeInputLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  strikeInputField: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 10, color: Colors.textPrimary, fontSize: 14, marginBottom: 10,
  },
  strikeInputBtns: { flexDirection: 'row', gap: 8 },
  strikeInputCancel: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  strikeInputCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  strikeInputConfirm: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#FF4D4D', alignItems: 'center',
  },
  strikeInputConfirmText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Shared
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 24,
    alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textSecondary },

  // Renew form
  renewInlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 10, marginTop: 14,
  },
  renewInlineBtnText: { color: Colors.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  renewCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.accent + '50', marginBottom: 14,
  },
  renewTitle: { ...Typography.label, color: Colors.accent, marginBottom: 12 },
  renewSegmented: {
    flexDirection: 'row', backgroundColor: Colors.bg, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, padding: 3, marginBottom: 14, gap: 3,
  },
  renewSegment: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  renewSegmentActive: { backgroundColor: Colors.accent },
  renewSegmentText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  renewSegmentTextActive: { color: Colors.bg },
  renewLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  renewInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 11, color: Colors.textPrimary, fontSize: 15, marginBottom: 12,
  },
  renewBtns: { flexDirection: 'row', gap: 8 },
  renewCancel: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  renewCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  renewConfirm: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: Colors.accent, alignItems: 'center',
  },
  renewConfirmText: { color: Colors.bg, fontWeight: '800', fontSize: 13 },

  // Schedule add button
  scheduleAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  scheduleAddBtnText: { color: Colors.bg, fontSize: 11, fontWeight: '800' },

  // Schedule form
  scheduleCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.accent + '50', marginBottom: 14,
  },
  scheduleFormTitle: { ...Typography.label, color: Colors.accent, marginBottom: 12 },
  scheduleFormLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6 },
  scheduleFormInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 11, color: Colors.textPrimary, fontSize: 15, marginBottom: 12,
  },
  scheduleBtns: { flexDirection: 'row', gap: 8 },
  scheduleCancel: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  scheduleCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  scheduleConfirm: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: Colors.accent, alignItems: 'center',
  },
  scheduleConfirmText: { color: Colors.bg, fontWeight: '800', fontSize: 13 },

  // Scheduled session cards
  scheduledCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  scheduledIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accent + '15', borderWidth: 1, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  scheduledDate: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  scheduledNotes: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  scheduledHold: { ...Typography.caption, color: Colors.textSecondary, fontSize: 10 },

  // Birthday
  bdDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  bdText: { ...Typography.body, color: Colors.textPrimary },
  bdEmpty: { ...Typography.body, color: Colors.textSecondary, fontStyle: 'italic' },
  bdEditCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.accent + '50', marginBottom: 8,
  },
  bdEditHint: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 8 },
  bdEditInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 10, color: Colors.textPrimary, fontSize: 15, marginBottom: 10,
  },
  bdEditBtns: { flexDirection: 'row', gap: 8 },
  bdEditCancel: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  bdEditCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  bdEditSave: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.accent, alignItems: 'center',
  },
  bdEditSaveText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },

  // Transfer client
  transferBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.danger + '50',
    backgroundColor: Colors.danger + '0D',
    borderRadius: 12, padding: 14,
  },
  transferBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '600', flex: 1 },

  // Transfer modal
  transferOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  transferSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 36,
    borderWidth: 1, borderColor: Colors.border,
  },
  transferHandle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  transferHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  transferTitle: { ...Typography.label, color: Colors.textPrimary, fontSize: 13 },
  transferSub: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 12 },
  transferEmpty: { ...Typography.body, color: Colors.textSecondary, paddingVertical: 12, textAlign: 'center' },
  transferCoachRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', marginBottom: 4,
  },
  transferCoachRowSel: { backgroundColor: Colors.accent + '12', borderColor: Colors.accent + '40' },
  transferCoachAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accent + '18', justifyContent: 'center', alignItems: 'center',
  },
  transferCoachAvatarText: { fontSize: 12, fontWeight: '800', color: Colors.accent },
  transferCoachName: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  transferNotesLabel: { ...Typography.label, color: Colors.textSecondary, marginTop: 14, marginBottom: 6 },
  transferNotesInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.textPrimary, fontSize: 14, minHeight: 60,
    textAlignVertical: 'top', marginBottom: 14,
  },
  transferSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 12, padding: 15,
  },
  transferSubmitText: { color: Colors.bg, fontWeight: '800', fontSize: 14 },

  // Payments
  paymentsCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8, overflow: 'hidden',
  },
  paymentRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 12 },
  paymentRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  paymentLeft: { flex: 1, marginRight: 12 },
  paymentMethodText: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  paymentDate: { fontSize: 12, color: Colors.textSecondary },
  paymentNotes: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  paymentAmount: { fontSize: 15, fontWeight: '800', color: '#4CAF50' },
  paymentMore: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 10 },
  methodChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  methodChipActive: { backgroundColor: Colors.accent + '15', borderColor: Colors.accent },
  methodChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  methodChipTextActive: { color: Colors.accent, fontWeight: '700' },
});
