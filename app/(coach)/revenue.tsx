import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useClients } from '@/hooks/useClients';
import { usePayments, Payment, NewPayment, PaymentMethod, PaymentStatus } from '@/hooks/usePayments';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 80; // 24 screen pad + 16 card pad each side
const BAR_COUNT = 6;
const BAR_W = Math.floor((CHART_W * 0.52) / BAR_COUNT);
const BAR_GAP = Math.floor((CHART_W - BAR_COUNT * BAR_W) / (BAR_COUNT + 1));

const VAT_RATE = 0.05;

const fmt = (n: number) =>
  'OMR ' + n.toFixed(3).replace(/\.?0+$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const fmtK = (n: number) => {
  if (n >= 1000) return 'OMR ' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return 'OMR ' + n.toFixed(3).replace(/\.?0+$/, '');
};

const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const todayISO = () => new Date().toISOString().split('T')[0];

function getLast6Months(): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
    });
  }
  return result;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash', bank_muscat: 'Bank Muscat', nbo: 'NBO', oab: 'OAB',
  bank_dhofar: 'Bank Dhofar', ahli_bank: 'Ahli Bank', sohar: 'Sohar Intl',
  hsbc: 'HSBC Oman', bank_nizwa: 'Bank Nizwa', other: 'Other',
};

