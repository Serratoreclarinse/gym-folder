import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushNotifications';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type EquipmentRequest = {
  id: string;
  coachId: string;
  coachName: string;
  itemName: string;
  quantity: number;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  adminNotes: string | null;
  createdAt: string;
};

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#FF9800', icon: 'time-outline' },
  approved:  { label: 'Approved',  color: '#2196F3', icon: 'checkmark-circle-outline' },
  rejected:  { label: 'Rejected',  color: '#F44336', icon: 'close-circle-outline' },
  fulfilled: { label: 'Fulfilled', color: '#4CAF50', icon: 'checkmark-done-outline' },
} as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EquipmentRequestsScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('equipment_requests')
      .select('*, coach:profiles!equipment_requests_coach_id_fkey(id, name)')
      .order('created_at', { ascending: false });

    setRequests(
      (data ?? []).map((row: any) => ({
        id: row.id,
        coachId: row.coach_id,
        coachName: row.coach?.name ?? '—',
        itemName: row.item_name,
        quantity: row.quantity,
        notes: row.notes ?? null,
        status: row.status,
        adminNotes: row.admin_notes ?? null,
        createdAt: row.created_at,
      })),
    );
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateStatus = async (req: EquipmentRequest, newStatus: 'approved' | 'rejected' | 'fulfilled', adminNotes?: string) => {
    setActionId(req.id);
    const { error } = await supabase
      .from('equipment_requests')
      .update({ status: newStatus, admin_notes: adminNotes ?? null, updated_at: new Date().toISOString() })
      .eq('id', req.id);
    setActionId(null);
    if (error) { Alert.alert('Error', error.message); return; }

    // Notify coach
    const notifMap = {
      approved: { title: '✅ Equipment Request Approved', body: `Your request for "${req.itemName}" has been approved.` },
      rejected: { title: '❌ Equipment Request Rejected', body: `Your request for "${req.itemName}" was declined.${adminNotes ? ` Reason: ${adminNotes}` : ''}` },
      fulfilled: { title: '📦 Equipment Ready!', body: `"${req.itemName}" has been fulfilled and is ready.` },
    };
    await sendPushNotification(req.coachId, notifMap[newStatus]);

    setRejectingId(null);
    setAdminNoteInput('');
    load();
  };

  const confirmAction = (req: EquipmentRequest, action: 'approved' | 'fulfilled') => {
    const labels = { approved: 'Approve', fulfilled: 'Mark as Fulfilled' };
    const msg = action === 'approved'
      ? `Approve request for "${req.itemName}" (×${req.quantity}) from ${req.coachName}?`
      : `Mark "${req.itemName}" as fulfilled?`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) updateStatus(req, action);
      return;
    }
    Alert.alert(labels[action], msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: labels[action], onPress: () => updateStatus(req, action) },
    ]);
  };

  const pending   = requests.filter((r) => r.status === 'pending');
  const approved  = requests.filter((r) => r.status === 'approved');
  const fulfilled = requests.filter((r) => r.status === 'fulfilled');
  const rejected  = requests.filter((r) => r.status === 'rejected');

  if (loading && requests.length === 0) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  const renderSection = (title: string, items: EquipmentRequest[]) => {
    if (items.length === 0) return null;
    return (
      <>
        <Text style={s.sectionTitle}>{title}</Text>
        {items.map((req) => {
          const cfg = STATUS_CONFIG[req.status];
          const isActioning = actionId === req.id;
          return (
            <View key={req.id} style={[s.card, { borderLeftColor: cfg.color }]}>
              <View style={s.cardHeader}>
                <View style={s.cardLeft}>
                  <Text style={s.itemName}>{req.itemName}</Text>
                  <Text style={s.cardMeta}>×{req.quantity} · {req.coachName} · {fmtDate(req.createdAt)}</Text>
                  {req.notes && <Text style={s.cardNotes}>"{req.notes}"</Text>}
                  {req.adminNotes && <Text style={[s.cardNotes, { color: cfg.color }]}>Admin: {req.adminNotes}</Text>}
                </View>
                <View style={[s.statusBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '50' }]}>
                  <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                  <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>

              {req.status === 'pending' && (
                <View style={s.actions}>
                  <Pressable
                    style={[s.actionBtn, s.rejectBtn]}
                    onPress={() => { setRejectingId(req.id); setAdminNoteInput(''); }}
                    disabled={isActioning}
                  >
                    <Text style={s.rejectBtnText}>Reject</Text>
                  </Pressable>
                  <Pressable
                    style={[s.actionBtn, s.approveBtn]}
                    onPress={() => confirmAction(req, 'approved')}
                    disabled={isActioning}
                  >
                    {isActioning
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.approveBtnText}>Approve</Text>}
                  </Pressable>
                </View>
              )}

              {req.status === 'pending' && rejectingId === req.id && (
                <View style={s.rejectForm}>
                  <TextInput
                    style={s.rejectInput}
                    placeholder="Reason for rejection (optional)"
                    placeholderTextColor={colors.textSecondary}
                    value={adminNoteInput}
                    onChangeText={setAdminNoteInput}
                    multiline
                  />
                  <View style={s.rejectFormActions}>
                    <Pressable style={s.rejectCancelBtn} onPress={() => setRejectingId(null)}>
                      <Text style={s.rejectCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[s.actionBtn, s.rejectConfirmBtn]}
                      onPress={() => updateStatus(req, 'rejected', adminNoteInput.trim() || undefined)}
                      disabled={isActioning}
                    >
                      <Text style={s.rejectBtnText}>Confirm Reject</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {req.status === 'approved' && (
                <Pressable
                  style={[s.actionBtn, s.fulfillBtn]}
                  onPress={() => confirmAction(req, 'fulfilled')}
                  disabled={isActioning}
                >
                  {isActioning
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.fulfillBtnText}>Mark as Fulfilled</Text>}
                </Pressable>
              )}
            </View>
          );
        })}
      </>
    );
  };

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      {requests.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="construct-outline" size={48} color={colors.border} />
          <Text style={s.emptyText}>No equipment requests yet</Text>
        </View>
      ) : (
        <>
          {renderSection('PENDING', pending)}
          {renderSection('APPROVED — IN PROGRESS', approved)}
          {renderSection('FULFILLED', fulfilled)}
          {renderSection('REJECTED', rejected)}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
    emptyText: { ...Typography.body, color: c.textSecondary },
    sectionTitle: { ...Typography.label, color: c.textSecondary, marginTop: 20, marginBottom: 10 },
    card: {
      backgroundColor: c.surface, borderRadius: 14, borderWidth: 1,
      borderColor: c.border, borderLeftWidth: 4, padding: 14, marginBottom: 10,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardLeft: { flex: 1, gap: 3 },
    itemName: { ...Typography.subtitle, color: c.textPrimary, fontWeight: '700' },
    cardMeta: { ...Typography.caption, color: c.textSecondary },
    cardNotes: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic', marginTop: 2 },
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    approveBtn: { backgroundColor: '#2196F3' },
    approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    rejectBtn: { backgroundColor: '#F4433615', borderWidth: 1, borderColor: '#F4433650' },
    rejectBtnText: { color: '#F44336', fontWeight: '700', fontSize: 14 },
    fulfillBtn: { backgroundColor: '#4CAF50', marginTop: 10 },
    fulfillBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    rejectForm: { marginTop: 10, gap: 8 },
    rejectInput: {
      ...Typography.body, color: c.textPrimary,
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, minHeight: 60,
    },
    rejectFormActions: { flexDirection: 'row', gap: 8 },
    rejectCancelBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
      borderWidth: 1, borderColor: c.border,
    },
    rejectCancelText: { color: c.textSecondary, fontWeight: '600' },
    rejectConfirmBtn: { flex: 1, backgroundColor: '#F44336' },
  });
}
