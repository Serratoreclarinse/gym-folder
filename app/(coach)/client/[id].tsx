import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatBirthday } from '@/hooks/useBirthdays';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useSessions } from '@/hooks/useSessions';
import { useStrikes } from '@/hooks/useStrikes';
import { useScheduledSessions } from '@/hooks/useScheduledSessions';
import { scheduleSessionReminder, cancelSessionReminder } from '@/lib/notifications';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ClientNotesTab } from '@/components/ClientNotesTab';
import { ClientFilesTab } from '@/components/ClientFilesTab';
import { ClientGoalsTab } from '@/components/ClientGoalsTab';
import { ClientPhotosTab } from '@/components/ClientPhotosTab';
import { ClientMeasurementsTab } from '@/components/ClientMeasurementsTab';
import { ClientCheckinsTab } from '@/components/ClientCheckinsTab';
import { MilestonesSection } from '@/components/MilestonesSection';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
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

type Tab = 'overview' | 'sessions' | 'goals' | 'notes' | 'files' | 'photos' | 'measurements' | 'checkins';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [reason, setReason] = useState('');
  return (
    <View style={styles.strikeInputCard}>
      <Text style={styles.strikeInputLabel}>Reason (optional)</Text>
      <TextInput
        style={styles.strikeInputField}
        value={reason}
        onChangeText={setReason}
        placeholder="e.g. missed session, late payment…"
        placeholderTextColor={colors.textSecondary}
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.bdEditCard}>
      <Text style={styles.bdEditHint}>Format: MM-DD  (e.g. 12-25 for Dec 25)</Text>
      <TextInput
        style={styles.bdEditInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="MM-DD"
        placeholderTextColor={colors.textSecondary}
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

type RenewPaymentStatus = 'partial' | 'full';
type RenewParams = {
  type: PackageType; sessions: string; weeks: string;
  paymentStatus: RenewPaymentStatus; amountPaid: string;
  paymentMethod: string; balanceDueDate: string; receiptUri: string | null;
};

const PAY_METHODS = [
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

function RenewForm({
  initialType, initialWeeks, onConfirm, onCancel,
}: {
  initialType: PackageType; initialWeeks: string;
  onConfirm: (params: RenewParams) => void; onCancel: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pkgType, setPkgType] = useState<PackageType>(initialType);
  const [sessions, setSessions] = useState('');
  const [weeks, setWeeks] = useState(initialWeeks);
  const [payStatus, setPayStatus] = useState<RenewPaymentStatus>('full');
  const [amountPaid, setAmountPaid] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [balanceDue, setBalanceDue] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerDate, setDatePickerDate] = useState(new Date());
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const isValid = sessions.trim() !== '' && Number(sessions) > 0 && receiptUri !== null;

  const pickReceiptLocal = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.9 });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.9 });
    }
    if (!result.canceled && result.assets[0]) {
      const processed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      setReceiptUri(processed.uri);
    }
  };

  const PAY_OPTS: { value: RenewPaymentStatus; label: string }[] = [
    { value: 'partial', label: 'Partial' },
    { value: 'full', label: 'Full' },
  ];

  return (
    <View style={styles.renewCard}>
      <Text style={styles.renewTitle}>NEW PACKAGE</Text>

      {/* Package type */}
      <View style={styles.renewSegmented}>
        {PACKAGE_OPTIONS.map((opt) => (
          <Pressable key={opt.value}
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
      <TextInput style={styles.renewInput} value={sessions}
        onChangeText={(v) => setSessions(v.replace(/[^0-9]/g, ''))}
        placeholder="e.g. 12" placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad" autoFocus returnKeyType="next" />

      <Text style={styles.renewLabel}>
        Duration (weeks){' '}
        <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>— optional</Text>
      </Text>
      <TextInput style={styles.renewInput} value={weeks}
        onChangeText={(v) => setWeeks(v.replace(/[^0-9]/g, ''))}
        placeholder="e.g. 6" placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad" returnKeyType="next" />

      {/* Payment status */}
      <Text style={styles.renewLabel}>Payment</Text>
      <View style={[styles.renewSegmented, { marginBottom: 10 }]}>
        {PAY_OPTS.map((o) => (
          <Pressable key={o.value}
            style={[styles.renewSegment, payStatus === o.value && styles.renewSegmentActive,
              payStatus === o.value && o.value === 'full' && { backgroundColor: '#22C55E' },
              payStatus === o.value && o.value === 'partial' && { backgroundColor: colors.accent },
            ]}
            onPress={() => setPayStatus(o.value)}
          >
            <Text style={[styles.renewSegmentText, payStatus === o.value && styles.renewSegmentTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {payStatus !== 'unpaid' && (
        <>
          <Text style={styles.renewLabel}>Amount Paid (OMR)</Text>
          <TextInput style={styles.renewInput} value={amountPaid}
            onChangeText={(v) => setAmountPaid(v.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 150" placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad" returnKeyType="next" />
          <Text style={styles.renewLabel}>Payment Method</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
              {PAY_METHODS.map((m) => (
                <Pressable
                  key={m.value}
                  onPress={() => setPayMethod(m.value)}
                  style={[
                    styles.renewSegment,
                    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
                    payMethod === m.value && styles.renewSegmentActive,
                  ]}
                >
                  <Text style={[styles.renewSegmentText, payMethod === m.value && styles.renewSegmentTextActive]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {payStatus === 'partial' && (
        <>
          <Text style={styles.renewLabel}>Balance Due Date</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={balanceDue}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              onChange={e => setBalanceDue((e.target as any).value)}
              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 11, color: colors.textPrimary, fontSize: 15, marginBottom: 12, width: '100%' } as any}
            />
          ) : (
            <>
              <Pressable
                style={[styles.renewInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => {
                  if (Platform.OS === 'android') {
                    DateTimePickerAndroid.open({
                      value: datePickerDate,
                      mode: 'date',
                      minimumDate: new Date(Date.now() + 86400000),
                      onChange: (event, date) => {
                        if (event.type === 'set' && date) {
                          setDatePickerDate(date);
                          setBalanceDue(date.toISOString().split('T')[0]);
                        }
                      },
                    });
                  } else {
                    setShowDatePicker(v => !v);
                  }
                }}
              >
                <Text style={{ color: balanceDue ? colors.textPrimary : colors.textSecondary, fontSize: 15 }}>
                  {balanceDue
                    ? new Date(balanceDue + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Select date'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              </Pressable>
              <Modal
                visible={showDatePicker && Platform.OS === 'ios'}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
                  <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={() => setShowDatePicker(false)} />
                  <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 36 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <Pressable onPress={() => setShowDatePicker(false)}>
                        <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
                      </Pressable>
                      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>Balance Due Date</Text>
                      <Pressable onPress={() => setShowDatePicker(false)}>
                        <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>Done</Text>
                      </Pressable>
                    </View>
                    <DateTimePicker
                      value={datePickerDate}
                      mode="date"
                      display="spinner"
                      minimumDate={new Date(Date.now() + 86400000)}
                      onChange={(_event, date) => {
                        if (date) {
                          setDatePickerDate(date);
                          setBalanceDue(date.toISOString().split('T')[0]);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </View>
                </View>
              </Modal>
            </>
          )}
        </>
      )}

      {/* Receipt — always required */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Text style={styles.renewLabel}>Payment Receipt</Text>
        <View style={{ backgroundColor: colors.danger + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: colors.danger, fontSize: 10, fontWeight: '800' }}>REQUIRED</Text>
        </View>
      </View>
      {receiptUri ? (
        <View style={styles.receiptPreviewRow}>
          <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
          <View style={{ flex: 1, gap: 8 }}>
            <Pressable style={styles.receiptSaveBtn}
              onPress={async () => {
                const ok = await Sharing.isAvailableAsync();
                if (ok) await Sharing.shareAsync(receiptUri, { mimeType: 'image/jpeg' });
              }}>
              <Ionicons name="download-outline" size={15} color={colors.accent} />
              <Text style={styles.receiptPickText}>Save to Device</Text>
            </Pressable>
            <Pressable style={styles.removeReceiptBtn} onPress={() => setReceiptUri(null)}>
              <Ionicons name="close-circle" size={15} color={colors.danger} />
              <Text style={[styles.receiptPickText, { color: colors.danger }]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.receiptPickRow, { marginBottom: 6 }]}>
            <Pressable style={styles.receiptPickBtn} onPress={() => pickReceiptLocal('camera')}>
              <Ionicons name="camera-outline" size={18} color={colors.accent} />
              <Text style={styles.receiptPickText}>Camera</Text>
            </Pressable>
            <Pressable style={styles.receiptPickBtn} onPress={() => pickReceiptLocal('gallery')}>
              <Ionicons name="images-outline" size={18} color={colors.accent} />
              <Text style={styles.receiptPickText}>Gallery</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 14, textAlign: 'center' }}>
            Upload proof of payment to continue
          </Text>
        </>
      )}

      <View style={styles.renewBtns}>
        <Pressable style={styles.renewCancel} onPress={onCancel}>
          <Text style={styles.renewCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.renewConfirm, !isValid && { opacity: 0.4 }]}
          disabled={!isValid}
          onPress={() => onConfirm({ type: pkgType, sessions, weeks, paymentStatus: payStatus, amountPaid, paymentMethod: payMethod, balanceDueDate: balanceDue, receiptUri })}
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [showDatePickerSheet, setShowDatePickerSheet] = useState(false);
  return (
    <View style={styles.scheduleCard}>
      <Text style={styles.scheduleFormTitle}>SCHEDULE SESSION</Text>
      <Text style={styles.scheduleFormLabel}>DATE</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={new Date(date + 'T00:00:00')}
          mode="date"
          display="compact"
          onChange={(_, selected) => {
            if (selected) setDate(selected.toISOString().split('T')[0]);
          }}
          style={{ alignSelf: 'flex-start', marginLeft: -8, marginBottom: 12 }}
        />
      ) : (
        <>
          <Pressable
            style={styles.datePressable}
            onPress={() => setShowDatePickerSheet(true)}
          >
            <Ionicons name="calendar-outline" size={14} color={colors.accent} />
            <Text style={styles.datePressableText}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </Pressable>
          {showDatePickerSheet && (
            <DateTimePicker
              value={new Date(date + 'T00:00:00')}
              mode="date"
              display="default"
              onChange={(_, selected) => {
                setShowDatePickerSheet(false);
                if (selected) setDate(selected.toISOString().split('T')[0]);
              }}
            />
          )}
        </>
      )}
      <Text style={styles.scheduleFormLabel}>Time (24h, e.g. 14:30)</Text>
      <TextInput
        style={styles.scheduleFormInput}
        value={time}
        onChangeText={setTime}
        placeholder="09:00"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
      <Text style={styles.scheduleFormLabel}>Notes (optional)</Text>
      <TextInput
        style={styles.scheduleFormInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. Chest day, bring towel"
        placeholderTextColor={colors.textSecondary}
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showStrikeInput, setShowStrikeInput] = useState(false);
  const [showBirthdayEdit, setShowBirthdayEdit] = useState(false);
  const [bdInput, setBdInput] = useState('');
  const [showRenewForm, setShowRenewForm] = useState(false);
  const [submittingRenewal, setSubmittingRenewal] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferCoaches, setTransferCoaches] = useState<{ id: string; name: string }[]>([]);
  const [selectedTransferCoachId, setSelectedTransferCoachId] = useState<string | null>(null);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Freeze request
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeStart, setFreezeStart] = useState('');
  const [freezeEnd, setFreezeEnd] = useState('');
  const [freezeReason, setFreezeReason] = useState('');
  const [submittingFreeze, setSubmittingFreeze] = useState(false);
  const [showFreezeStartPicker, setShowFreezeStartPicker] = useState(false);
  const [showFreezeEndPicker, setShowFreezeEndPicker] = useState(false);

  type Payment = { id: string; amount: number; payment_method: string; notes: string | null; paid_at: string; receipt_url: string | null };
  const [clientPayments, setClientPayments] = useState<Payment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPayReqModal, setShowPayReqModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [paymentReceiptFull, setPaymentReceiptFull] = useState<string | null>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  const savedScrollY = useRef(0);
  const [payReqAmount, setPayReqAmount] = useState('');
  const [payReqNotes, setPayReqNotes] = useState('');
  const [sendingPayReq, setSendingPayReq] = useState(false);
  const [payReqSent, setPayReqSent] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payNotes, setPayNotes] = useState('');
  const [payTransactionRef, setPayTransactionRef] = useState('');
  const [payReceiptUri, setPayReceiptUri] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  const { profile } = useAuth();
  const { clients, loading: clientsLoading, error: clientsError, refetch: refetchClients } = useClients();
  const { sessions, loading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useSessions(id);
  const { strikes, refetch: refetchStrikes, addStrike, removeStrike } = useStrikes(id);
  const { sessions: scheduledSessions, scheduleSession, deleteSession: deleteScheduledSession, rescheduleSession } = useScheduledSessions(id);
  const [reschedulingSession, setReschedulingSession] = useState<import('@/hooks/useScheduledSessions').ScheduledSession | null>(null);

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
      .select('id, amount, payment_method, notes, paid_at, receipt_url')
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
      .is('deactivated_at', null)
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
        data: { type: 'transfer_request' },
      });
    }
    setShowTransferModal(false);
    Alert.alert('Transfer Requested', 'Your request has been sent to admin for approval.');
  };

  const renewPackage = async (params: RenewParams) => {
    if (!profile?.id) return;
    const { type: pkgType, sessions: sessStr, weeks: weeksStr,
            paymentStatus, amountPaid, paymentMethod, balanceDueDate, receiptUri } = params;
    const totalSessions = Number(sessStr);
    const durationWeeks = weeksStr && Number(weeksStr) > 0 ? Number(weeksStr) : null;

    setShowRenewForm(false);
    setSubmittingRenewal(true);

    // Upload receipt if provided
    let renewReceiptUrl: string | null = null;
    if (receiptUri) {
      try {
        const path = `${id}/renewal-${Date.now()}.jpg`;
        const formData = new FormData();
        formData.append('file', { uri: receiptUri, name: path, type: 'image/jpeg' } as any);
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, formData, { contentType: 'image/jpeg', upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);
          renewReceiptUrl = urlData.publicUrl;
        }
      } catch {}
    }

    // Add sessions directly — no admin approval needed
    const { error: rpcErr } = await supabase.rpc('add_renewal_sessions', {
      p_client_id: id,
      p_sessions: totalSessions,
      p_duration_weeks: durationWeeks ?? null,
    });

    if (rpcErr) {
      setSubmittingRenewal(false);
      Alert.alert('Renewal Error', rpcErr.message);
      return;
    }

    // Record for history (already accepted)
    await supabase.from('renewal_requests').insert({
      client_id: id,
      coach_id: profile.id,
      package_type: pkgType,
      total_sessions: totalSessions,
      status: 'accepted',
      updated_at: new Date().toISOString(),
      payment_status: paymentStatus,
      ...(amountPaid && Number(amountPaid) > 0 ? { amount_paid: Number(amountPaid) } : {}),
      ...(paymentStatus === 'partial' && balanceDueDate ? { balance_due_date: balanceDueDate } : {}),
      ...(renewReceiptUrl ? { receipt_url: renewReceiptUrl } : {}),
      ...(durationWeeks ? { duration_weeks: durationWeeks } : {}),
    });

    // Record payment in payments table so it shows in payment history
    if (amountPaid && Number(amountPaid) > 0) {
      const { error: payErr } = await supabase.from('payments').insert({
        client_id: id,
        coach_id: profile.id,
        recorded_by: profile.id,
        amount: Number(amountPaid),
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
        notes: paymentStatus === 'partial'
          ? `Renewal – partial. Balance due: ${balanceDueDate || 'TBD'}`
          : `Renewal – full payment`,
        ...(renewReceiptUrl ? { receipt_url: renewReceiptUrl } : {}),
      });
      if (payErr) console.warn('Renewal payment INSERT failed:', payErr.message);
    }

    // Mark client as retention
    await supabase.from('profiles').update({ is_retention: true }).eq('id', id);

    // Notify client
    await sendPushNotification(id as string, {
      title: '🎉 Package Renewed!',
      body: `Your package has been renewed. +${totalSessions} sessions added to your account.`,
      data: { type: 'package_renewed' },
    });

    // Notify admin (FYI)
    const { data: adminRows } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
    if (adminRows?.[0]?.id) {
      await sendPushNotification(adminRows[0].id, {
        title: 'ℹ️ Package Renewed',
        body: `${profile.name ?? 'A coach'} renewed ${client?.name ?? 'a client'}'s package. +${totalSessions} sessions.`,
        data: { type: 'renewal_info' },
      });
    }

    setSubmittingRenewal(false);
    Alert.alert('✅ Package Renewed!', `+${totalSessions} sessions added to ${client?.name ?? 'client'}'s account.`);
    refetchClients();
    fetchPayments();
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
      const dateStr = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      await sendPushNotification(id as string, {
        title: '📅 Session Scheduled',
        body: `Your coach has scheduled a session for you on ${dateStr} at ${timeStr}.`,
        data: { type: 'session_scheduled' },
      });
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

  const handleRequestFreeze = async () => {
    if (!pkg || !profile?.id || !id) return;
    if (!freezeStart || !freezeEnd) {
      Alert.alert('Missing dates', 'Enter both a start and end date.');
      return;
    }
    if (freezeStart >= freezeEnd) {
      Alert.alert('Invalid range', 'End date must be after start date.');
      return;
    }
    setSubmittingFreeze(true);
    const { error } = await supabase.from('package_freezes').insert({
      package_id: pkg.id,
      client_id: id,
      coach_id: profile.id,
      freeze_start: freezeStart,
      freeze_end: freezeEnd,
      reason: freezeReason.trim() || null,
      status: 'pending',
    });
    setSubmittingFreeze(false);
    if (error) { Alert.alert('Error', error.message); return; }
    // Notify admin — they need to approve the freeze
    const { data: adminForFreeze } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
    if (adminForFreeze?.[0]?.id) {
      await sendPushNotification(adminForFreeze[0].id, {
        title: '❄️ Freeze Request',
        body: `${profile?.name ?? 'A coach'} requested a freeze for ${client?.name ?? 'a client'} (${freezeStart} → ${freezeEnd}).`,
        data: { type: 'freeze_request' },
      });
    }
    setShowFreezeModal(false);
    setFreezeStart('');
    setFreezeEnd('');
    setFreezeReason('');
    Alert.alert('Submitted', 'Freeze request sent to admin for approval.');
  };


  const handleRemoveStrike = (strikeId: string) => {
    Alert.alert('Remove Strike', 'Remove this strike from the client?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeStrike(strikeId) },
    ]);
  };

  const handleSendPaymentRequest = async () => {
    if (!id) return;
    setSendingPayReq(true);
    const amt = payReqAmount.trim();
    const body = amt
      ? `OMR ${amt} is due for your training package. Please complete your payment.`
      : `You have a pending payment for your training package. Please contact your coach.`;
    const note = payReqNotes.trim() ? `\nNote: ${payReqNotes.trim()}` : '';
    await sendPushNotification(id, { title: '💳 Payment Request', body: body + note, data: { type: 'payment_request' } });
    setSendingPayReq(false);
    setPayReqSent(true);
    setPayReqAmount(''); setPayReqNotes('');
    setTimeout(() => { setShowPayReqModal(false); setPayReqSent(false); }, 1500);
  };

  const pickReceipt = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required to take a photo.'); return; }
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.9 });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.9 });
    }
    if (!result.canceled && result.assets[0]) {
      const processed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPayReceiptUri(processed.uri);
    }
  };

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Invalid amount', 'Enter a valid amount greater than 0.'); return; }
    if (!profile?.id) return;
    setSavingPayment(true);

    let receiptUrl: string | null = null;
    if (payReceiptUri) {
      setUploadingReceipt(true);
      try {
        const path = `${id}/${Date.now()}.jpg`;
        const formData = new FormData();
        formData.append('file', { uri: payReceiptUri, name: path, type: 'image/jpeg' } as any);
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(path, formData, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path);
        receiptUrl = publicUrl;
      } catch (e: any) {
        setUploadingReceipt(false);
        setSavingPayment(false);
        Alert.alert('Upload Error', e.message ?? 'Failed to upload receipt. Try again.');
        return;
      }
      setUploadingReceipt(false);
    }

    const { error } = await supabase.from('payments').insert({
      client_id: id,
      coach_id: profile.id,
      package_id: pkg?.id ?? null,
      amount: amt,
      payment_method: payMethod,
      notes: payNotes.trim() || null,
      transaction_ref: payTransactionRef.trim() || null,
      recorded_by: profile.id,
      ...(receiptUrl ? { receipt_url: receiptUrl } : {}),
    });
    setSavingPayment(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowPaymentModal(false);
    setPayAmount('');
    setPayNotes('');
    setPayTransactionRef('');
    setPayMethod('cash');
    setPayReceiptUri(null);
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
          <Ionicons name="chatbubbles-outline" size={22} color={colors.accent} />
        </Pressable>
        {client?.phone && (
          <>
            <Pressable
              style={styles.contactBtn}
              onPress={() => Linking.openURL(`whatsapp://send?phone=${client.phone!.replace(/\D/g, '')}`)}
              hitSlop={6}
            >
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </Pressable>
            <Pressable
              style={styles.contactBtn}
              onPress={() => Linking.openURL(`tel:${client.phone}`)}
              hitSlop={6}
            >
              <Ionicons name="call-outline" size={22} color={colors.accent} />
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
          {!showRenewForm && (
            <Pressable style={styles.renewInlineBtn} onPress={() => setShowRenewForm(true)} disabled={submittingRenewal}>
              <Ionicons name="refresh-outline" size={15} color={colors.bg} />
              <Text style={styles.renewInlineBtnText}>{submittingRenewal ? 'RENEWING...' : 'RENEW PACKAGE'}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No active package</Text>
          {!showRenewForm && (
            <Pressable style={[styles.renewInlineBtn, { marginTop: 12 }]} onPress={() => setShowRenewForm(true)} disabled={submittingRenewal}>
              <Ionicons name="add-outline" size={15} color={colors.bg} />
              <Text style={styles.renewInlineBtnText}>{submittingRenewal ? 'RENEWING...' : 'ADD PACKAGE'}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Package renewal form */}
      {showRenewForm && (
        <RenewForm
          initialType={pkg?.package_type ?? '1hr'}
          initialWeeks={pkg?.duration_weeks ? String(pkg.duration_weeks) : ''}
          onConfirm={(params) => renewPackage(params)}
          onCancel={() => setShowRenewForm(false)}
        />
      )}

      {/* Log session CTA */}
      {pkg && pkg.sessions_remaining > 0 && (
        <Pressable
          style={styles.logBtn}
          onPress={() => router.push({ pathname: '/(coach)/log-session', params: { clientId: id } })}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.bg} />
          <Text style={styles.logBtnText}>LOG A SESSION</Text>
        </Pressable>
      )}

      {/* Request Freeze */}
      {pkg && pkg.duration_weeks && (
        <Pressable style={styles.freezeBtn} onPress={() => setShowFreezeModal(true)}>
          <Ionicons name="snow-outline" size={16} color="#64B5F6" />
          <Text style={styles.freezeBtnText}>Request Freeze</Text>
        </Pressable>
      )}

      {/* Upcoming scheduled sessions */}
      <View style={[styles.sectionRow, { marginTop: 20, marginBottom: 10 }]}>
        <Text style={styles.sectionTitle}>UPCOMING SESSIONS</Text>
      </View>
      {scheduledSessions.length === 0 && !showScheduleForm ? (
        <View style={[styles.emptyCard, { marginBottom: 20 }]}>
          <Text style={styles.emptyText}>No upcoming sessions scheduled</Text>
        </View>
      ) : (
        scheduledSessions.map((s) => {
          const dt = new Date(s.scheduled_at);
          const dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isPending = s.status === 'reschedule_pending';
          return (
            <View key={s.id}>
              <Pressable
                style={styles.scheduledCard}
                onLongPress={() =>
                  Alert.alert(
                    isPending ? 'Reschedule Pending' : `Session · ${dateStr} ${timeStr}`,
                    isPending ? 'Client has not yet accepted the new time.' : 'What do you want to do?',
                    [
                      { text: 'Keep It', style: 'cancel' },
                      {
                        text: 'Reschedule',
                        onPress: () => setReschedulingSession(s),
                      },
                      {
                        text: 'Cancel Session', style: 'destructive',
                        onPress: () =>
                          Alert.alert('Cancel Session', `Remove ${client?.name ?? 'this client'}'s session on ${dateStr}?`, [
                            { text: 'Keep It', style: 'cancel' },
                            {
                              text: 'Cancel Session', style: 'destructive',
                              onPress: async () => {
                                cancelSessionReminder(s.id);
                                await deleteScheduledSession(s.id);
                                await sendPushNotification(id as string, {
                                  title: '❌ Session Cancelled',
                                  body: `Your session on ${dateStr} at ${timeStr} has been cancelled by your coach.`,
                                  data: { type: 'session_cancelled' },
                                });
                              },
                            },
                          ]),
                      },
                    ],
                  )
                }
              >
                <View style={styles.scheduledIconWrap}>
                  <Ionicons name={isPending ? 'time-outline' : 'calendar-outline'} size={18} color={isPending ? colors.warning : colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduledDate}>{dateStr} · {timeStr}</Text>
                  {isPending && s.reschedule_proposed_at ? (
                    <Text style={[styles.scheduledNotes, { color: colors.warning }]}>
                      → Proposed: {new Date(s.reschedule_proposed_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {new Date(s.reschedule_proposed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  ) : s.notes ? (
                    <Text style={styles.scheduledNotes}>{s.notes}</Text>
                  ) : null}
                </View>
                <Text style={styles.scheduledHold}>Hold to edit</Text>
              </Pressable>
              {reschedulingSession?.id === s.id && (
                <ScheduleForm
                  onConfirm={async (date, time, notes) => {
                    const newDt = new Date(`${date.trim()}T${time.trim()}:00`);
                    if (isNaN(newDt.getTime()) || newDt <= new Date()) {
                      Alert.alert('Invalid date', 'Enter a valid future date and time.');
                      return;
                    }
                    const { error: rsErr } = await rescheduleSession(s.id, newDt);
                    if (rsErr) { Alert.alert('Error', rsErr); return; }
                    const newDateStr = newDt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const newTimeStr = newDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    await sendPushNotification(id as string, {
                      title: '📅 Session Rescheduled',
                      body: `Your coach proposed a new time: ${newDateStr} at ${newTimeStr}. Open the app to accept or decline.`,
                      data: { type: 'reschedule_proposed' },
                    });
                    setReschedulingSession(null);
                  }}
                  onCancel={() => setReschedulingSession(null)}
                />
              )}
            </View>
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
            <Ionicons name="pencil-outline" size={16} color={colors.accent} />
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

      {/* Milestones */}
      <View style={{ marginTop: 20, marginBottom: 4 }}>
        <MilestonesSection clientId={id} />
      </View>

      {/* Strikes section */}
      <View style={[styles.sectionRow, { marginTop: 20 }]}>
        <Text style={styles.sectionTitle}>STRIKES</Text>
        {!showStrikeInput && (
          <Pressable style={styles.addStrikeBtn} onPress={handleAddStrike}>
            <Ionicons name="add" size={14} color={colors.bg} />
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
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={styles.reqPayBtn} onPress={() => setShowPayReqModal(true)}>
            <Ionicons name="send-outline" size={12} color="#fff" />
            <Text style={styles.reqPayBtnText}>Request</Text>
          </Pressable>
          <Pressable style={styles.addStrikeBtn} onPress={() => setShowPaymentModal(true)}>
            <Ionicons name="add" size={14} color={colors.bg} />
            <Text style={styles.addStrikeBtnText}>Record</Text>
          </Pressable>
        </View>
      </View>
      {clientPayments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No payments recorded yet</Text>
        </View>
      ) : (
        <View style={styles.paymentsCard}>
          {clientPayments.slice(0, 3).map((p, i) => (
            <Pressable
              key={p.id}
              style={[styles.paymentRow, i < Math.min(clientPayments.length, 3) - 1 && styles.paymentRowBorder]}
              onPress={() => setSelectedPayment(p)}
            >
              <View style={styles.paymentLeft}>
                <Text style={styles.paymentMethodText}>{METHOD_LABEL[p.payment_method] ?? p.payment_method}</Text>
                <Text style={styles.paymentDate}>
                  {new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                {p.notes ? <Text style={styles.paymentNotes}>{p.notes}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.paymentAmount}>
                  OMR {p.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </Text>
                {p.receipt_url && <Ionicons name="image-outline" size={13} color={colors.accent} />}
              </View>
            </Pressable>
          ))}
          {clientPayments.length > 3 && (
            <Pressable
              style={styles.viewAllBtn}
              onPress={() => router.push({ pathname: '/(coach)/client-payments/[id]', params: { id: id as string, name: client?.name ?? '' } } as any)}
            >
              <Text style={styles.viewAllText}>View all {clientPayments.length} payments</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </Pressable>
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
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.danger} />
            <Text style={styles.transferBtnText}>Transfer Client to Another Coach</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.danger} />
          </Pressable>
        </>
      )}
    </>
  );

  // ── Sessions Tab ─────────────────────────────────────────────
  const SessionsContent = () => (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={styles.sectionTitle}>SESSION HISTORY</Text>
        {sessions.length > 5 && (
          <Pressable
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 3 }, pressed && { opacity: 0.7 }]}
            onPress={() => router.push({ pathname: '/(coach)/client-sessions/[id]', params: { id } } as any)}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>View All ({sessions.length})</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.accent} />
          </Pressable>
        )}
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No sessions logged yet</Text>
        </View>
      ) : (
        sessions.slice(0, 5).map((s) => {
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
                      color={s.session_type === 'home' ? '#2196F3' : colors.accent}
                    />
                    <Text style={[styles.sessionTypeText, s.session_type === 'home' && { color: '#2196F3' }]}>
                      {s.session_type === 'home' ? 'Home' : 'Gym'}
                    </Text>
                  </View>
                  <View style={styles.durationChip}>
                    <Ionicons name="time-outline" size={12} color={colors.accent} />
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
                      color={star <= s.rating! ? '#FFD700' : colors.border}
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
              <Ionicons name="close" size={20} color={colors.textSecondary} />
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
            placeholderTextColor={colors.textSecondary}
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

          {payMethod !== 'cash' && (
            <>
              <Text style={styles.transferNotesLabel}>Transaction / Ref No. (optional)</Text>
              <TextInput
                style={styles.renewInput}
                value={payTransactionRef}
                onChangeText={setPayTransactionRef}
                placeholder="e.g. 617903789219"
                placeholderTextColor={colors.textSecondary}
                keyboardType="default"
                autoCapitalize="none"
              />
            </>
          )}

          <Text style={styles.transferNotesLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.transferNotesInput}
            value={payNotes}
            onChangeText={setPayNotes}
            placeholder="e.g. monthly payment for July…"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={2}
          />
          {/* Receipt */}
          <Text style={styles.transferNotesLabel}>Payment Receipt (optional)</Text>
          {payReceiptUri ? (
            <View style={styles.receiptPreviewRow}>
              <Image source={{ uri: payReceiptUri }} style={styles.receiptThumb} />
              <View style={{ flex: 1, gap: 8 }}>
                <Pressable
                  style={styles.receiptSaveBtn}
                  onPress={async () => {
                    const available = await Sharing.isAvailableAsync();
                    if (available) await Sharing.shareAsync(payReceiptUri, { mimeType: 'image/jpeg' });
                  }}
                >
                  <Ionicons name="download-outline" size={15} color={colors.accent} />
                  <Text style={styles.receiptPickText}>Save to Device</Text>
                </Pressable>
                <Pressable style={styles.removeReceiptBtn} onPress={() => setPayReceiptUri(null)}>
                  <Ionicons name="close-circle" size={15} color={colors.danger} />
                  <Text style={[styles.receiptPickText, { color: colors.danger }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.receiptPickRow}>
              <Pressable style={styles.receiptPickBtn} onPress={() => pickReceipt('camera')}>
                <Ionicons name="camera-outline" size={18} color={colors.accent} />
                <Text style={styles.receiptPickText}>Camera</Text>
              </Pressable>
              <Pressable style={styles.receiptPickBtn} onPress={() => pickReceipt('gallery')}>
                <Ionicons name="images-outline" size={18} color={colors.accent} />
                <Text style={styles.receiptPickText}>Gallery</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={[styles.transferSubmitBtn, (!payAmount || savingPayment) && { opacity: 0.45 }]}
            onPress={handleRecordPayment}
            disabled={!payAmount || savingPayment}
          >
            <Ionicons name="cash-outline" size={16} color={colors.bg} />
            <Text style={styles.transferSubmitText}>
              {uploadingReceipt ? 'Uploading receipt…' : savingPayment ? 'Saving…' : 'Record Payment'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>

    {/* ── Request Payment Modal ── */}
    <Modal visible={showPayReqModal} transparent animationType="slide" onRequestClose={() => setShowPayReqModal(false)}>
      <View style={styles.transferOverlay}>
        <View style={styles.transferSheet}>
          <View style={styles.transferHandle} />
          <View style={styles.transferHead}>
            <Text style={styles.transferTitle}>REQUEST PAYMENT</Text>
            <Pressable onPress={() => setShowPayReqModal(false)}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.transferSub}>Send a payment reminder to {client?.name}.</Text>

          {payReqSent ? (
            <View style={styles.payReqSuccess}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
              <Text style={styles.payReqSuccessText}>Request Sent!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.transferNotesLabel}>Amount (OMR) — optional</Text>
              <TextInput
                style={styles.renewInput}
                value={payReqAmount}
                onChangeText={(v) => setPayReqAmount(v.replace(/[^0-9.]/g, ''))}
                placeholder="e.g. 545.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.transferNotesLabel}>Note — optional</Text>
              <TextInput
                style={styles.transferNotesInput}
                value={payReqNotes}
                onChangeText={setPayReqNotes}
                placeholder="e.g. Monthly renewal due"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
              />
              <Pressable
                style={[styles.transferSubmitBtn, sendingPayReq && { opacity: 0.45 }]}
                onPress={handleSendPaymentRequest}
                disabled={sendingPayReq}
              >
                <Ionicons name="send-outline" size={16} color={colors.bg} />
                <Text style={styles.transferSubmitText}>{sendingPayReq ? 'Sending…' : 'Send Request'}</Text>
              </Pressable>
            </>
          )}
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
              <Ionicons name="close" size={22} color={colors.textSecondary} />
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
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
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
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={2}
          />
          <Pressable
            style={[styles.transferSubmitBtn, (!selectedTransferCoachId || transferring) && { opacity: 0.45 }]}
            onPress={handleInitiateTransfer}
            disabled={!selectedTransferCoachId || transferring}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.bg} />
            <Text style={styles.transferSubmitText}>{transferring ? 'Submitting…' : 'Initiate Transfer'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>

    {/* ── Freeze Request Modal ── */}
    <Modal visible={showFreezeModal} transparent animationType="slide" onRequestClose={() => setShowFreezeModal(false)}>
      <View style={styles.transferOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowFreezeModal(false)} />
        <View style={styles.transferSheet}>
          <View style={styles.transferHandle} />
          <View style={styles.transferHead}>
            <Text style={styles.transferTitle}>REQUEST FREEZE</Text>
            <Pressable onPress={() => setShowFreezeModal(false)}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.transferSub}>
            Package end date will be extended by the number of frozen days.
          </Text>

          <Text style={styles.transferNotesLabel}>FREEZE START</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={freezeStart ? new Date(freezeStart + 'T00:00:00') : new Date()}
              mode="date"
              display="compact"
              onChange={(_, selected) => {
                if (selected) setFreezeStart(selected.toISOString().split('T')[0]);
              }}
              style={{ alignSelf: 'flex-start', marginLeft: -8, marginBottom: 12 }}
            />
          ) : (
            <>
              <Pressable style={styles.datePressable} onPress={() => setShowFreezeStartPicker(true)}>
                <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                <Text style={styles.datePressableText}>
                  {freezeStart
                    ? new Date(freezeStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Select start date'}
                </Text>
              </Pressable>
              {showFreezeStartPicker && (
                <DateTimePicker
                  value={freezeStart ? new Date(freezeStart + 'T00:00:00') : new Date()}
                  mode="date"
                  display="default"
                  onChange={(_, selected) => {
                    setShowFreezeStartPicker(false);
                    if (selected) setFreezeStart(selected.toISOString().split('T')[0]);
                  }}
                />
              )}
            </>
          )}

          <Text style={styles.transferNotesLabel}>FREEZE END</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={freezeEnd ? new Date(freezeEnd + 'T00:00:00') : new Date()}
              mode="date"
              display="compact"
              onChange={(_, selected) => {
                if (selected) setFreezeEnd(selected.toISOString().split('T')[0]);
              }}
              style={{ alignSelf: 'flex-start', marginLeft: -8, marginBottom: 12 }}
            />
          ) : (
            <>
              <Pressable style={styles.datePressable} onPress={() => setShowFreezeEndPicker(true)}>
                <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                <Text style={styles.datePressableText}>
                  {freezeEnd
                    ? new Date(freezeEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Select end date'}
                </Text>
              </Pressable>
              {showFreezeEndPicker && (
                <DateTimePicker
                  value={freezeEnd ? new Date(freezeEnd + 'T00:00:00') : new Date()}
                  mode="date"
                  display="default"
                  onChange={(_, selected) => {
                    setShowFreezeEndPicker(false);
                    if (selected) setFreezeEnd(selected.toISOString().split('T')[0]);
                  }}
                />
              )}
            </>
          )}

          <Text style={styles.transferNotesLabel}>REASON — optional</Text>
          <TextInput
            style={styles.transferNotesInput}
            value={freezeReason}
            onChangeText={setFreezeReason}
            placeholder="e.g. vacation, medical leave…"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={2}
          />

          <Pressable
            style={[styles.transferSubmitBtn, { backgroundColor: '#64B5F6' }, submittingFreeze && { opacity: 0.45 }]}
            onPress={handleRequestFreeze}
            disabled={submittingFreeze}
          >
            <Ionicons name="snow-outline" size={16} color="#000" />
            <Text style={[styles.transferSubmitText, { color: '#000' }]}>
              {submittingFreeze ? 'Submitting…' : 'Submit Request'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>

    {/* Payment detail modal */}
    <Modal
      visible={!!selectedPayment}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (paymentReceiptFull) { setPaymentReceiptFull(null); }
        else { setSelectedPayment(null); }
      }}
    >
      {/* Full-screen receipt inside the same modal — avoids iOS two-modal limitation */}
      {paymentReceiptFull ? (
        <View style={{ flex: 1, backgroundColor: '#000000F0', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={() => setPaymentReceiptFull(null)} />
          <Image
            source={{ uri: paymentReceiptFull }}
            style={{ width: '92%', height: '75%', borderRadius: 12, backgroundColor: '#333' }}
            resizeMode="contain"
          />
          <Pressable
            style={{ marginTop: 20, backgroundColor: '#ffffff20', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}
            onPress={() => setPaymentReceiptFull(null)}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Close</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.modalOverlay}>
          <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={() => {
            setSelectedPayment(null);
            setTimeout(() => mainScrollRef.current?.scrollTo({ y: savedScrollY.current, animated: false }), 50);
          }} />
          <View style={styles.payDetailSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.payDetailTitle}>Payment Detail</Text>
            {selectedPayment && (
              <>
                <View style={styles.payDetailRow}>
                  <Text style={styles.payDetailLabel}>Amount</Text>
                  <Text style={styles.payDetailValue}>
                    OMR {selectedPayment.amount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </Text>
                </View>
                <View style={styles.payDetailRow}>
                  <Text style={styles.payDetailLabel}>Method</Text>
                  <Text style={styles.payDetailValue}>{METHOD_LABEL[selectedPayment.payment_method] ?? selectedPayment.payment_method}</Text>
                </View>
                <View style={styles.payDetailRow}>
                  <Text style={styles.payDetailLabel}>Date</Text>
                  <Text style={styles.payDetailValue}>
                    {new Date(selectedPayment.paid_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                {selectedPayment.notes ? (
                  <View style={styles.payDetailRow}>
                    <Text style={styles.payDetailLabel}>Notes</Text>
                    <Text style={[styles.payDetailValue, { flex: 1, textAlign: 'right' }]}>{selectedPayment.notes}</Text>
                  </View>
                ) : null}
                {selectedPayment.receipt_url ? (
                  <Pressable
                    onPress={() => setPaymentReceiptFull(selectedPayment.receipt_url!)}
                    style={{ marginTop: 8 }}
                  >
                    <Image
                      source={{ uri: selectedPayment.receipt_url }}
                      style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.border }}
                      resizeMode="contain"
                    />
                    <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                      Tap to view full receipt
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
            <Pressable style={styles.payDetailClose} onPress={() => {
              setPaymentReceiptFull(null);
              setSelectedPayment(null);
              setTimeout(() => mainScrollRef.current?.scrollTo({ y: savedScrollY.current, animated: false }), 50);
            }}>
              <Text style={styles.payDetailCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Modal>

    <ScrollView
      ref={mainScrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onScroll={e => { savedScrollY.current = e.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={100}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
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
        {(['overview', 'sessions', 'goals', 'notes', 'files', 'photos', 'measurements', 'checkins'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'overview' ? 'Overview'
                : tab === 'sessions' ? `Sessions${sessions.length > 0 ? ` (${sessions.length})` : ''}`
                : tab === 'goals' ? 'Goals'
                : tab === 'notes' ? 'Notes'
                : tab === 'files' ? 'Files'
                : tab === 'measurements' ? 'Body'
                : tab === 'checkins' ? 'Check-ins'
                : 'Photos'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewContent />}
      {activeTab === 'sessions' && <SessionsContent />}
      {activeTab === 'goals' && <ClientGoalsTab clientId={id} />}
      {activeTab === 'notes' && <ClientNotesTab clientId={id} />}
      {activeTab === 'files' && <ClientFilesTab clientId={id} />}
      {activeTab === 'photos' && <ClientPhotosTab clientId={id} />}
      {activeTab === 'measurements' && <ClientMeasurementsTab clientId={id} />}
      {activeTab === 'checkins' && <ClientCheckinsTab clientId={id} />}
    </ScrollView>
    </>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
  scroll: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 48 },

  // Client header
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  contactBtns: { flexDirection: 'row', gap: 8, marginLeft: 'auto' as any },
  contactBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  avatar: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: c.accent + '18', borderWidth: 2, borderColor: c.accent + '50',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: c.accent },
  clientMeta: { flex: 1 },
  clientName: { ...Typography.subtitle, color: c.textPrimary, marginBottom: 2 },
  clientEmail: { ...Typography.caption, color: c.textSecondary },
  clientPhone: { ...Typography.caption, color: c.textSecondary },

  // Tab bar
  tabBar: {
    backgroundColor: c.surface,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabBarContent: { flexDirection: 'row', padding: 4 },
  tabBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: c.accent },
  tabLabel: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  tabLabelActive: { color: c.bg },

  // Package card
  packageCard: {
    backgroundColor: c.surface, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: c.accent + '30', marginBottom: 14,
  },
  packageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  packageLabel: { ...Typography.label, color: c.accent, marginBottom: 4 },
  packageType: { ...Typography.subtitle, color: c.textPrimary },
  statusBadge: {
    backgroundColor: c.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: c.accent + '40',
  },
  statusWarning: { backgroundColor: c.warning + '18', borderColor: c.warning + '50' },
  statusExpired: { backgroundColor: c.border + '80', borderColor: c.border },
  statusText: { fontSize: 12, fontWeight: '700', color: c.accent },
  statusTextWarning: { color: c.warning },
  statusTextExpired: { color: c.textSecondary },
  progressTrack: { height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: c.accent, borderRadius: 3 },
  progressLabel: { ...Typography.caption, color: c.textSecondary, marginBottom: 10 },
  durationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  durationInfo: { ...Typography.caption, color: c.textSecondary, flex: 1 },
  trackBadge: {
    backgroundColor: c.success + '18', borderRadius: 7,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: c.success + '40',
  },
  trackBadgeBehind: { backgroundColor: c.warning + '18', borderColor: c.warning + '40' },
  trackText: { fontSize: 11, fontWeight: '700', color: c.success },
  trackTextBehind: { color: c.warning },

  // Log button
  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.accent, borderRadius: 13, paddingVertical: 14, marginBottom: 28,
  },
  logBtnText: { color: c.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },

  _freeSessionBtn_unused: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 13, paddingVertical: 12, marginTop: -18, marginBottom: 28,
    borderWidth: 1, borderColor: c.success + '50',
    backgroundColor: c.success + '10',
  },
  _freeSessionBtnText_unused: { color: c.success, fontSize: 13, fontWeight: '700' },

  freezeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 13, paddingVertical: 12, marginTop: -18, marginBottom: 28,
    borderWidth: 1, borderColor: '#64B5F650',
    backgroundColor: '#64B5F610',
  },
  freezeBtnText: { color: '#64B5F6', fontSize: 13, fontWeight: '700' },

  // Section
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { ...Typography.label, color: c.textSecondary },
  addStrikeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  addStrikeBtnText: { color: c.bg, fontSize: 11, fontWeight: '800' },

  // Strikes
  strikesCard: {
    backgroundColor: c.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 8,
  },
  strikeDots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  strikeDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: c.border, backgroundColor: 'transparent',
  },
  strikeDotFilled: { backgroundColor: c.danger, borderColor: c.danger },
  strikeCount: { ...Typography.caption, color: c.textSecondary, marginLeft: 4 },
  strikeCountMax: { color: c.danger, fontWeight: '700' },
  noStrikesText: { ...Typography.body, color: c.textSecondary, fontStyle: 'italic' },
  strikeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  strikeIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: c.danger + '20', borderWidth: 1, borderColor: c.danger + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  strikeIconText: { fontSize: 14 },
  strikeInfo: { flex: 1 },
  strikeLabel: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
  strikeDate: { ...Typography.caption, color: c.textSecondary },
  strikeReason: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic', marginTop: 2 },
  strikeTip: { ...Typography.caption, color: c.textSecondary, marginTop: 8, textAlign: 'center' },

  // Sessions
  sessionCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
  },
  sessionCardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  sessionDate: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
  durationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.accent + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  durationText: { fontSize: 12, fontWeight: '600', color: c.accent },
  sessionTypeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.accent + '12', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: c.accent + '30',
  },
  sessionTypeChipHome: { backgroundColor: '#2196F312', borderColor: '#2196F330' },
  sessionTypeText: { fontSize: 11, fontWeight: '700', color: c.accent },
  exRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  exBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 6 },
  exDetails: { flex: 1 },
  exName: { ...Typography.body, color: c.textPrimary, fontWeight: '500' },
  exMeta: { ...Typography.caption, color: c.textSecondary, marginTop: 1 },
  sessionNotes: {
    ...Typography.caption, color: c.textSecondary, fontStyle: 'italic',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border,
  },
  ratingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border,
  },
  ratingLabel: { ...Typography.caption, color: c.textSecondary, marginLeft: 6 },

  // Strike inline input
  strikeInputCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.danger + '50', marginBottom: 12,
  },
  strikeInputLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 8 },
  strikeInputField: {
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 10, padding: 10, color: c.textPrimary, fontSize: 14, marginBottom: 10,
  },
  strikeInputBtns: { flexDirection: 'row', gap: 8 },
  strikeInputCancel: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: c.border, alignItems: 'center',
  },
  strikeInputCancelText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
  strikeInputConfirm: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: c.danger, alignItems: 'center',
  },
  strikeInputConfirmText: { color: c.bg, fontWeight: '700', fontSize: 13 },

  // Shared
  emptyCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 24,
    alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: c.border,
  },
  emptyText: { ...Typography.body, color: c.textSecondary },

  // Renew form
  renewInlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: c.accent, borderRadius: 10, paddingVertical: 10, marginTop: 14,
  },
  renewInlineBtnText: { color: c.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  renewCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.accent + '50', marginBottom: 14,
  },
  renewTitle: { ...Typography.label, color: c.accent, marginBottom: 12 },
  renewSegmented: {
    flexDirection: 'row', backgroundColor: c.bg, borderRadius: 10,
    borderWidth: 1, borderColor: c.border, padding: 3, marginBottom: 14, gap: 3,
  },
  renewSegment: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  renewSegmentActive: { backgroundColor: c.accent },
  renewSegmentText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  renewSegmentTextActive: { color: c.bg },
  renewLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 8 },
  renewInput: {
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 10, padding: 11, color: c.textPrimary, fontSize: 15, marginBottom: 12,
  },
  renewBtns: { flexDirection: 'row', gap: 8 },
  renewCancel: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: c.border, alignItems: 'center',
  },
  renewCancelText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
  renewConfirm: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: c.accent, alignItems: 'center',
  },
  renewConfirmText: { color: c.bg, fontWeight: '800', fontSize: 13 },

  // Schedule add button
  scheduleAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  scheduleAddBtnText: { color: c.bg, fontSize: 11, fontWeight: '800' },

  // Schedule form
  scheduleCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.accent + '50', marginBottom: 14,
  },
  scheduleFormTitle: { ...Typography.label, color: c.accent, marginBottom: 12 },
  scheduleFormLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 6 },
  scheduleFormInput: {
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 10, padding: 11, color: c.textPrimary, fontSize: 15, marginBottom: 12,
  },
  datePressable: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12,
    borderRadius: 8, borderWidth: 1, borderColor: c.accent + '50',
    backgroundColor: c.accent + '10', alignSelf: 'flex-start',
  },
  datePressableText: { fontSize: 14, fontWeight: '600', color: c.accent },
  scheduleBtns: { flexDirection: 'row', gap: 8 },
  scheduleCancel: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: c.border, alignItems: 'center',
  },
  scheduleCancelText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
  scheduleConfirm: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: c.accent, alignItems: 'center',
  },
  scheduleConfirmText: { color: c.bg, fontWeight: '800', fontSize: 13 },

  // Scheduled session cards
  scheduledCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.surface, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: c.border,
  },
  scheduledIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.accent + '15', borderWidth: 1, borderColor: c.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  scheduledDate: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
  scheduledNotes: { ...Typography.caption, color: c.textSecondary, marginTop: 2 },
  scheduledHold: { ...Typography.caption, color: c.textSecondary, fontSize: 10 },

  // Birthday
  bdDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: c.border, marginBottom: 8,
  },
  bdText: { ...Typography.body, color: c.textPrimary },
  bdEmpty: { ...Typography.body, color: c.textSecondary, fontStyle: 'italic' },
  bdEditCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.accent + '50', marginBottom: 8,
  },
  bdEditHint: { ...Typography.caption, color: c.textSecondary, marginBottom: 8 },
  bdEditInput: {
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 10, padding: 10, color: c.textPrimary, fontSize: 15, marginBottom: 10,
  },
  bdEditBtns: { flexDirection: 'row', gap: 8 },
  bdEditCancel: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: c.border, alignItems: 'center',
  },
  bdEditCancelText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
  bdEditSave: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: c.accent, alignItems: 'center',
  },
  bdEditSaveText: { color: c.bg, fontWeight: '700', fontSize: 13 },

  // Transfer client
  transferBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: c.danger + '50',
    backgroundColor: c.danger + '0D',
    borderRadius: 12, padding: 14,
  },
  transferBtnText: { color: c.danger, fontSize: 14, fontWeight: '600', flex: 1 },

  // Transfer modal
  transferOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
  transferSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 36,
    borderWidth: 1, borderColor: c.border,
  },
  transferHandle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: c.border, alignSelf: 'center', marginBottom: 16,
  },
  transferHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  transferTitle: { ...Typography.label, color: c.textPrimary, fontSize: 13 },
  transferSub: { ...Typography.caption, color: c.textSecondary, marginBottom: 12 },
  transferEmpty: { ...Typography.body, color: c.textSecondary, paddingVertical: 12, textAlign: 'center' },
  transferCoachRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', marginBottom: 4,
  },
  transferCoachRowSel: { backgroundColor: c.accent + '12', borderColor: c.accent + '40' },
  transferCoachAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.accent + '18', justifyContent: 'center', alignItems: 'center',
  },
  transferCoachAvatarText: { fontSize: 12, fontWeight: '800', color: c.accent },
  transferCoachName: { ...Typography.body, color: c.textPrimary, flex: 1 },
  transferNotesLabel: { ...Typography.label, color: c.textSecondary, marginTop: 14, marginBottom: 6 },
  transferNotesInput: {
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: c.textPrimary, fontSize: 14, minHeight: 60,
    textAlignVertical: 'top', marginBottom: 14,
  },
  transferSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.accent, borderRadius: 12, padding: 15,
  },
  transferSubmitText: { color: c.bg, fontWeight: '800', fontSize: 14 },

  // Receipt picker
  receiptPickRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  receiptPickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5, borderColor: c.accent + '50',
    backgroundColor: c.accent + '10',
  },
  receiptPickText: { fontSize: 13, fontWeight: '700', color: c.accent },
  receiptPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  receiptThumb: { width: 60, height: 76, borderRadius: 10, backgroundColor: c.border },
  receiptSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  removeReceiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Payments
  paymentsCard: {
    backgroundColor: c.surface, borderRadius: 14,
    borderWidth: 1, borderColor: c.border, marginBottom: 8, overflow: 'hidden',
  },
  paymentRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 12 },
  paymentRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  paymentLeft: { flex: 1, marginRight: 12 },
  paymentMethodText: { fontSize: 13, fontWeight: '700', color: c.textPrimary, marginBottom: 2 },
  paymentDate: { fontSize: 12, color: c.textSecondary },
  paymentNotes: { fontSize: 12, color: c.textSecondary, fontStyle: 'italic', marginTop: 2 },
  paymentAmount: { fontSize: 15, fontWeight: '800', color: c.success },
  paymentMore: { ...Typography.caption, color: c.textSecondary, textAlign: 'center', paddingVertical: 10 },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border,
  },
  viewAllText: { ...Typography.caption, color: c.accent, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  payDetailSheet: {
    backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  payDetailTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 20, textAlign: 'center' },
  payDetailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  payDetailLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
  payDetailValue: { fontSize: 14, color: c.textPrimary, fontWeight: '600', marginLeft: 16 },
  payDetailClose: {
    marginTop: 20, backgroundColor: c.surface, borderRadius: 12,
    borderWidth: 1, borderColor: c.border, paddingVertical: 13, alignItems: 'center',
  },
  payDetailCloseText: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  methodChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg,
  },
  methodChipActive: { backgroundColor: c.accent + '15', borderColor: c.accent },
  methodChipText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  methodChipTextActive: { color: c.accent, fontWeight: '700' },
  reqPayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: c.success, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  reqPayBtnText: { fontSize: 12, fontWeight: '700', color: c.bg },
  payReqSuccess: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  payReqSuccessText: { fontSize: 16, fontWeight: '700', color: c.success },
});
}