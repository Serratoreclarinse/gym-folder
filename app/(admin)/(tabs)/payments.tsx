import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

type Payment = {
  id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  paid_at: string;
  client_name: string;
  coach_name: string;
};

type CoachOption = { id: string; name: string };
type ClientOption = { id: string; name: string; package_id: string | null };

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', bank_muscat: 'Bank Muscat', nbo: 'NBO', oab: 'OAB',
  bank_dhofar: 'Bank Dhofar', ahli_bank: 'Ahli Bank', sohar: 'Sohar Intl',
  hsbc: 'HSBC Oman', bank_nizwa: 'Bank Nizwa', other: 'Other',
};

const METHOD_COLOR: Record<string, string> = {
  cash: '#4CAF50', bank_muscat: '#2196F3', nbo: '#FF9800', oab: '#9C27B0',
  bank_dhofar: '#00BCD4', ahli_bank: '#FF5722', sohar: '#8BC34A',
  hsbc: '#E91E63', bank_nizwa: '#3F51B5', other: '#888888',
};

const PAYMENT_METHODS = Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }));

function monthStart(): string {
  const d = new Date();
  d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminPaymentsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCoach, setFilterCoach] = useState<string | null>(null);

  // Record payment modal state
  const [showModal, setShowModal] = useState(false);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<CoachOption | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [payDate, setPayDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showCoachPicker, setShowCoachPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id, amount, payment_method, notes, paid_at,
        client:profiles!payments_client_id_fkey(name),
        coach:profiles!payments_coach_id_fkey(name)
      `)
      .order('paid_at', { ascending: false })
      .limit(100);

    if (error) { setLoading(false); return; }
    setPayments(
      (data ?? []).map((row: any) => ({
        id: row.id,
        amount: row.amount,
        payment_method: row.payment_method,
        notes: row.notes,
        paid_at: row.paid_at,
        client_name: row.client?.name ?? '—',
        coach_name: row.coach?.name ?? '—',
      })),
    );
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openModal = async () => {
    setAmount(''); setNotes(''); setTransactionRef('');
    setPayDate(todayStr()); setMethod('cash');
    setSelectedCoach(null); setSelectedClient(null); setClients([]);
    const { data } = await supabase
      .from('profiles').select('id, name').eq('role', 'coach').is('deactivated_at', null).order('name');
    setCoaches((data ?? []) as CoachOption[]);
    setShowModal(true);
  };

  const selectCoach = async (coach: CoachOption) => {
    setSelectedCoach(coach);
    setSelectedClient(null);
    setShowCoachPicker(false);
    setLoadingClients(true);
    const { data } = await supabase
      .from('packages')
      .select('client_id, id, client:profiles!packages_client_id_fkey(name)')
      .eq('coach_id', coach.id)
      .eq('status', 'active');
    const seen = new Set<string>();
    setClients(
      (data ?? []).reduce((acc: ClientOption[], r: any) => {
        if (!seen.has(r.client_id)) {
          seen.add(r.client_id);
          acc.push({ id: r.client_id, name: r.client?.name ?? '—', package_id: r.id });
        }
        return acc;
      }, []),
    );
    setLoadingClients(false);
  };

  const handleSave = async () => {
    if (!selectedCoach || !selectedClient) { Alert.alert('Missing info', 'Select a coach and client.'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Invalid amount', 'Enter a valid amount.'); return; }
    if (!payDate.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Invalid date', 'Use YYYY-MM-DD format.'); return; }
    setSaving(true);
    const { error } = await supabase.from('payments').insert({
      client_id: selectedClient.id,
      coach_id: selectedCoach.id,
      package_id: selectedClient.package_id ?? null,
      amount: amt,
      payment_method: method,
      notes: notes.trim() || null,
      transaction_ref: transactionRef.trim() || null,
      recorded_by: user?.id ?? null,
      paid_at: new Date(payDate + 'T00:00:00').toISOString(),
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowModal(false);
    load();
  };

  const exportCSV = () => {
    if (visiblePayments.length === 0) { Alert.alert('No data', 'No payments to export.'); return; }
    const header = ['Date', 'Client', 'Coach', 'Method', 'Amount (OMR)', 'Notes'].join(',');
    const rows = visiblePayments.map((p) => [
      new Date(p.paid_at).toLocaleDateString('en-US'),
      `"${p.client_name}"`,
      `"${p.coach_name}"`,
      METHOD_LABEL[p.payment_method] ?? p.payment_method,
      Number(p.amount).toFixed(2),
      `"${p.notes ?? ''}"`,
    ].join(','));
    const csv = [header, ...rows].join('\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const thisMonthStart = monthStart();
  const allCoaches = useMemo(() => {
    const seen = new Set<string>();
    return payments.reduce<string[]>((acc, p) => {
      if (p.coach_name !== '—' && !seen.has(p.coach_name)) { seen.add(p.coach_name); acc.push(p.coach_name); }
      return acc;
    }, []).sort();
  }, [payments]);
  const visiblePayments = filterCoach ? payments.filter((p) => p.coach_name === filterCoach) : payments;
  const monthlyPayments = visiblePayments.filter((p) => p.paid_at >= thisMonthStart);
  const monthlyTotal = monthlyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const allTimeTotal = visiblePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const methodTotals = visiblePayments.reduce<Record<string, number>>((acc, p) => {
    acc[p.payment_method] = (acc[p.payment_method] ?? 0) + Number(p.amount);
    return acc;
  }, {});
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
      >
        {/* Header row with Record Payment button */}
        <View style={s.topRow}>
          <Text style={s.sectionTitle}>REVENUE SUMMARY</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Platform.OS === 'web' && payments.length > 0 && (
              <Pressable style={s.exportBtn} onPress={exportCSV}>
                <Ionicons name="download-outline" size={16} color={colors.accent} />
                <Text style={s.exportBtnText}>Export</Text>
              </Pressable>
            )}
            <Pressable style={s.recordBtn} onPress={openModal}>
              <Ionicons name="add" size={16} color={colors.bg} />
              <Text style={s.recordBtnText}>Record Payment</Text>
            </Pressable>
          </View>
        </View>

        {allCoaches.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
            <Pressable
              style={[s.filterChip, filterCoach === null && s.filterChipActive]}
              onPress={() => setFilterCoach(null)}
            >
              <Text style={[s.filterChipText, filterCoach === null && s.filterChipTextActive]}>All Coaches</Text>
            </Pressable>
            {allCoaches.map((name) => (
              <Pressable
                key={name}
                style={[s.filterChip, filterCoach === name && s.filterChipActive]}
                onPress={() => setFilterCoach(filterCoach === name ? null : name)}
              >
                <Text style={[s.filterChipText, filterCoach === name && s.filterChipTextActive]}>{name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>{monthName}</Text>
            <Text style={s.summaryValue}>
              OMR {monthlyTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </Text>
            <Text style={s.summaryCount}>{monthlyPayments.length} payment{monthlyPayments.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>All Time</Text>
            <Text style={s.summaryValue}>
              OMR {allTimeTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </Text>
            <Text style={s.summaryCount}>{payments.length} payment{payments.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {Object.keys(methodTotals).length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 24 }]}>BY PAYMENT METHOD</Text>
            <View style={s.methodsCard}>
              {Object.entries(methodTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([method, total], i, arr) => (
                  <View key={method} style={[s.methodRow, i < arr.length - 1 && s.methodRowBorder]}>
                    <View style={[s.methodDot, { backgroundColor: METHOD_COLOR[method] ?? colors.textSecondary }]} />
                    <Text style={s.methodName}>{METHOD_LABEL[method] ?? method}</Text>
                    <Text style={s.methodTotal}>
                      OMR {total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}
            </View>
          </>
        )}

        <Text style={[s.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>
          {filterCoach ? `${filterCoach.toUpperCase()}'S PAYMENTS` : 'ALL PAYMENTS'}
        </Text>
        {visiblePayments.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="cash-outline" size={44} color={colors.border} />
            <Text style={s.emptyTitle}>{filterCoach ? 'No payments for this coach' : 'No payments recorded'}</Text>
            {!filterCoach && <Pressable style={s.emptyBtn} onPress={openModal}>
              <Ionicons name="add" size={16} color={colors.bg} />
              <Text style={s.emptyBtnText}>Record First Payment</Text>
            </Pressable>}
          </View>
        ) : (
          visiblePayments.map((p) => {
            const color = METHOD_COLOR[p.payment_method] ?? colors.textSecondary;
            const dateStr = new Date(p.paid_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            return (
              <Pressable
                key={p.id}
                style={({ pressed }) => [s.paymentCard, pressed && { opacity: 0.75 }]}
                onPress={() => router.push(`/(admin)/invoice/${p.id}` as any)}
              >
                <View style={s.paymentTop}>
                  <View style={s.clientAvatar}>
                    <Text style={s.clientAvatarText}>{initials(p.client_name)}</Text>
                  </View>
                  <View style={s.paymentInfo}>
                    <Text style={s.clientName}>{p.client_name}</Text>
                    <Text style={s.coachName}>Coach: {p.coach_name}</Text>
                    <View style={s.paymentMeta}>
                      <View style={[s.methodPill, { backgroundColor: color + '20', borderColor: color + '60' }]}>
                        <Text style={[s.methodPillText, { color }]}>
                          {METHOD_LABEL[p.payment_method] ?? p.payment_method}
                        </Text>
                      </View>
                      <Text style={s.dateText}>{dateStr}</Text>
                    </View>
                    {p.notes ? <Text style={s.notesText}>"{p.notes}"</Text> : null}
                  </View>
                  <View style={s.amountRight}>
                    <Text style={s.amountText}>
                      OMR {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </Text>
                    <Ionicons name="receipt-outline" size={14} color={colors.textSecondary} style={{ marginTop: 4 }} />
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Record Payment Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>Record Payment</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Coach picker */}
              <Text style={s.fieldLabel}>COACH</Text>
              <Pressable style={s.pickerBtn} onPress={() => setShowCoachPicker(true)}>
                <Text style={[s.pickerBtnText, !selectedCoach && { color: colors.textSecondary }]}>
                  {selectedCoach?.name ?? 'Select coach…'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </Pressable>

              {/* Client picker */}
              <Text style={s.fieldLabel}>CLIENT</Text>
              <Pressable
                style={[s.pickerBtn, !selectedCoach && s.pickerBtnDisabled]}
                onPress={() => selectedCoach && setShowClientPicker(true)}
              >
                {loadingClients
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <Text style={[s.pickerBtnText, !selectedClient && { color: colors.textSecondary }]}>
                      {selectedClient?.name ?? (selectedCoach ? 'Select client…' : 'Select coach first')}
                    </Text>
                }
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </Pressable>

              {/* Amount */}
              <Text style={s.fieldLabel}>AMOUNT (OMR)</Text>
              <TextInput
                style={s.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              {/* Payment method */}
              <Text style={s.fieldLabel}>PAYMENT METHOD</Text>
              <Pressable style={s.pickerBtn} onPress={() => setShowMethodPicker(true)}>
                <View style={[s.methodDot, { backgroundColor: METHOD_COLOR[method] ?? colors.textSecondary }]} />
                <Text style={s.pickerBtnText}>{METHOD_LABEL[method]}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </Pressable>

              {/* Date */}
              <Text style={s.fieldLabel}>DATE</Text>
              <TextInput
                style={s.input}
                value={payDate}
                onChangeText={setPayDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              {/* Transaction ref */}
              <Text style={s.fieldLabel}>TRANSACTION REF (optional)</Text>
              <TextInput
                style={s.input}
                value={transactionRef}
                onChangeText={setTransactionRef}
                placeholder="Bank ref, receipt no., etc."
                placeholderTextColor={colors.textSecondary}
              />

              {/* Notes */}
              <Text style={s.fieldLabel}>NOTES (optional)</Text>
              <TextInput
                style={[s.input, { height: 68, textAlignVertical: 'top', paddingTop: 10 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional notes…"
                placeholderTextColor={colors.textSecondary}
                multiline
              />

              <Pressable
                style={[s.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Record Payment'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Coach picker sheet */}
      <Modal visible={showCoachPicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '60%' }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { marginBottom: 12 }]}>Select Coach</Text>
            <ScrollView>
              {coaches.map((c) => (
                <Pressable key={c.id} style={s.pickerItem} onPress={() => selectCoach(c)}>
                  <Text style={s.pickerItemText}>{c.name}</Text>
                  {selectedCoach?.id === c.id && (
                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Client picker sheet */}
      <Modal visible={showClientPicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '60%' }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { marginBottom: 12 }]}>Select Client</Text>
            <ScrollView>
              {clients.length === 0
                ? <Text style={s.emptyPickerText}>No active clients for this coach</Text>
                : clients.map((c) => (
                  <Pressable
                    key={c.id}
                    style={s.pickerItem}
                    onPress={() => { setSelectedClient(c); setShowClientPicker(false); }}
                  >
                    <Text style={s.pickerItemText}>{c.name}</Text>
                    {selectedClient?.id === c.id && (
                      <Ionicons name="checkmark" size={18} color={colors.accent} />
                    )}
                  </Pressable>
                ))
              }
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Method picker sheet */}
      <Modal visible={showMethodPicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '70%' }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { marginBottom: 12 }]}>Payment Method</Text>
            <ScrollView>
              {PAYMENT_METHODS.map((m) => (
                <Pressable
                  key={m.value}
                  style={s.pickerItem}
                  onPress={() => { setMethod(m.value); setShowMethodPicker(false); }}
                >
                  <View style={[s.methodDot, { backgroundColor: METHOD_COLOR[m.value] }]} />
                  <Text style={s.pickerItemText}>{m.label}</Text>
                  {method === m.value && (
                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { ...Typography.label, color: c.textSecondary },
    recordBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: c.accent, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    recordBtnText: { color: c.bg, fontWeight: '700', fontSize: 13 },
    exportBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: c.accent, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    exportBtnText: { color: c.accent, fontWeight: '700', fontSize: 13 },

    filterScroll: { marginBottom: 16, marginHorizontal: -20 },
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 2 },
    filterChip: {
      borderRadius: 20, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 14, paddingVertical: 7, backgroundColor: c.surface,
    },
    filterChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    filterChipText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    filterChipTextActive: { color: c.bg },

    summaryRow: { flexDirection: 'row', gap: 12 },
    summaryCard: {
      flex: 1, backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, padding: 16, alignItems: 'center',
    },
    summaryLabel: { ...Typography.caption, color: c.textSecondary, marginBottom: 6, textAlign: 'center' },
    summaryValue: { fontSize: 22, fontWeight: '900', color: c.success, marginBottom: 4 },
    summaryCount: { ...Typography.caption, color: c.textSecondary },

    methodsCard: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    },
    methodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    methodRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    methodDot: { width: 10, height: 10, borderRadius: 5 },
    methodName: { ...Typography.body, color: c.textPrimary, flex: 1 },
    methodTotal: { fontSize: 15, fontWeight: '800', color: c.textPrimary },

    paymentCard: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 8,
    },
    paymentTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    clientAvatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.accent + '18', borderWidth: 1, borderColor: c.accent + '40',
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    clientAvatarText: { fontSize: 13, fontWeight: '800', color: c.accent },
    paymentInfo: { flex: 1 },
    clientName: { ...Typography.body, color: c.textPrimary, fontWeight: '700', marginBottom: 2 },
    coachName: { ...Typography.caption, color: c.textSecondary, marginBottom: 4 },
    paymentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    methodPill: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
    methodPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
    dateText: { ...Typography.caption, color: c.textSecondary },
    notesText: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic' },
    amountRight: { alignItems: 'flex-end', flexShrink: 0 },
    amountText: { fontSize: 16, fontWeight: '900', color: c.success },

    emptyCard: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 8 },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.accent, borderRadius: 10,
      paddingHorizontal: 16, paddingVertical: 10,
    },
    emptyBtnText: { color: c.bg, fontWeight: '700', fontSize: 14 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, paddingBottom: 36, maxHeight: '90%',
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2, backgroundColor: c.border,
      alignSelf: 'center', marginBottom: 16,
    },
    modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    modalTitle: { ...Typography.subtitle, color: c.textPrimary, fontWeight: '800', fontSize: 17 },

    fieldLabel: { ...Typography.label, color: c.textSecondary, fontSize: 11, letterSpacing: 0.8, marginBottom: 6 },
    input: {
      backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 14, paddingVertical: 12, color: c.textPrimary, fontSize: 15, marginBottom: 16,
    },
    pickerBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
    },
    pickerBtnDisabled: { opacity: 0.5 },
    pickerBtnText: { flex: 1, color: c.textPrimary, fontSize: 15 },

    saveBtn: {
      backgroundColor: c.accent, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center', marginTop: 8,
    },
    saveBtnText: { color: c.bg, fontWeight: '800', fontSize: 15 },

    pickerItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 14, paddingHorizontal: 4,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    pickerItemText: { flex: 1, ...Typography.body, color: c.textPrimary },
    emptyPickerText: { ...Typography.body, color: c.textSecondary, textAlign: 'center', paddingVertical: 24 },
  });
}
