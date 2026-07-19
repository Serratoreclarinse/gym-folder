import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const WORKOUT_KEY = '@elevat3/paused_workout';

type Exercise = {
  exercise_name: string;
  sets: number;
  reps: number | null;
  weight: string | null;
  notes: string | null;
  isSuperset?: boolean;
};

type Phase = 'set' | 'rest' | 'between' | 'done' | 'saving' | 'summary';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// Returns groups of exercise indices. Exercises with isSuperset:true are chained with the next.
// e.g. [Plank(super), PushUp, Squat] → [[0,1],[2]]
function buildGroups(exs: Exercise[]): number[][] {
  const groups: number[][] = [];
  let i = 0;
  while (i < exs.length) {
    const group = [i];
    while (exs[i]?.isSuperset && i + 1 < exs.length) {
      i++;
      group.push(i);
    }
    groups.push(group);
    i++;
  }
  return groups;
}

export default function GuidedWorkoutScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
    sessionId?: string;
    resume?: string;
    alreadySaved?: string;
  }>();

  const exercises: Exercise[] = JSON.parse(params.exercises ?? '[]');
  const totalExercises = exercises.length;

  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('set');
  // Per-set actual weights and notes: [exercise_index][set_index]
  const [setWeights, setSetWeights] = useState<string[][]>(
    () => exercises.map((ex) => Array.from({ length: Math.max(1, ex.sets ?? 1) }, () => ex.weight ?? '')),
  );
  const [setNotes, setSetNotes] = useState<string[][]>(
    () => exercises.map((ex) => Array.from({ length: Math.max(1, ex.sets ?? 1) }, () => '')),
  );
  const [restRemaining, setRestRemaining] = useState(60);
  const [defaultRest, setDefaultRest] = useState(60);
  const [restRunning, setRestRunning] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [startTime] = useState(() => Date.now());
  const [sessionAlreadySaved, setSessionAlreadySaved] = useState(params.alreadySaved === 'true');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setNotesRef = useRef<TextInput>(null);

  const saveProgress = async (currentExIdx: number, currentSetIdx: number) => {
    try {
      await AsyncStorage.setItem(WORKOUT_KEY, JSON.stringify({
        exercises,
        exIdx: currentExIdx,
        setIdx: currentSetIdx,
        clientId: params.clientId,
        pkgId: params.pkgId,
        coachId: params.coachId,
        sessionDate: params.sessionDate,
        durationMinutes: params.durationMinutes,
        sessionNotes: params.sessionNotes,
        clientName: params.clientName,
        alreadySaved: params.alreadySaved === 'true',
        savedAt: Date.now(),
      }));
    } catch {}
  };

  const groups = buildGroups(exercises);
  const currentGroupIdx = groups.findIndex((g) => g.includes(exIdx));
  const currentGroup = groups[currentGroupIdx] ?? [exIdx];
  const isSupersetGroup = currentGroup.length > 1;
  const isLastInGroup = exIdx === currentGroup[currentGroup.length - 1];
  const currentEx = exercises[exIdx];
  const totalSets = exercises[currentGroup[0]]?.sets ?? 1;

  // Restore saved progress if resuming, otherwise save fresh start
  useEffect(() => {
    if (params.resume === 'true') {
      AsyncStorage.getItem(WORKOUT_KEY).then((data) => {
        if (data) {
          const saved = JSON.parse(data);
          setExIdx(saved.exIdx ?? 0);
          setSetIdx(saved.setIdx ?? 0);
          if (saved.alreadySaved) setSessionAlreadySaved(true);
        }
      });
    } else {
      saveProgress(0, 0);
    }
  }, []);

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
      'Your exercise progress will be saved. You can resume from the Dashboard anytime.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Exit & Save Progress',
          onPress: async () => {
            await saveProgress(exIdx, setIdx);
            router.replace('/(coach)');
          },
        },
      ],
    );
  };

  const handleSetDone = () => {
    if (!isLastInGroup) {
      // More exercises in this superset — advance without rest
      const next = exIdx + 1;
      setExIdx(next);
      void saveProgress(next, setIdx);
      return;
    }
    const moreSets = setIdx + 1 < totalSets;
    if (moreSets) {
      setRestRemaining(defaultRest);
      setRestRunning(true);
      setPhase('rest');
    } else {
      const moreGroups = currentGroupIdx + 1 < groups.length;
      if (moreGroups) setPhase('between');
      else setPhase('done');
    }
  };

  const goToNextSet = () => {
    stopRest();
    const firstExIdx = currentGroup[0];
    const nextSetIdx = setIdx + 1;
    setExIdx(firstExIdx);
    setSetIdx(nextSetIdx);
    setPhase('set');
    void saveProgress(firstExIdx, nextSetIdx);
  };

  const handleSkipRest = () => goToNextSet();
  const handleNextSet = () => goToNextSet();

  const handleNextExercise = () => {
    const nextGroup = groups[currentGroupIdx + 1];
    const nextExIdx = nextGroup[0];
    setExIdx(nextExIdx);
    setSetIdx(0);
    setPhase('set');
    void saveProgress(nextExIdx, 0);
  };

  const adjustRest = (delta: number) => {
    setDefaultRest((r) => Math.max(10, r + delta));
    setRestRemaining((r) => Math.max(0, r + delta));
  };

  const handleFinish = async () => {
    setPhase('saving');
    try {
      // Merge per-set weights and notes back into exercises
      const finalExercises = exercises.map((ex, i) => {
        const weights = (setWeights[i] ?? []).map((w) => w.trim()).filter(Boolean);
        const unique = [...new Set(weights)];
        const finalWeight = weights.length === 0 ? ex.weight : (unique.length === 1 ? unique[0] : weights.join(' / '));

        const perSetNotes = (setNotes[i] ?? [])
          .map((n, si) => n.trim() ? `S${si + 1}: ${n.trim()}` : '')
          .filter(Boolean)
          .join(' · ');
        const finalNotes = perSetNotes
          ? (ex.notes ? `${ex.notes} | ${perSetNotes}` : perSetNotes)
          : (ex.notes ?? null);

        return { ...ex, weight: finalWeight, notes: finalNotes };
      });

      if (sessionAlreadySaved) {
        // Session already exists — just update the exercises with actual weights
        if (params.sessionId) {
          const { error } = await supabase
            .from('workout_sessions')
            .update({ exercises: finalExercises })
            .eq('id', params.sessionId);
          if (error) throw error;
        }
      } else {
        const elapsed = Math.round((Date.now() - startTime) / 60000);
        const finalDuration = Math.max(Number(params.durationMinutes) || elapsed, elapsed);
        const { error } = await supabase.from('workout_sessions').insert({
          package_id: params.pkgId,
          client_id: params.clientId,
          coach_id: params.coachId,
          session_date: params.sessionDate,
          duration_minutes: finalDuration,
          exercises: finalExercises,
          notes: params.sessionNotes || null,
          status: 'completed',
        });
        if (error) throw error;
      }
      await AsyncStorage.removeItem(WORKOUT_KEY);
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
            <Ionicons name="close-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.exitBtnText}>EXIT</Text>
          </Pressable>

          <View style={styles.wHeaderCenter}>
            <Text style={styles.wClientName} numberOfLines={1}>{params.clientName || 'Workout'}</Text>
            <Text style={styles.wElapsed}>
              {pad(elapsedMins)}:{pad(elapsedSecRem)} elapsed
            </Text>
          </View>

          <Text style={styles.wProgress}>
            {currentGroupIdx + 1}/{groups.length}
          </Text>
        </View>
      )}

      {/* ── Phase content ─────────────────────────────────────── */}

      {/* SET phase */}
      {phase === 'set' && (
        <View style={styles.phaseSet}>

          {/* TOP: Exercise overview strip */}
          <View style={styles.exStrip}>
            {exercises.map((ex, i) => (
              <View key={i} style={[styles.exStripRow, i === exIdx && styles.exStripRowActive]}>
                <Ionicons
                  name={i < exIdx ? 'checkmark-circle' : i === exIdx ? 'ellipse' : 'ellipse-outline'}
                  size={12}
                  color={i < exIdx ? colors.accent : i === exIdx ? colors.accent : colors.border}
                />
                <Text
                  style={[styles.exStripName, i === exIdx && { color: colors.textPrimary, fontWeight: '700' }]}
                  numberOfLines={1}
                >
                  {ex.exercise_name}
                </Text>
                {i === exIdx && (
                  <Text style={styles.exStripBadge}>S{setIdx + 1}/{totalSets}</Text>
                )}
              </View>
            ))}
          </View>

          {/* MIDDLE: Current exercise info */}
          <View style={styles.phaseCenter}>
            <Text style={styles.progressLabel}>
              {isSupersetGroup
                ? `SUPERSET ${currentGroup.indexOf(exIdx) + 1}/${currentGroup.length}  ·  Group ${currentGroupIdx + 1} of ${groups.length}`
                : `Exercise ${currentGroupIdx + 1} of ${groups.length}`}
            </Text>

            <Text style={styles.exName}>{currentEx?.exercise_name}</Text>

            <View style={styles.setChip}>
              <Text style={styles.setChipText}>SET {setIdx + 1} OF {totalSets}</Text>
            </View>

            {currentEx?.reps ? (
              <Text style={styles.targetText}>{currentEx.reps} reps</Text>
            ) : null}

            {currentEx?.notes ? (
              <Text style={styles.notesText}>{currentEx.notes}</Text>
            ) : null}
          </View>

          {/* BOTTOM: Per-set weight + notes + SET DONE */}
          <View style={styles.phaseBottom}>
            {/* Weight */}
            <View style={styles.weightRow}>
              <Text style={styles.weightRowLabel}>
                WEIGHT{setIdx > 0 && setWeights[exIdx]?.[setIdx - 1] ? `  ·  prev: ${setWeights[exIdx][setIdx - 1]}` : ''}
              </Text>
              <TextInput
                style={styles.weightInput}
                value={setWeights[exIdx]?.[setIdx] ?? ''}
                onChangeText={(v) => setSetWeights((prev) => {
                  const next = prev.map((arr) => [...arr]);
                  if (next[exIdx]) next[exIdx][setIdx] = v;
                  return next;
                })}
                placeholder={currentEx?.weight ?? 'e.g. 60kg'}
                placeholderTextColor={colors.textSecondary + '60'}
                returnKeyType="next"
                onSubmitEditing={() => setNotesRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            {/* Per-set notes */}
            <TextInput
              ref={setNotesRef}
              style={styles.setNotesInput}
              value={setNotes[exIdx]?.[setIdx] ?? ''}
              onChangeText={(v) => setSetNotes((prev) => {
                const next = prev.map((arr) => [...arr]);
                if (next[exIdx]) next[exIdx][setIdx] = v;
                return next;
              })}
              placeholder="Set notes (optional)…"
              placeholderTextColor={colors.textSecondary + '60'}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            {/* Progress dots */}
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

            {/* SET DONE */}
            <Pressable style={styles.setDoneBtn} onPress={() => { Keyboard.dismiss(); handleSetDone(); }}>
              <Ionicons name="checkmark-circle" size={26} color={colors.bg} />
              <Text style={styles.primaryBtnText}>SET DONE</Text>
            </Pressable>
          </View>

        </View>
      )}

      {/* REST phase */}
      {phase === 'rest' && (
        <View style={styles.phase}>
          <Text style={styles.progressLabel}>REST</Text>

          <Text style={[styles.timerDisplay, restRemaining === 0 && { color: colors.accent }]}>
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
                  color={colors.textPrimary}
                />
                <Text style={styles.secondaryBtnText}>
                  {restRunning ? 'PAUSE' : 'RESUME'}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryBtn} onPress={handleSkipRest}>
                <Ionicons name="play-skip-forward" size={20} color={colors.textPrimary} />
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
            {isSupersetGroup
              ? `Up next: Set ${setIdx + 2} of ${totalSets} — ${currentGroup.map((i) => exercises[i]?.exercise_name).join(' + ')}`
              : `Up next: Set ${setIdx + 2} of ${totalSets} — ${currentEx?.exercise_name}`}
          </Text>
        </View>
      )}

      {/* BETWEEN exercises phase */}
      {phase === 'between' && (
        <View style={styles.phase}>
          <View style={styles.bigIcon}>
            <Ionicons name="checkmark-circle" size={80} color={colors.accent} />
          </View>
          <Text style={styles.exName}>
            {isSupersetGroup
              ? currentGroup.map((i) => exercises[i]?.exercise_name).join(' + ')
              : currentEx?.exercise_name}
          </Text>
          <Text style={styles.progressLabel}>All {totalSets} sets complete!</Text>

          {(() => {
            const nextGroup = groups[currentGroupIdx + 1] ?? [];
            const nextGroupName = nextGroup.map((i) => exercises[i]?.exercise_name).filter(Boolean).join(' + ');
            const nextFirstEx = exercises[nextGroup[0]];
            return (
              <View style={styles.upNextCard}>
                <Text style={styles.upNextCardLabel}>UP NEXT</Text>
                <Text style={styles.upNextCardName}>{nextGroupName}</Text>
                {nextGroup.length === 1 && (nextFirstEx?.reps || nextFirstEx?.weight) ? (
                  <Text style={styles.upNextCardMeta}>
                    {[
                      nextFirstEx?.reps ? `${nextFirstEx.reps} reps` : null,
                      nextFirstEx?.weight,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
            );
          })()}

          <Pressable style={styles.primaryBtn} onPress={handleNextExercise}>
            <Text style={styles.primaryBtnText}>NEXT EXERCISE →</Text>
          </Pressable>
        </View>
      )}

      {/* DONE phase */}
      {phase === 'done' && (
        <View style={styles.phase}>
          <View style={styles.bigIcon}>
            <Ionicons name="trophy" size={80} color={colors.accent} />
          </View>
          <Text style={styles.exName}>Workout Complete!</Text>
          <Text style={styles.progressLabel}>
            {totalExercises} exercises · {Math.round((Date.now() - startTime) / 60000)} min
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleFinish}>
            <Ionicons name={sessionAlreadySaved ? 'checkmark-circle-outline' : 'save-outline'} size={22} color={colors.bg} />
            <Text style={styles.primaryBtnText}>{sessionAlreadySaved ? 'DONE' : 'FINISH & SAVE'}</Text>
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
            <Ionicons name="checkmark-done-circle" size={84} color={colors.accent} />
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
            <Ionicons name="home-outline" size={20} color={colors.bg} />
            <Text style={styles.primaryBtnText}>BACK TO DASHBOARD</Text>
          </Pressable>
        </View>
      )}

    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
  root: {
    flex: 1,
  },

  // ── Persistent header ────────────────────────────────────────
  wHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
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
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  wHeaderCenter: { alignItems: 'center', flex: 1 },
  wClientName: {
    color: c.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  wElapsed: {
    color: c.accent,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  wProgress: {
    color: c.textSecondary,
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
    color: c.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  exName: {
    fontSize: 30,
    fontWeight: '800',
    color: c.textPrimary,
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: -0.5,
  },
  setChip: {
    backgroundColor: c.accent + '18',
    borderWidth: 1,
    borderColor: c.accent + '50',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 16,
  },
  setChipText: {
    color: c.accent,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  targetText: {
    ...Typography.subtitle,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  notesText: {
    ...Typography.caption,
    color: c.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: c.accent,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 32,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    color: c.bg,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
  },
  secondaryBtnText: {
    color: c.textPrimary,
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
    borderColor: c.border,
    backgroundColor: 'transparent',
  },
  dotDone: { backgroundColor: c.accent, borderColor: c.accent },
  dotCurrent: { borderColor: c.accent },
  exerciseList: {
    marginTop: 28,
    alignSelf: 'stretch',
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.textSecondary,
  },
  timerDisplay: {
    fontSize: 88,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -2,
    lineHeight: 96,
    marginBottom: 8,
  },
  timerDoneLabel: {
    ...Typography.label,
    color: c.accent,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  adjustBtnText: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
  adjustDefault: { ...Typography.body, color: c.textSecondary, minWidth: 44, textAlign: 'center' },
  restBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  upNextLabel: {
    ...Typography.caption,
    color: c.textSecondary,
    textAlign: 'center',
    marginTop: 28,
  },
  bigIcon: { marginBottom: 16 },
  upNextCard: {
    alignSelf: 'stretch',
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.accent + '30',
    padding: 18,
    marginTop: 24,
    alignItems: 'center',
    gap: 4,
  },
  upNextCardLabel: { ...Typography.label, color: c.accent },
  upNextCardName: { ...Typography.subtitle, color: c.textPrimary, textAlign: 'center' },
  upNextCardMeta: { ...Typography.caption, color: c.textSecondary },
  summaryCard: {
    alignSelf: 'stretch',
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    marginTop: 28,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  summaryLabel: { ...Typography.body, color: c.textSecondary },
  summaryValue: { ...Typography.body, color: c.textPrimary, fontWeight: '700' },

  // ── SET phase layout ──────────────────────────────────────────
  phaseSet: {
    flex: 1,
  },
  exStrip: {
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 7,
  },
  exStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exStripRowActive: {},
  exStripName: {
    ...Typography.caption,
    color: c.textSecondary,
    flex: 1,
  },
  exStripBadge: {
    color: c.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  phaseCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 8,
  },
  phaseBottom: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  weightRow: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  weightRowLabel: {
    ...Typography.label,
    color: c.textSecondary,
    fontSize: 10,
    marginBottom: 2,
  },
  weightInput: {
    color: c.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    paddingVertical: 2,
    letterSpacing: 0.3,
  },
  setNotesInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: c.textPrimary,
    fontSize: 14,
  },
  setDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: c.accent,
    borderRadius: 18,
    paddingVertical: 18,
    alignSelf: 'stretch',
  },
});
}