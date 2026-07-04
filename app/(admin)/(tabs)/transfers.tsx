import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushNotifications';
import { Colors, Typography } from '@/constants/theme';

type Transfer = {
  id: string;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  from_coach_id: string;
  to_coach_id: string;
  client_name: string;
  from_coach_name: string;
  to_coach_name: string;
  package_type: string;
  sessions_remaining: number;
};

const STATUS_LABEL: Record<string, string> = {
  pending_admin:  'Needs Approval',
  pending_coach:  'Awaiting Coach',
  accepted:       'Accepted',
  rejected_admin: 'Rejected (Admin)',
  rejected_coach: 'Rejected (Coach)',
  cancelled:      'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  pending_admin:  '#FF9800',
  pending_coach:  Colors.accent,
  accepted:       '#4CAF50',
  rejected_admin: Colors.danger,
  rejected_coach: Colors.danger,
  cancelled:      Colors.textSecondary,
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminTransfersScreen() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotesMap, setAdminNotesMap] = useState<Record<string, string>>({});
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('client_transfers')
      .select(`
        id, status, notes, admin_notes, created_at, from_coach_id, to_coach_id,
        client:profiles!client_transfers_client_id_fkey(name),
        from_coach:profiles!client_transfers_from_coach_id_fkey(name),
        to_coach:profiles!client_transfers_to_coach_id_fkey(name),
        package:packages!client_transfers_package_id_fkey(package_type, sessions_remaining)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) { setLoading(false); return; }

    setTransfers(
      (data ?? []).map((row: any) => ({
        id: row.id,
        status: row.status,
        notes: row.notes,
        admin_notes: row.admin_notes,
        created_at: row.created_at,
        from_coach_id: row.from_coach_id,
        to_coach_id: row.to_coach_id,
        client_name: row.client?.name ?? '—',
        from_coach_name: row.from_coach?.name ?? '—',
        to_coach_name: row.to_coach?.name ?? '—',
        package_type: row.package?.package_type ?? '—',
        sessions_remaining: row.package?.sessions_remaining ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleApprove = async (t: Transfer) => {
    setActioning(t.id);
    const { error } = await supabase.rpc('admin_approve_transfer', {
      p_transfer_id: t.id,
      p_admin_notes: adminNotesMap[t.id]?.trim() || null,
    });
    setActioning(null);
    if (error) { Alert.alert('Error', error.message); return; }
    // Notify target coach
    await sendPushNotification(t.to_coach_id, {
      title: '🔄 Incoming Transfer Request',
      body: `Admin approved a transfer of ${t.client_name} to you. Open the app to accept or decline.`,
    });
    setExpandedId(null);
    load();
  };

  const handleReject = async (t: Transfer) => {
    Alert.alert('Reject Transfer', 'Are you sure you want to reject this transfer request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          setActioning(t.id);
          const { error } = await supabase.rpc('admin_reject_transfer', {
            p_transfer_id: t.id,
            p_admin_notes: adminNotesMap[t.id]?.trim() || null,
          });
          setActioning(null);
          if (error) { Alert.alert('Error', error.message); return; }
          // Notify originating coach
          await sendPushNotification(t.from_coach_id, {
            title: '❌ Transfer Rejected',
            body: `Your transfer request for ${t.client_name} was rejected by admin.`,
          });
          setExpandedId(null);
          load();
        },
      },
    ]);
  };

  const pending = transfers.filter((t) => t.status === 'pending_admin');
  const history = transfers.filter((t) => t.status !== 'pending_admin');

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
    >
      {/* Pending approval */}
      {pending.length > 0 ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>NEEDS APPROVAL</Text>
            <View style={s.badge}>
              <Text style={s.badgeText}>{pending.length}</Text>
            </View>
          </View>
          {pending.map((t) => {
            const expanded = expandedId === t.id;
            const isActioning = actioning === t.id;
            return (
              <Pressable
                key={t.id}
                style={s.card}
                onPress={() => setExpandedId(expanded ? null : t.id)}
              >
                {/* Card top row */}
                <View style={s.cardTop}>
                  <View style={s.clientAvatar}>
                    <Text style={s.clientAvatarText}>{initials(t.client_name)}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.clientName}>{t.client_name}</Text>
                    <Text style={s.cardSub}>
                      {t.from_coach_name} → {t.to_coach_name}
                    </Text>
                    <Text style={s.cardMeta}>
                      {t.package_type} · {t.sessions_remaining} sessions left
                    </Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: '#FF980020', borderColor: '#FF980060' }]}>
                    <Text style={[s.statusPillText, { color: '#FF9800' }]}>PENDING</Text>
                  </View>
                </View>

                {/* Expanded review panel */}
                {expanded && (
                  <View style={s.reviewPanel}>
                    {t.notes ? (
                      <View style={s.notesRow}>
                        <Ionicons name="chatbubble-outline" size={14} color={Colors.textSecondary} />
                        <Text style={s.notesText}>"{t.notes}"</Text>
                      </View>
                    ) : null}
                    <Text style={s.adminNotesLabel}>Admin notes (optional)</Text>
                    <TextInput
                      style={s.adminNotesInput}
                      value={adminNotesMap[t.id] ?? ''}
                      onChangeText={(v) => setAdminNotesMap((prev) => ({ ...prev, [t.id]: v }))}
                      placeholder="Reason for approval/rejection…"
                      placeholderTextColor={Colors.textSecondary}
                      multiline
                    />
                    <View style={s.actionRow}>
                      <Pressable
                        style={[s.rejectBtn, isActioning && { opacity: 0.5 }]}
                        onPress={() => handleReject(t)}
                        disabled={isActioning}
                      >
                        <Ionicons name="close" size={16} color={Colors.danger} />
                        <Text style={s.rejectText}>Reject</Text>
                      </Pressable>
                      <Pressable
                        style={[s.approveBtn, isActioning && { opacity: 0.5 }]}
                        onPress={() => handleApprove(t)}
                        disabled={isActioning}
                      >
                        {isActioning
                          ? <ActivityIndicator size="small" color={Colors.bg} />
                          : <><Ionicons name="checkmark" size={16} color={Colors.bg} /><Text style={s.approveBtnText}>Approve</Text></>
                        }
                      </Pressable>
                    </View>
                  </View>
                )}

                <View style={s.expandHint}>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={Colors.textSecondary}
                  />
                </View>
              </Pressable>
            );
          })}
        </>
      ) : (
        <View style={s.emptyPending}>
          <Ionicons name="checkmark-circle-outline" size={48} color={Colors.border} />
          <Text style={s.emptyTitle}>No pending transfers</Text>
          <Text style={s.emptySub}>All transfer requests have been reviewed</Text>
        </View>
      )}

      {/* History */}
      {history.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { marginTop: 28, marginBottom: 12 }]}>HISTORY</Text>
          {history.map((t) => {
            const color = STATUS_COLOR[t.status] ?? Colors.textSecondary;
            const dateStr = new Date(t.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            return (
              <View key={t.id} style={[s.card, s.historyCard]}>
                <View style={s.cardTop}>
                  <View style={s.clientAvatar}>
                    <Text style={s.clientAvatarText}>{initials(t.client_name)}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.clientName}>{t.client_name}</Text>
                    <Text style={s.cardSub}>
                      {t.from_coach_name} → {t.to_coach_name}
                    </Text>
                    <Text style={s.cardMeta}>{dateStr}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: color + '20', borderColor: color + '60' }]}>
                    <Text style={[s.statusPillText, { color }]}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary },
  badge: {
    backgroundColor: '#FF980020', borderRadius: 10, borderWidth: 1, borderColor: '#FF980060',
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#FF9800' },

  card: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 10,
  },
  historyCard: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  clientAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accent + '18', borderWidth: 1, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  clientAvatarText: { fontSize: 14, fontWeight: '800', color: Colors.accent },
  cardInfo: { flex: 1 },
  clientName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 3 },
  cardSub: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 2 },
  cardMeta: { ...Typography.caption, color: Colors.textSecondary },

  statusPill: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, flexShrink: 0,
  },
  statusPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

  expandHint: { alignItems: 'center', marginTop: 10 },

  reviewPanel: { marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14 },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12 },
  notesText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, fontStyle: 'italic' },
  adminNotesLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6 },
  adminNotesInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    color: Colors.textPrimary, fontSize: 14, minHeight: 52,
    textAlignVertical: 'top', marginBottom: 12,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.danger + '50', borderRadius: 10, paddingVertical: 11,
    backgroundColor: Colors.danger + '0D',
  },
  rejectText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 11,
  },
  approveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 13 },

  emptyPending: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 8 },
  emptySub: { ...Typography.body, color: Colors.textSecondary },
});
