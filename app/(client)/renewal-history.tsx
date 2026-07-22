import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Typography } from '@/constants/theme';
import type { ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const PKG_LABEL: Record<string, string> = { '30min': '30 min', '45min': '45 min', '1hr': '1 hour' };

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  unpaid:  { label: 'UNPAID',   color: '#FF4D4D', bg: '#FF4D4D18' },
  partial: { label: 'PARTIAL',  color: '#F59E0B', bg: '#F59E0B18' },
  full:    { label: 'PAID',     color: '#4CAF50', bg: '#4CAF5018' },
};

type RenewalRecord = {
  id: string;
  total_sessions: number;
  package_type: string;
  created_at: string;
  payment_status: string;
  amount_paid: number | null;
  balance_due_date: string | null;
  receipt_url: string | null;
};

export default function RenewalHistoryScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<RenewalRecord | null>(null);

  const fetchRenewals = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('renewal_requests')
      .select('id, total_sessions, package_type, created_at, payment_status, amount_paid, balance_due_date, receipt_url')
      .eq('client_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });
    setRenewals((data ?? []) as RenewalRecord[]);
  }, [user?.id]);

  useEffect(() => {
    fetchRenewals().then(() => setLoading(false));
  }, [fetchRenewals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRenewals();
    setRefreshing(false);
  }, [fetchRenewals]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (renewals.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="refresh-circle-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.4 }} />
        <Text style={styles.emptyTitle}>No renewals yet</Text>
        <Text style={styles.emptySub}>Your package renewal history will appear here</Text>
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
        {renewals.map((r, i) => {
          const dateStr = new Date(r.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          });
          const badge = STATUS_BADGE[r.payment_status] ?? STATUS_BADGE.unpaid;
          const isPartial = r.payment_status === 'partial';
          const dueDateStr = r.balance_due_date
            ? new Date(r.balance_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : null;

          return (
            <Pressable
              key={r.id}
              style={({ pressed }) => [styles.card, i < renewals.length - 1 && { marginBottom: 12 }, pressed && { opacity: 0.75 }]}
              onPress={() => setSelected(r)}
            >
              {/* Top row */}
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Ionicons name="refresh-circle-outline" size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessions}>+{r.total_sessions} sessions</Text>
                  <Text style={styles.meta}>{dateStr} · {PKG_LABEL[r.package_type] ?? r.package_type}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                  {r.receipt_url && (
                    <Ionicons name="image-outline" size={16} color={colors.accent} />
                  )}
                </View>
              </View>

              {/* Partial balance warning */}
              {isPartial && (
                <View style={styles.balanceRow}>
                  <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                  <Text style={styles.balanceText}>
                    Balance pending{dueDateStr ? ` · due ${dueDateStr}` : ''}
                  </Text>
                </View>
              )}

              {/* Amount paid */}
              {r.amount_paid != null && Number(r.amount_paid) > 0 && (
                <View style={styles.amountRow}>
                  <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.amountText}>
                    OMR {Number(r.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} paid
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Detail sheet */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.overlay}>
          <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={() => setSelected(null)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.handle} />
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Renewal Detail</Text>

            {selected && (() => {
              const badge = STATUS_BADGE[selected.payment_status] ?? STATUS_BADGE.unpaid;
              const dateStr = new Date(selected.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              const dueDateStr = selected.balance_due_date
                ? new Date(selected.balance_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : null;
              return (
                <>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Sessions</Text>
                    <Text style={[styles.detailValue, { color: colors.accent, fontWeight: '800' }]}>+{selected.total_sessions}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Type</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{PKG_LABEL[selected.package_type] ?? selected.package_type}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{dateStr}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>
                  {selected.amount_paid != null && Number(selected.amount_paid) > 0 && (
                    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount Paid</Text>
                      <Text style={[styles.detailValue, { color: colors.success, fontWeight: '700' }]}>
                        OMR {Number(selected.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  )}
                  {dueDateStr && (
                    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Balance Due</Text>
                      <Text style={[styles.detailValue, { color: '#F59E0B', fontWeight: '700' }]}>{dueDateStr}</Text>
                    </View>
                  )}
                  {selected.receipt_url && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Receipt</Text>
                      <Image
                        source={{ uri: selected.receipt_url }}
                        style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: colors.border }}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                </>
              );
            })()}

            <Pressable
              style={[styles.closeBtn, { backgroundColor: colors.accent }]}
              onPress={() => setSelected(null)}
            >
              <Text style={[styles.closeBtnText, { color: colors.bg }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
    loadingText: { ...Typography.body, color: c.textSecondary },
    emptyTitle: { ...Typography.title, color: c.textPrimary, fontSize: 18, textAlign: 'center' },
    emptySub: { ...Typography.caption, color: c.textSecondary, textAlign: 'center' },
    card: {
      backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 1, borderColor: c.border,
      padding: 16, marginBottom: 0,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconWrap: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.accent + '15',
      alignItems: 'center', justifyContent: 'center',
    },
    sessions: { ...Typography.body, color: c.accent, fontWeight: '800', fontSize: 16, marginBottom: 2 },
    meta: { ...Typography.caption, color: c.textSecondary },
    badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    balanceRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginTop: 10, paddingTop: 10,
      borderTopWidth: 1, borderTopColor: c.border,
    },
    balanceText: { ...Typography.caption, color: '#F59E0B', fontWeight: '600' },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    amountText: { ...Typography.caption, color: c.textSecondary },
    // Detail sheet
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 36, gap: 0,
    },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ffffff30', alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
    detailRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 12, borderBottomWidth: 1,
    },
    detailLabel: { ...Typography.caption, fontWeight: '600' },
    detailValue: { ...Typography.body, fontSize: 14 },
    closeBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    closeBtnText: { fontWeight: '800', fontSize: 15 },
  });
}
