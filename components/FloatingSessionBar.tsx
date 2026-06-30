import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveSessionContext } from '@/context/ActiveSessionContext';
import { QRScanModal } from '@/components/QRScanModal';
import { Colors, Typography } from '@/constants/theme';

const TAB_BAR_HEIGHT = 58;

export function FloatingSessionBar() {
  const { activeSession, pauseSession, resumeSession, endSession } = useActiveSessionContext();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [remainingSecs, setRemainingSecs] = useState(0);
  const [showQRScan, setShowQRScan] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!activeSession || activeSession.is_paused) return;

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
  }, [activeSession?.start_time, activeSession?.current_duration, activeSession?.is_paused]);

  // Hide on Dashboard — the full ActiveSessionCard is shown there
  const isOnDashboard = pathname === '/(coach)' || pathname === '/(coach)/(tabs)';
  if (!activeSession || isOnDashboard) return null;

  const isPaused = activeSession.is_paused;
  const isRed = !isPaused && remainingSecs <= 300;
  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const timeDisplay = isPaused
    ? 'PAUSED'
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const handleEnd = () =>
    Alert.alert('End Session', `End session for ${activeSession.client_name}?`, [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: () => endSession() },
    ]);

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[s.wrapper, { bottom: TAB_BAR_HEIGHT + insets.bottom }]}
      >
        <View style={[s.bar, isRed && s.barRed]}>
          <View
            style={[
              s.stripe,
              {
                backgroundColor: isPaused
                  ? Colors.textSecondary
                  : isRed
                    ? Colors.accent
                    : '#4CAF50',
              },
            ]}
          />

          <View style={s.info}>
            <Text style={s.clientName} numberOfLines={1}>
              {activeSession.client_name}
            </Text>
            <Text style={[s.timer, isPaused && s.timerPaused, isRed && s.timerRed]}>
              {timeDisplay}
            </Text>
          </View>

          {/* QR check-in */}
          <Pressable
            style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}
            onPress={() => !checkedIn && setShowQRScan(true)}
            hitSlop={10}
          >
            <Ionicons
              name={checkedIn ? 'checkmark-circle' : 'qr-code-outline'}
              size={19}
              color={checkedIn ? '#4CAF50' : Colors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}
            onPress={() => (isPaused ? resumeSession() : pauseSession())}
            hitSlop={10}
          >
            <Ionicons
              name={isPaused ? 'play' : 'pause'}
              size={18}
              color={Colors.textPrimary}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}
            onPress={handleEnd}
            hitSlop={10}
          >
            <Ionicons name="stop-circle-outline" size={20} color={Colors.danger} />
          </Pressable>
        </View>
      </View>

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

const s = StyleSheet.create({
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
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    height: 52,
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 8,
  },
  barRed: {
    borderColor: Colors.accent + '60',
    backgroundColor: Colors.accent + '10',
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
    color: Colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  timer: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  timerPaused: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  timerRed: {
    color: Colors.accent,
  },
  iconBtn: {
    width: 40,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
