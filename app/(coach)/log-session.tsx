import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  Alert,
  FlatList,
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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useExerciseHistory, RecentExercise } from '@/hooks/useExerciseHistory';
import { useTemplates } from '@/hooks/useTemplates';
import { Colors, Typography } from '@/constants/theme';

type Exercise = {
  id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
  notes: string;
};

const todayISO = () => new Date().toISOString().split('T')[0];
const uid = () => Math.random().toString(36).slice(2);
const blankExercise = (): Exercise => ({ id: uid(), exercise_name: '', sets: '', reps: '', weight: '', duration: '', notes: '' });

function currentTimeStr(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Parse "9:00 AM" or "09:00" into a Date on the given YYYY-MM-DD
function parseSessionDateTime(date: string, time: string): Date | null {
  try {
    const [y, mo, d] = date.split('-').map(Number);
    let h = 0, m = 0;
    const upper = time.toUpperCase().trim();
    if (upper.includes('AM') || upper.includes('PM')) {
      const [timePart, period] = upper.split(' ');
      const [hh, mm] = timePart.split(':').map(Number);
      h = period === 'PM' && hh !== 12 ? hh + 12 : period === 'AM' && hh === 12 ? 0 : hh;
      m = mm || 0;
    } else {
      const [hh, mm] = upper.split(':').map(Number);
      h = hh; m = mm || 0;
    }
    return new Date(y, mo - 1, d, h, m, 0);
  } catch { return null; }
}

async function scheduleSessionReminder(clientName: string, sessionDate: string, sessionTime: string) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const sessionDT = parseSessionDateTime(sessionDate, sessionTime);
  if (!sessionDT) return;

  const reminderDT = new Date(sessionDT.getTime() - 15 * 60 * 1000);
  if (reminderDT <= new Date()) return; // already passed

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Session Starting Soon!',
      body: `${clientName}'s session starts in 15 minutes`,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDT },
  });
}

