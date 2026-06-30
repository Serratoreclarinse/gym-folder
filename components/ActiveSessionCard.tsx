import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushNotifications';
import { ActiveSession, NextSession } from '@/hooks/useActiveSession';
import { QRScanModal } from '@/components/QRScanModal';
import { Colors, Typography } from '@/constants/theme';

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
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
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
                placeholderTextColor={Colors.textSecondary + '60'}
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
              placeholderTextColor={Colors.textSecondary + '60'}
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
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={tu.overlay}>
        <View style={tu.card}>
          <Text style={tu.emoji}>⏰</Text>
          <Text style={tu.title}>SESSION TIME'S UP!</Text>
          <Text style={tu.sub}>{clientName}'s session has ended.</Text>
          <Text style={tu.sub2}>What would you like to do?</Text>
          <Pressable style={tu.extendBtn} onPress={onExtend}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
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

// ── No-Show modal (auto-fires when timer ends without check-in) ───────────────

function NoShowModal({
  visible,
  clientName,
  onExtend,
  onRecord,
}: {
  visible: boolean;
  clientName: string;
  onExtend: () => void;
  onRecord: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={tu.overlay}>
        <View style={tu.card}>
          <Text style={tu.emoji}>⚠️</Text>
          <Text style={tu.title}>CLIENT NO-SHOW</Text>
          <Text style={tu.sub}>{clientName} didn't check in.</Text>
          <Text style={tu.sub2}>Time is up — record as no-show?</Text>
          <Pressable style={tu.extendBtn} onPress={onExtend}>
            <Ionicons name="time-outline" size={18} color={Colors.accent} />
            <Text style={tu.extendText}>EXTEND TIME (CLIENT IS LATE)</Text>
          </Pressable>
          <Pressable style={[tu.endBtn, { backgroundColor: '#FFA50015', borderColor: '#FFA50060' }]} onPress={onRecord}>
            <Text style={[tu.endText, { color: '#FFA500', fontWeight: '800' }]}>RECORD NO-SHOW</Text>
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
  const endTime = new Date(
    new Date(activeSession.start_time).getTime() + activeSession.current_duration * 60 * 1000,
  );

  const [remainingSecs, setRemainingSecs] = useState(() =>
    Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000)),
  );
  const [showExtend, setShowExtend] = useState(false);
  const [showTimesUp, setShowTimesUp] = useState(false);
  const [showNoShow, setShowNoShow] = useState(false);
  const [showQRScan, setShowQRScan] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  const alerted5Ref = useRef(false);
  const timesUpFiredRef = useRef(false);
  const checkedInRef = useRef(false);

  useEffect(() => { checkedInRef.current = checkedIn; }, [checkedIn]);

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
          setShowNoShow(true);
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
    ? Colors.textSecondary
    : isRed
      ? Colors.accent
      : isYellow
        ? '#FF9800'
        : '#4CAF50';

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

  const handleCancelSession = () => {
    Alert.alert(
      'Cancel Session',
      `Cancel the timer for ${activeSession.client_name}? The session log will be deleted.`,
      [
        { text: 'Keep Timer', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: async () => {
            const { error } = await onCancel();
            if (error) Alert.alert('Error', error);
          },
        },
      ],
    );
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
      Alert.alert('No Exercises', 'No exercises were planned for this session.');
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
        alreadySaved: 'true',
      },
    } as any);
  };

  const handleQRConfirm = async () => {
    setShowQRScan(false);
    setCheckedIn(true);
    await openWorkoutPortal();
  };

  const handleAutoNoShow = async () => {
    setShowNoShow(false);
    // Mark existing workout session as absent
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

        {/* Buttons */}
        <View style={s.btnCol}>
          {/* SCAN CLIENT TO START SESSION / CLIENT CHECKED IN */}
          {!checkedIn ? (
            <Pressable
              style={({ pressed }) => [s.scanBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowQRScan(true)}
              disabled={loadingWorkout}
            >
              <Ionicons name="qr-code-outline" size={18} color={Colors.bg} />
              <Text style={s.scanBtnText}>
                {loadingWorkout ? 'LOADING WORKOUT…' : 'SCAN CLIENT TO START SESSION'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [s.checkedInBtn, pressed && { opacity: 0.8 }, loadingWorkout && { opacity: 0.6 }]}
              onPress={openWorkoutPortal}
              disabled={loadingWorkout}
            >
              <Ionicons name="barbell-outline" size={18} color="#4CAF50" />
              <Text style={s.checkedInBtnText}>
                {loadingWorkout ? 'LOADING…' : 'CLIENT CHECKED IN — OPEN WORKOUT'}
              </Text>
            </Pressable>
          )}

          {/* EXTEND TIME */}
          <Pressable
            style={({ pressed }) => [s.extendBtn, pressed && { opacity: 0.75 }]}
            onPress={() => setShowExtend(true)}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
            <Text style={s.extendBtnText}>EXTEND TIME</Text>
          </Pressable>

          {/* CANCEL SESSION */}
          <Pressable
            style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.6 }]}
            onPress={handleCancelSession}
          >
            <Ionicons name="close-circle-outline" size={14} color={Colors.textSecondary} />
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

      <NoShowModal
        visible={showNoShow}
        clientName={activeSession.client_name}
        onExtend={() => {
          setShowNoShow(false);
          alerted5Ref.current = false;
          timesUpFiredRef.current = false;
          setShowExtend(true);
        }}
        onRecord={handleAutoNoShow}
      />

      <QRScanModal
        visible={showQRScan}
        clientName={activeSession.client_name}
        expectedClientId={activeSession.client_id}
        onConfirm={handleQRConfirm}
        onCancel={() => setShowQRScan(false)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#4CAF5040',
    padding: 14,
    marginBottom: 10,
  },
  cardYellow: { borderColor: '#FF980060' },
  cardRed: { borderColor: Colors.accent + '60' },

  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  liveLabel: { ...Typography.label, color: Colors.textSecondary, flex: 1 },
  timer: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },

  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accent + '20',
    borderWidth: 1, borderColor: Colors.accent + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.accent, fontWeight: '800', fontSize: 15 },
  clientName: { ...Typography.subtitle, color: Colors.textPrimary, marginBottom: 2 },
  meta: { ...Typography.caption, color: Colors.textSecondary },

  btnCol: { gap: 8 },

  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14,
  },
  scanBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  checkedInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4CAF5015', borderWidth: 1.5, borderColor: '#4CAF5060',
    borderRadius: 12, paddingVertical: 14,
  },
  checkedInBtnText: { color: '#4CAF50', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  extendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.accent + '50', borderRadius: 10,
    paddingVertical: 10, backgroundColor: Colors.accent + '08',
  },
  extendBtnText: { color: Colors.accent, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8,
  },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 12, letterSpacing: 0.5 },
});

