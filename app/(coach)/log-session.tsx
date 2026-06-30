import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { QRScanModal } from '@/components/QRScanModal';
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
import { Colors, Typography } from '@/constants/theme';
import { sendPushNotification } from '@/lib/pushNotifications';

type Exercise = {
  id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
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
const blankExercise = (): Exercise => ({ id: uid(), exercise_name: '', sets: '', reps: '', weight: '', duration: '', notes: '', isSuperset: false });

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
  onRemove,
  onToggleSuperset,
  onOpenPicker,
}: {
  exercise: Exercise;
  lastWeight?: string;
  index: number;
  isLast: boolean;
  onChange: (id: string, field: keyof Exercise, value: string) => void;
  onRemove: (id: string) => void;
  onToggleSuperset: (id: string) => void;
  onOpenPicker: (id: string) => void;
}) {
  return (
    <View style={styles.exCard}>
      <View style={styles.exCardHeader}>
        <Text style={styles.exCardTitle}>EXERCISE {index + 1}</Text>
        <Pressable onPress={() => onRemove(exercise.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
        </Pressable>
      </View>

      {/* Exercise name — tappable to open library picker */}
      <Pressable
        style={[styles.exInput, styles.exNameBtn]}
        onPress={() => onOpenPicker(exercise.id)}
      >
        <Text style={[styles.exNameBtnText, !exercise.exercise_name && { color: Colors.textSecondary }]}
          numberOfLines={1}>
          {exercise.exercise_name || 'Tap to select exercise…'}
        </Text>
        <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
      </Pressable>

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
          {lastWeight ? (
            <Text style={styles.lastWeightHint}>last: {lastWeight}</Text>
          ) : null}
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

      {!isLast && (
        <Pressable
          style={[styles.supersetToggle, exercise.isSuperset && styles.supersetToggleActive]}
          onPress={() => onToggleSuperset(exercise.id)}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={13}
            color={exercise.isSuperset ? Colors.bg : Colors.textSecondary}
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
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={calStyles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={nextMonth} hitSlop={12} style={calStyles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
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

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 12, marginTop: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { padding: 4 },
  monthLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700' },
  dayNames: { flexDirection: 'row', marginBottom: 4 },
  dayName: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: Colors.accent, borderRadius: 100 },
  cellToday: { borderWidth: 1, borderColor: Colors.accent, borderRadius: 100 },
  cellText: { fontSize: 14, color: Colors.textPrimary },
  cellTextSelected: { color: Colors.bg, fontWeight: '700' },
  cellTextToday: { color: Colors.accent, fontWeight: '700' },
});

export default function LogSessionScreen() {
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ clientId?: string; date?: string; mode?: string }>();
  const { clients } = useClients();
  const { history: exerciseHistory } = useExerciseHistory();
  const { getLastUsed } = useClientLastWeights(selectedClientId || null);
  const { templates, markUsed } = useTemplates();

  const [selectedClientId, setSelectedClientId] = useState(params.clientId ?? '');
  const [sessionDate, setSessionDate] = useState(params.date ?? todayISO());
  const [sessionType, setSessionType] = useState<'gym' | 'home'>('gym');
  const [duration, setDuration] = useState('60');
  const [exercises, setExercises] = useState<Exercise[]>([blankExercise()]);
  const [sessionTime, setSessionTime] = useState(currentTimeStr());
  const [sessionNotes, setSessionNotes] = useState('');
  const [mode, setMode] = useState<'full' | 'quick'>(params.mode === 'quick' ? 'quick' : 'full');
  const [showQRGate, setShowQRGate] = useState(false);
  const [qrConfirmFn, setQrConfirmFn] = useState<(() => void) | null>(null);
  const [loading, setLoading] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState<string | null>(null);
  const pickerTargetRef = useRef<string | null>(null);

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
      { id: uid(), exercise_name: item.exercise_name, sets: item.sets, reps: item.reps, weight: item.weight, duration: item.duration, notes: '', isSuperset: false },
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
              isSuperset: false,
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

    const validExercises = exercises
      .filter((e) => e.exercise_name.trim())
      .map(({ id: _id, ...e }) => ({
        exercise_name: e.exercise_name.trim(),
        sets: e.sets ? Number(e.sets) : null,
        reps: e.reps ? Number(e.reps) : null,
        weight: e.weight.trim() || null,
        duration: e.duration.trim() || null,
        notes: e.notes.trim() || null,
        isSuperset: e.isSuperset,
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
        await scheduleSessionReminder(selectedClient?.name ?? 'Client', sessionDate, sessionTime.trim(), selectedClientId);
      }

      const sessionsLeft = pkg.sessions_remaining - 1;
      if (sessionsLeft > 0 && sessionsLeft <= 3) {
        await sendPushNotification(selectedClientId, {
          title: '⚠️ Package Almost Empty',
          body: `Only ${sessionsLeft} session${sessionsLeft !== 1 ? 's' : ''} left in your package. Contact your coach to renew soon!`,
        });
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
          is_paused: false,
        });

        const hasExercises = validExercises.length > 0;
        if (hasExercises) {
          Alert.alert(
            'Session Started!',
            `Timer started for ${selectedClient?.name}. Gusto mo bang gawin ang exercises step by step?`,
            [
              {
                text: 'Dashboard nalang',
                onPress: () => router.back(),
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
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }
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
        isSuperset: e.isSuperset,
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

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeBtn, mode === 'full' && styles.modeBtnActive]}
            onPress={() => setMode('full')}
          >
            <Ionicons name="list-outline" size={15} color={mode === 'full' ? Colors.bg : Colors.textSecondary} />
            <Text style={[styles.modeBtnText, mode === 'full' && styles.modeBtnTextActive]}>FULL LOG</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'quick' && styles.modeBtnActive]}
            onPress={() => setMode('quick')}
          >
            <Ionicons name="flash" size={15} color={mode === 'quick' ? Colors.bg : Colors.textSecondary} />
            <Text style={[styles.modeBtnText, mode === 'quick' && styles.modeBtnTextActive]}>QUICK</Text>
          </Pressable>
        </View>

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
        {selectedClient && pkg && pkg.sessions_remaining <= 3 && pkg.sessions_remaining > 0 && (
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
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>DATE</Text>
              <Pressable style={styles.dateTrigger} onPress={() => setShowCalendar(v => !v)}>
                <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
                <Text style={styles.dateTriggerText}>
                  {new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </Text>
                <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
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
                placeholderTextColor={Colors.textSecondary}
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
            <View style={styles.field}>
              <Text style={styles.label}>START TIME</Text>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => setShowTimePicker((v) => !v)}
              >
                <Text style={[styles.pickerBtnText, !sessionTime && { color: Colors.textSecondary }]}>
                  {sessionTime || '9:00 AM'}
                </Text>
                <Ionicons
                  name={showTimePicker ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.textSecondary}
                />
              </Pressable>
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
                          <Text style={[styles.dropdownItemText, active && { color: Colors.accent }]}>
                            {slot}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              <TextInput
                style={[styles.input, { marginTop: 6 }]}
                value={sessionTime}
                onChangeText={(v) => { setSessionTime(v); setShowTimePicker(false); }}
                placeholder="9:00 AM"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
              />
              <Text style={styles.timeFormatHint}>Type manually: 9:00 AM  or  14:30</Text>
            </View>
          </>
        )}

        {/* Exercises — full mode only */}
        {mode === 'full' && <View style={styles.exHeader}>
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
        </View>}

        {mode === 'full' && exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            index={i}
            isLast={i === exercises.length - 1}
            lastWeight={ex.exercise_name ? (getLastUsed(ex.exercise_name)?.weight ?? undefined) : undefined}
            onChange={updateExercise}
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
          placeholderTextColor={Colors.textSecondary}
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

        {/* Start Workout — full mode only */}
        {mode === 'full' && (
          <>
            <Pressable
              style={[styles.startWorkoutBtn, !canSave && styles.saveBtnDisabled]}
              onPress={() => {
                if (!canSave) return;
                setQrConfirmFn(() => handleStartWorkout);
                setShowQRGate(true);
              }}
              disabled={!canSave || loading}
            >
              <Ionicons name="play-circle-outline" size={20} color={Colors.accent} />
              <Text style={styles.startWorkoutBtnText}>START WORKOUT</Text>
            </Pressable>
          </>
        )}
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

      {/* Exercise Library Picker */}
      <ExercisePickerModal
        visible={pickerTargetId !== null}
        onClose={() => { pickerTargetRef.current = null; setPickerTargetId(null); }}
        onSelect={(name) => {
          const targetId = pickerTargetRef.current;
          if (targetId) {
            updateExercise(targetId, 'exercise_name', name);
            // Auto-fill weight if field is currently empty
            const last = getLastUsed(name);
            if (last) {
              setExercises((prev) => prev.map((e) => {
                if (e.id !== targetId) return e;
                return {
                  ...e,
                  weight: e.weight.trim() ? e.weight : last.weight,
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

      {/* QR gate — confirm client is present before saving or starting workout */}
      <QRScanModal
        visible={showQRGate}
        clientName={selectedClient?.name ?? ''}
        expectedClientId={selectedClientId}
        onConfirm={() => { setShowQRGate(false); qrConfirmFn?.(); }}
        onCancel={() => { setShowQRGate(false); setQrConfirmFn(null); }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  modeToggle: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  modeBtnActive: { backgroundColor: Colors.accent },
  modeBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  modeBtnTextActive: { color: Colors.bg },
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
  dateTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14,
  },
  dateTriggerText: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', flex: 1 },
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
  exNameBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  exNameBtnText: { color: Colors.textPrimary, fontSize: 14, flex: 1, marginRight: 8 },
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
  supersetToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: 10, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  supersetToggleActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  supersetToggleText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  supersetToggleTextActive: { color: Colors.bg },
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
  timeFormatHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 5,
    letterSpacing: 0.2,
  },
  lastWeightHint: {
    fontSize: 11,
    color: Colors.accent,
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
    borderColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 10,
  },
  startWorkoutBtnText: { color: Colors.accent, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
});
