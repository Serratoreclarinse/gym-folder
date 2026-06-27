import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTemplates, NewTemplateExercise } from '@/hooks/useTemplates';
import { Colors, Typography } from '@/constants/theme';

type ExField = {
  id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  notes: string;
};

const uid = () => Math.random().toString(36).slice(2);
const blank = (): ExField => ({
  id: uid(),
  exercise_name: '',
  sets: '',
  reps: '',
  weight: '',
  notes: '',
});

// Defined outside to prevent keyboard flicker
function ExCard({
  ex,
  index,
  onChange,
  onRemove,
}: {
  ex: ExField;
  index: number;
  onChange: (id: string, field: keyof ExField, v: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={s.exCard}>
      <View style={s.exHead}>
        <Text style={s.exNum}>EXERCISE {index + 1}</Text>
        <Pressable onPress={() => onRemove(ex.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
        </Pressable>
      </View>
      <TextInput
        style={s.exInput}
        placeholder="Exercise name"
        placeholderTextColor={Colors.textSecondary}
        value={ex.exercise_name}
        onChangeText={(v) => onChange(ex.id, 'exercise_name', v)}
      />
      <View style={s.exRow}>
        <View style={s.exSmall}>
          <Text style={s.exLabel}>SETS</Text>
          <TextInput
            style={s.exSmallInput}
            placeholder="4"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            value={ex.sets}
            onChangeText={(v) => onChange(ex.id, 'sets', v)}
          />
        </View>
        <View style={s.exSmall}>
          <Text style={s.exLabel}>REPS</Text>
          <TextInput
            style={s.exSmallInput}
            placeholder="10"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            value={ex.reps}
            onChangeText={(v) => onChange(ex.id, 'reps', v)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.exLabel}>WEIGHT</Text>
          <TextInput
            style={s.exSmallInput}
            placeholder="80kg"
            placeholderTextColor={Colors.textSecondary}
            value={ex.weight}
            onChangeText={(v) => onChange(ex.id, 'weight', v)}
          />
        </View>
      </View>
      <TextInput
        style={[s.exInput, s.exNotes]}
        placeholder="Notes (optional)"
        placeholderTextColor={Colors.textSecondary}
        value={ex.notes}
        onChangeText={(v) => onChange(ex.id, 'notes', v)}
        multiline
        numberOfLines={2}
      />
    </View>
  );
}

export default function TemplateFormScreen() {
  const params = useLocalSearchParams<{ templateId?: string }>();
  const { templates, createTemplate, updateTemplate } = useTemplates();
  const isEdit = !!params.templateId;
  const existing = templates.find((t) => t.id === params.templateId);

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<ExField[]>([blank()]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(!isEdit);

  useEffect(() => {
    if (isEdit && existing && !ready) {
      setName(existing.name);
      setExercises(
        existing.exercises.length > 0
          ? existing.exercises.map((e) => ({
              id: uid(),
              exercise_name: e.exercise_name,
              sets: e.sets != null ? String(e.sets) : '',
              reps: e.reps != null ? String(e.reps) : '',
              weight: e.weight ?? '',
              notes: e.notes ?? '',
            }))
          : [blank()]
      );
      setReady(true);
    }
  }, [isEdit, existing, ready]);

  const updateEx = (id: string, field: keyof ExField, v: string) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: v } : e)));
  };

  const removeEx = (id: string) => {
    if (exercises.length === 1) return;
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSave = async () => {
    const trimName = name.trim();
    if (!trimName) {
      Alert.alert('Name required', 'Please give this template a name.');
      return;
    }

    const validExercises: NewTemplateExercise[] = exercises
      .filter((e) => e.exercise_name.trim())
      .map((e, i) => ({
        exercise_name: e.exercise_name.trim(),
        sets: e.sets ? Number(e.sets) : null,
        reps: e.reps ? Number(e.reps) : null,
        weight: e.weight.trim() || null,
        notes: e.notes.trim() || null,
        order_index: i,
      }));

    setSaving(true);
    try {
      if (isEdit && params.templateId) {
        await updateTemplate(params.templateId, trimName, validExercises);
      } else {
        await createTemplate(trimName, validExercises);
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const canSave = name.trim().length > 0 && !saving;

  return (
    <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.label}>TEMPLATE NAME</Text>
        <TextInput
          style={s.nameInput}
          placeholder="e.g. Push Day A"
          placeholderTextColor={Colors.textSecondary}
          value={name}
          onChangeText={setName}
          autoFocus={!isEdit}
        />

        <View style={s.exHeader}>
          <Text style={s.label}>EXERCISES</Text>
          <Pressable
            style={s.addBtn}
            onPress={() => setExercises((prev) => [...prev, blank()])}
          >
            <Ionicons name="add" size={16} color={Colors.bg} />
            <Text style={s.addBtnText}>ADD</Text>
          </Pressable>
        </View>

        {exercises.map((ex, i) => (
          <ExCard key={ex.id} ex={ex} index={i} onChange={updateEx} onRemove={removeEx} />
        ))}

        <Pressable
          style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={s.saveBtnText}>
            {saving ? 'SAVING…' : isEdit ? 'UPDATE TEMPLATE' : 'SAVE TEMPLATE'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: 10 },
  nameInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 28,
  },
  exHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { color: Colors.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  exCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  exNum: { ...Typography.label, color: Colors.textSecondary, fontSize: 11 },
  exInput: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 14,
    marginBottom: 8,
  },
  exNotes: { minHeight: 56, textAlignVertical: 'top', marginBottom: 0 },
  exRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  exSmall: { flex: 1 },
  exLabel: { ...Typography.label, color: Colors.textSecondary, fontSize: 10, marginBottom: 6 },
  exSmallInput: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: Colors.textPrimary,
    fontSize: 14,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: Colors.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
});
