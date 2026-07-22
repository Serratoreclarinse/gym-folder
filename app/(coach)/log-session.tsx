import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { QRScanModal } from '@/components/QRScanModal';
import { PRSummaryModal, PRBeat } from '@/components/PRSummaryModal';
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
import { useClientLastWeights } from '@/hooks/useClientLastWeights';
import { useTemplates } from '@/hooks/useTemplates';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { sendPushNotification } from '@/lib/pushNotifications';

type SetData = { kg: string; reps: string; duration: string };

type Exercise = {
  id: string;
  exercise_name: string;
  sets_data: SetData[];
  notes: string;
  isSuperset: boolean;
};

const QUICK_DURATIONS = [30, 45, 60, 90] as const;

const TIME_SLOTS = [
  '5:00 AM', '5:30 AM',
  '6:00 AM', '6:30 AM',
  '7:00 AM', '7:30 AM',
  '8:00 AM', '8:30 AM',
  '9:00 AM', '9:30 AM',
  '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM',
  '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM',
  '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM',
  '9:00 PM',
] as const;
const todayISO = () => new Date().toISOString().split('T')[0];
const uid = () => Math.random().toString(36).slice(2);
const blankSetData = (): SetData => ({ kg: '', reps: '', duration: '' });
const blankExercise = (): Exercise => ({ id: uid(), exercise_name: '', sets_data: [blankSetData()], notes: '', isSuperset: false });

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

async function scheduleSessionReminder(
  clientName: string,
  sessionDate: string,
  sessionTime: string,
  clientId: string,
) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const sessionDT = parseSessionDateTime(sessionDate, sessionTime);
  if (!sessionDT) return;

  const now = Date.now();

  // Schedule local coach reminders at T-30 and T-15
  const slots: { offsetMs: number; label: string }[] = [
    { offsetMs: 30 * 60 * 1000, label: '30 minutes' },
    { offsetMs: 15 * 60 * 1000, label: '15 minutes' },
  ];

  for (const { offsetMs, label } of slots) {
    const fireAt = new Date(sessionDT.getTime() - offsetMs);
    if (fireAt.getTime() <= now) continue;
    if (Platform.OS === 'web') continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Session Starting Soon!',
        body: `${clientName}'s session starts in ${label}`,
        sound: true,
        data: { clientId, clientName, label },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
  }

  // Immediate push to client confirming the session time
  await sendPushNotification(clientId, {
    title: '📅 Session Confirmed',
    body: `Your session is set for ${sessionTime}. See you soon!`,
  });
}

