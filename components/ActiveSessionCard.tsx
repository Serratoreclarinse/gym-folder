import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ActiveSession, NextSession } from '@/hooks/useActiveSession';
import { QRScanModal } from '@/components/QRScanModal';
import { Colors, Typography } from '@/constants/theme';

// ── Time slots for Move Time modal ───────────────────────────────────────────

const MOVE_TIME_SLOTS = [
  '5:00 AM', '5:30 AM', '6:00 AM', '6:30 AM',
  '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM',
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM',
  '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM',
  '9:00 PM',
];

function parseSlotToDate(slot: string, base: Date): Date | null {
  try {
    const upper = slot.toUpperCase().trim();
    const [timePart, period] = upper.split(' ');
    const [hhStr, mmStr] = timePart.split(':');
    let h = parseInt(hhStr, 10);
    const m = parseInt(mmStr, 10) || 0;
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  } catch { return null; }
}

// ── Move Time modal ───────────────────────────────────────────────────────────

function MoveTimeModal({
  visible,
  currentStartTime,
  onClose,
  onMove,
}: {
  visible: boolean;
  currentStartTime: string;
  onClose: () => void;
  onMove: (newStartISO: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentDisplay = new Date(currentStartTime).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });

  const handleMove = async () => {
    const parsed = parseSlotToDate(selected, new Date(currentStartTime));
    if (!parsed) return;
    setSaving(true);
    await onMove(parsed.toISOString());
    setSaving(false);
    setSelected('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mt.overlay} onPress={onClose}>
        <Pressable style={mt.sheet} onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={mt.handle} />
            <View style={mt.header}>
              <Text style={mt.title}>MOVE SESSION TIME</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={mt.currentInfo}>Current start: {currentDisplay}</Text>

            <Pressable
              style={mt.pickerBtn}
              onPress={() => setShowDropdown(!showDropdown)}
            >
              <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
              <Text style={[mt.pickerText, !selected && mt.pickerPlaceholder]}>
                {selected || 'Select new start time'}
              </Text>
              <Ionicons
                name={showDropdown ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textSecondary}
              />
            </Pressable>

            {showDropdown && (
              <View style={mt.dropdown}>
                <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                  {MOVE_TIME_SLOTS.map((slot) => (
                    <Pressable
                      key={slot}
                      style={[mt.dropdownItem, selected === slot && mt.dropdownItemActive]}
                      onPress={() => { setSelected(slot); setShowDropdown(false); }}
                    >
                      <Text style={[mt.dropdownText, selected === slot && mt.dropdownTextActive]}>
                        {slot}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <Pressable
              style={[mt.moveBtn, (!selected || saving) && mt.moveBtnDisabled]}
              onPress={handleMove}
              disabled={!selected || saving}
            >
              <Text style={mt.moveBtnText}>{saving ? 'MOVING…' : 'MOVE TO THIS TIME'}</Text>
            </Pressable>

            <View style={{ height: 24 }} />
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Extend modal — at module scope (has TextInputs) ─────────────────────────

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
              <Text style={em.title}>ADD TIME</Text>
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
              <Text style={em.customBtnText}>{saving ? 'ADDING…' : 'ADD TIME'}</Text>
            </Pressable>

            <View style={{ height: 24 }} />
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Times Up modal — at module scope ─────────────────────────────────────────

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
            <Text style={tu.extendText}>ADD TIME</Text>
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
  onMove,
}: {
  activeSession: ActiveSession;
  nextSession: NextSession | null;
  onExtend: (minutes: number, reason: string) => Promise<{ error: string | null }>;
  onEnd: () => Promise<{ error: string | null }>;
  onCancel: () => Promise<{ error: string | null }>;
  onMove: (newStartTime: string) => Promise<{ error: string | null }>;
}) {
  const endTime = new Date(
    new Date(activeSession.start_time).getTime() + activeSession.current_duration * 60 * 1000,
  );

  const [remainingSecs, setRemainingSecs] = useState(() =>
    Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000)),
  );
  const [showExtend, setShowExtend] = useState(false);
  const [showMoveTime, setShowMoveTime] = useState(false);
  const [showTimesUp, setShowTimesUp] = useState(false);
  const [showQRScan, setShowQRScan] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  const alerted5Ref = useRef(false);
  const timesUpFiredRef = useRef(false);

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
        setShowTimesUp(true);
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
  const timerColor = isPaused ? Colors.textSecondary : isRed ? Colors.accent : isYellow ? '#FF9800' : '#4CAF50';

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

  const handleMoveTime = async (newStartISO: string) => {
    const { error } = await onMove(newStartISO);
    if (error) Alert.alert('Error', error);
    else {
      alerted5Ref.current = false;
      timesUpFiredRef.current = false;
    }
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Session',
      `End ${activeSession.client_name}'s session? Total duration: ${activeSession.current_duration} min.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            const { error } = await onEnd();
            if (error) Alert.alert('Error', error);
          },
        },
      ],
    );
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

  const handleOpenWorkout = async () => {
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

  return (
    <>
      <View style={[s.card, isRed && s.cardRed, isYellow && s.cardYellow]}>
        {/* Header row */}
        <View style={s.topRow}>
          <View style={[s.liveDot, { backgroundColor: timerColor }]} />
          <Text style={s.liveLabel}>{isPaused ? 'PAUSED' : 'LIVE SESSION'}</Text>
          <Text style={[s.timer, { color: timerColor }]}>{display}</Text>
        </View>

        {/* Client row — tap to open workout portal */}
        <Pressable
          style={({ pressed }) => [s.clientRow, pressed && { opacity: 0.7 }]}
          onPress={handleOpenWorkout}
          disabled={loadingWorkout}
        >
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
          <Ionicons name="barbell-outline" size={18} color={Colors.textSecondary} />
        </Pressable>

        {/* Buttons */}
        <View style={s.btnCol}>
          {/* OPEN WORKOUT */}
          <Pressable
            style={({ pressed }) => [
              s.openWorkoutBtn,
              pressed && { opacity: 0.8 },
              loadingWorkout && { opacity: 0.55 },
            ]}
            onPress={handleOpenWorkout}
            disabled={loadingWorkout}
          >
            <Ionicons name="barbell-outline" size={16} color={Colors.bg} />
            <Text style={s.openWorkoutBtnText}>
              {loadingWorkout ? 'LOADING…' : 'OPEN WORKOUT'}
            </Text>
          </Pressable>

          {/* ADD TIME | MOVE TIME */}
          <View style={s.btnRow}>
            <Pressable
              style={({ pressed }) => [s.halfBtn, pressed && { opacity: 0.75 }]}
              onPress={() => setShowExtend(true)}
            >
              <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
              <Text style={s.halfBtnText}>ADD TIME</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.halfBtn, s.halfBtnAlt, pressed && { opacity: 0.75 }]}
              onPress={() => setShowMoveTime(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <Text style={[s.halfBtnText, s.halfBtnTextAlt]}>MOVE TIME</Text>
            </Pressable>
          </View>

          {/* SCAN CLIENT QR */}
          <Pressable
            style={({ pressed }) => [
              s.checkInBtn,
              checkedIn && s.checkInBtnDone,
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => !checkedIn && setShowQRScan(true)}
          >
            <Ionicons
              name={checkedIn ? 'checkmark-circle' : 'qr-code-outline'}
              size={16}
              color={checkedIn ? '#4CAF50' : '#888'}
            />
            <Text style={[s.checkInBtnText, checkedIn && s.checkInBtnTextDone]}>
              {checkedIn ? 'CLIENT CHECKED IN' : 'SCAN CLIENT QR'}
            </Text>
          </Pressable>

          {/* END SESSION */}
          <Pressable
            style={({ pressed }) => [s.endBtn, pressed && { opacity: 0.75 }]}
            onPress={handleEndSession}
          >
            <Ionicons name="stop-circle-outline" size={16} color={Colors.textPrimary} />
            <Text style={s.endBtnText}>END SESSION</Text>
          </Pressable>

          {/* CANCEL */}
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

      <MoveTimeModal
        visible={showMoveTime}
        currentStartTime={activeSession.start_time}
        onClose={() => setShowMoveTime(false)}
        onMove={handleMoveTime}
      />

      <TimesUpModal
        visible={showTimesUp}
        clientName={activeSession.client_name}
        onExtend={() => { setShowTimesUp(false); setShowExtend(true); }}
        onEnd={() => { setShowTimesUp(false); handleEndSession(); }}
      />

      <QRScanModal
        visible={showQRScan}
        clientName={activeSession.client_name}
        expectedClientId={activeSession.client_id}
        onConfirm={() => { setShowQRScan(false); setCheckedIn(true); }}
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

  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
  },
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
  btnRow: { flexDirection: 'row', gap: 8 },

  openWorkoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 12,
    paddingVertical: 13,
  },
  openWorkoutBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14, letterSpacing: 0.8 },

  halfBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.accent + '60', borderRadius: 10,
    paddingVertical: 10, backgroundColor: Colors.accent + '10',
  },
  halfBtnAlt: {
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  halfBtnText: { color: Colors.accent, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  halfBtnTextAlt: { color: Colors.textSecondary },

  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingVertical: 10, backgroundColor: Colors.surface,
  },
  checkInBtnDone: { borderColor: '#4CAF5060', backgroundColor: '#4CAF5010' },
  checkInBtnText: { color: Colors.textSecondary, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  checkInBtnTextDone: { color: '#4CAF50' },

  endBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingVertical: 10,
  },
  endBtnText: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },

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

const mt = StyleSheet.create({
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
    alignItems: 'center', marginBottom: 12,
  },
  title: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },
  currentInfo: {
    ...Typography.caption, color: Colors.textSecondary,
    marginBottom: 16,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 4,
  },
  pickerText: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  pickerPlaceholder: { color: Colors.textSecondary, fontWeight: '400' },
  dropdown: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, marginBottom: 16, overflow: 'hidden',
  },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16 },
  dropdownItemActive: { backgroundColor: Colors.accent + '18' },
  dropdownText: { color: Colors.textSecondary, fontSize: 15 },
  dropdownTextActive: { color: Colors.accent, fontWeight: '700' },
  moveBtn: {
    backgroundColor: Colors.accent, borderRadius: 13,
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  moveBtnDisabled: { opacity: 0.35 },
  moveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1 },
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
  extendText: { color: Colors.accent, fontWeight: '800', fontSize: 14, letterSpacing: 0.8 },
  endBtn: {
    paddingVertical: 13, paddingHorizontal: 24, width: '100%',
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  endText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
});