// ─── Bar Chart ──────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; total: number }[] }) {
  const { colors } = useTheme();
  const chartH = 120;
  const labelH = 18;
  const maxBarH = chartH - labelH - 6;
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <Svg width={CHART_W} height={chartH}>
      {data.map((d, i) => {
        const h = d.total > 0 ? Math.max(4, (d.total / maxVal) * maxBarH) : 3;
        const x = BAR_GAP + i * (BAR_W + BAR_GAP);
        const y = chartH - labelH - h - 4;
        const color = d.total > 0 ? colors.accent : colors.border;
        return (
          <G key={`bar${i}`}>
            <Rect x={x} y={y} width={BAR_W} height={h} rx={4} fill={color} />
            <SvgText
              x={x + BAR_W / 2}
              y={chartH - 2}
              textAnchor="middle"
              fontSize={9}
              fontWeight="600"
              fill={colors.textSecondary}
            >
              {d.label}
            </SvgText>
            {d.total > 0 && (
              <SvgText
                x={x + BAR_W / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={8}
                fill={colors.accent}
              >
                {fmtK(d.total)}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Payment Row ─────────────────────────────────────────────────────────────

function PaymentRow({
  payment,
  showClient,
  onPress,
  onLongPress,
}: {
  payment: Payment;
  showClient: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const isPaid = payment.status === 'paid';
  return (
    <Pressable
      style={({ pressed }) => [styles.payRow, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.payRowLeft}>
        {showClient && (
          <Text style={styles.payClientName}>{payment.client_name}</Text>
        )}
        <Text style={styles.payPackage}>{payment.package_type}</Text>
        <Text style={styles.payMeta}>
          {fmtDate(payment.payment_date)}  ·  {METHOD_LABEL[payment.payment_method]}
        </Text>
        {payment.notes ? (
          <Text style={styles.payNotes} numberOfLines={1}>{payment.notes}</Text>
        ) : null}
      </View>
      <View style={styles.payRowRight}>
        <Text style={[styles.payAmount, !isPaid && { color: colors.textSecondary }]}>
          {fmt(payment.amount)}
        </Text>
        <View style={[styles.statusPill, isPaid ? styles.statusPaid : styles.statusPending]}>
          <Text style={[styles.statusText, { color: isPaid ? '#4CAF50' : '#FFA500' }]}>
            {isPaid ? 'Paid' : 'Pending'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function CollapseSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={onToggle}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>{subtitle}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>
      {expanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

// ─── Report Generator ────────────────────────────────────────────────────────

type ReportPeriod = { key: string; label: string } | { key: 'all'; label: string };

function buildCSV(payments: Payment[], periodLabel: string): string {
  const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const paid = payments.filter((p) => p.status === 'paid');
  const pending = payments.filter((p) => p.status === 'pending');
  const paidTotal = paid.reduce((s, p) => s + p.amount, 0);
  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0);

  const vatTotal = paidTotal * VAT_RATE;

  const header = `ELEVATE Revenue Report – ${periodLabel}\nGenerated: ${now}\n\n`;
  const cols = 'DATE,CLIENT,PACKAGE,AMOUNT (OMR),VAT 5% (OMR),METHOD,STATUS,NOTES\n';
  const rows = payments
    .slice()
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
    .map((p) =>
      [
        p.payment_date,
        `"${p.client_name}"`,
        `"${p.package_type}"`,
        p.amount.toFixed(3),
        (p.amount * VAT_RATE).toFixed(3),
        METHOD_LABEL[p.payment_method],
        p.status === 'paid' ? 'Paid' : 'Pending',
        p.notes ? `"${p.notes.replace(/"/g, '""')}"` : '',
      ].join(',')
    )
    .join('\n');

  const summary = `\n\nSUMMARY\nPaid Total,OMR ${paidTotal.toFixed(3)}\nVAT (5%),OMR ${vatTotal.toFixed(3)}\nPending Total,OMR ${pendingTotal.toFixed(3)}\nTotal Records,${payments.length}\nPaid Records,${paid.length}\nPending Records,${pending.length}`;

  return header + cols + rows + summary;
}

function ReportModal({
  visible,
  payments,
  onClose,
}: {
  visible: boolean;
  payments: Payment[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const rp = useMemo(() => makeRpStyles(colors), [colors]);
  const allMonthKeys = [...new Set(payments.map((p) => p.payment_date.slice(0, 7)))].sort().reverse();

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const periods: { key: string; label: string }[] = [
    { key: 'all', label: 'All Time' },
    { key: thisMonthKey, label: fmtMonth(thisMonthKey) },
    ...(allMonthKeys.includes(lastMonthKey) ? [{ key: lastMonthKey, label: fmtMonth(lastMonthKey) }] : []),
    ...allMonthKeys.filter((k) => k !== thisMonthKey && k !== lastMonthKey).map((k) => ({ key: k, label: fmtMonth(k) })),
  ];

  const [selectedKey, setSelectedKey] = useState('all');

  const filtered = selectedKey === 'all'
    ? payments
    : payments.filter((p) => p.payment_date.startsWith(selectedKey));

  const paidFiltered = filtered.filter((p) => p.status === 'paid');
  const paidTotal = paidFiltered.reduce((s, p) => s + p.amount, 0);
  const pendingCount = filtered.filter((p) => p.status === 'pending').length;
  const periodLabel = periods.find((p) => p.key === selectedKey)?.label ?? 'All Time';

  const handleShare = async () => {
    const csv = buildCSV(filtered, periodLabel);
    try {
      await Share.share({ message: csv, title: `Revenue Report – ${periodLabel}` });
    } catch {
      Alert.alert('Error', 'Could not open share sheet.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rp.root}>
        <Pressable style={rp.overlay} onPress={onClose} />
        <View style={rp.sheet}>
          <View style={rp.handle} />
          <Text style={rp.title}>GENERATE REPORT</Text>

          <Text style={rp.label}>SELECT PERIOD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 8 }}>
            {periods.map((p) => (
              <Pressable
                key={p.key}
                style={[rp.chip, selectedKey === p.key && rp.chipActive]}
                onPress={() => setSelectedKey(p.key)}
              >
                <Text style={[rp.chipText, selectedKey === p.key && rp.chipTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={rp.preview}>
            <View style={rp.previewRow}>
              <Text style={rp.previewLabel}>Records</Text>
              <Text style={rp.previewValue}>{filtered.length}</Text>
            </View>
            <View style={rp.previewRow}>
              <Text style={rp.previewLabel}>Paid Total</Text>
              <Text style={[rp.previewValue, { color: colors.accent }]}>{fmt(paidTotal)}</Text>
            </View>
            {paidTotal > 0 && (
              <View style={rp.previewRow}>
                <Text style={rp.previewLabel}>VAT (5%)</Text>
                <Text style={[rp.previewValue, { color: colors.textSecondary }]}>{fmt(paidTotal * VAT_RATE)}</Text>
              </View>
            )}
            {pendingCount > 0 && (
              <View style={rp.previewRow}>
                <Text style={rp.previewLabel}>Pending</Text>
                <Text style={[rp.previewValue, { color: '#FFA500' }]}>{pendingCount} record{pendingCount !== 1 ? 's' : ''}</Text>
              </View>
            )}
            <Text style={rp.previewNote}>Exports as CSV — open in Excel, Sheets, or email to accounting.</Text>
          </View>

          <Pressable
            style={[rp.shareBtn, filtered.length === 0 && { opacity: 0.4 }]}
            onPress={handleShare}
            disabled={filtered.length === 0}
          >
            <Ionicons name="share-outline" size={18} color={colors.bg} />
            <Text style={rp.shareBtnText}>Share Report</Text>
          </Pressable>

          <Pressable style={rp.cancelBtn} onPress={onClose}>
            <Text style={rp.cancelText}>Cancel</Text>
          </Pressable>
          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Payment Form Modal ───────────────────────────────────────────────────────
// Defined outside the main screen to prevent keyboard-flicker on TextInput focus.

type FormProps = {
  visible: boolean;
  editing: Payment | null;
  clients: ReturnType<typeof useClients>['clients'];
  onClose: () => void;
  onSave: (data: NewPayment) => Promise<void>;
};

function PaymentFormModal({ visible, editing, clients, onClose, onSave }: FormProps) {
  const [clientId, setClientId] = useState('');
  const [packageType, setPackageType] = useState('');
  const [amount, setAmount] = useState('');
  const { colors } = useTheme();
  const fm = useMemo(() => makeFmStyles(colors), [colors]);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<PaymentStatus>('paid');
  const [notes, setNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setClientId(editing.client_id);
      setPackageType(editing.package_type);
      setAmount(String(editing.amount));
      setMethod(editing.payment_method);
      setDate(editing.payment_date);
      setStatus(editing.status);
      setNotes(editing.notes ?? '');
    } else {
      setClientId('');
      setPackageType('');
      setAmount('');
      setMethod('cash');
      setDate(todayISO());
      setStatus('paid');
      setNotes('');
    }
    setPickerOpen(false);
  }, [visible, editing?.id]);

  const selectedClient = clients.find((c) => c.id === clientId);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!clientId) { Alert.alert('Missing', 'Please select a client.'); return; }
    if (!parsedAmount || parsedAmount <= 0) { Alert.alert('Missing', 'Please enter a valid amount.'); return; }
    setSaving(true);
    await onSave({
      client_id: clientId,
      package_type: packageType.trim() || 'Package',
      amount: parsedAmount,
      payment_method: method,
      payment_date: date || todayISO(),
      status,
      notes: notes.trim() || null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fm.root}>
        <Pressable style={fm.overlay} onPress={onClose} />
        <View style={fm.sheet}>
          <View style={fm.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={fm.title}>{editing ? 'EDIT PAYMENT' : 'ADD PAYMENT'}</Text>

            {/* Client */}
            <Text style={fm.label}>CLIENT</Text>
            <Pressable style={fm.select} onPress={() => setPickerOpen((v) => !v)}>
              <Text style={[fm.selectText, !selectedClient && { color: colors.textSecondary + '80' }]}>
                {selectedClient ? selectedClient.name : 'Select a client…'}
              </Text>
              <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textSecondary} />
            </Pressable>
            {pickerOpen && (
              <View style={fm.dropdown}>
                <FlatList
                  data={clients}
                  keyExtractor={(c) => c.id}
                  scrollEnabled={false}
                  renderItem={({ item: c }) => (
                    <Pressable
                      style={[fm.dropItem, c.id === clientId && fm.dropItemActive]}
                      onPress={() => { setClientId(c.id); setPickerOpen(false); }}
                    >
                      <Text style={[fm.dropItemText, c.id === clientId && { color: colors.accent }]}>
                        {c.name}
                      </Text>
                      {c.id === clientId && <Ionicons name="checkmark" size={14} color={colors.accent} />}
                    </Pressable>
                  )}
                />
              </View>
            )}

            {/* Package description */}
            <Text style={fm.label}>PACKAGE / DESCRIPTION</Text>
            <TextInput
              style={fm.input}
              value={packageType}
              onChangeText={setPackageType}
              placeholder="e.g. 20 sessions · 1hr"
              placeholderTextColor={colors.textSecondary + '60'}
              autoCorrect={false}
            />

            {/* Amount */}
            <Text style={fm.label}>AMOUNT (OMR)</Text>
            <View style={fm.amountWrap}>
              <Text style={fm.peso}>OMR</Text>
              <TextInput
                style={[fm.input, fm.amountInput]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.000"
                placeholderTextColor={colors.textSecondary + '60'}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Payment method */}
            <Text style={fm.label}>PAYMENT METHOD</Text>
            <View style={fm.methodList}>
              {(['cash', 'bank_muscat', 'nbo', 'oab', 'bank_dhofar', 'ahli_bank', 'sohar', 'hsbc', 'bank_nizwa', 'other'] as PaymentMethod[]).map((m) => (
                <Pressable
                  key={m}
                  style={[fm.methodOption, method === m && fm.methodOptionActive]}
                  onPress={() => setMethod(m)}
                >
                  <Text style={[fm.methodOptionText, method === m && fm.methodOptionTextActive]}>
                    {METHOD_LABEL[m]}
                  </Text>
                  {method === m && <Ionicons name="checkmark" size={14} color={colors.accent} />}
                </Pressable>
              ))}
            </View>

            {/* Date */}
            <Text style={fm.label}>DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={fm.input}
              value={date}
              onChangeText={setDate}
              placeholder="2025-06-01"
              placeholderTextColor={colors.textSecondary + '60'}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />

            {/* Status */}
            <Text style={fm.label}>STATUS</Text>
            <View style={fm.segRow}>
              {(['paid', 'pending'] as PaymentStatus[]).map((s) => (
                <Pressable
                  key={s}
                  style={[
                    fm.seg,
                    status === s && (s === 'paid' ? fm.segActive : fm.segPending),
                  ]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[fm.segText, status === s && fm.segTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <Text style={fm.label}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={[fm.input, fm.inputMulti]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. BDO transfer, referral discount…"
              placeholderTextColor={colors.textSecondary + '60'}
              multiline
              numberOfLines={3}
              autoCorrect={false}
            />

            <View style={fm.btnRow}>
              <Pressable style={fm.cancelBtn} onPress={onClose}>
                <Text style={fm.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={fm.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={fm.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
            <View style={{ height: 48 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RevenueScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { payments, loading, refetch, addPayment, updatePayment, deletePayment, toggleStatus } =
    usePayments();
  const { clients } = useClients();

  const [activeTab, setActiveTab] = useState<'monthly' | 'clients'>('monthly');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showReport, setShowReport] = useState(false);

  useFocusEffect(useCallback(() => { refetch(); }, []));

  const toggleExpand = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const openAdd = () => { setEditingPayment(null); setShowModal(true); };
  const openEdit = (p: Payment) => { setEditingPayment(p); setShowModal(true); };

  const handleSave = async (data: NewPayment) => {
    if (editingPayment) {
      await updatePayment(editingPayment.id, data);
    } else {
      await addPayment(data);
    }
  };

  const handlePaymentPress = (p: Payment) => {
    Alert.alert(p.client_name, `${p.package_type} · ${fmt(p.amount)}`, [
      {
        text: p.status === 'paid' ? 'Mark as Pending' : 'Mark as Paid',
        onPress: () => toggleStatus(p.id, p.status),
      },
      { text: 'Edit', onPress: () => openEdit(p) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete Payment', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deletePayment(p.id) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const thisMonthKey = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  })();

  const paidPayments = payments.filter((p) => p.status === 'paid');
  const thisMonthPaid = paidPayments.filter((p) => p.payment_date.startsWith(thisMonthKey));
  const thisMonthTotal = thisMonthPaid.reduce((s, p) => s + p.amount, 0);
  const allTimeTotal = paidPayments.reduce((s, p) => s + p.amount, 0);
  const thisMonthPackages = payments.filter((p) => p.payment_date.startsWith(thisMonthKey)).length;
  const activeClientCount = new Set(paidPayments.map((p) => p.client_id)).size;
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  // Bar chart: last 6 months
  const last6 = getLast6Months();
  const chartData = last6.map(({ key, label }) => ({
    label,
    total: paidPayments.filter((p) => p.payment_date.startsWith(key)).reduce((s, p) => s + p.amount, 0),
  }));

  // Monthly grouping (desc)
  const monthKeys = [
    ...new Set(payments.map((p) => p.payment_date.slice(0, 7))),
  ].sort().reverse();

  // Client grouping
  const clientIds = [...new Set(payments.map((p) => p.client_id))];
  const byClient = clientIds.map((id) => {
    const cp = payments.filter((p) => p.client_id === id);
    return { id, name: cp[0].client_name, payments: cp };
  });

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
      >
        {/* ── Summary cards ──────────────────────────────────────── */}
        <View style={styles.grid}>
          <View style={[styles.card, styles.cardAccent]}>
            <Text style={styles.cardValue}>{fmt(thisMonthTotal)}</Text>
            {thisMonthTotal > 0 && (
              <Text style={styles.cardVat}>+{fmt(thisMonthTotal * VAT_RATE)} VAT</Text>
            )}
            <Text style={styles.cardLabel}>This Month</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardValue}>{fmt(allTimeTotal)}</Text>
            {allTimeTotal > 0 && (
              <Text style={styles.cardVat}>+{fmt(allTimeTotal * VAT_RATE)} VAT</Text>
            )}
            <Text style={styles.cardLabel}>All Time</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardValue}>{thisMonthPackages}</Text>
            <Text style={styles.cardLabel}>Packages This Month</Text>
          </View>
          <View style={styles.card}>
            <Text style={[styles.cardValue, pendingCount > 0 && { color: '#FFA500' }]}>
              {pendingCount > 0 ? `⚠ ${pendingCount}` : activeClientCount}
            </Text>
            <Text style={styles.cardLabel}>
              {pendingCount > 0 ? 'Pending Payments' : 'Clients Paid'}
            </Text>
          </View>
        </View>

        {/* ── Bar chart ──────────────────────────────────────────── */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>EARNINGS — LAST 6 MONTHS</Text>
            <Pressable style={styles.reportBtn} onPress={() => setShowReport(true)}>
              <Ionicons name="document-text-outline" size={15} color={colors.accent} />
              <Text style={styles.reportBtnText}>Report</Text>
            </Pressable>
          </View>
          {allTimeTotal === 0 ? (
            <Text style={styles.chartEmpty}>No paid records yet</Text>
          ) : (
            <BarChart data={chartData} />
          )}
        </View>

        {/* ── Tab switcher ───────────────────────────────────────── */}
        <View style={styles.tabRow}>
          {(['monthly', 'clients'] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'monthly' ? 'By Month' : 'By Client'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Empty state ────────────────────────────────────────── */}
        {payments.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={52} color={colors.border} />
            <Text style={styles.emptyTitle}>No revenue recorded yet</Text>
            <Text style={styles.emptySub}>Tap + to add your first payment</Text>
          </View>
        ) : activeTab === 'monthly' ? (
          /* ── Monthly view ────────────────────────────────────── */
          monthKeys.map((key) => {
            const mp = payments.filter((p) => p.payment_date.startsWith(key));
            const mTotal = mp.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
            const mPending = mp.filter((p) => p.status === 'pending').length;
            return (
              <CollapseSection
                key={key}
                title={fmtMonth(key)}
                subtitle={`${fmt(mTotal)}  +${fmt(mTotal * VAT_RATE)} VAT${mPending > 0 ? `  ·  ${mPending} pending` : ''}  ·  ${mp.length} record${mp.length !== 1 ? 's' : ''}`}
                expanded={expandedKeys.has(key)}
                onToggle={() => toggleExpand(key)}
              >
                {mp.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    showClient
                    onPress={() => handlePaymentPress(p)}
                    onLongPress={() => openEdit(p)}
                  />
                ))}
              </CollapseSection>
            );
          })
        ) : (
          /* ── Client view ─────────────────────────────────────── */
          byClient.map(({ id, name, payments: cp }) => {
            const cTotal = cp.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
            const cPending = cp.filter((p) => p.status === 'pending').length;
            return (
              <CollapseSection
                key={id}
                title={name}
                subtitle={`${fmt(cTotal)} paid  +${fmt(cTotal * VAT_RATE)} VAT${cPending > 0 ? `  ·  ${cPending} pending` : ''}  ·  ${cp.length} record${cp.length !== 1 ? 's' : ''}`}
                expanded={expandedKeys.has(id)}
                onToggle={() => toggleExpand(id)}
              >
                {cp.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    showClient={false}
                    onPress={() => handlePaymentPress(p)}
                    onLongPress={() => openEdit(p)}
                  />
                ))}
              </CollapseSection>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <Pressable style={styles.fab} onPress={openAdd}>
        <Ionicons name="add" size={28} color={colors.bg} />
      </Pressable>

      {/* ── Add / Edit Modal ── */}
      <PaymentFormModal
        visible={showModal}
        editing={editingPayment}
        clients={clients}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

      {/* ── Report Modal ── */}
      <ReportModal
        visible={showReport}
        payments={payments}
        onClose={() => setShowReport(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  scroll: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 32 },

  // Summary grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: {
    flex: 1, minWidth: '44%',
    backgroundColor: c.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: c.border,
  },
  cardAccent: { backgroundColor: c.accent + '12', borderColor: c.accent + '40' },
  cardValue: { ...Typography.subtitle, color: c.accent, fontWeight: '800', marginBottom: 2 },
  cardVat: { fontSize: 11, color: c.textSecondary, marginBottom: 4 },
  cardLabel: { ...Typography.caption, color: c.textSecondary },

  // Chart
  chartCard: {
    backgroundColor: c.surface, borderRadius: 16,
    borderWidth: 1, borderColor: c.border,
    padding: 16, marginBottom: 16, overflow: 'hidden',
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  chartTitle: { ...Typography.label, color: c.textSecondary },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: c.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: c.accent + '40',
  },
  reportBtnText: { fontSize: 12, fontWeight: '700', color: c.accent },
  chartEmpty: { ...Typography.body, color: c.textSecondary, textAlign: 'center', paddingVertical: 24 },

  // Tabs
  tabRow: {
    flexDirection: 'row', backgroundColor: c.surface,
    borderRadius: 12, borderWidth: 1, borderColor: c.border,
    padding: 4, marginBottom: 14,
  },
  tabBtn: { flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: c.accent },
  tabText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
  tabTextActive: { color: c.bg },

  // Collapsible section
  section: {
    backgroundColor: c.surface, borderRadius: 14,
    borderWidth: 1, borderColor: c.border, marginBottom: 10, overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  sectionHeaderLeft: { flex: 1 },
  sectionTitle: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
  sectionSub: { ...Typography.caption, color: c.textSecondary },
  sectionBody: { borderTopWidth: 1, borderTopColor: c.border },

  // Payment row
  payRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  payRowLeft: { flex: 1, marginRight: 10 },
  payClientName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 1 },
  payPackage: { ...Typography.body, color: c.textPrimary, marginBottom: 2 },
  payMeta: { ...Typography.caption, color: c.textSecondary },
  payNotes: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic', marginTop: 2 },
  payRowRight: { alignItems: 'flex-end', gap: 6 },
  payAmount: { ...Typography.body, color: c.accent, fontWeight: '700' },
  statusPill: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  statusPaid: { backgroundColor: '#4CAF5015', borderColor: '#4CAF5040' },
  statusPending: { backgroundColor: '#FFA50015', borderColor: '#FFA50040' },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: c.accent,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
});
}

// Form modal styles (separate namespace to keep clean)
function makeFmStyles(colors: ColorScheme) {
  return StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: '88%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20,
  },
  title: { ...Typography.label, color: colors.textPrimary, fontWeight: '800', letterSpacing: 1.5, marginBottom: 20 },
  label: { ...Typography.label, color: colors.textSecondary, marginBottom: 6, marginTop: 16 },

  // Client dropdown
  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  selectText: { ...Typography.body, color: colors.textPrimary, flex: 1 },
  dropdown: {
    backgroundColor: colors.surfaceRaised, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    marginTop: 4, maxHeight: 200, overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dropItemActive: { backgroundColor: colors.accent + '10' },
  dropItemText: { ...Typography.body, color: colors.textPrimary },

  // Inputs
  input: {
    backgroundColor: colors.surfaceRaised, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: colors.textPrimary, fontSize: 15,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  peso: { ...Typography.body, color: colors.accent, fontWeight: '800' },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '700' },

  // Segment controls (status only)
  segRow: { flexDirection: 'row', gap: 8 },
  seg: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  segActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segPending: { backgroundColor: '#FFA50020', borderColor: '#FFA50060' },
  segText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  segTextActive: { color: colors.bg },

  // Payment method list
  methodList: { gap: 4 },
  methodOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  methodOptionActive: { backgroundColor: colors.accent + '15', borderColor: colors.accent },
  methodOptionText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  methodOptionTextActive: { color: colors.accent, fontWeight: '700' },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 13, alignItems: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: '700', fontSize: 15 },
  saveBtn: {
    flex: 1, borderRadius: 12, backgroundColor: colors.accent,
    paddingVertical: 13, alignItems: 'center',
  },
  saveText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
});
}

// Report modal styles
function makeRpStyles(colors: ColorScheme) {
  return StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
    paddingHorizontal: 20, paddingTop: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20,
  },
  title: { ...Typography.label, color: colors.textPrimary, fontWeight: '800', letterSpacing: 1.5, marginBottom: 20 },
  label: { ...Typography.label, color: colors.textSecondary, marginBottom: 10 },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.bg },

  preview: {
    backgroundColor: colors.bg, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 20, gap: 10,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLabel: { ...Typography.body, color: colors.textSecondary },
  previewValue: { ...Typography.body, color: colors.textPrimary, fontWeight: '700' },
  previewNote: { ...Typography.caption, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 14, marginBottom: 10,
  },
  shareBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
  cancelBtn: {
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 13, alignItems: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: '700', fontSize: 15 },
});
}