function ExerciseCard({
  exercise,
  index,
  isLast,
  lastWeight,
  onChange,
  onSetChange,
  onAddSet,
  onRemoveLastSet,
  onBWToggle,
  onRemove,
  onToggleSuperset,
  onOpenPicker,
}: {
  exercise: Exercise;
  lastWeight?: string;
  index: number;
  isLast: boolean;
  onChange: (id: string, field: 'exercise_name' | 'notes', value: string) => void;
  onSetChange: (id: string, setIndex: number, field: keyof SetData, value: string) => void;
  onAddSet: (id: string) => void;
  onRemoveLastSet: (id: string) => void;
  onBWToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleSuperset: (id: string) => void;
  onOpenPicker: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allBW = exercise.sets_data.length > 0 && exercise.sets_data.every(s => s.kg === 'BW');

  return (
    <View style={styles.exCard}>
      <View style={styles.exCardHeader}>
        <Text style={styles.exCardTitle}>EXERCISE {index + 1}</Text>
        <Pressable onPress={() => onRemove(exercise.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>

      {/* Exercise name — tappable to open library picker */}
      <Pressable
        style={[styles.exInput, styles.exNameBtn]}
        onPress={() => onOpenPicker(exercise.id)}
      >
        <Text style={[styles.exNameBtnText, !exercise.exercise_name && { color: colors.textSecondary }]}
          numberOfLines={1}>
          {exercise.exercise_name || 'Tap to select exercise…'}
        </Text>
        <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
      </Pressable>

      {lastWeight ? <Text style={styles.lastWeightHint}>last: {lastWeight}</Text> : null}

      {/* Column headers */}
      <View style={styles.setHeaderRow}>
        <View style={styles.setColSet} />
        <Text style={[styles.setColLabel, styles.setColKg]}>KG</Text>
        <Text style={[styles.setColLabel, styles.setColReps]}>REPS</Text>
        <Text style={[styles.setColLabel, styles.setColDur]}>DUR.</Text>
      </View>

      {/* Per-set rows */}
      {exercise.sets_data.map((setRow, i) => (
        <View key={i} style={styles.setDataRow}>
          <Text style={[styles.setLabel, styles.setColSet]}>Set {i + 1}</Text>
          <TextInput
            style={[styles.setInput, styles.setColKg]}
            placeholder="—"
            placeholderTextColor={colors.border}
            keyboardType="decimal-pad"
            value={setRow.kg}
            onChangeText={(v) => onSetChange(exercise.id, i, 'kg', v)}
          />
          <TextInput
            style={[styles.setInput, styles.setColReps]}
            placeholder="—"
            placeholderTextColor={colors.border}
            keyboardType="number-pad"
            value={setRow.reps}
            onChangeText={(v) => onSetChange(exercise.id, i, 'reps', v)}
          />
          <TextInput
            style={[styles.setInput, styles.setColDur]}
            placeholder="—"
            placeholderTextColor={colors.border}
            value={setRow.duration}
            onChangeText={(v) => onSetChange(exercise.id, i, 'duration', v)}
          />
        </View>
      ))}

      {/* Set controls: remove / count / add / BW */}
      <View style={styles.setControlRow}>
        <Pressable
          style={[styles.setCtrlBtn, exercise.sets_data.length <= 1 && styles.setCtrlBtnDisabled]}
          onPress={() => onRemoveLastSet(exercise.id)}
          disabled={exercise.sets_data.length <= 1}
        >
          <Ionicons name="remove" size={16} color={exercise.sets_data.length <= 1 ? colors.border : colors.textSecondary} />
        </Pressable>
        <Text style={styles.setCountText}>
          {exercise.sets_data.length} SET{exercise.sets_data.length !== 1 ? 'S' : ''}
        </Text>
        <Pressable style={styles.setCtrlBtn} onPress={() => onAddSet(exercise.id)}>
          <Ionicons name="add" size={16} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          style={[styles.bwBtn, allBW && styles.bwBtnActive]}
          onPress={() => onBWToggle(exercise.id)}
        >
          <Text style={[styles.bwBtnText, allBW && styles.bwBtnTextActive]}>BW</Text>
        </Pressable>
      </View>

      <TextInput
        style={[styles.exInput, styles.exNotes]}
        placeholder="Notes (optional)"
        placeholderTextColor={colors.textSecondary}
        value={exercise.notes}
        onChangeText={(v) => onChange(exercise.id, 'notes', v)}
        multiline
        numberOfLines={2}
      />

      {!isLast && (
        <Pressable
          style={[styles.supersetToggle, exercise.isSuperset && styles.supersetToggleActive]}
          onPress={() => onToggleSuperset(exercise.id)}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={13}
            color={exercise.isSuperset ? colors.bg : colors.textSecondary}
          />
          <Text style={[styles.supersetToggleText, exercise.isSuperset && styles.supersetToggleTextActive]}>
            {exercise.isSuperset ? 'SUPERSET WITH NEXT ✓' : 'SUPERSET WITH NEXT'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function CalendarPicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { colors } = useTheme();
  const calStyles = useMemo(() => makeCalStyles(colors), [colors]);
  const sel = new Date(value + 'T00:00:00');
  const [vy, setVy] = useState(sel.getFullYear());
  const [vm, setVm] = useState(sel.getMonth());

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const prevMonth = () => { if (vm === 0) { setVy(y => y - 1); setVm(11); } else setVm(m => m - 1); };
  const nextMonth = () => { if (vm === 11) { setVy(y => y + 1); setVm(0); } else setVm(m => m + 1); };

  const firstDay = new Date(vy, vm, 1);
  const totalDays = new Date(vy, vm + 1, 0).getDate();
  const startPad = firstDay.getDay();
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  const monthLabel = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={calStyles.container}>
      <View style={calStyles.header}>
        <Pressable onPress={prevMonth} hitSlop={12} style={calStyles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={calStyles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={nextMonth} hitSlop={12} style={calStyles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={calStyles.dayNames}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <Text key={d} style={calStyles.dayName}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`p${i}`} style={calStyles.cell} />;
          const iso = `${vy}-${String(vm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = iso === value;
          const isToday = new Date(vy, vm, day).getTime() === today.getTime();
          return (
            <Pressable
              key={iso}
              style={[calStyles.cell, isSelected && calStyles.cellSelected, isToday && !isSelected && calStyles.cellToday]}
              onPress={() => onChange(iso)}
            >
              <Text style={[calStyles.cellText, isSelected && calStyles.cellTextSelected, isToday && !isSelected && calStyles.cellTextToday]}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeCalStyles(colors: ColorScheme) {
  return StyleSheet.create({
  container: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 12, marginTop: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { padding: 4 },
  monthLabel: { ...Typography.body, color: colors.textPrimary, fontWeight: '700' },
  dayNames: { flexDirection: 'row', marginBottom: 4 },
  dayName: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: colors.accent, borderRadius: 100 },
  cellToday: { borderWidth: 1, borderColor: colors.accent, borderRadius: 100 },
  cellText: { fontSize: 14, color: colors.textPrimary },
  cellTextSelected: { color: colors.bg, fontWeight: '700' },
  cellTextToday: { color: colors.accent, fontWeight: '700' },
});
}

export default function LogSessionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ clientId?: string; date?: string; mode?: string; exercises?: string; duration?: string; sessionType?: string }>();
  const { clients } = useClients();
  const { history: exerciseHistory } = useExerciseHistory();
  const { templates, markUsed } = useTemplates();

  const [selectedClientId, setSelectedClientId] = useState(params.clientId ?? '');
  const { getLastUsed } = useClientLastWeights(selectedClientId || null);
  const [sessionDate, setSessionDate] = useState(params.date ?? todayISO());
  const [sessionType, setSessionType] = useState<'gym' | 'home'>(params.sessionType === 'home' ? 'home' : 'gym');
  const [duration, setDuration] = useState(params.duration ?? '60');
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const rawEx = Array.isArray(params.exercises) ? params.exercises[0] : params.exercises;
    if (rawEx) {
      try {
        const parsed = JSON.parse(rawEx) as Array<Record<string, unknown>>;
        if (parsed.length > 0) {
          return parsed.map((ex, i) => {
            if (Array.isArray(ex.sets_data)) {
              return {
                id: String(i),
                exercise_name: String(ex.exercise_name ?? ''),
                sets_data: (ex.sets_data as any[]).map((s: any) => ({
                  kg: String(s.kg ?? ''),
                  reps: String(s.reps ?? ''),
                  duration: String(s.duration ?? ''),
                })),
                notes: String(ex.notes ?? ''),
                isSuperset: false,
              };
            }
            const numSets = Number(ex.sets) || 1;
            return {
              id: String(i),
              exercise_name: String(ex.exercise_name ?? ''),
              sets_data: Array.from({ length: numSets }, () => ({
                kg: String(ex.weight ?? ''),
                reps: String(ex.reps ?? ''),
                duration: String(ex.duration ?? ''),
              })),
              notes: String(ex.notes ?? ''),
              isSuperset: false,
            };
          });
        }
      } catch {
        Alert.alert('Restore Warning', 'Could not restore exercises from the previous session.');
      }
    }
    return [blankExercise()];
  });
  const [sessionTime, setSessionTime] = useState(currentTimeStr());
  const [sessionNotes, setSessionNotes] = useState('');
  const [mode, setMode] = useState<'full' | 'quick'>(params.mode === 'quick' ? 'quick' : 'full');
  const [showQRGate, setShowQRGate] = useState(false);
  const [qrConfirmFn, setQrConfirmFn] = useState<(() => void) | null>(null);
  const [loading, setLoading] = useState(false);
  const savingRef = useRef(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState<string | null>(null);
  const [prBeats, setPrBeats] = useState<PRBeat[]>([]);
  const pickerTargetRef = useRef<string | null>(null);

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  const activeClients = clients.filter((c) => c.activePackage?.status === 'active');
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const pkg = selectedClient?.activePackage;

  const addExercise = () => setExercises((prev) => [...prev, blankExercise()]);

  const addFromHistory = (item: RecentExercise) => {
    const numSets = Number(item.sets) || 1;
    setExercises((prev) => [
      ...prev,
      {
        id: uid(),
        exercise_name: item.exercise_name,
        sets_data: Array.from({ length: numSets }, () => ({
          kg: item.weight || '',
          reps: item.reps || '',
          duration: item.duration || '',
        })),
        notes: '',
        isSuperset: false,
      },
    ]);
    setShowHistoryModal(false);
  };

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;

    const doApply = () => {
      setExercises(
        tpl.exercises.length > 0
          ? tpl.exercises.map((e) => {
              const setsData =
                e.set_rows.length > 0
                  ? e.set_rows.map((r) => ({
                      kg: r.weight ?? '',
                      reps: r.reps != null ? String(r.reps) : '',
                      duration: '',
                    }))
                  : Array.from({ length: Number(e.sets) || 1 }, () => ({
                      kg: e.weight ?? '',
                      reps: e.reps != null ? String(e.reps) : '',
                      duration: '',
                    }));
              return {
                id: uid(),
                exercise_name: e.exercise_name,
                sets_data: setsData,
                notes: e.notes ?? '',
                isSuperset: false,
              };
            })
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

  const updateExercise = (id: string, field: 'exercise_name' | 'notes', value: string) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const updateSetField = (id: string, setIndex: number, field: keyof SetData, value: string) => {
    setExercises((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const newSetsData = [...e.sets_data];
      newSetsData[setIndex] = { ...newSetsData[setIndex], [field]: value };
      return { ...e, sets_data: newSetsData };
    }));
  };

  const addSet = (id: string) => {
    setExercises((prev) => prev.map((e) =>
      e.id !== id ? e : { ...e, sets_data: [...e.sets_data, blankSetData()] }
    ));
  };

  const removeLastSet = (id: string) => {
    setExercises((prev) => prev.map((e) =>
      e.id !== id || e.sets_data.length <= 1 ? e : { ...e, sets_data: e.sets_data.slice(0, -1) }
    ));
  };

  const bwToggle = (id: string) => {
    setExercises((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const allBW = e.sets_data.every(s => s.kg === 'BW');
      return { ...e, sets_data: e.sets_data.map(s => ({ ...s, kg: allBW ? '' : 'BW' })) };
    }));
  };

  const toggleSuperset = (id: string) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, isSuperset: !e.isSuperset } : e)));
  };

  const removeExercise = (id: string) => {
    if (exercises.length === 1) return;
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const canSave =
    !!selectedClientId &&
    !!pkg &&
    pkg.status === 'active' &&
    pkg.sessions_remaining > 0 &&
    !!sessionDate &&
    Number(duration) > 0 &&
    (mode === 'quick' || !!sessionTime.trim()) &&
    (mode === 'quick' || exercises.some((e) => e.exercise_name.trim()));

  const handleSave = async () => {
    if (!canSave || !profile?.id || !pkg) return;
    if (savingRef.current) return;
    savingRef.current = true;

    // Block if client already has a session on this date
    const { data: dup } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('client_id', selectedClientId)
      .eq('session_date', sessionDate)
      .neq('status', 'absent')
      .limit(1)
      .maybeSingle();

    if (dup) {
      const { data: runningSession } = await supabase
        .from('active_sessions')
        .select('id')
        .eq('session_id', dup.id)
        .eq('is_active', true)
        .maybeSingle();

      savingRef.current = false;
      Alert.alert(
        runningSession ? 'Session In Progress' : 'Session Already Logged',
        runningSession
          ? `${selectedClient?.name ?? 'This client'} already has an active session running today. Check your Dashboard to manage it.`
          : `${selectedClient?.name ?? 'This client'} already has a session on ${sessionDate}. Only 1 session per client per day is allowed.`,
        runningSession
          ? [{ text: 'OK' }, { text: 'Go to Dashboard', onPress: () => router.back() }]
          : [{ text: 'OK' }],
      );
      return;
    }

    // Time conflict check — coach can't have overlapping sessions (any client)
    if (sessionTime.trim() && Number(duration) > 0) {
      const newStart = parseSessionDateTime(sessionDate, sessionTime.trim());
      if (newStart) {
        const newEndMs = newStart.getTime() + Number(duration) * 60 * 1000;

        // Check logged sessions for other clients on same date
        const { data: sameDaySessions } = await supabase
          .from('workout_sessions')
          .select('id, scheduled_time, duration_minutes, client_id')
          .eq('coach_id', profile.id)
          .eq('session_date', sessionDate)
          .neq('client_id', selectedClientId)
          .neq('status', 'absent');

        for (const sess of sameDaySessions ?? []) {
          if (!sess.scheduled_time) continue;
          const existStart = parseSessionDateTime(sessionDate, sess.scheduled_time);
          if (!existStart) continue;
          const existEndMs = existStart.getTime() + (sess.duration_minutes || 60) * 60 * 1000;
          if (newStart.getTime() < existEndMs && newEndMs > existStart.getTime()) {
            const conflictName = clients.find(c => c.id === sess.client_id)?.name ?? 'another client';
            savingRef.current = false;
            Alert.alert(
              '⚠️ Time Conflict',
              `You already have a session with ${conflictName} at ${sess.scheduled_time}.\n\n${sessionTime.trim()} overlaps with that session. Please choose a different time.`,
              [{ text: 'OK' }],
            );
            return;
          }
        }

        // Check scheduled (future) sessions for other clients on same date
        const { data: schedConflicts } = await supabase
          .from('scheduled_sessions')
          .select('id, scheduled_at, client_id')
          .eq('coach_id', profile.id)
          .neq('client_id', selectedClientId)
          .gte('scheduled_at', sessionDate + 'T00:00:00.000Z')
          .lte('scheduled_at', sessionDate + 'T23:59:59.999Z')
          .in('status', ['pending', 'client_confirmed', 'reschedule_pending']);

        for (const ss of schedConflicts ?? []) {
          const existStart = new Date(ss.scheduled_at);
          const existEndMs = existStart.getTime() + 60 * 60 * 1000;
          if (newStart.getTime() < existEndMs && newEndMs > existStart.getTime()) {
            const conflictName = clients.find(c => c.id === ss.client_id)?.name ?? 'another client';
            const conflictTime = existStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            savingRef.current = false;
            Alert.alert(
              '⚠️ Time Conflict',
              `You already have a session with ${conflictName} scheduled at ${conflictTime}.\n\n${sessionTime.trim()} overlaps with that session. Please choose a different time.`,
              [{ text: 'OK' }],
            );
            return;
          }
        }
      }
    }

    const validExercises = exercises
      .filter((e) => e.exercise_name.trim())
      .map(({ id: _id, sets_data, ...e }) => {
        const maxKg = sets_data.reduce((mx, s) => { const n = parseFloat(s.kg || '0') || 0; return n > mx ? n : mx; }, 0);
        const firstReps = sets_data.find(s => s.reps)?.reps ?? null;
        const firstDur = sets_data.find(s => s.duration)?.duration ?? null;
        return {
          exercise_name: e.exercise_name.trim(),
          sets: sets_data.length,
          reps: firstReps ? Number(firstReps) : null,
          weight: maxKg > 0 ? String(maxKg) : (sets_data.some(s => s.kg === 'BW') ? 'BW' : null),
          duration: firstDur || null,
          notes: e.notes.trim() || null,
          isSuperset: e.isSuperset,
          sets_data: sets_data.map((s, i) => ({
            set: i + 1,
            kg: s.kg || null,
            reps: s.reps ? Number(s.reps) : null,
            duration: s.duration || null,
          })),
        };
      });

    setLoading(true);
    try {
      // Future session: schedule only — no workout record, no session deduction
      const _todayIso = new Date().toISOString().slice(0, 10);
      if (sessionDate > _todayIso) {
        const scheduledDt = parseSessionDateTime(sessionDate, sessionTime.trim() || '09:00');
        if (scheduledDt && profile?.id) {
          const { error: schedErr } = await supabase.from('scheduled_sessions').insert({
            coach_id: profile.id,
            client_id: selectedClientId,
            scheduled_at: scheduledDt.toISOString(),
            notes: sessionNotes.trim() || null,
            status: 'pending',
          });
          if (schedErr) { Alert.alert('Error', schedErr.message); return; }
        }
        const dateLabel = new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        Alert.alert(
          'Session Scheduled!',
          `${selectedClient?.name ?? 'Client'}'s session on ${dateLabel}${sessionTime.trim() ? ' at ' + sessionTime.trim() : ''} has been scheduled. The client will see a countdown on their dashboard.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }

      // Past/today: create workout record and deduct session
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
        status: 'completed',
      }).select('id').single();

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      // Mark any scheduled_sessions on this day as completed
      await supabase
        .from('scheduled_sessions')
        .update({ status: 'completed' })
        .eq('client_id', selectedClientId)
        .gte('scheduled_at', sessionDate + 'T00:00:00.000Z')
        .lte('scheduled_at', sessionDate + 'T23:59:59.999Z')
        .in('status', ['pending', 'client_confirmed', 'reschedule_pending']);

      if (sessionTime.trim()) {
        await scheduleSessionReminder(selectedClient?.name ?? 'Client', sessionDate, sessionTime.trim(), selectedClientId);
      }

      // ── PR Detection + exercise_records save ────────────────────────────────
      const newPRBeats: PRBeat[] = [];
      try {
        // Fetch previous best per exercise for this client
        const { data: prevRecords } = await supabase
          .from('exercise_records')
          .select('exercise_name, best_kg, best_reps, best_duration')
          .eq('client_id', selectedClientId);

        // Build map: exercise key → all-time best values so far
        type BestMap = { kg: number | null; reps: number | null; dur: number | null };
        const bestMap = new Map<string, BestMap>();
        for (const r of (prevRecords ?? [])) {
          const key = r.exercise_name.toLowerCase().trim();
          const cur = bestMap.get(key) ?? { kg: null, reps: null, dur: null };
          bestMap.set(key, {
            kg:   Math.max(cur.kg ?? 0,   r.best_kg       ?? 0) || null,
            reps: Math.max(cur.reps ?? 0, r.best_reps     ?? 0) || null,
            dur:  Math.max(cur.dur ?? 0,  r.best_duration ?? 0) || null,
          });
        }

        // Compute this session's best per exercise + detect PRs
        const recordsToInsert = validExercises.map((ex) => {
          const sets = ex.sets_data as Array<{ kg: string | null; reps: number | null; duration: string | null }>;
          const maxKgVal  = sets.reduce((mx, s) => { const n = s.kg && s.kg !== 'BW' ? parseFloat(String(s.kg)) || 0 : 0; return n > mx ? n : mx; }, 0);
          const maxRepsVal = sets.reduce((mx, s) => Math.max(mx, s.reps ?? 0), 0);
          const maxDurVal  = sets.reduce((mx, s) => { const n = s.duration ? parseInt(String(s.duration)) || 0 : 0; return n > mx ? n : mx; }, 0);

          const key  = ex.exercise_name.toLowerCase().trim();
          const prev = bestMap.get(key) ?? { kg: null, reps: null, dur: null };

          if (maxKgVal > 0 && (prev.kg === null || maxKgVal > prev.kg)) {
            newPRBeats.push({ exercise: ex.exercise_name, metric: 'kg',       prev: prev.kg,   next: maxKgVal });
          } else if (maxRepsVal > 0 && (prev.reps === null || maxRepsVal > prev.reps)) {
            newPRBeats.push({ exercise: ex.exercise_name, metric: 'reps',     prev: prev.reps, next: maxRepsVal });
          } else if (maxDurVal > 0 && (prev.dur === null || maxDurVal > prev.dur)) {
            newPRBeats.push({ exercise: ex.exercise_name, metric: 'duration', prev: prev.dur,  next: maxDurVal });
          }

          return {
            client_id:     selectedClientId,
            session_id:    sessionData!.id,
            exercise_name: ex.exercise_name,
            best_kg:       maxKgVal  > 0 ? maxKgVal  : null,
            best_reps:     maxRepsVal > 0 ? maxRepsVal : null,
            best_duration: maxDurVal  > 0 ? maxDurVal  : null,
          };
        });

        // Save this session's exercise records
        if (recordsToInsert.length > 0) {
          await supabase.from('exercise_records').insert(recordsToInsert);
        }
      } catch {}
      // ─────────────────────────────────────────────────────────────────────────

      const sessionsLeft = pkg.sessions_remaining - 1;

      // Fetch admin once — used for low-session + session-logged notifications
      const { data: adminForSession } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
      const adminId = adminForSession?.[0]?.id ?? null;

      if (sessionsLeft > 0 && sessionsLeft <= 3) {
        await sendPushNotification(selectedClientId, {
          title: '⚠️ Package Almost Empty',
          body: `Only ${sessionsLeft} session${sessionsLeft !== 1 ? 's' : ''} left in your package. Contact your coach to renew soon!`,
        });
        await sendPushNotification(profile.id, {
          title: '⚠️ Client Running Low',
          body: `${selectedClient?.name ?? 'A client'} has ${sessionsLeft} session${sessionsLeft !== 1 ? 's' : ''} left. Time to offer a renewal!`,
          data: { type: 'low_sessions', client_id: selectedClientId },
        });
        if (adminId) {
          await sendPushNotification(adminId, {
            title: '⚠️ Client Running Low',
            body: `${selectedClient?.name ?? 'A client'} (coach: ${profile?.name ?? '?'}) has ${sessionsLeft} session${sessionsLeft !== 1 ? 's' : ''} left.`,
            data: { type: 'low_sessions', client_id: selectedClientId },
          });
        }
      }
      if (sessionsLeft === 0) {
        await sendPushNotification(selectedClientId, {
          title: '🔴 Last Session Used',
          body: 'You have no sessions left. Contact your coach to renew your package.',
        });
        await sendPushNotification(profile.id, {
          title: '🔴 Client Out of Sessions',
          body: `${selectedClient?.name ?? 'A client'} just used their last session. Follow up for renewal!`,
          data: { type: 'no_sessions', client_id: selectedClientId },
        });
        if (adminId) {
          await sendPushNotification(adminId, {
            title: '🔴 Client Out of Sessions',
            body: `${selectedClient?.name ?? 'A client'} (coach: ${profile?.name ?? '?'}) has no sessions left.`,
            data: { type: 'no_sessions', client_id: selectedClientId },
          });
        }
      }
      if (adminId) {
        await sendPushNotification(adminId, {
          title: '📋 Session Logged',
          body: `${profile?.name ?? 'A coach'} logged a session for ${selectedClient?.name ?? 'a client'}. ${sessionsLeft} session${sessionsLeft !== 1 ? 's' : ''} remaining.`,
          data: { type: 'session_logged' },
        });
      }

      // Start the timer only if we're within 3 hours of the session time
      const sessionDateOnly = sessionDate.trim() || new Date().toISOString().slice(0, 10);
      const todayOnly = new Date().toISOString().slice(0, 10);
      const isPastDate = sessionDateOnly < todayOnly;
      let isWithinStartWindow = isPastDate; // past sessions always ok
      if (sessionDateOnly === todayOnly) {
        if (sessionTime.trim()) {
          const sessionDt = parseSessionDateTime(sessionDate, sessionTime.trim());
          if (sessionDt) {
            const hoursUntil = (sessionDt.getTime() - Date.now()) / (60 * 60 * 1000);
            isWithinStartWindow = hoursUntil <= 3; // within 3 hours of session time
          } else {
            isWithinStartWindow = true;
          }
        } else {
          isWithinStartWindow = true; // no time set (quick session) — allow immediately
        }
      }

      const { data: existingActive } = !isWithinStartWindow ? { data: null } : await supabase
        .from('active_sessions')
        .select('id')
        .eq('coach_id', profile.id)
        .eq('is_active', true)
        .maybeSingle();

      if (isWithinStartWindow && !existingActive && sessionData?.id) {
        const sessionStart = sessionTime.trim()
          ? (parseSessionDateTime(sessionDate, sessionTime.trim()) ?? new Date())
          : new Date();
        await supabase.from('active_sessions').insert({
          coach_id: profile.id,
          client_id: selectedClientId,
          session_id: sessionData.id,
          start_time: sessionStart.toISOString(),
          original_duration: Number(duration),
          current_duration: Number(duration),
          is_active: true,
          is_paused: false,
        });

        const hasExercises = validExercises.length > 0;
        if (hasExercises) {
          Alert.alert(
            'Session Started!',
            `Timer started for ${selectedClient?.name}. Would you like to do the exercises step by step?`,
            [
              {
                text: 'Back to Dashboard',
                onPress: () => {
                  if (newPRBeats.length > 0) { setPrBeats(newPRBeats); } else { router.back(); }
                },
              },
              {
                text: 'Start Exercises',
                onPress: () => {
                  router.replace({
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
                      alreadySaved: 'true',
                    },
                  } as any);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Session Started!',
            `Timer started for ${selectedClient?.name} (${duration} min). Check your Dashboard.`,
            [{ text: 'OK', onPress: () => { if (newPRBeats.length > 0) { setPrBeats(newPRBeats); } else { router.back(); } } }]
          );
        }
      } else {
        const futureNote = !isPastDate && sessionDateOnly === todayOnly && !isWithinStartWindow
          ? '\n\nTimer will be available within 3 hours of the session time.'
          : existingActive ? '\n\nNote: Timer not started — a session is already active.' : '';
        Alert.alert(
          'Session logged!',
          `${selectedClient?.name}'s session recorded. Sessions remaining: ${pkg.sessions_remaining - 1}${futureNote}`,
          [{ text: 'OK', onPress: () => { if (newPRBeats.length > 0) { setPrBeats(newPRBeats); } else { router.back(); } } }]
        );
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save session');
    } finally {
      savingRef.current = false;
      setLoading(false);
    }
  };

  const handleStartWorkout = () => {
    if (!canSave || !profile?.id || !pkg) return;
    const validExercises = exercises
      .filter((e) => e.exercise_name.trim())
      .map(({ id: _id, sets_data, ...e }) => {
        const maxKg = sets_data.reduce((mx, s) => { const n = parseFloat(s.kg || '0') || 0; return n > mx ? n : mx; }, 0);
        const firstReps = sets_data.find(s => s.reps)?.reps ?? null;
        const firstDur = sets_data.find(s => s.duration)?.duration ?? null;
        return {
          exercise_name: e.exercise_name.trim(),
          sets: sets_data.length || 1,
          reps: firstReps ? Number(firstReps) : null,
          weight: maxKg > 0 ? String(maxKg) : (sets_data.some(s => s.kg === 'BW') ? 'BW' : null),
          duration: firstDur || null,
          notes: e.notes.trim() || null,
          isSuperset: e.isSuperset,
          sets_data: sets_data.map((s, i) => ({
            set: i + 1,
            kg: s.kg || null,
            reps: s.reps ? Number(s.reps) : null,
            duration: s.duration || null,
          })),
        };
      });
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
    <View style={styles.root}>
      <View style={styles.closeRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeBtn, mode === 'full' && styles.modeBtnActive]}
            onPress={() => setMode('full')}
          >
            <Ionicons name="list-outline" size={15} color={mode === 'full' ? colors.bg : colors.textSecondary} />
            <Text style={[styles.modeBtnText, mode === 'full' && styles.modeBtnTextActive]}>FULL LOG</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'quick' && styles.modeBtnActive]}
            onPress={() => setMode('quick')}
          >
            <Ionicons name="flash" size={15} color={mode === 'quick' ? colors.bg : colors.textSecondary} />
            <Text style={[styles.modeBtnText, mode === 'quick' && styles.modeBtnTextActive]}>QUICK</Text>
          </Pressable>
        </View>

        {/* Client picker */}
        <Text style={styles.sectionTitle}>CLIENT</Text>
        <Pressable style={styles.pickerBtn} onPress={() => setShowClientPicker((v) => !v)}>
          <Text style={[styles.pickerBtnText, !selectedClient && { color: colors.textSecondary }]}>
            {selectedClient ? selectedClient.name : 'Select a client…'}
          </Text>
          <Ionicons
            name={showClientPicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
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
                  <Text style={[styles.dropdownItemText, c.id === selectedClientId && { color: colors.accent }]}>
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
        {selectedClient && pkg && pkg.sessions_remaining <= 3 && pkg.sessions_remaining > 0 && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <Text style={styles.warningText}>
              Only {pkg.sessions_remaining} session{pkg.sessions_remaining !== 1 ? 's' : ''} remaining in this package
            </Text>
          </View>
        )}
        {selectedClient && pkg && pkg.sessions_remaining === 0 && (
          <View style={[styles.warningBanner, styles.errorBanner]}>
            <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
            <Text style={[styles.warningText, { color: colors.danger }]}>
              This client has no sessions remaining
            </Text>
          </View>
        )}

        {/* SESSION DETAILS */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SESSION DETAILS</Text>

        {mode === 'quick' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>DURATION</Text>
              <View style={styles.typeRow}>
                {QUICK_DURATIONS.map((d) => (
                  <Pressable
                    key={d}
                    style={[styles.typeBtn, duration === String(d) && styles.typeBtnActive]}
                    onPress={() => setDuration(String(d))}
                  >
                    <Text style={[styles.typeBtnText, duration === String(d) && styles.typeBtnTextActive]}>
                      {d}m
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
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
                      name={t === 'gym' ? 'fitness-outline' : 'home-outline'}
                      size={16}
                      color={sessionType === t ? colors.bg : colors.textSecondary}
                    />
                    <Text style={[styles.typeBtnText, sessionType === t && styles.typeBtnTextActive]}>
                      {t === 'gym' ? 'Gym' : 'Home'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>DATE</Text>
              <Pressable style={styles.dateTrigger} onPress={() => setShowCalendar(v => !v)}>
                <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                <Text style={styles.dateTriggerText}>
                  {new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </Text>
                <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
              </Pressable>
              {showCalendar && (
                <CalendarPicker
                  value={sessionDate}
                  onChange={(iso) => { setSessionDate(iso); setShowCalendar(false); }}
                />
              )}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>DURATION (MIN)</Text>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={(v) => setDuration(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="60"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
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
                      name={t === 'gym' ? 'fitness-outline' : 'home-outline'}
                      size={16}
                      color={sessionType === t ? colors.bg : colors.textSecondary}
                    />
                    <Text style={[styles.typeBtnText, sessionType === t && styles.typeBtnTextActive]}>
                      {t === 'gym' ? 'Gym' : 'Home'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>START TIME</Text>
              <View style={styles.pickerBtn}>
                <TextInput
                  style={[styles.pickerBtnText, { flex: 1 }]}
                  value={sessionTime}
                  onChangeText={(v) => { setSessionTime(v); setShowTimePicker(false); }}
                  placeholder="e.g. 9:00 AM"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="done"
                />
                <Pressable onPress={() => setShowTimePicker((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showTimePicker ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
              {showTimePicker && (
                <View style={[styles.dropdown, { maxHeight: 220 }]}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {TIME_SLOTS.map((slot) => {
                      const active = sessionTime.trim().toUpperCase() === slot.toUpperCase();
                      return (
                        <Pressable
                          key={slot}
                          style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                          onPress={() => { setSessionTime(slot); setShowTimePicker(false); }}
                        >
                          <Text style={[styles.dropdownItemText, active && { color: colors.accent }]}>
                            {slot}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          </>
        )}

        {/* Exercises — full mode only */}
        {mode === 'full' && <View style={styles.exHeader}>
          <Text style={styles.sectionTitle}>EXERCISES</Text>
          <View style={styles.exHeaderBtns}>
            {templates.length > 0 && (
              <Pressable style={styles.historyBtn} onPress={() => setShowTemplateModal(true)}>
                <Ionicons name="copy-outline" size={14} color={colors.accent} />
                <Text style={styles.historyBtnText}>TEMPLATE</Text>
              </Pressable>
            )}
            {exerciseHistory.length > 0 && (
              <Pressable style={styles.historyBtn} onPress={() => setShowHistoryModal(true)}>
                <Ionicons name="time-outline" size={14} color={colors.accent} />
                <Text style={styles.historyBtnText}>HISTORY</Text>
              </Pressable>
            )}
            <Pressable style={styles.historyBtn} onPress={() => router.push('/(coach)/exercise-library' as any)}>
              <Ionicons name="library-outline" size={14} color={colors.accent} />
              <Text style={styles.historyBtnText}>LIBRARY</Text>
            </Pressable>
            <Pressable style={styles.addExBtn} onPress={addExercise}>
              <Ionicons name="add" size={16} color={colors.bg} />
              <Text style={styles.addExBtnText}>ADD</Text>
            </Pressable>
          </View>
        </View>}

        {mode === 'full' && exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            index={i}
            isLast={i === exercises.length - 1}
            lastWeight={ex.exercise_name ? (getLastUsed(ex.exercise_name)?.weight ?? undefined) : undefined}
            onChange={updateExercise}
            onSetChange={updateSetField}
            onAddSet={addSet}
            onRemoveLastSet={removeLastSet}
            onBWToggle={bwToggle}
            onRemove={removeExercise}
            onToggleSuperset={toggleSuperset}
            onOpenPicker={(id) => { pickerTargetRef.current = id; setPickerTargetId(id); }}
          />
        ))}

        {/* Session notes */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>SESSION NOTES</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Overall notes for this session…"
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={3}
          value={sessionNotes}
          onChangeText={setSessionNotes}
        />

        {/* Save button — no QR needed, coach can plan freely */}
        <Pressable
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={() => { if (!canSave) return; handleSave(); }}
          disabled={!canSave || loading}
        >
          <Text style={styles.saveBtnText}>
            {loading ? 'SAVING…' : mode === 'quick' ? 'START QUICK SESSION' : 'SAVE SESSION'}
          </Text>
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
                <Ionicons name="close" size={22} color={colors.textSecondary} />
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

      {/* Exercise Library Picker */}
      <ExercisePickerModal
        visible={pickerTargetId !== null}
        onClose={() => { pickerTargetRef.current = null; setPickerTargetId(null); }}
        onSelect={(name) => {
          const targetId = pickerTargetRef.current;
          if (targetId) {
            updateExercise(targetId, 'exercise_name', name);
            // Auto-fill kg into empty set rows from last usage
            const last = getLastUsed(name);
            if (last?.weight) {
              setExercises((prev) => prev.map((e) => {
                if (e.id !== targetId) return e;
                return {
                  ...e,
                  sets_data: e.sets_data.map(s => ({ ...s, kg: s.kg.trim() ? s.kg : last.weight })),
                };
              }));
            }
          }
          pickerTargetRef.current = null;
          setPickerTargetId(null);
        }}
      />

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
                <Ionicons name="close" size={22} color={colors.textSecondary} />
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

      {/* QR gate — confirm client is present before saving or starting workout */}
      <QRScanModal
        visible={showQRGate}
        clientName={selectedClient?.name ?? ''}
        expectedClientId={selectedClientId}
        onConfirm={() => { setShowQRGate(false); qrConfirmFn?.(); }}
        onCancel={() => { setShowQRGate(false); setQrConfirmFn(null); }}
      />
      <PRSummaryModal
        beats={prBeats}
        clientName={selectedClient?.name ?? 'Client'}
        onClose={() => { setPrBeats([]); router.back(); }}
      />
    </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  closeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  kav: { flex: 1, backgroundColor: c.bg },
  scroll: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 60 },
  modeToggle: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 12, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: c.border },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  modeBtnActive: { backgroundColor: c.accent },
  modeBtnText: { color: c.textSecondary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  modeBtnTextActive: { color: c.bg },
  sectionTitle: { ...Typography.label, color: c.textSecondary, marginBottom: 12 },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 4,
  },
  pickerBtnText: { ...Typography.body, color: c.textPrimary },
  dropdown: {
    backgroundColor: c.surfaceRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  dropdownEmpty: { ...Typography.body, color: c.textSecondary, padding: 16, textAlign: 'center' },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  dropdownItemActive: { backgroundColor: c.accent + '12' },
  dropdownItemText: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
  dropdownItemSub: { ...Typography.caption, color: c.textSecondary, marginTop: 2 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.warning + '15',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.warning + '40',
  },
  errorBanner: { backgroundColor: c.danger + '15', borderColor: c.danger + '40' },
  warningText: { ...Typography.caption, color: c.warning, flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 16 },
  label: { ...Typography.label, color: c.textSecondary, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
    borderColor: c.border, backgroundColor: c.surface,
  },
  typeBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: c.textSecondary },
  typeBtnTextActive: { color: c.bg },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: c.textPrimary,
    fontSize: 15,
  },
  dateTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14,
  },
  dateTriggerText: { ...Typography.body, color: c.textPrimary, fontWeight: '600', flex: 1 },
  notesInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  exHeader: { marginBottom: 12, gap: 8 },
  exHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: c.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  historyBtnText: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addExBtnText: { color: c.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: c.surface,
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
    backgroundColor: c.border,
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
  modalTitle: { ...Typography.label, color: c.textPrimary, fontSize: 14 },
  modalSub: { ...Typography.caption, color: c.textSecondary, marginBottom: 16 },
  historyList: { flexGrow: 0 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  historyItemLeft: { flex: 1, marginRight: 12 },
  historyItemName: { ...Typography.body, color: c.textPrimary, fontWeight: '700' },
  historyItemSub: { ...Typography.caption, color: c.textSecondary, marginTop: 2 },
  historyCountBadge: {
    backgroundColor: c.accent + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: c.accent + '50',
  },
  historyCountText: { color: c.accent, fontSize: 11, fontWeight: '800' },
  exCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  exCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  exCardTitle: { ...Typography.label, color: c.textSecondary, fontSize: 11 },
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
  exNotes: { minHeight: 56, textAlignVertical: 'top', marginBottom: 0 },
  exNameBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  exNameBtnText: { color: c.textPrimary, fontSize: 14, flex: 1, marginRight: 8 },
  // Per-set table styles
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  setDataRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  setColSet: { width: 46 },
  setColKg: { flex: 1 },
  setColReps: { flex: 1 },
  setColDur: { flex: 1 },
  setColLabel: {
    fontSize: 10, fontWeight: '800', color: c.textSecondary, letterSpacing: 0.5, textAlign: 'center',
  },
  setLabel: { fontSize: 11, color: c.textSecondary, fontWeight: '700' },
  setInput: {
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
    color: c.textPrimary,
    fontSize: 13,
    textAlign: 'center',
  },
  setControlRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 8, marginBottom: 10,
  },
  setCtrlBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.bg,
    justifyContent: 'center', alignItems: 'center',
  },
  setCtrlBtnDisabled: { opacity: 0.3 },
  setCountText: { fontSize: 12, fontWeight: '800', color: c.textPrimary, minWidth: 60, textAlign: 'center' },
  bwBtn: {
    paddingHorizontal: 12, height: 30, borderRadius: 15,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.bg,
    justifyContent: 'center', alignItems: 'center',
  },
  bwBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
  bwBtnText: { fontSize: 11, fontWeight: '800', color: c.textSecondary },
  bwBtnTextActive: { color: c.bg },
  supersetToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: 10, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: c.border,
    backgroundColor: c.bg,
  },
  supersetToggleActive: { backgroundColor: c.accent, borderColor: c.accent },
  supersetToggleText: { color: c.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  supersetToggleTextActive: { color: c.bg },
  saveBtn: {
    backgroundColor: c.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: c.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
  lastWeightHint: {
    fontSize: 11,
    color: c.accent,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  startWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: c.accent,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 10,
  },
  startWorkoutBtnText: { color: c.accent, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
});
}