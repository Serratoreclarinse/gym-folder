import { useCallback, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type Payment = {
  id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  paid_at: string;
  client_name: string;
  coach_name: string;
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
};

const METHOD_COLOR: Record<string, string> = {
  cash: '#4CAF50',
  gcash: '#2196F3',
  maya: '#9C27B0',
  bank_transfer: '#FF9800',
  other: Colors.textSecondary,
};

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminPaymentsScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

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

  const thisMonthStart = monthStart();
  const monthlyPayments = payments.filter((p) => p.paid_at >= thisMonthStart);
  const monthlyTotal = monthlyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const allTimeTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const methodTotals = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.payment_method] = (acc[p.payment_method] ?? 0) + Number(p.amount);
    return acc;
  }, {});

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
    >
      {/* Revenue summary */}
      <Text style={s.sectionTitle}>REVENUE SUMMARY</Text>
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

      {/* Breakdown by method */}
      {Object.keys(methodTotals).length > 0 && (
        <>
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>BY PAYMENT METHOD</Text>
          <View style={s.methodsCard}>
            {Object.entries(methodTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([method, total], i, arr) => (
                <View
                  key={method}
                  style={[s.methodRow, i < arr.length - 1 && s.methodRowBorder]}
                >
                  <View style={[s.methodDot, { backgroundColor: METHOD_COLOR[method] ?? Colors.textSecondary }]} />
                  <Text style={s.methodName}>{METHOD_LABEL[method] ?? method}</Text>
                  <Text style={s.methodTotal}>
                    OMR {total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
          </View>
        </>
      )}

      {/* All payments */}
      <Text style={[s.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>
        ALL PAYMENTS
      </Text>
      {payments.length === 0 ? (
        <View style={s.emptyCard}>
          <Ionicons name="cash-outline" size={44} color={Colors.border} />
          <Text style={s.emptyTitle}>No payments recorded</Text>
          <Text style={s.emptySub}>Coaches record payments from the client detail page</Text>
        </View>
      ) : (
        payments.map((p) => {
          const color = METHOD_COLOR[p.payment_method] ?? Colors.textSecondary;
          const dateStr = new Date(p.paid_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          });
          return (
            <View key={p.id} style={s.paymentCard}>
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
                <Text style={s.amountText}>
                  OMR {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 12 },

  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 16, alignItems: 'center',
  },
  summaryLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 6, textAlign: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '900', color: '#4CAF50', marginBottom: 4 },
  summaryCount: { ...Typography.caption, color: Colors.textSecondary },

  methodsCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  methodRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  methodDot: { width: 10, height: 10, borderRadius: 5 },
  methodName: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  methodTotal: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },

  paymentCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 8,
  },
  paymentTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  clientAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accent + '18', borderWidth: 1, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  clientAvatarText: { fontSize: 13, fontWeight: '800', color: Colors.accent },
  paymentInfo: { flex: 1 },
  clientName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  coachName: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 4 },
  paymentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  methodPill: {
    borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1,
  },
  methodPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  dateText: { ...Typography.caption, color: Colors.textSecondary },
  notesText: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
  amountText: { fontSize: 16, fontWeight: '900', color: '#4CAF50', flexShrink: 0 },

  emptyCard: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 8 },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
});
