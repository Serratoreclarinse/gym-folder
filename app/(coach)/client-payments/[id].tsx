import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image, Modal, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import { Typography, ColorScheme } from '@/constants/theme';

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', bank_muscat: 'Bank Muscat', nbo: 'NBO', oab: 'OAB',
  bank_dhofar: 'Bank Dhofar', ahli_bank: 'Ahli Bank', sohar: 'Sohar Intl',
  hsbc: 'HSBC Oman', bank_nizwa: 'Bank Nizwa', other: 'Other',
};

type Payment = {
  id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  paid_at: string;
  receipt_url: string | null;
};

export default function ClientPaymentsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  useEffect(() => {
    if (name) navigation.setOptions({ title: `${name} — Payments` });
  }, [name]);

  const fetch = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('payments')
      .select('id, amount, payment_method, notes, paid_at, receipt_url')
      .eq('client_id', id)
      .order('paid_at', { ascending: false });
    setPayments((data ?? []) as Payment[]);
  }, [id]);

  useEffect(() => { fetch().then(() => setLoading(false)); }, [fetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetch();
    setRefreshing(false);
  }, [fetch]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    );
  }

  if (payments.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="cash-outline" size={44} color={colors.textSecondary} style={{ opacity: 0.4 }} />
        <Text style={styles.emptyText}>No payments recorded</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.card}>
          {payments.map((p, i) => (
            <Pressable
              key={p.id}
              style={({ pressed }) => [
                styles.row,
                i < payments.length - 1 && styles.rowBorder,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setSelected(p)}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.method}>{METHOD_LABEL[p.payment_method] ?? p.payment_method}</Text>
                <Text style={styles.date}>
                  {new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                {p.notes ? <Text style={styles.notes} numberOfLines={1}>{p.notes}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.amount}>
                  OMR {p.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </Text>
                {p.receipt_url && (
                  <Ionicons name="image-outline" size={14} color={colors.accent} />
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Payment detail sheet */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={() => setSelected(null)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.handle} />
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Payment Detail</Text>
            {selected && (
              <>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount</Text>
                  <Text style={[styles.detailValue, { color: colors.success, fontWeight: '800' }]}>
                    OMR {selected.amount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Method</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{METHOD_LABEL[selected.payment_method] ?? selected.payment_method}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                    {new Date(selected.paid_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                {selected.notes ? (
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Notes</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary, flex: 1, textAlign: 'right' }]}>{selected.notes}</Text>
                  </View>
                ) : null}
                {selected.receipt_url ? (
                  <Pressable
                    onPress={() => setViewingReceipt(selected.receipt_url!)}
                    style={{ marginTop: 12 }}
                  >
                    <Image
                      source={{ uri: selected.receipt_url }}
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
            <Pressable style={[styles.closeBtn, { backgroundColor: colors.accent }]} onPress={() => setSelected(null)}>
              <Text style={[styles.closeBtnText, { color: colors.bg }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Full-screen receipt viewer */}
      <Modal visible={!!viewingReceipt} transparent animationType="fade" onRequestClose={() => setViewingReceipt(null)}>
        <View style={{ flex: 1, backgroundColor: '#000000F0', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={() => setViewingReceipt(null)} />
          {viewingReceipt && (
            <Image
              source={{ uri: viewingReceipt }}
              style={{ width: '92%', height: '75%', borderRadius: 12, backgroundColor: '#333' }}
              resizeMode="contain"
            />
          )}
          <Pressable
            style={{ marginTop: 20, backgroundColor: '#ffffff20', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}
            onPress={() => setViewingReceipt(null)}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 10 },
    emptyText: { ...Typography.body, color: c.textSecondary },
    card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    rowLeft: { flex: 1, gap: 2 },
    method: { ...Typography.body, color: c.textPrimary, fontWeight: '700' },
    date: { ...Typography.caption, color: c.textSecondary },
    notes: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic' },
    amount: { ...Typography.body, color: c.success, fontWeight: '800' },
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ffffff30', alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    detailLabel: { ...Typography.caption, fontWeight: '600' },
    detailValue: { ...Typography.body, fontSize: 14 },
    closeBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    closeBtnText: { fontWeight: '800', fontSize: 15 },
  });
}