function ExerciseCard({
  exercise,
  index,
  onChange,
  onRemove,
}: {
  exercise: Exercise;
  index: number;
  onChange: (id: string, field: keyof Exercise, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.exCard}>
      <View style={styles.exCardHeader}>
        <Text style={styles.exCardTitle}>EXERCISE {index + 1}</Text>
        <Pressable onPress={() => onRemove(exercise.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
        </Pressable>
      </View>

      <TextInput
        style={styles.exInput}
        placeholder="Exercise name (e.g. Bench Press)"
        placeholderTextColor={Colors.textSecondary}
        value={exercise.exercise_name}
        onChangeText={(v) => onChange(exercise.id, 'exercise_name', v)}
      />

      <View style={styles.exRow}>
        <View style={styles.exSmallField}>
          <Text style={styles.exLabel}>SETS</Text>
          <TextInput
            style={styles.exSmallInput}
            placeholder="4"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            value={exercise.sets}
            onChangeText={(v) => onChange(exercise.id, 'sets', v)}
          />
        </View>
        <View style={styles.exSmallField}>
          <Text style={styles.exLabel}>REPS</Text>
          <TextInput
            style={styles.exSmallInput}
            placeholder="10"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            value={exercise.reps}
            onChangeText={(v) => onChange(exercise.id, 'reps', v)}
          />
        </View>
        <View style={styles.exSmallField}>
          <Text style={styles.exLabel}>DURATION</Text>
          <TextInput
            style={styles.exSmallInput}
            placeholder="30s"
            placeholderTextColor={Colors.textSecondary}
            value={exercise.duration}
            onChangeText={(v) => onChange(exercise.id, 'duration', v)}
          />
        </View>
      </View>

      {/* Weight row with BW quick-fill */}
      <View style={styles.exRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exLabel}>WEIGHT</Text>
          <TextInput
            style={styles.exSmallInput}
            placeholder="80kg / Body Weight"
            placeholderTextColor={Colors.textSecondary}
            value={exercise.weight}
            onChangeText={(v) => onChange(exercise.id, 'weight', v)}
          />
        </View>
        <View style={styles.bwBtnWrap}>
          <Text style={styles.exLabel}> </Text>
          <Pressable
            style={[styles.bwBtn, exercise.weight === 'Body Weight' && styles.bwBtnActive]}
            onPress={() => onChange(exercise.id, 'weight', exercise.weight === 'Body Weight' ? '' : 'Body Weight')}
          >
            <Text style={[styles.bwBtnText, exercise.weight === 'Body Weight' && styles.bwBtnTextActive]}>BW</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={[styles.exInput, styles.exNotes]}
        placeholder="Notes (optional)"
        placeholderTextColor={Colors.textSecondary}
        value={exercise.notes}
        onChangeText={(v) => onChange(exercise.id, 'notes', v)}
        multiline
        numberOfLines={2}
      />
    </View>
  );
}

export default function LogSessionScreen() {
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ clientId?: string; date?: string }>();
  const { clients } = useClients();
  const { history: exerciseHistory } = useExerciseHistory();
  const { templates, markUsed } = useTemplates();

  const [selectedClientId, setSelectedClientId] = useState(params.clientId ?? '');
  const [sessionDate, setSessionDate] = useState(params.date ?? todayISO());
  const [sessionType, setSessionType] = useState<'gym' | 'home'>('gym');
  const [duration, setDuration] = useState('60');
  const [exercises, setExercises] = useState<Exercise[]>([blankExercise()]);
  const [sessionTime, setSessionTime] = useState(currentTimeStr());
  const [sessionNotes, setSessionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  const activeClients = clients.filter((c) => c.activePackage?.status === 'active');
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const pkg = selectedClient?.activePackage;

  const addExercise = () => setExercises((prev) => [...prev, blankExercise()]);

  const addFromHistory = (item: RecentExercise) => {
    setExercises((prev) => [
      ...prev,
      { id: uid(), exercise_name: item.exercise_name, sets: item.sets, reps: item.reps, weight: item.weight, duration: item.duration, notes: '' },
    ]);
    setShowHistoryModal(false);
  };

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;

    const doApply = () => {
      setExercises(
        tpl.exercises.length > 0
          ? tpl.exercises.map((e) => ({
              id: uid(),
              exercise_name: e.exercise_name,
              sets: e.sets != null ? String(e.sets) : '',
              reps: e.reps != null ? String(e.reps) : '',
              weight: e.weight ?? '',
              duration: '',
              notes: e.notes ?? '',
            }))
          : [blankExercise()]
      );
      markUsed(templateId);
      setShowTemplateModal(false);
    };

    const hasExisting = exercises.some((e) => e.exercise_name.trim());
    if (hasExisting) {
      Alert.alert(
        'Load Template',
        `Replace current exercises with "${tpl.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: doApply },
        ]
      );
    } else {
      doApply();
    }
  };

  const updateExercise = (id: string, field: keyof Exercise, value: string) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const removeExercise = (id: string) => {
    if (exercises.length === 1) return;
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const canSave =
    selectedClientId &&
    pkg &&
    pkg.status === 'active' &&
    pkg.sessions_remaining > 0 &&
    sessionDate &&
    Number(duration) > 0 &&
    exercises.some((e) => e.exercise_name.trim());

  const handleSave = async () => {
    if (!canSave || !profile?.id || !pkg) return;

    const validExercises = exercises
      .filter((e) => e.exercise_name.trim())
      .map(({ id: _id, ...e }) => ({
        exercise_name: e.exercise_name.trim(),
        sets: e.sets ? Number(e.sets) : null,
        reps: e.reps ? Number(e.reps) : null,
        weight: e.weight.trim() || null,
        duration: e.duration.trim() || null,
        notes: e.notes.trim() || null,
      }));

    setLoading(true);
    try {
      const { data: sessionData, error } = await supabase.from('workout_sessions').insert({
        package_id: pkg.id,
        client_id: selectedClientId,
        coach_id: profile.id,
        session_date: sessionDate,
        scheduled_time: sessionTime.trim() || null,
        duration_minutes: Number(duration),
        exercises: validExercises,
        notes: sessionNotes.trim() || null,
        session_type: sessionType,
      }).select('id').single();

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (sessionTime.trim()) {
        await scheduleSessionReminder(selectedClient?.name ?? 'Client', sessionDate, sessionTime.trim());
      }

      // Try to start the session timer
      const { data: existingActive } = await supabase
        .from('active_sessions')
        .select('id')
        .eq('coach_id', profile.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!existingActive && sessionData?.id) {
        await supabase.from('active_sessions').insert({
          coach_id: profile.id,
          client_id: selectedClientId,
          session_id: sessionData.id,
          start_time: new Date().toISOString(),
          original_duration: Number(duration),
          current_duration: Number(duration),
          is_active: true,
        });
        Alert.alert(
          'Session Started!',
          `Timer started for ${selectedClient?.name} (${duration} min). Check your Dashboard.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          'Session logged!',
          `${selectedClient?.name}'s session recorded. Sessions remaining: ${pkg.sessions_remaining - 1}${existingActive ? '\n\nNote: Timer not started — a session is already active.' : ''}`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkout = () => {
    if (!canSave || !profile?.id || !pkg) return;
    const validExercises = exercises
      .filter((e) => e.exercise_name.trim())
      .map(({ id: _id, ...e }) => ({
        exercise_name: e.exercise_name.trim(),
        sets: e.sets ? Number(e.sets) : 1,
        reps: e.reps ? Number(e.reps) : null,
        weight: e.weight.trim() || null,
        duration: e.duration.trim() || null,
        notes: e.notes.trim() || null,
      }));
    router.push({
      pathname: '/(coach)/guided-workout',
      params: {
        exercises: JSON.stringify(validExercises),
        clientId: selectedClientId,
        pkgId: pkg.id,
        coachId: profile.id,
        sessionDate,
        durationMinutes: duration,
        sessionNotes: sessionNotes.trim(),
        clientName: selectedClient?.name ?? '',
      },
    });
  };

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Client picker */}
        <Text style={styles.sectionTitle}>CLIENT</Text>
        <Pressable style={styles.pickerBtn} onPress={() => setShowClientPicker((v) => !v)}>
          <Text style={[styles.pickerBtnText, !selectedClient && { color: Colors.textSecondary }]}>
            {selectedClient ? selectedClient.name : 'Select a client…'}
          </Text>
          <Ionicons
            name={showClientPicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textSecondary}
          />
        </Pressable>

        {showClientPicker && (
          <View style={styles.dropdown}>
            {activeClients.length === 0 ? (
              <Text style={styles.dropdownEmpty}>No active clients with sessions remaining</Text>
            ) : (
              activeClients.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.dropdownItem, c.id === selectedClientId && styles.dropdownItemActive]}
                  onPress={() => { setSelectedClientId(c.id); setShowClientPicker(false); }}
                >
                  <Text style={[styles.dropdownItemText, c.id === selectedClientId && { color: Colors.accent }]}>
                    {c.name}
                  </Text>
                  <Text style={styles.dropdownItemSub}>
                    {c.activePackage?.sessions_remaining} sessions remaining
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* Package warning */}
        {selectedClient && pkg && pkg.sessions_remaining <= 2 && pkg.sessions_remaining > 0 && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={16} color="#FFA500" />
            <Text style={styles.warningText}>
              Only {pkg.sessions_remaining} session{pkg.sessions_remaining !== 1 ? 's' : ''} remaining in this package
            </Text>
          </View>
        )}
        {selectedClient && pkg && pkg.sessions_remaining === 0 && (
          <View style={[styles.warningBanner, styles.errorBanner]}>
            <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
            <Text style={[styles.warningText, { color: Colors.danger }]}>
              This client has no sessions remaining
            </Text>
          </View>
        )}

        {/* Date + Duration */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SESSION DETAILS</Text>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>DATE</Text>
            <TextInput
              style={styles.input}
              value={sessionDate}
              onChangeText={setSessionDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>DURATION (MIN)</Text>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={(v) => setDuration(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
        </View>

        {/* Session type — Gym vs Home */}
        <View style={styles.field}>
          <Text style={styles.label}>SESSION TYPE</Text>
          <View style={styles.typeRow}>
            {(['gym', 'home'] as const).map((t) => (
              <Pressable
                key={t}
                style={[styles.typeBtn, sessionType === t && styles.typeBtnActive]}
                onPress={() => setSessionType(t)}
              >
                <Ionicons
                  name={t === 'gym' ? 'barbell-outline' : 'home-outline'}
                  size={16}
                  color={sessionType === t ? Colors.bg : Colors.textSecondary}
                />
                <Text style={[styles.typeBtnText, sessionType === t && styles.typeBtnTextActive]}>
                  {t === 'gym' ? 'Gym' : 'Home'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Start time (optional) */}
        <View style={styles.field}>
          <Text style={styles.label}>START TIME (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={sessionTime}
            onChangeText={setSessionTime}
            placeholder="e.g. 09:00 AM"
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        {/* Exercises */}
        <View style={styles.exHeader}>
          <Text style={styles.sectionTitle}>EXERCISES</Text>
          <View style={styles.exHeaderBtns}>
            {templates.length > 0 && (
              <Pressable style={styles.historyBtn} onPress={() => setShowTemplateModal(true)}>
                <Ionicons name="copy-outline" size={14} color={Colors.accent} />
                <Text style={styles.historyBtnText}>TEMPLATE</Text>
              </Pressable>
            )}
            {exerciseHistory.length > 0 && (
              <Pressable style={styles.historyBtn} onPress={() => setShowHistoryModal(true)}>
                <Ionicons name="time-outline" size={14} color={Colors.accent} />
                <Text style={styles.historyBtnText}>HISTORY</Text>
              </Pressable>
            )}
            <Pressable style={styles.addExBtn} onPress={addExercise}>
              <Ionicons name="add" size={16} color={Colors.bg} />
              <Text style={styles.addExBtnText}>ADD</Text>
            </Pressable>
          </View>
        </View>

        {exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            index={i}
            onChange={updateExercise}
            onRemove={removeExercise}
          />
        ))}

        {/* Session notes */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>SESSION NOTES</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Overall notes for this session…"
          placeholderTextColor={Colors.textSecondary}
          multiline
          numberOfLines={3}
          value={sessionNotes}
          onChangeText={setSessionNotes}
        />

        {/* Save button */}
        <Pressable
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || loading}
        >
          <Text style={styles.saveBtnText}>{loading ? 'SAVING…' : 'SAVE SESSION'}</Text>
        </Pressable>

        {/* Start Workout button */}
        <Pressable
          style={[styles.startWorkoutBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleStartWorkout}
          disabled={!canSave || loading}
        >
          <Ionicons name="play-circle-outline" size={20} color={Colors.accent} />
          <Text style={styles.startWorkoutBtnText}>START WORKOUT</Text>
        </Pressable>
      </ScrollView>

      {/* Template Picker Modal */}
      <Modal
        visible={showTemplateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTemplateModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>LOAD TEMPLATE</Text>
              <Pressable onPress={() => setShowTemplateModal(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>Select a template to auto-fill exercises</Text>
            <FlatList
              data={templates}
              keyExtractor={(t) => t.id}
              style={styles.historyList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const exCount = item.exercises.length;
                const preview = item.exercises.slice(0, 2).map((e) => e.exercise_name).join(', ');
                return (
                  <Pressable
                    style={({ pressed }) => [styles.historyItem, pressed && { opacity: 0.65 }]}
                    onPress={() => applyTemplate(item.id)}
                  >
                    <View style={styles.historyItemLeft}>
                      <Text style={styles.historyItemName}>{item.name}</Text>
                      {preview ? (
                        <Text style={styles.historyItemSub}>
                          {preview}{exCount > 2 ? '…' : ''}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.historyCountBadge}>
                      <Text style={styles.historyCountText}>{exCount} ex</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Exercise History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowHistoryModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PAST EXERCISES</Text>
              <Pressable onPress={() => setShowHistoryModal(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>Tap to add pre-filled to your session</Text>
            <FlatList
              data={exerciseHistory}
              keyExtractor={(item) => item.exercise_name}
              style={styles.historyList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const parts: string[] = [];
                if (item.sets && item.reps) parts.push(`${item.sets}×${item.reps}`);
                else if (item.sets) parts.push(`${item.sets} sets`);
                if (item.weight) parts.push(`@ ${item.weight}`);
                if (item.duration) parts.push(item.duration);
                const summary = parts.join(' · ');
                return (
                  <Pressable
                    style={({ pressed }) => [styles.historyItem, pressed && { opacity: 0.65 }]}
                    onPress={() => addFromHistory(item)}
                  >
                    <View style={styles.historyItemLeft}>
                      <Text style={styles.historyItemName}>{item.exercise_name}</Text>
                      {summary ? <Text style={styles.historyItemSub}>{summary}</Text> : null}
                    </View>
                    <View style={styles.historyCountBadge}>
                      <Text style={styles.historyCountText}>{item.count}×</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 12 },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  pickerBtnText: { ...Typography.body, color: Colors.textPrimary },
  dropdown: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  dropdownEmpty: { ...Typography.body, color: Colors.textSecondary, padding: 16, textAlign: 'center' },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemActive: { backgroundColor: Colors.accent + '12' },
  dropdownItemText: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  dropdownItemSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFA50015',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFA50040',
  },
  errorBanner: { backgroundColor: Colors.danger + '15', borderColor: Colors.danger + '40' },
  warningText: { ...Typography.caption, color: '#FFA500', flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 16 },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  typeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  typeBtnTextActive: { color: Colors.bg },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  exHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  historyBtnText: { color: Colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addExBtnText: { color: Colors.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },
  modalSub: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 16 },
  historyList: { flexGrow: 0 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyItemLeft: { flex: 1, marginRight: 12 },
  historyItemName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700' },
  historyItemSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  historyCountBadge: {
    backgroundColor: Colors.accent + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accent + '50',
  },
  historyCountText: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
  exCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  exCardTitle: { ...Typography.label, color: Colors.textSecondary, fontSize: 11 },
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
  exSmallField: { flex: 1 },
  bwBtnWrap: { justifyContent: 'flex-end', paddingBottom: 0 },
  bwBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bwBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  bwBtnText: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary },
  bwBtnTextActive: { color: Colors.bg },
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
  startWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 10,
  },
  startWorkoutBtnText: { color: Colors.accent, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
});
