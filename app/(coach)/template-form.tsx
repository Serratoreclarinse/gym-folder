import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { ExercisePickerModal } from '@/components/ExercisePickerModal';

type SetRowField = {
  id: string;
  reps: string;
  weight: string;
};

type ExField = {
  id: string;
  exercise_name: string;
  setRows: SetRowField[];
  notes: string;
};

const uid = () => Math.random().toString(36).slice(2);
const blankRow = (): SetRowField => ({ id: uid(), reps: '', weight: '' });
const blank = (): ExField => ({
  id: uid(),
  exercise_name: '',
  setRows: [blankRow()],
  notes: '',
});

// Defined outside to prevent keyboard flicker
function ExCard({
  ex,
  index,
  onChangeName,
  onChangeNotes,
  onSetRowChange,
  onAddSet,
  onRemoveSet,
  onRemove,
  onOpenPicker,
  styles,
  colors,
}: {
  ex: ExField;
  index: number;
  onChangeName: (id: string, v: string) => void;
  onChangeNotes: (id: string, v: string) => void;
  onSetRowChange: (exId: string, rowId: string, field: 'reps' | 'weight', v: string) => void;
  onAddSet: (exId: string) => void;
  onRemoveSet: (exId: string, rowId: string) => void;
  onRemove: (id: string) => void;
  onOpenPicker: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorScheme;
}) {
  return (
    <View style={styles.exCard}>
      <View style={styles.exHead}>
        <Text style={styles.exNum}>EXERCISE {index + 1}</Text>
        <Pressable onPress={() => onRemove(ex.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>

      <Pressable
        style={[styles.exInput, styles.exNameBtn]}
        onPress={() => onOpenPicker(ex.id)}
      >
        <Text
          style={[styles.exNameText, !ex.exercise_name && { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {ex.exercise_name || 'Tap to select exercise…'}
        </Text>
        <Ionicons name="search-outline" size={15} color={colors.textSecondary} />
      </Pressable>

      <View style={styles.setHeader}>
        <Text style={[styles.exLabel, { flex: 0.3 }]}>#</Text>
        <Text style={[styles.exLabel, { flex: 1 }]}>REPS</Text>
        <Text style={[styles.exLabel, { flex: 1 }]}>WEIGHT</Text>
        <View style={{ width: 28 }} />
      </View>

      {ex.setRows.map((row, ri) => (
        <View key={row.id} style={styles.setRow}>
          <Text style={styles.setNum}>{ri + 1}</Text>
          <TextInput
            style={[styles.exSmallInput, { flex: 1 }]}
            placeholder="10"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            value={row.reps}
            onChangeText={(v) => onSetRowChange(ex.id, row.id, 'reps', v)}
          />
          <TextInput
            style={[styles.exSmallInput, { flex: 1 }]}
            placeholder="60kg"
            placeholderTextColor={colors.textSecondary}
            value={row.weight}
            onChangeText={(v) => onSetRowChange(ex.id, row.id, 'weight', v)}
          />
          <Pressable
            onPress={() => onRemoveSet(ex.id, row.id)}
            hitSlop={6}
            disabled={ex.setRows.length === 1}
            style={[styles.removeSetBtn, ex.setRows.length === 1 && { opacity: 0.25 }]}
          >
            <Ionicons name="remove-circle-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      ))}

      <Pressable style={styles.addSetBtn} onPress={() => onAddSet(ex.id)}>
        <Ionicons name="add" size={14} color={colors.accent} />
        <Text style={styles.addSetText}>ADD SET</Text>
      </Pressable>

      <TextInput
        style={[styles.exInput, styles.exNotes]}
        placeholder="Notes (optional)"
        placeholderTextColor={colors.textSecondary}
        value={ex.notes}
        onChangeText={(v) => onChangeNotes(ex.id, v)}
        multiline
        numberOfLines={2}
      />
    </View>
  );
}

export default function TemplateFormScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ templateId?: string }>();
  const { templates, createTemplate, updateTemplate } = useTemplates();
  const isEdit = !!params.templateId;
  const existing = templates.find((t) => t.id === params.templateId);

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<ExField[]>([blank()]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(!isEdit);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && existing && !ready) {
      setName(existing.name);
      setExercises(
        existing.exercises.length > 0
          ? existing.exercises.map((e) => ({
              id: uid(),
              exercise_name: e.exercise_name,
              setRows:
                e.set_rows.length > 0
                  ? e.set_rows.map((r) => ({
                      id: uid(),
                      reps: r.reps != null ? String(r.reps) : '',
                      weight: r.weight ?? '',
                    }))
                  : Array.from({ length: e.sets ?? 1 }, () => ({
                      id: uid(),
                      reps: e.reps != null ? String(e.reps) : '',
                      weight: e.weight ?? '',
                    })),
              notes: e.notes ?? '',
            }))
          : [blank()]
      );
      setReady(true);
    }
  }, [isEdit, existing, ready]);

  const onChangeName = (id: string, v: string) =>
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, exercise_name: v } : e)));

  const onChangeNotes = (id: string, v: string) =>
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, notes: v } : e)));

  const onSetRowChange = (exId: string, rowId: string, field: 'reps' | 'weight', v: string) =>
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exId
          ? { ...e, setRows: e.setRows.map((r) => (r.id === rowId ? { ...r, [field]: v } : r)) }
          : e
      )
    );

  const onAddSet = (exId: string) =>
    setExercises((prev) =>
      prev.map((e) => (e.id === exId ? { ...e, setRows: [...e.setRows, blankRow()] } : e))
    );

  const onRemoveSet = (exId: string, rowId: string) =>
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exId && e.setRows.length > 1
          ? { ...e, setRows: e.setRows.filter((r) => r.id !== rowId) }
          : e
      )
    );

  const openPicker = (id: string) => {
    setPickerTargetId(id);
    setPickerVisible(true);
  };

  const handlePickerSelect = (exName: string) => {
    if (pickerTargetId) {
      onChangeName(pickerTargetId, exName);
    }
    setPickerVisible(false);
    setPickerTargetId(null);
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
        sets: e.setRows.length,
        reps: null,
        weight: null,
        notes: e.notes.trim() || null,
        order_index: i,
        set_rows: e.setRows.map((r) => ({
          reps: r.reps ? Number(r.reps) : null,
          weight: r.weight.trim() || null,
        })),
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
          placeholderTextColor={colors.textSecondary}
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
            <Ionicons name="add" size={16} color={colors.bg} />
            <Text style={s.addBtnText}>ADD</Text>
          </Pressable>
        </View>

        {exercises.map((ex, i) => (
          <ExCard
            key={ex.id}
            ex={ex}
            index={i}
            onChangeName={onChangeName}
            onChangeNotes={onChangeNotes}
            onSetRowChange={onSetRowChange}
            onAddSet={onAddSet}
            onRemoveSet={onRemoveSet}
            onRemove={removeEx}
            onOpenPicker={openPicker}
            styles={s}
            colors={colors}
          />
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

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => { setPickerVisible(false); setPickerTargetId(null); }}
        onSelect={handlePickerSelect}
      />
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    kav: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 60 },
    label: { ...Typography.label, color: c.textSecondary, marginBottom: 10 },
    nameInput: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: c.textPrimary,
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
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    addBtnText: { color: c.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
    exCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    exHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    exNum: { ...Typography.label, color: c.textSecondary, fontSize: 11 },
    exInput: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.textPrimary,
      fontSize: 14,
      marginBottom: 8,
    },
    exNameBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    exNameText: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '500',
      marginRight: 8,
    },
    exNotes: { minHeight: 56, textAlignVertical: 'top', marginBottom: 0, marginTop: 8 },
    setHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
      marginTop: 4,
    },
    exLabel: { ...Typography.label, color: c.textSecondary, fontSize: 10 },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    setNum: {
      ...Typography.label,
      color: c.textSecondary,
      fontSize: 11,
      width: 20,
      textAlign: 'center',
    },
    exSmallInput: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
      color: c.textPrimary,
      fontSize: 14,
      textAlign: 'center',
    },
    removeSetBtn: {
      width: 28,
      alignItems: 'center',
    },
    addSetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      marginTop: 2,
      marginBottom: 2,
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    addSetText: {
      color: c.accent,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    saveBtn: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    saveBtnDisabled: { opacity: 0.35 },
    saveBtnText: { color: c.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
  });
}
