import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, Modal, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { Platform } from 'react-native';

const PACKAGE_LABEL: Record<string, string> = {
  '30min': '30 min',
  '45min': '45 min',
  '1hr':   '1 hour',
};

type PaymentStatus = 'unpaid' | 'partial' | 'full';

type RenewalRecord = {
  id: string;
  client_id: string;
  client_name: string;
  coach_name: string;
  package_type: string;
  total_sessions: number;
  duration_weeks: number | null;
  created_at: string;
  payment_status: PaymentStatus;
  amount_paid: number | null;
  balance_due_date: string | null;
  receipt_url: string | null;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDueDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminRenewalsScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [records, setRecords] = useState<RenewalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('renewal_requests')
      .select(`
        id, package_type, total_sessions, duration_weeks, created_at,
        payment_status, amount_paid, balance_due_date, receipt_url,
        client:profiles!renewal_requests_client_id_fkey(id, name),
        coach:profiles!renewal_requests_coach_id_fkey(name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    setRecords(
      (data ?? []).map((row: any) => ({
        id: row.id,
        client_id: row.client?.id ?? '',
        client_name: row.client?.name ?? '—',
        coach_name: row.coach?.name ?? '—',
        package_type: row.package_type,
        total_sessions: row.total_sessions,
        duration_weeks: row.duration_weeks ?? null,
        created_at: row.created_at,
        payment_status: row.payment_status ?? 'unpaid',
        amount_paid: row.amount_paid ?? null,
        balance_due_date: row.balance_due_date ?? null,
        receipt_url: row.receipt_url ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const PAY_COLOR: Record<PaymentStatus, string> = {
    unpaid: '#EF4444',
    partial: colors.accent,
    full: '#22C55E',
  };
  const PAY_LABEL: Record<PaymentStatus, string> = {
    unpaid: 'UNPAID',
    partial: 'PARTIAL',
    full: 'PAID',
  };

  return (
    <View style={s.root}>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        >
          {records.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="refresh-circle-outline" size={52} color={colors.border} />
              <Text style={s.emptyTitle}>No renewals yet</Text>
              <Text style={s.emptySubtitle}>Coach-triggered renewals will appear here</Text>
            </View>
          ) : (
            records.map((rec) => (
              <View key={rec.id} style={s.card}>
                <Pressable
                  style={({ pressed }) => [s.cardMain, pressed && { opacity: 0.75 }]}
                  onPress={() => rec.client_id && router.push(`/(admin)/client/${rec.client_id}` as any)}
                >
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{initials(rec.client_name)}</Text>
                  </View>

                  <View style={s.info}>
                    <View style={s.nameRow}>
                      <Text style={s.clientName}>{rec.client_name}</Text>
                      <View style={[s.pill, { borderColor: colors.success + '50', backgroundColor: colors.success + '18' }]}>
                        <Text style={[s.pillText, { color: colors.success }]}>RENEWED</Text>
                      </View>
                      <View style={[s.pill, { borderColor: PAY_COLOR[rec.payment_status] + '50', backgroundColor: PAY_COLOR[rec.payment_status] + '18' }]}>
                        <Text style={[s.pillText, { color: PAY_COLOR[rec.payment_status] }]}>
                          {PAY_LABEL[rec.payment_status]}
                        </Text>
                      </View>
                    </View>

                    <Text style={s.coachLine}>
                      <Ionicons name="person-outline" size={11} color={colors.textSecondary} /> {rec.coach_name}
                    </Text>

                    <Text style={s.pkgLine}>
                      {PACKAGE_LABEL[rec.package_type] ?? rec.package_type} · +{rec.total_sessions} sessions
                      {rec.duration_weeks ? ` · ${rec.duration_weeks}w` : ''}
                    </Text>

                    {rec.payment_status === 'partial' && rec.amount_paid != null && (
                      <Text style={s.payLine}>
                        OMR {rec.amount_paid.toFixed(2)} paid
                        {rec.balance_due_date ? ` · balance due ${fmtDueDate(rec.balance_due_date)}` : ''}
                      </Text>
                    )}
                    {rec.payment_status === 'full' && rec.amount_paid != null && (
                      <Text style={s.payLine}>OMR {rec.amount_paid.toFixed(2)}</Text>
                    )}

                    <Text style={s.dateText}>
                      {fmtDate(rec.created_at)} · {timeAgo(rec.created_at)}
                    </Text>
                  </View>
                </Pressable>

                <View style={s.rightCol}>
                  {rec.receipt_url ? (
                    <Pressable onPress={() => setViewingReceipt(rec.receipt_url)} hitSlop={8}>
                      <Image source={{ uri: rec.receipt_url }} style={s.receiptThumb} />
                    </Pressable>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.border} />
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Full-screen receipt viewer */}
      <Modal visible={!!viewingReceipt} transparent animationType="fade" onRequestClose={() => setViewingReceipt(null)}>
        <View style={s.modalBg}>
          <Pressable style={s.modalClose} onPress={() => setViewingReceipt(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          {viewingReceipt && (
            <Image source={{ uri: viewingReceipt }} style={s.fullImg} resizeMode="contain" />
          )}
          <Pressable
            style={s.dlBtn}
            onPress={async () => {
              if (!viewingReceipt) return;
              if (Platform.OS === 'web') {
                window.open(viewingReceipt, '_blank');
              } else if (Platform.OS === 'ios') {
                const ok = await Sharing.isAvailableAsync();
                if (ok) await Sharing.shareAsync(viewingReceipt, { mimeType: 'image/jpeg' });
              } else {
                Linking.openURL(viewingReceipt);
              }
            }}
          >
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={s.dlBtnText}>{Platform.OS === 'web' ? 'Open / Download' : 'Save to Device'}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16, gap: 10 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyTitle: { ...Typography.body, color: c.textSecondary, fontWeight: '600' },
    emptySubtitle: { ...Typography.caption, color: c.textSecondary, textAlign: 'center' },

    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'flex-start',
      overflow: 'hidden',
    },
    cardMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 14,
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.accent + '22',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: { fontSize: 15, fontWeight: '800', color: c.accent },
    info: { flex: 1 },
    rightCol: { alignItems: 'center', justifyContent: 'center', paddingTop: 2, paddingRight: 14 },
    nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
    clientName: { ...Typography.body, fontWeight: '700' as const, color: c.textPrimary },
    pill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 20,
      borderWidth: 1,
    },
    pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
    coachLine: { ...Typography.caption, color: c.textSecondary, marginBottom: 2 },
    pkgLine: { fontSize: 12, fontWeight: '600', color: c.accent, marginBottom: 1 },
    payLine: { fontSize: 11, color: c.textSecondary, marginBottom: 1 },
    dateText: { ...Typography.caption, color: c.textSecondary, marginTop: 2 },
    receiptThumb: { width: 44, height: 56, borderRadius: 6, borderWidth: 1, borderColor: c.border },

    // Receipt modal
    modalBg: { flex: 1, backgroundColor: '#000d', justifyContent: 'center', alignItems: 'center' },
    modalClose: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
    fullImg: { width: '90%', height: '70%' },
    dlBtn: {
      position: 'absolute', bottom: 52,
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30,
    },
    dlBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
