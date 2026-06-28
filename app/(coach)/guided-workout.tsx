import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type Exercise = {
  exercise_name: string;
  sets: number;
  reps: number | null;
  weight: string | null;
  notes: string | null;
};

type Phase = 'set' | 'rest' | 'between' | 'done' | 'saving' | 'summary';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function GuidedWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    exercises: string;
    clientId: string;
    pkgId: string;
    coachId: string;
    sessionDate: string;
    durationMinutes: string;
    sessionNotes: string;
    clientName: string;
  }>();

  const exercises: Exercise[] = JSON.parse(params.exercises ?? '[]');
  const totalExercises = exercises.length;

  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('set');
  const [restRemaining, setRestRemaining] = useState(60);
  const [defaultRest, setDefaultRest] = useState(60);
  const [restRunning, setRestRunning] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [startTime] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentEx = exercises[exIdx];
  const totalSets = currentEx?.sets ?? 1;

  // Elapsed timer — ticks up every second
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  // Rest countdown
  useEffect(() => {
    if (!restRunning || phase !== 'rest') return;
    intervalRef.current = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 3 && prev > 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Vibration.vibrate(120);
        }
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setRestRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Vibration.vibrate([0, 350, 100, 350, 100, 350]);
          setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 400);
          setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 800);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [restRunning, phase]);

  const stopRest = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRestRunning(false);
  };

  const handleExit = () => {
    if (phase === 'summary') { router.replace('/(coach)'); return; }
    Alert.alert(
      'Exit Workout?',
      'Exercise progress will be lost. Your session timer will keep running on the Dashboard.',
      [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Exit to Dashboard', style: 'destructive', onPress: () => router.replace('/(coach)') },
      ],
    );
  };

  const handleSetDone = () => {
    const moreSets = setIdx + 1 < totalSets;
    if (moreSets) {
      setRestRemaining(defaultRest);
      setRestRunning(true);
      setPhase('rest');
    } else {
      const moreExercises = exIdx + 1 < totalExercises;
      if (moreExercises) {
        setPhase('between');
      } else {
        setPhase('done');
      }
    }
  };

  const handleSkipRest = () => {
    stopRest();
    setSetIdx((prev) => prev + 1);
    setPhase('set');
  };

  const handleNextSet = () => {
    stopRest();
    setSetIdx((prev) => prev + 1);
    setPhase('set');
  };

  const handleNextExercise = () => {
    setExIdx((prev) => prev + 1);
    setSetIdx(0);
    setPhase('set');
  };

  const adjustRest = (delta: number) => {
    setDefaultRest((r) => Math.max(10, r + delta));
    setRestRemaining((r) => Math.max(0, r + delta));
  };

  const handleFinish = async () => {
    setPhase('saving');
    const elapsed = Math.round((Date.now() - startTime) / 60000);
    const finalDuration = Math.max(Number(params.durationMinutes) || elapsed, elapsed);
    try {
      const { error } = await supabase.from('workout_sessions').insert({
        package_id: params.pkgId,
        client_id: params.clientId,
        coach_id: params.coachId,
        session_date: params.sessionDate,
        duration_minutes: finalDuration,
        exercises,
        notes: params.sessionNotes || null,
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('summary');
    } catch (err: unknown) {
      setPhase('done');
      Alert.alert('Error saving', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const elapsedMins = Math.floor(elapsedSecs / 60);
  const elapsedSecRem = elapsedSecs % 60;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Persistent header ─────────────────────────────────── */}
      {phase !== 'saving' && (
        <View style={styles.wHeader}>
          <Pressable style={styles.exitBtn} onPress={handleExit} hitSlop={12}>
            <Ionicons name="close-outline" size={22} color={Colors.textSecondary} />
            <Text style={styles.exitBtnText}>EXIT</Text>
          </Pressable>

          <View style={styles.wHeaderCenter}>
            <Text style={styles.wClientName} numberOfLines={1}>{params.clientName || 'Workout'}</Text>
            <Text style={styles.wElapsed}>
              {pad(elapsedMins)}:{pad(elapsedSecRem)} elapsed
            </Text>
          </View>

          <Text style={styles.wProgress}>
            {exIdx + 1}/{totalExercises}
          </Text>
        </View>
      )}

      {/* ── Phase content ─────────────────────────────────────── */}

      {/* SET phase */}
      {phase === 'set' && (
        <View style={styles.phase}>
          <Text style={styles.progressLabel}>
            Exercise {exIdx + 1} of {totalExercises}
          </Text>

          <Text style={styles.exName}>{currentEx?.exercise_name}</Text>

          <View style={styles.setChip}>
            <Text style={styles.setChipText}>SET {setIdx + 1} OF {totalSets}</Text>
          </View>

          {(currentEx?.reps || currentEx?.weight) ? (
            <Text style={styles.targetText}>
              {[
                currentEx.reps ? `${currentEx.reps} reps` : null,
                currentEx.weight ?? null,
              ].filter(Boolean).join('  ·  ')}
            </Text>
          ) : null}

          {currentEx?.notes ? (
            <Text style={styles.notesText}>{currentEx.notes}</Text>
          ) : null}

          <Pressable style={styles.primaryBtn} onPress={handleSetDone}>
            <Ionicons name="checkmark-circle" size={26} color={Colors.bg} />
            <Text style={styles.primaryBtnText}>SET DONE</Text>
          </Pressable>

          <View style={styles.dotsRow}>
            {Array.from({ length: totalSets }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < setIdx && styles.dotDone,
                  i === setIdx && styles.dotCurrent,
                ]}
              />
            ))}
          </View>

          <View style={styles.exerciseList}>
            {exercises.map((ex, i) => (
              <View key={i} style={styles.exerciseListRow}>
                <Ionicons
                  name={i < exIdx ? 'checkmark-circle' : i === exIdx ? 'ellipse' : 'ellipse-outline'}
                  size={14}
                  color={i < exIdx ? Colors.accent : i === exIdx ? Colors.accent : Colors.border}
                />
                <Text style={[styles.exerciseListName, i === exIdx && { color: Colors.textPrimary }]}>
                  {ex.exercise_name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* REST phase */}
      {phase === 'rest' && (
        <View style={styles.phase}>
          <Text style={styles.progressLabel}>REST</Text>

          <Text style={[styles.timerDisplay, restRemaining === 0 && { color: Colors.accent }]}>
            {pad(Math.floor(restRemaining / 60))}:{pad(restRemaining % 60)}
          </Text>
          {restRemaining === 0 && <Text style={styles.timerDoneLabel}>REST DONE!</Text>}

          <View style={styles.adjustRow}>
            <Pressable style={styles.adjustBtn} onPress={() => adjustRest(-10)}>
              <Text style={styles.adjustBtnText}>−10s</Text>
            </Pressable>
            <Text style={styles.adjustDefault}>{defaultRest}s</Text>
            <Pressable style={styles.adjustBtn} onPress={() => adjustRest(+10)}>
              <Text style={styles.adjustBtnText}>+10s</Text>
            </Pressable>
          </View>

          {restRemaining > 0 && (
            <View style={styles.restBtns}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setRestRunning((r) => !r)}
              >
                <Ionicons
                  name={restRunning ? 'pause' : 'play'}
                  size={20}
                  color={Colors.textPrimary}
                />
                <Text style={styles.secondaryBtnText}>
                  {restRunning ? 'PAUSE' : 'RESUME'}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryBtn} onPress={handleSkipRest}>
                <Ionicons name="play-skip-forward" size={20} color={Colors.textPrimary} />
                <Text style={styles.secondaryBtnText}>SKIP</Text>
              </Pressable>
            </View>
          )}

          {restRemaining === 0 && (
            <Pressable style={[styles.primaryBtn, { marginTop: 32 }]} onPress={handleNextSet}>
              <Text style={styles.primaryBtnText}>NEXT SET →</Text>
            </Pressable>
          )}

          <Text style={styles.upNextLabel}>
            Up next: Set {setIdx + 2} of {totalSets} — {currentEx?.exercise_name}
          </Text>
        </View>
      )}

      {/* BETWEEN exercises phase */}
      {phase === 'between' && (
        <View style={styles.phase}>
          <View style={styles.bigIcon}>
            <Ionicons name="checkmark-circle" size={80} color={Colors.accent} />
          </View>
          <Text style={styles.exName}>{currentEx?.exercise_name}</Text>
          <Text style={styles.progressLabel}>All {totalSets} sets complete!</Text>

          <View style={styles.upNextCard}>
            <Text style={styles.upNextCardLabel}>UP NEXT</Text>
            <Text style={styles.upNextCardName}>{exercises[exIdx + 1]?.exercise_name}</Text>
            {(exercises[exIdx + 1]?.reps || exercises[exIdx + 1]?.weight) ? (
              <Text style={styles.upNextCardMeta}>
                {[
                  exercises[exIdx + 1]?.reps ? `${exercises[exIdx + 1]?.reps} reps` : null,
                  exercises[exIdx + 1]?.weight,
                ].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>

          <Pressable style={styles.primaryBtn} onPress={handleNextExercise}>
            <Text style={styles.primaryBtnText}>NEXT EXERCISE →</Text>
          </Pressable>
        </View>
      )}

      {/* DONE phase */}
      {phase === 'done' && (
        <View style={styles.phase}>
          <View style={styles.bigIcon}>
            <Ionicons name="trophy" size={80} color={Colors.accent} />
          </View>
          <Text style={styles.exName}>Workout Complete!</Text>
          <Text style={styles.progressLabel}>
            {totalExercises} exercises · {Math.round((Date.now() - startTime) / 60000)} min
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleFinish}>
            <Ionicons name="save-outline" size={22} color={Colors.bg} />
            <Text style={styles.primaryBtnText}>FINISH & SAVE</Text>
          </Pressable>
        </View>
      )}

      {/* SAVING phase */}
      {phase === 'saving' && (
        <View style={styles.phase}>
          <Text style={styles.progressLabel}>Saving session…</Text>
        </View>
      )}

      {/* SUMMARY phase */}
      {phase === 'summary' && (
        <View style={styles.phase}>
          <View style={styles.bigIcon}>
            <Ionicons name="checkmark-done-circle" size={84} color={Colors.accent} />
          </View>
          <Text style={styles.exName}>Session Saved!</Text>
          <Text style={styles.progressLabel}>{params.clientName}'s session is logged</Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{Math.round((Date.now() - startTime) / 60000)} min</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Exercises</Text>
              <Text style={styles.summaryValue}>{totalExercises} completed</Text>
            </View>
          </View>

          <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(coach)')}>
            <Ionicons name="home-outline" size={20} color={Colors.bg} />
            <Text style={styles.primaryBtnText}>BACK TO DASHBOARD</Text>
          </Pressable>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // ── Persistent header ────────────────────────────────────────
  wHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 60,
  },
  exitBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  wHeaderCenter: { alignItems: 'center', flex: 1 },
  wClientName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  wElapsed: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  wProgress: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },

  // ── Phase area ───────────────────────────────────────────────
  phase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },

  progressLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  exName: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: -0.5,
  },
  setChip: {
    backgroundColor: Colors.accent + '18',
    borderWidth: 1,
    borderColor: Colors.accent + '50',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 16,
  },
  setChipText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  targetText: {
    ...Typography.subtitle,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  notesText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 32,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    color: Colors.bg,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
  },
  secondaryBtnText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  dotDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dotCurrent: { borderColor: Colors.accent },
  exerciseList: {
    marginTop: 28,
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 8,
  },
  exerciseListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseListName: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  timerDisplay: {
    fontSize: 88,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 96,
    marginBottom: 8,
  },
  timerDoneLabel: {
    ...Typography.label,
    color: Colors.accent,
    letterSpacing: 3,
    marginBottom: 8,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  adjustBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  adjustBtnText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  adjustDefault: { ...Typography.body, color: Colors.textSecondary, minWidth: 44, textAlign: 'center' },
  restBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  upNextLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 28,
  },
  bigIcon: { marginBottom: 16 },
  upNextCard: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
    padding: 18,
    marginTop: 24,
    alignItems: 'center',
    gap: 4,
  },
  upNextCardLabel: { ...Typography.label, color: Colors.accent },
  upNextCardName: { ...Typography.subtitle, color: Colors.textPrimary, textAlign: 'center' },
  upNextCardMeta: { ...Typography.caption, color: Colors.textSecondary },
  summaryCard: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 28,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: { ...Typography.body, color: Colors.textSecondary },
  summaryValue: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700' },
});
