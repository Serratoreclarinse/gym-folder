import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type EquipmentRequest = {
  id: string;
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

export default function CoachEquipmentRequestsScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // New request form
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('equipment_requests')
      .select('id, item_name, quantity, notes, status, admin_notes, created_at')
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false });

    setRequests(
      (data ?? []).map((row: any) => ({
        id: row.id,
        itemName: row.item_name,
        quantity: row.quantity,
        notes: row.notes ?? null,
        status: row.status,
        adminNotes: row.admin_notes ?? null,
        createdAt: row.created_at,
      })),
    );
    setLoading(false);
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSubmit = async () => {
    const name = itemName.trim();
    const qty = parseInt(quantity, 10);
    if (!name) { Alert.alert('Required', 'Enter the item name.'); return; }
    if (isNaN(qty) || qty < 1) { Alert.alert('Invalid', 'Quantity must be at least 1.'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('equipment_requests').insert({
      coach_id: profile!.id,
      item_name: name,
      quantity: qty,
      notes: notes.trim() || null,
      status: 'pending',
    });
    setSubmitting(false);

    if (error) { Alert.alert('Error', error.message); return; }
    setItemName('');
    setQuantity('1');
    setNotes('');
    setShowForm(false);
    load();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* New request button */}
        <Pressable
          style={({ pressed }) => [s.newBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setShowForm((v) => !v)}
        >
          <Ionicons name={showForm ? 'close-outline' : 'add-outline'} size={20} color="#fff" />
          <Text style={s.newBtnText}>{showForm ? 'CANCEL' : 'NEW REQUEST'}</Text>
        </Pressable>

        {/* Form */}
        {showForm && (
          <View style={[s.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.formTitle, { color: colors.textPrimary }]}>Request Equipment</Text>

            <Text style={[s.label, { color: colors.textSecondary }]}>ITEM NAME</Text>
            <TextInput
              style={[s.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
              placeholder="e.g. Resistance Band, Barbell"
              placeholderTextColor={colors.textSecondary}
              value={itemName}
              onChangeText={setItemName}
            />

            <Text style={[s.label, { color: colors.textSecondary }]}>QUANTITY</Text>
            <TextInput
              style={[s.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
              placeholder="1"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={quantity}
              onChangeText={setQuantity}
            />

            <Text style={[s.label, { color: colors.textSecondary }]}>NOTES (optional)</Text>
            <TextInput
              style={[s.input, s.multiline, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
              placeholder="Any additional details..."
              placeholderTextColor={colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <Pressable
              style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.8 }, submitting && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.submitBtnText}>SUBMIT REQUEST</Text>}
            </Pressable>
          </View>
        )}

        {/* History */}
        {loading && requests.length === 0 ? (
          <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
        ) : requests.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="construct-outline" size={48} color={colors.border} />
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>No requests yet</Text>
            <Text style={[s.emptyHint, { color: colors.textSecondary }]}>Tap NEW REQUEST to submit one</Text>
          </View>
        ) : (
          <>
            <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>MY REQUESTS</Text>
            {requests.map((req) => {
              const cfg = STATUS_CONFIG[req.status];
              return (
                <View key={req.id} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: cfg.color }]}>
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[s.itemName, { color: colors.textPrimary }]}>{req.itemName}</Text>
                      <Text style={[s.meta, { color: colors.textSecondary }]}>×{req.quantity} · {fmtDate(req.createdAt)}</Text>
                      {req.notes && <Text style={[s.noteText, { color: colors.textSecondary }]}>"{req.notes}"</Text>}
                      {req.adminNotes && (
                        <Text style={[s.noteText, { color: cfg.color }]}>Admin: {req.adminNotes}</Text>
                      )}
                    </View>
                    <View style={[s.badge, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '50' }]}>
                      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 48 },
    center: { paddingTop: 60, alignItems: 'center' },

    newBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, marginBottom: 16,
    },
    newBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1 },

    form: {
      borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, gap: 6,
    },
    formTitle: { ...Typography.subtitle, fontWeight: '700', marginBottom: 8 },
    label: { ...Typography.label, fontSize: 11, letterSpacing: 1, marginTop: 8, marginBottom: 4 },
    input: {
      borderWidth: 1, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15,
    },
    multiline: { minHeight: 72, textAlignVertical: 'top' },
    submitBtn: {
      backgroundColor: c.accent, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center', marginTop: 12,
    },
    submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1 },

    sectionTitle: { ...Typography.label, fontSize: 11, letterSpacing: 1.5, marginBottom: 10 },
    card: {
      borderRadius: 14, borderWidth: 1, borderLeftWidth: 4,
      padding: 14, marginBottom: 10,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    itemName: { ...Typography.subtitle, fontWeight: '700' },
    meta: { ...Typography.caption },
    noteText: { ...Typography.caption, fontStyle: 'italic', marginTop: 2 },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    badgeText: { fontSize: 11, fontWeight: '700' },
    empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyText: { ...Typography.subtitle, fontWeight: '700' },
    emptyHint: { ...Typography.caption },
  });
}
