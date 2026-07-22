import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useActiveSessionContext } from '@/context/ActiveSessionContext';
import { QRScanModal } from '@/components/QRScanModal';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const TAB_BAR_HEIGHT = 58;

export function FloatingSessionBar() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { activeSession, endSession } = useActiveSessionContext();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [remainingSecs, setRemainingSecs] = useState(0);
  const [showQRScan, setShowQRScan] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkinKey = activeSession ? `@elevat3/checkedIn_${activeSession.session_id}` : null;
  useEffect(() => {
    if (!checkinKey) return;
    AsyncStorage.getItem(checkinKey).then((val) => {
      if (val === 'true') setCheckedIn(true);
    });
  }, [checkinKey]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!activeSession) return;

    const endMs =
      new Date(activeSession.start_time).getTime() +
      activeSession.current_duration * 60_000;

    const tick = () =>
      setRemainingSecs(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeSession?.start_time, activeSession?.current_duration]);

  // Hide on Dashboard — the full ActiveSessionCard is shown there
  const isOnDashboard = pathname === '/(coach)' || pathname === '/(coach)/(tabs)';
  if (!activeSession || isOnDashboard) return null;

  const isRed = remainingSecs <= 300;
  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const timeDisplay = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const handleEnd = () =>
    Alert.alert('End Session', `End session for ${activeSession.client_name}?`, [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: () => endSession() },
    ]);

  const openWorkoutPortal = async () => {
    if (!activeSession.session_id) return;
    setLoadingWorkout(true);
    const { data } = await supabase
      .from('workout_sessions')
      .select('exercises, package_id, session_date, duration_minutes, notes')
      .eq('id', activeSession.session_id)
      .single();
    setLoadingWorkout(false);

    const exercises = (data?.exercises as unknown[]) ?? [];
    if (!exercises.length) {
      Alert.alert(
        'No Exercises',
        'No exercises were planned for this session.',
        [
          { text: 'Keep Timer', style: 'cancel' },
          { text: 'End Session', style: 'destructive', onPress: () => endSession() },
        ],
      );
      return;
    }

    router.push({
      pathname: '/(coach)/guided-workout',
      params: {
        exercises: JSON.stringify(exercises),
        clientId: activeSession.client_id,
        pkgId: data?.package_id ?? '',
        coachId: activeSession.coach_id,
        sessionDate: data?.session_date ?? new Date().toISOString().split('T')[0],
        durationMinutes: String(data?.duration_minutes ?? activeSession.current_duration),
        sessionNotes: data?.notes ?? '',
        clientName: activeSession.client_name,
        sessionId: activeSession.session_id,
        alreadySaved: 'true',
      },
    } as any);
  };

  const handleQRConfirm = async () => {
    setShowQRScan(false);
    setCheckedIn(true);
    if (checkinKey) await AsyncStorage.setItem(checkinKey, 'true');
  };

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[s.wrapper, { bottom: TAB_BAR_HEIGHT + insets.bottom }]}
      >
        <View style={[s.bar, isRed && s.barRed]}>
          <View style={[s.stripe, { backgroundColor: isRed ? colors.accent : colors.success }]} />

          <View style={s.info}>
            <Text style={s.clientName} numberOfLines={1}>
              {activeSession.client_name}
            </Text>
            <Text style={[s.timer, isRed && s.timerRed]}>
              {timeDisplay}
            </Text>
          </View>

          {/* QR check-in / open workout */}
          <Pressable
            style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}
            onPress={() => checkedIn ? openWorkoutPortal() : setShowQRScan(true)}
            disabled={loadingWorkout}
            hitSlop={10}
          >
            <Ionicons
              name={checkedIn ? 'barbell-outline' : 'qr-code-outline'}
              size={19}
              color={checkedIn ? colors.success : colors.textSecondary}
            />
          </Pressable>

          {/* End */}
          <Pressable
            style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}
            onPress={handleEnd}
            hitSlop={10}
          >
            <Ionicons name="stop-circle-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </View>

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

const makeStyles = (c: ColorScheme) => StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    zIndex: 99,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    height: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 8,
  },
  barRed: {
    borderColor: c.accent + '60',
    backgroundColor: c.accent + '10',
  },
  stripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  info: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  clientName: {
    ...Typography.caption,
    color: c.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  timer: {
    ...Typography.body,
    color: c.textPrimary,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  timerRed: {
    color: c.accent,
  },
  iconBtn: {
    width: 40,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
