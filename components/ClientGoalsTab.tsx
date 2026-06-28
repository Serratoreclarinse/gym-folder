import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGoals, ClientGoal, GoalStatus } from '@/hooks/useGoals';
import { Colors, Typography } from '@/constants/theme';

const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; icon: string }> = {
  active:   { label: 'Active',   color: Colors.accent,        icon: 'flag-outline' },
  achieved: { label: 'Achieved', color: '#4CAF50',            icon: 'checkmark-circle-outline' },
  dropped:  { label: 'Dropped',  color: Colors.textSecondary, icon: 'close-circle-outline' },
};

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Goal form — at module scope to prevent keyboard flicker ───────────────────

function GoalForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (title: string, description: string, targetDate: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={gf.handle} />
      <View style={gf.header}>
        <Text style={gf.title}>ADD GOAL</Text>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView
        style={gf.scroll}
        contentContainerStyle={gf.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={gf.lbl}>GOAL</Text>
        <TextInput
          style={gf.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Lose 5kg, Run 5km, Bench 100kg…"
          placeholderTextColor={Colors.textSecondary + '80'}
          autoCapitalize="sentences"
          returnKeyType="next"
        />

        <Text style={[gf.lbl, { marginTop: 14 }]}>DESCRIPTION (optional)</Text>
        <TextInput
          style={[gf.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Add details or milestones…"
          placeholderTextColor={Colors.textSecondary + '80'}
          multiline
          autoCapitalize="sentences"
        />

        <Text style={[gf.lbl, { marginTop: 14 }]}>TARGET DATE (optional)</Text>
        <TextInput
          style={gf.input}
          value={targetDate}
          onChangeText={setTargetDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textSecondary + '80'}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          returnKeyType="done"
        />

        <Pressable
          style={[gf.saveBtn, (!title.trim() || saving) && gf.saveBtnDisabled]}
          onPress={() => title.trim() && !saving && onSave(title, description, targetDate)}
          disabled={!title.trim() || saving}
        >
          <Text style={gf.saveBtnText}>{saving ? 'SAVING…' : 'ADD GOAL'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Goal card — at module scope ───────────────────────────────────────────────

function GoalCard({
  goal,
  onUpdateStatus,
  onDelete,
}: {
  goal: ClientGoal;
  onUpdateStatus: (id: string, status: GoalStatus) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[goal.status];

  const handleLongPress = () => {
    Alert.alert('Delete Goal', `Remove "${goal.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(goal.id) },
    ]);
  };

  return (
    <Pressable
      style={({ pressed }) => [s.goalCard, pressed && { opacity: 0.8 }]}
      onLongPress={handleLongPress}
    >
      <View style={[s.statusBadge, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '40' }]}>
        <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
        <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>

      <Text style={[s.goalTitle, goal.status !== 'active' && { color: Colors.textSecondary }]}>
        {goal.title}
      </Text>

      {goal.description ? (
        <Text style={s.goalDesc}>{goal.description}</Text>
      ) : null}

      {goal.target_date ? (
        <View style={s.dateRow}>
          <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
          <Text style={s.dateText}>Target: {fmtDate(goal.target_date)}</Text>
        </View>
      ) : null}

      {goal.status === 'active' ? (
        <View style={s.actionRow}>
          <Pressable
            style={[s.actionBtn, { borderColor: '#4CAF5050', backgroundColor: '#4CAF5010' }]}
            onPress={() => onUpdateStatus(goal.id, 'achieved')}
          >
            <Ionicons name="checkmark-outline" size={14} color="#4CAF50" />
            <Text style={[s.actionBtnText, { color: '#4CAF50' }]}>Mark Done</Text>
          </Pressable>
          <Pressable
            style={[s.actionBtn, { borderColor: Colors.border }]}
            onPress={() => onUpdateStatus(goal.id, 'dropped')}
          >
            <Ionicons name="close-outline" size={14} color={Colors.textSecondary} />
            <Text style={[s.actionBtnText, { color: Colors.textSecondary }]}>Drop</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[s.actionBtn, { borderColor: Colors.border, marginTop: 10, alignSelf: 'flex-start' }]}
          onPress={() => onUpdateStatus(goal.id, 'active')}
        >
          <Ionicons name="refresh-outline" size={14} color={Colors.textSecondary} />
          <Text style={[s.actionBtnText, { color: Colors.textSecondary }]}>Reactivate</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function ClientGoalsTab({ clientId }: { clientId: string }) {
  const { goals, loading, addGoal, updateStatus, deleteGoal } = useGoals(clientId);
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const activeGoals = goals.filter((g) => g.status === 'active');
  const doneGoals   = goals.filter((g) => g.status !== 'active');

  const handleAdd = async (title: string, description: string, targetDate: string) => {
    setSaving(true);
    const { error } = await addGoal(title, description, targetDate);
    setSaving(false);
    if (error) { Alert.alert('Error', error); return; }
    setShowForm(false);
  };

  const handleUpdateStatus = async (id: string, status: GoalStatus) => {
    const { error } = await updateStatus(id, status);
    if (error) Alert.alert('Error', error);
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteGoal(id);
    if (error) Alert.alert('Error', error);
  };

  const openForm = () => {
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  return (
    <>
      <Pressable style={s.addBtn} onPress={openForm}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
        <Text style={s.addBtnText}>ADD GOAL</Text>
      </Pressable>

      {loading ? (
        <Text style={s.loadingText}>Loading…</Text>
      ) : goals.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="flag-outline" size={52} color={Colors.border} />
          <Text style={s.emptyTitle}>No goals yet</Text>
          <Text style={s.emptySub}>Tap ADD GOAL to set a target for this client</Text>
        </View>
      ) : (
        <View>
          {activeGoals.length > 0 && (
            <>
              <Text style={s.sectionLabel}>ACTIVE ({activeGoals.length})</Text>
              {activeGoals.map((g) => (
                <GoalCard key={g.id} goal={g} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />
              ))}
            </>
          )}
          {doneGoals.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { marginTop: 20 }]}>COMPLETED / DROPPED</Text>
              {doneGoals.map((g) => (
                <GoalCard key={g.id} goal={g} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />
              ))}
            </>
          )}
        </View>
      )}

      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setShowForm(false)}
      >
        <Pressable style={s.overlay} onPress={() => !saving && setShowForm(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <GoalForm
              key={formKey}
              onSave={handleAdd}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const gf = StyleSheet.create({
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 4,
  },
  title: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },
  scroll: { flexGrow: 0 },
  content: { padding: 20, paddingTop: 12, paddingBottom: 44 },
  lbl: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15, marginBottom: 4,
  },
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 13,
    paddingVertical: 15, alignItems: 'center', marginTop: 22,
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1.2 },
});

const s = StyleSheet.create({
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.accent + '60', borderRadius: 12,
    paddingVertical: 12, marginBottom: 16, backgroundColor: Colors.accent + '10',
  },
  addBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  loadingText: { color: Colors.textSecondary, textAlign: 'center', paddingTop: 40 },
  emptyWrap: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 8 },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },

  sectionLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 10 },

  goalCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  goalTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginBottom: 4 },
  goalDesc: { ...Typography.body, color: Colors.textSecondary, marginBottom: 6, lineHeight: 20 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  dateText: { ...Typography.caption, color: Colors.textSecondary },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%', paddingBottom: 16,
  },
});
