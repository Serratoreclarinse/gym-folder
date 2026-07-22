import { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useGoals, ClientGoal, GoalStatus } from '@/hooks/useGoals';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; icon: string }> = {
  active:   { label: 'Active',   color: '#E8001D',        icon: 'flag-outline' },
  achieved: { label: 'Achieved', color: '#4CAF50',         icon: 'checkmark-circle-outline' },
  dropped:  { label: 'Dropped',  color: '#888888',         icon: 'close-circle-outline' },
};

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Goal form ─────────────────────────────────────────────────────────────────

function GoalForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (title: string, description: string, targetDate: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const gf = useMemo(() => makeFormStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={gf.handle} />
      <View style={gf.header}>
        <Text style={gf.title}>ADD GOAL</Text>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
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
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="sentences"
          returnKeyType="next"
        />

        <Text style={[gf.lbl, { marginTop: 14 }]}>DESCRIPTION (optional)</Text>
        <TextInput
          style={[gf.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Add details or milestones…"
          placeholderTextColor={colors.textSecondary}
          multiline
          autoCapitalize="sentences"
        />

        <Text style={[gf.lbl, { marginTop: 14 }]}>TARGET DATE (optional)</Text>
        {Platform.OS === 'ios' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <DateTimePicker
              value={targetDate ? new Date(targetDate + 'T00:00:00') : new Date()}
              mode="date"
              display="compact"
              onChange={(_, selected) => {
                if (selected) setTargetDate(selected.toISOString().split('T')[0]);
              }}
              style={{ marginLeft: -8 }}
            />
            {targetDate ? (
              <Pressable onPress={() => setTargetDate('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <Pressable style={gf.datePressable} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={gf.datePressableText}>
                {targetDate
                  ? new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Select target date (optional)'}
              </Text>
              {targetDate ? (
                <Pressable onPress={(e) => { e.stopPropagation(); setTargetDate(''); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={targetDate ? new Date(targetDate + 'T00:00:00') : new Date()}
                mode="date"
                display="default"
                onChange={(_, selected) => {
                  setShowDatePicker(false);
                  if (selected) setTargetDate(selected.toISOString().split('T')[0]);
                }}
              />
            )}
          </>
        )}

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

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onUpdateStatus,
  onDelete,
}: {
  goal: ClientGoal;
  onUpdateStatus: (id: string, status: GoalStatus) => void;
  onDelete: (id: string) => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
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

      <Text style={[s.goalTitle, goal.status !== 'active' && { color: colors.textSecondary }]}>
        {goal.title}
      </Text>

      {goal.description ? (
        <Text style={s.goalDesc}>{goal.description}</Text>
      ) : null}

      {goal.target_date ? (
        <View style={s.dateRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
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
            style={[s.actionBtn, { borderColor: colors.border }]}
            onPress={() => onUpdateStatus(goal.id, 'dropped')}
          >
            <Ionicons name="close-outline" size={14} color={colors.textSecondary} />
            <Text style={[s.actionBtnText, { color: colors.textSecondary }]}>Drop</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[s.actionBtn, { borderColor: colors.border, marginTop: 10, alignSelf: 'flex-start' }]}
          onPress={() => onUpdateStatus(goal.id, 'active')}
        >
          <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
          <Text style={[s.actionBtnText, { color: colors.textSecondary }]}>Reactivate</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function ClientGoalsTab({ clientId }: { clientId: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
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

  const closeForm = () => {
    if (saving) return;
    Keyboard.dismiss();
    setShowForm(false);
  };

  return (
    <>
      <Pressable style={s.addBtn} onPress={openForm}>
        <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
        <Text style={s.addBtnText}>ADD GOAL</Text>
      </Pressable>

      {loading ? (
        <Text style={s.loadingText}>Loading…</Text>
      ) : goals.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="flag-outline" size={52} color={colors.border} />
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
        onRequestClose={closeForm}
      >
        <Pressable style={s.overlay} onPress={closeForm}>
          <Pressable style={[s.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <GoalForm
              key={formKey}
              onSave={handleAdd}
              onCancel={closeForm}
              saving={saving}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeFormStyles(c: ColorScheme) {
  return StyleSheet.create({
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center', marginTop: 12, marginBottom: 8,
    },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, marginBottom: 4,
    },
    title: { ...Typography.label, color: c.textPrimary, fontSize: 14 },
    scroll: { flexGrow: 0 },
    content: { padding: 20, paddingTop: 12, paddingBottom: 44 },
    lbl: { ...Typography.label, color: c.textSecondary, marginBottom: 8 },
    input: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.textPrimary,
      fontSize: 15,
      marginBottom: 4,
    },
    saveBtn: {
      backgroundColor: c.accent,
      borderRadius: 13,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 22,
    },
    saveBtnDisabled: { opacity: 0.35 },
    saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 1.2 },
    datePressable: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12,
      borderRadius: 8, borderWidth: 1, borderColor: c.accent + '50',
      backgroundColor: c.accent + '10',
    },
    datePressableText: { flex: 1, fontSize: 14, fontWeight: '500', color: c.accent },
  });
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1.5, borderColor: c.accent + '60', borderRadius: 12,
      paddingVertical: 12, marginBottom: 16, backgroundColor: c.accent + '10',
    },
    addBtnText: { color: c.accent, fontSize: 13, fontWeight: '800', letterSpacing: 1 },

    loadingText: { color: c.textSecondary, textAlign: 'center', paddingTop: 40 },
    emptyWrap: { alignItems: 'center', paddingTop: 40, gap: 8 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 8 },
    emptySub: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },

    sectionLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 10 },

    goalCard: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      padding: 14, marginBottom: 10,
    },
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20,
      paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    goalTitle: { ...Typography.subtitle, color: c.textPrimary, marginBottom: 4 },
    goalDesc: { ...Typography.body, color: c.textSecondary, marginBottom: 6, lineHeight: 20 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    dateText: { ...Typography.caption, color: c.textSecondary },

    actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    },
    actionBtnText: { fontSize: 12, fontWeight: '600' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: '85%', paddingBottom: 16,
    },
  });
}
