import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAvailability } from '@/hooks/useAvailability';
import { useSessions } from '@/hooks/useSessions';
import { Colors, Typography } from '@/constants/theme';

// Defined outside parent to prevent TextInput keyboard flicker
function BlockForm({
  startDate, endDate, reason,
  onChangeStart, onChangeEnd, onChangeReason,
  onSave, onCancel,
}: {
  startDate: string; endDate: string; reason: string;
  onChangeStart: (v: string) => void;
  onChangeEnd:   (v: string) => void;
  onChangeReason:(v: string) => void;
  onSave:   () => void;
  onCancel: () => void;
}) {
  return (
    <View style={fs.wrap}>
      <Text style={fs.lbl}>START DATE</Text>
      <TextInput
        style={fs.input}
        value={startDate}
        onChangeText={onChangeStart}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        autoFocus
      />
      <Text style={fs.lbl}>END DATE</Text>
      <TextInput
        style={fs.input}
        value={endDate}
        onChangeText={onChangeEnd}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Text style={fs.lbl}>REASON (optional)</Text>
      <TextInput
        style={[fs.input, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
        value={reason}
        onChangeText={onChangeReason}
        placeholder="e.g. Vacation, Holiday, Sick day…"
        placeholderTextColor={Colors.textSecondary}
        multiline
        autoCapitalize="sentences"
      />
      <View style={fs.btns}>
        <Pressable style={fs.cancelBtn} onPress={onCancel}>
          <Text style={fs.cancelTxt}>Cancel</Text>
        </Pressable>
        <Pressable style={fs.saveBtn} onPress={onSave}>
          <Text style={fs.saveTxt}>Block Dates</Text>
        </Pressable>
      </View>
    </View>
  );
}

const fs = StyleSheet.create({
  wrap:      { padding: 20, paddingBottom: 40 },
  lbl:       { ...Typography.label, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input:     { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: Colors.textPrimary, fontSize: 15 },
  btns:      { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingVertical: 13, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
  saveBtn:   { flex: 1, borderRadius: 12, backgroundColor: Colors.accent, paddingVertical: 13, alignItems: 'center' },
  saveTxt:   { color: Colors.bg, fontWeight: '800', fontSize: 14 },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function BlockedDatesScreen() {
  const { blockedDates, loading, refetch, addBlockedDate, removeBlockedDate } = useAvailability();
  const { sessions } = useSessions();

  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey]   = useState(0);
  const [startDate, setStart]   = useState('');
  const [endDate,   setEnd]     = useState('');
  const [reason,    setReason]  = useState('');

  const openForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setStart(today);
    setEnd(today);
    setReason('');
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format (e.g. 2025-12-25).');
      return;
    }
    if (startDate > endDate) {
      Alert.alert('Invalid range', 'Start date must be on or before end date.');
      return;
    }

    const sessionsInRange = sessions.filter(
      (s) => s.session_date >= startDate && s.session_date <= endDate,
    );

    const doBlock = async () => {
      setShowForm(false);
      await addBlockedDate(startDate, endDate, reason);
    };

    if (sessionsInRange.length > 0) {
      Alert.alert(
        'Sessions exist in this range',
        `You have ${sessionsInRange.length} session${sessionsInRange.length !== 1 ? 's' : ''} during these dates. Block anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block Anyway', style: 'destructive', onPress: doBlock },
        ],
      );
    } else {
      await doBlock();
    }
  };

  const handleRemove = (id: string, label: string) => {
    Alert.alert('Remove Block', `Remove the block for ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeBlockedDate(id) },
    ]);
  };

  const todayISO = new Date().toISOString().split('T')[0];

  return (
    <>
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />}
      >
        {blockedDates.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="ban-outline" size={48} color={Colors.border} />
            <Text style={st.emptyTitle}>No blocked dates</Text>
            <Text style={st.emptySub}>Block off holidays, sick days, or vacations using the + button</Text>
          </View>
        ) : (
          blockedDates.map((bd) => {
            const isPast = bd.end_date < todayISO;
            const label  = formatRange(bd.start_date, bd.end_date);
            return (
              <View
                key={bd.id}
                style={[st.card, isPast ? st.cardPast : st.cardActive]}
              >
                <View style={[st.cardIcon, { backgroundColor: (isPast ? Colors.textSecondary : Colors.danger) + '15' }]}>
                  <Ionicons name="ban-outline" size={18} color={isPast ? Colors.textSecondary : Colors.danger} />
                </View>
                <View style={st.cardInfo}>
                  <Text style={[st.cardLabel, isPast && { color: Colors.textSecondary }]}>{label}</Text>
                  {bd.reason ? <Text style={st.cardReason}>{bd.reason}</Text> : null}
                  {isPast && <Text style={st.pastTag}>PAST</Text>}
                </View>
                <Pressable onPress={() => handleRemove(bd.id, label)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable style={st.fab} onPress={openForm}>
        <Ionicons name="add" size={26} color={Colors.bg} />
      </Pressable>

      {/* Form modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={st.modalHead}>
            <Text style={st.modalTitle}>Block Dates</Text>
            <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <BlockForm
            key={formKey}
            startDate={startDate} endDate={endDate} reason={reason}
            onChangeStart={setStart} onChangeEnd={setEnd} onChangeReason={setReason}
            onSave={handleSave} onCancel={() => setShowForm(false)}
          />
        </View>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 100 },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub:   { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },

  card:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1 },
  cardActive: { borderColor: Colors.danger + '30' },
  cardPast:   { borderColor: Colors.border, opacity: 0.55 },
  cardIcon:   { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardInfo:   { flex: 1 },
  cardLabel:  { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  cardReason: { ...Typography.caption, color: Colors.textSecondary },
  pastTag:    { ...Typography.label, fontSize: 9, color: Colors.textSecondary, marginTop: 3 },

  fab: {
    position: 'absolute', bottom: 32, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  modalHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { ...Typography.subtitle, color: Colors.textPrimary },
});