const em = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  title: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },
  sectionLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 10 },

  presetRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  presetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 16,
    backgroundColor: Colors.accent + '15', borderWidth: 1.5, borderColor: Colors.accent + '50',
    borderRadius: 12,
  },
  presetLabel: { color: Colors.accent, fontSize: 20, fontWeight: '800' },
  presetSub: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },

  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customInput: {
    flex: 1, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 18, fontWeight: '700',
  },
  customUnit: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },

  reasonInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15,
  },

  customBtn: {
    backgroundColor: Colors.accent, borderRadius: 13,
    paddingVertical: 14, alignItems: 'center', marginTop: 18,
  },
  customBtnDisabled: { opacity: 0.35 },
  customBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1 },
});

const tu = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: 20,
    padding: 28, width: '100%', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.accent + '40',
  },
  emoji: { fontSize: 48, marginBottom: 14 },
  title: { ...Typography.label, color: Colors.textPrimary, fontSize: 18, marginBottom: 8, textAlign: 'center' },
  sub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  sub2: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  extendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.accent + '60', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 24,
    backgroundColor: Colors.accent + '15', marginBottom: 12, width: '100%', justifyContent: 'center',
  },
  extendText: { color: Colors.accent, fontWeight: '800', fontSize: 13, letterSpacing: 0.8 },
  endBtn: {
    paddingVertical: 13, paddingHorizontal: 24, width: '100%',
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  endText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
});
