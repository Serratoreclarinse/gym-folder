import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushNotifications';
import { ActiveSession, NextSession } from '@/hooks/useActiveSession';
import { QRScanModal } from '@/components/QRScanModal';
import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { Colors, Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

// ── Extend modal ─────────────────────────────────────────────────────────────

function ExtendModal({
  visible,
  onClose,
  onExtend,
  nextSession,
  endTime,
}: {
  visible: boolean;
  onClose: () => void;
  onExtend: (minutes: number, reason: string) => Promise<void>;
  nextSession: NextSession | null;
  endTime: Date;
}) {
  const { colors: c } = useTheme();
  const em = useMemo(() => makeEmStyles(c), [c]);
  const [customMins, setCustomMins] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const PRESETS = [15, 30, 45];

  const reset = () => { setCustomMins(''); setReason(''); };

  const handleExtend = (mins: number) => {
    const doExtend = async () => {
      setSaving(true);
      await onExtend(mins, reason);
      setSaving(false);
      reset();
      onClose();
    };

    if (nextSession) {
      const newEnd = new Date(endTime.getTime() + mins * 60 * 1000);
      const nextStart = new Date(nextSession.scheduled_at);
      if (newEnd > nextStart) {
        const timeStr = nextStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        Alert.alert(
          'Overlap Warning',
          `Extending will overlap with ${nextSession.client_name}'s session at ${timeStr}. Extend anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Extend Anyway', onPress: doExtend },
          ],
        );
        return;
      }
    }

    doExtend();
  };

  const handleCustom = () => {
    const mins = parseInt(customMins, 10);
    if (!mins || mins <= 0 || mins > 180) {
      Alert.alert('Invalid', 'Enter a duration between 1 and 180 minutes.');
      return;
    }
    handleExtend(mins);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={em.overlay} onPress={onClose}>
        <Pressable style={em.sheet} onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={em.handle} />
            <View style={em.header}>
              <Text style={em.title}>EXTEND TIME</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={22} color={c.textSecondary} />
              </Pressable>
            </View>

            <View style={em.presetRow}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p}
                  style={({ pressed }) => [em.presetBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => handleExtend(p)}
                  disabled={saving}
                >
                  <Text style={em.presetLabel}>+{p}</Text>
                  <Text style={em.presetSub}>min</Text>
                </Pressable>
              ))}
            </View>

            <Text style={em.sectionLabel}>CUSTOM DURATION</Text>
            <View style={em.customRow}>
              <TextInput
                style={em.customInput}
                value={customMins}
                onChangeText={setCustomMins}
                placeholder="0"
                placeholderTextColor={c.textSecondary + '60'}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={em.customUnit}>min</Text>
            </View>

            <Text style={[em.sectionLabel, { marginTop: 16 }]}>REASON (optional)</Text>
            <TextInput
              style={em.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. client wanted more time…"
              placeholderTextColor={c.textSecondary + '60'}
              autoCapitalize="sentences"
              returnKeyType="done"
            />

            <Pressable
              style={[em.customBtn, (!customMins.trim() || saving) && em.customBtnDisabled]}
              onPress={handleCustom}
              disabled={!customMins.trim() || saving}
            >
              <Text style={em.customBtnText}>{saving ? 'EXTENDING…' : 'EXTEND TIME'}</Text>
            </Pressable>

            <View style={{ height: 24 }} />
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Times Up modal ────────────────────────────────────────────────────────────

function TimesUpModal({
  visible,
  clientName,
  onExtend,
  onEnd,
}: {
  visible: boolean;
  clientName: string;
  onExtend: () => void;
  onEnd: () => void;
}) {
  const { colors: c } = useTheme();
  const tu = useMemo(() => makeTuStyles(c), [c]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={tu.overlay}>
        <View style={tu.card}>
          <Text style={tu.emoji}>⏰</Text>
          <Text style={tu.title}>SESSION TIME'S UP!</Text>
          <Text style={tu.sub}>{clientName}'s session has ended.</Text>
          <Text style={tu.sub2}>What would you like to do?</Text>
          <Pressable style={tu.extendBtn} onPress={onExtend}>
            <Ionicons name="add-circle-outline" size={18} color={c.accent} />
            <Text style={tu.extendText}>EXTEND TIME</Text>
          </Pressable>
          <Pressable style={tu.endBtn} onPress={onEnd}>
            <Text style={tu.endText}>END SESSION</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Active session card ───────────────────────────────────────────────────────

export function ActiveSessionCard({
  activeSession,
  nextSession,
  onExtend,
  onEnd,
  onCancel,
}: {
  activeSession: ActiveSession;
  nextSession: NextSession | null;
  onExtend: (minutes: number, reason: string) => Promise<{ error: string | null }>;
  onEnd: () => Promise<{ error: string | null }>;
  onCancel: () => Promise<{ error: string | null }>;
}) {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeMainStyles(c), [c]);
  const cm = useMemo(() => makeCmStyles(c), [c]);
  const ql = useMemo(() => makeQlStyles(c), [c]);

  const endTime = new Date(
    new Date(activeSession.start_time).getTime() + activeSession.current_duration * 60 * 1000,
  );

  const [remainingSecs, setRemainingSecs] = useState(() =>
    Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000)),
  );
  const [showExtend, setShowExtend] = useState(false);
  const [showTimesUp, setShowTimesUp] = useState(false);
  const [showQRScan, setShowQRScan] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [quickExercises, setQuickExercises] = useState([{ name: '', sets: '', reps: '', kg: '' }]);
  const [savingQuick, setSavingQuick] = useState(false);
  const [showExPicker, setShowExPicker] = useState(false);
  const [exPickerIdx, setExPickerIdx] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [restoreCredit, setRestoreCredit] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [sessionMode, setSessionMode] = useState<'full' | 'quick' | null>(null);
  const [showCheckinBanner, setShowCheckinBanner] = useState(false);
  const alerted5Ref = useRef(false);
  const timesUpFiredRef = useRef(false);
  const checkedInRef = useRef(false);
  const autoNoShowRef = useRef<() => Promise<void>>();

  useEffect(() => { checkedInRef.current = checkedIn; }, [checkedIn]);

  // Persist check-in state across app reloads
  const checkinKey = `@elevat3/checkedIn_${activeSession.session_id}`;
  useEffect(() => {
    AsyncStorage.getItem(checkinKey).then((val) => {
      if (val === 'true') setCheckedIn(true);
    });
  }, [checkinKey]);

  // Determine session mode: full (has exercises) or quick (no exercises)
  useEffect(() => {
    if (!activeSession.session_id) { setSessionMode('quick'); return; }
    supabase
      .from('workout_sessions')
      .select('exercises')
      .eq('id', activeSession.session_id)
      .single()
      .then(({ data }) => {
        const exs = (data?.exercises as unknown[]) ?? [];
        setSessionMode(exs.length > 0 ? 'full' : 'quick');
      });
  }, [activeSession.session_id]);

  useEffect(() => {
    if (activeSession.is_paused) return;

    alerted5Ref.current = false;
    timesUpFiredRef.current = false;

    const tick = () => {
      const secs = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000));
      setRemainingSecs(secs);

      if (secs <= 300 && secs > 0 && !alerted5Ref.current) {
        alerted5Ref.current = true;
        Vibration.vibrate([0, 300, 100, 300, 100, 300]);
      }

      if (secs === 0 && !timesUpFiredRef.current) {
        timesUpFiredRef.current = true;
        Vibration.vibrate([0, 500, 200, 500]);
        if (checkedInRef.current) {
          setShowTimesUp(true);
        } else {
          autoNoShowRef.current?.();
        }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSession.start_time, activeSession.current_duration, activeSession.is_paused]);

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const isPaused = activeSession.is_paused;
  const isRed = !isPaused && remainingSecs <= 300;
  const isYellow = !isPaused && !isRed && remainingSecs <= 600;
  const timerColor = isPaused
    ? c.textSecondary
    : isRed
      ? c.accent
      : isYellow
        ? c.warning
        : c.success;

  const startedAt = new Date(activeSession.start_time).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });

  const initials = activeSession.client_name
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const handleExtendFromCard = async (minutes: number, reason: string) => {
    const { error } = await onExtend(minutes, reason);
    if (error) Alert.alert('Error', error);
    else {
      alerted5Ref.current = false;
      timesUpFiredRef.current = false;
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);

    if (activeSession.session_id) {
      if (restoreCredit) {
        // Deleting the row triggers decrement_sessions_used automatically — no manual update needed
        await supabase.from('workout_sessions').delete().eq('id', activeSession.session_id);
      } else {
        // Keep session in history but mark as cancelled
        await supabase.from('workout_sessions')
          .update({ status: 'absent', notes: cancelReason.trim() || 'Cancelled by coach' })
          .eq('id', activeSession.session_id);
      }
    }

    const { error } = await onCancel();
    setCancelling(false);

    if (error) {
      Alert.alert('Cancel Failed', error);
      return;
    }

    await AsyncStorage.removeItem(checkinKey);
    setShowCancelModal(false);
    setCancelReason('');
    setRestoreCredit(true);
  };

  const openWorkoutPortal = async () => {
    if (!activeSession.session_id) {
      Alert.alert('No Workout Data', 'No exercises were logged for this session.');
      return;
    }
    setLoadingWorkout(true);
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('exercises, package_id, session_date, duration_minutes, notes')
      .eq('id', activeSession.session_id)
      .single();
    setLoadingWorkout(false);

    if (error || !data) {
      Alert.alert('Error', 'Could not load workout data.');
      return;
    }

    const exercises = (data.exercises as unknown[]) ?? [];
    if (!exercises.length) {
      Alert.alert(
        'No Exercises',
        'No exercises were planned for this session.',
        [
          { text: 'Keep Timer', style: 'cancel' },
          { text: 'End Session', style: 'destructive', onPress: () => onEnd() },
        ],
      );
      return;
    }

    router.push({
      pathname: '/(coach)/guided-workout',
      params: {
        exercises: JSON.stringify(exercises),
        clientId: activeSession.client_id,
        pkgId: data.package_id ?? '',
        coachId: activeSession.coach_id,
        sessionDate: data.session_date ?? new Date().toISOString().split('T')[0],
        durationMinutes: String(data.duration_minutes ?? activeSession.current_duration),
        sessionNotes: data.notes ?? '',
        clientName: activeSession.client_name,
        sessionId: activeSession.session_id,
        alreadySaved: 'true',
      },
    } as any);
  };

  const handleQRConfirm = async () => {
    setShowQRScan(false);
    setCheckedIn(true);
    await AsyncStorage.setItem(checkinKey, 'true');
    setShowCheckinBanner(true);
    setTimeout(() => setShowCheckinBanner(false), 3000);
  };

  const handleAutoNoShow = async () => {
    if (activeSession.session_id) {
      await supabase
        .from('workout_sessions')
        .update({ status: 'absent', notes: 'No-show — client did not check in' })
        .eq('id', activeSession.session_id);

      await sendPushNotification(activeSession.client_id, {
        title: '⚠️ Session Missed',
        body: 'You missed your scheduled session. A session has been deducted from your package.',
      });
    }
    await onCancel();
  };
  autoNoShowRef.current = handleAutoNoShow;

  const handleSaveQuick = async () => {
    const valid = quickExercises.filter(e => e.name.trim());
    if (!valid.length) {
      Alert.alert('No Exercises', 'Add at least one exercise name.');
      return;
    }
    if (!activeSession.session_id) {
      Alert.alert('Error', 'No session found to save to.');
      return;
    }
    const formatted = valid.map(e => ({
      name: e.name.trim(),
      sets: parseInt(e.sets, 10) || 0,
      reps: parseInt(e.reps, 10) || 0,
      weight: e.kg.trim().toUpperCase() === 'BW' ? 'BW' : (parseFloat(e.kg) || 0),
    }));
    setSavingQuick(true);
    const { error } = await supabase
      .from('workout_sessions')
      .update({ exercises: formatted })
      .eq('id', activeSession.session_id);
    setSavingQuick(false);
    if (error) {
      Alert.alert('Error', 'Could not save exercises.');
      return;
    }
    setShowQuickLog(false);
    setQuickExercises([{ name: '', sets: '', reps: '', kg: '' }]);
    Alert.alert('Saved', 'Exercises logged successfully.');
  };

  return (
    <>
      <View style={[s.card, isRed && s.cardRed, isYellow && s.cardYellow]}>
        {/* Header row */}
        <View style={s.topRow}>
          <View style={[s.liveDot, { backgroundColor: timerColor }]} />
          <Text style={s.liveLabel}>{isPaused ? 'PAUSED' : 'LIVE SESSION'}</Text>
          <Text style={[s.timer, { color: timerColor }]}>{display}</Text>
        </View>

        {/* Client row */}
        <View style={s.clientRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.clientName}>{activeSession.client_name}</Text>
            <Text style={s.meta}>
              Started {startedAt} · {activeSession.original_duration} min
              {activeSession.current_duration !== activeSession.original_duration &&
                ` → ${activeSession.current_duration} min`}
            </Text>
          </View>
        </View>

        {/* Check-in success banner */}
        {showCheckinBanner && (
          <View style={s.checkinBanner}>
            <Ionicons name="checkmark-circle" size={16} color={c.success} />
            <Text style={s.checkinBannerText}>
              {activeSession.client_name} checked in — session is active!
            </Text>
          </View>
        )}

        {/* Buttons */}
        <View style={s.btnCol}>
          {/* SCAN CLIENT TO START SESSION / CLIENT CHECKED IN */}
          {!checkedIn ? (
            <Pressable
              style={({ pressed }) => [s.scanBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowQRScan(true)}
              disabled={loadingWorkout}
            >
              <Ionicons name="qr-code-outline" size={18} color={c.bg} />
              <Text style={s.scanBtnText}>
                {loadingWorkout ? 'LOADING WORKOUT…' : 'SCAN CLIENT TO START SESSION'}
              </Text>
            </Pressable>
          ) : sessionMode === 'full' ? (
            <Pressable
              style={({ pressed }) => [s.fullLogBtn, pressed && { opacity: 0.8 }, loadingWorkout && { opacity: 0.6 }]}
              onPress={openWorkoutPortal}
              disabled={loadingWorkout}
            >
              <Ionicons name="barbell-outline" size={16} color={c.success} />
              <Text style={s.fullLogBtnText}>{loadingWorkout ? 'LOADING…' : 'FULL LOG'}</Text>
            </Pressable>
          ) : sessionMode === 'quick' ? (
            <Pressable
              style={({ pressed }) => [s.quickLogBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowQuickLog(true)}
            >
              <Ionicons name="flash-outline" size={16} color={c.accent} />
              <Text style={s.quickLogBtnText}>QUICK LOG</Text>
            </Pressable>
          ) : null}

          {/* EXTEND TIME */}
          <Pressable
            style={({ pressed }) => [s.extendBtn, pressed && { opacity: 0.75 }]}
            onPress={() => setShowExtend(true)}
          >
            <Ionicons name="add-circle-outline" size={16} color={c.accent} />
            <Text style={s.extendBtnText}>EXTEND TIME</Text>
          </Pressable>

          {/* CANCEL SESSION */}
          <Pressable
            style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.6 }]}
            onPress={() => setShowCancelModal(true)}
          >
            <Ionicons name="close-circle-outline" size={14} color={c.textSecondary} />
            <Text style={s.cancelBtnText}>CANCEL SESSION</Text>
          </Pressable>
        </View>
      </View>

      <ExtendModal
        visible={showExtend}
        onClose={() => setShowExtend(false)}
        onExtend={handleExtendFromCard}
        nextSession={nextSession}
        endTime={endTime}
      />

      <TimesUpModal
        visible={showTimesUp}
        clientName={activeSession.client_name}
        onExtend={() => { setShowTimesUp(false); setShowExtend(true); }}
        onEnd={async () => {
          setShowTimesUp(false);
          const { error } = await onEnd();
          if (error) Alert.alert('Error', error);
        }}
      />

      <QRScanModal
        visible={showQRScan}
        clientName={activeSession.client_name}
        expectedClientId={activeSession.client_id}
        onConfirm={handleQRConfirm}
        onCancel={() => setShowQRScan(false)}
      />

      {/* Cancel Session Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <Pressable style={cm.overlay} onPress={() => setShowCancelModal(false)}>
          <Pressable style={cm.sheet} onPress={() => {}}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={cm.handle} />
              <View style={cm.header}>
                <Text style={cm.title}>CANCEL SESSION</Text>
                <Pressable onPress={() => setShowCancelModal(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={c.textSecondary} />
                </Pressable>
              </View>

              <Text style={cm.subText}>
                This will stop the timer for {activeSession.client_name}.
              </Text>

              <Text style={cm.fieldLabel}>REASON (optional)</Text>
              <TextInput
                style={cm.reasonInput}
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="e.g. Wrong client scanned, client left early…"
                placeholderTextColor={c.textSecondary + '60'}
                autoCapitalize="sentences"
                returnKeyType="done"
              />

              <View style={cm.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={cm.toggleLabel}>Restore session credit</Text>
                  <Text style={cm.toggleSub}>
                    {restoreCredit
                      ? 'Session will be deleted and 1 credit returned to package'
                      : 'Session stays deducted from package'}
                  </Text>
                </View>
                <Switch
                  value={restoreCredit}
                  onValueChange={setRestoreCredit}
                  trackColor={{ false: c.border, true: c.accent + '80' }}
                  thumbColor={restoreCredit ? c.accent : c.textSecondary}
                />
              </View>

              <Pressable
                style={[cm.cancelBtn, cancelling && { opacity: 0.5 }]}
                onPress={handleConfirmCancel}
                disabled={cancelling}
              >
                <Text style={cm.cancelBtnText}>{cancelling ? 'CANCELLING…' : 'CANCEL SESSION'}</Text>
              </Pressable>

              <Pressable
                style={cm.keepBtn}
                onPress={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                <Text style={cm.keepBtnText}>KEEP TIMER RUNNING</Text>
              </Pressable>

              <View style={{ height: 24 }} />
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Quick Log Modal */}
      <Modal
        visible={showQuickLog}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuickLog(false)}
      >
        <Pressable style={ql.overlay} onPress={() => setShowQuickLog(false)}>
          <Pressable style={ql.sheet} onPress={() => {}}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={ql.handle} />
              <View style={ql.header}>
                <Text style={ql.title}>QUICK LOG</Text>
                <Pressable onPress={() => setShowQuickLog(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={c.textSecondary} />
                </Pressable>
              </View>

              <View style={ql.tableHeader}>
                <Text style={[ql.colHead, { flex: 3 }]}>EXERCISE</Text>
                <Text style={ql.colHead}>SETS</Text>
                <Text style={ql.colHead}>REPS</Text>
                <Text style={ql.colHead}>KG / BW</Text>
                <View style={{ width: 28 }} />
              </View>

              <ScrollView
                style={{ maxHeight: 230 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {quickExercises.map((ex, i) => (
                  <View key={i} style={ql.exRow}>
                    <Pressable
                      style={[ql.input, ql.exNameBtn, { flex: 3 }]}
                      onPress={() => {
                        setExPickerIdx(i);
                        setShowQuickLog(false);
                        setShowExPicker(true);
                      }}
                    >
                      <Text
                        style={[ql.exNameTxt, !ex.name && { color: c.textSecondary + '60' }]}
                        numberOfLines={1}
                      >
                        {ex.name || 'Pick exercise'}
                      </Text>
                      <Ionicons name="chevron-down" size={11} color={c.textSecondary + '80'} />
                    </Pressable>
                    <TextInput
                      style={ql.input}
                      value={ex.sets}
                      onChangeText={v => {
                        const next = [...quickExercises];
                        next[i] = { ...next[i], sets: v };
                        setQuickExercises(next);
                      }}
                      placeholder="3"
                      placeholderTextColor={c.textSecondary + '60'}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <TextInput
                      style={ql.input}
                      value={ex.reps}
                      onChangeText={v => {
                        const next = [...quickExercises];
                        next[i] = { ...next[i], reps: v };
                        setQuickExercises(next);
                      }}
                      placeholder="10"
                      placeholderTextColor={c.textSecondary + '60'}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <TextInput
                        style={[ql.input, ex.kg.toUpperCase() === 'BW' ? { color: c.accent, fontWeight: '700' } : null]}
                        value={ex.kg}
                        onChangeText={v => {
                          const next = [...quickExercises];
                          next[i] = { ...next[i], kg: v };
                          setQuickExercises(next);
                        }}
                        placeholder="kg"
                        placeholderTextColor={c.textSecondary + '60'}
                        keyboardType="decimal-pad"
                        maxLength={6}
                      />
                      <Pressable
                        onPress={() => {
                          const next = [...quickExercises];
                          next[i] = { ...next[i], kg: ex.kg.toUpperCase() === 'BW' ? '' : 'BW' };
                          setQuickExercises(next);
                        }}
                        style={{ alignItems: 'center', marginTop: 2 }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '800', color: ex.kg.toUpperCase() === 'BW' ? c.accent : c.textSecondary + '80' }}>BW</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => {
                        if (quickExercises.length === 1) {
                          setQuickExercises([{ name: '', sets: '', reps: '', kg: '' }]);
                        } else {
                          setQuickExercises(quickExercises.filter((_, idx) => idx !== i));
                        }
                      }}
                      hitSlop={8}
                      style={{ justifyContent: 'center' }}
                    >
                      <Ionicons name="close-circle" size={20} color={c.textSecondary + '80'} />
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  style={({ pressed }) => [ql.addBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setQuickExercises([...quickExercises, { name: '', sets: '', reps: '', kg: '' }])}
                >
                  <Ionicons name="add-circle-outline" size={16} color={c.accent} />
                  <Text style={ql.addBtnText}>ADD EXERCISE</Text>
                </Pressable>
              </ScrollView>

              <Pressable
                style={[ql.saveBtn, savingQuick && ql.saveBtnDisabled]}
                onPress={handleSaveQuick}
                disabled={savingQuick}
              >
                <Text style={ql.saveBtnText}>{savingQuick ? 'SAVING…' : 'SAVE LOG'}</Text>
              </Pressable>

              <View style={{ height: 24 }} />
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>

      <ExercisePickerModal
        visible={showExPicker}
        onClose={() => { setShowExPicker(false); setShowQuickLog(true); }}
        onSelect={(name) => {
          const next = [...quickExercises];
          next[exPickerIdx] = { ...next[exPickerIdx], name };
          setQuickExercises(next);
          setShowExPicker(false);
          setShowQuickLog(true);
        }}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeMainStyles = (c: ColorScheme) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.success + '40',
    padding: 14,
    marginBottom: 10,
  },
  cardYellow: { borderColor: c.warning + '60' },
  cardRed: { borderColor: c.accent + '60' },

  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  liveLabel: { ...Typography.label, color: c.textSecondary, flex: 1 },
  timer: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },

  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: c.accent + '20',
    borderWidth: 1, borderColor: c.accent + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: c.accent, fontWeight: '800', fontSize: 15 },
  clientName: { ...Typography.subtitle, color: c.textPrimary, marginBottom: 2 },
  meta: { ...Typography.caption, color: c.textSecondary },

  btnCol: { gap: 8 },

  checkinBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.success + '18', borderWidth: 1, borderColor: c.success + '50',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
  },
  checkinBannerText: { ...Typography.caption, color: c.success, fontWeight: '700', flex: 1 },

  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14,
  },
  scanBtnText: { color: c.bg, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  checkedInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.success + '15', borderWidth: 1.5, borderColor: c.success + '60',
    borderRadius: 12, paddingVertical: 14,
  },
  checkedInBtnText: { color: c.success, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  extendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: c.accent + '50', borderRadius: 12,
    paddingVertical: 10, backgroundColor: c.accent + '08',
  },
  extendBtnText: { color: c.accent, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8,
  },
  cancelBtnText: { ...Typography.caption, color: c.textSecondary, fontWeight: '600', letterSpacing: 0.5 },

  fullLogBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.success + '15', borderWidth: 1.5, borderColor: c.success + '60',
    borderRadius: 12, paddingVertical: 14,
  },
  fullLogBtnText: { color: c.success, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  quickLogBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.accent + '15', borderWidth: 1.5, borderColor: c.accent + '60',
    borderRadius: 12, paddingVertical: 14,
  },
  quickLogBtnText: { color: c.accent, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
});

const makeEmStyles = (c: ColorScheme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.border, alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  title: { ...Typography.label, color: c.textPrimary, fontSize: 14 },
  sectionLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 10 },

  presetRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  presetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 16,
    backgroundColor: c.accent + '15', borderWidth: 1.5, borderColor: c.accent + '50',
    borderRadius: 12,
  },
  presetLabel: { color: c.accent, fontSize: 20, fontWeight: '800' },
  presetSub: { ...Typography.label, color: c.textSecondary, marginTop: 2 },

  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customInput: {
    flex: 1, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: c.textPrimary, fontSize: 18, fontWeight: '700',
  },
  customUnit: { ...Typography.subtitle, color: c.textSecondary },

  reasonInput: {
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: c.textPrimary, fontSize: 15,
  },

  customBtn: {
    backgroundColor: c.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 18,
  },
  customBtnDisabled: { opacity: 0.35 },
  customBtnText: { color: c.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1 },
});

const makeCmStyles = (c: ColorScheme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.border, alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  title: { ...Typography.label, color: c.textPrimary, fontSize: 14 },
  subText: { ...Typography.body, color: c.textSecondary, marginBottom: 20, lineHeight: 20 },
  fieldLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 8 },
  reasonInput: {
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: c.textPrimary, fontSize: 15, marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: c.bg, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.border, marginBottom: 20,
  },
  toggleLabel: { ...Typography.body, color: c.textPrimary, fontWeight: '700', marginBottom: 2 },
  toggleSub: { ...Typography.caption, color: c.textSecondary, lineHeight: 16 },
  cancelBtn: {
    backgroundColor: c.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  cancelBtnText: { color: c.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  keepBtn: {
    paddingVertical: 12, alignItems: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: c.border,
  },
  keepBtnText: { ...Typography.caption, color: c.textSecondary, fontWeight: '700', letterSpacing: 0.5 },
});

const makeQlStyles = (c: ColorScheme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 18, paddingBottom: 8,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.border, alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  title: { ...Typography.label, color: c.textPrimary, fontSize: 14 },
  tableHeader: {
    flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center',
  },
  colHead: {
    flex: 1, color: c.textSecondary,
    ...Typography.label, textAlign: 'center',
  },
  exRow: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 11,
    color: c.textPrimary, fontSize: 13, textAlign: 'center',
  },
  exNameBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  exNameTxt: { fontSize: 13, color: c.textPrimary, flex: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginTop: 4,
  },
  addBtnText: { ...Typography.caption, color: c.accent, fontWeight: '700' },
  saveBtn: {
    backgroundColor: c.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 14,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: c.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1 },
});

const makeTuStyles = (c: ColorScheme) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: c.overlay,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: c.surface, borderRadius: 16,
    padding: 28, width: '100%', alignItems: 'center',
    borderWidth: 1.5, borderColor: c.accent + '40',
  },
  emoji: { fontSize: 48, marginBottom: 14 },
  title: { ...Typography.heading, color: c.textPrimary, marginBottom: 8, textAlign: 'center' },
  sub: { ...Typography.body, color: c.textSecondary, textAlign: 'center', marginBottom: 4 },
  sub2: { ...Typography.body, color: c.textSecondary, textAlign: 'center', marginBottom: 24 },
  extendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: c.accent + '60', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 24,
    backgroundColor: c.accent + '15', marginBottom: 12, width: '100%', justifyContent: 'center',
  },
  extendText: { color: c.accent, fontWeight: '800', fontSize: 13, letterSpacing: 0.8 },
  endBtn: {
    paddingVertical: 13, paddingHorizontal: 24, width: '100%',
    borderRadius: 12, borderWidth: 1, borderColor: c.border,
    alignItems: 'center',
  },
  endText: { ...Typography.body, color: c.textSecondary, fontWeight: '700' },
});
