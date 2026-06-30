import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '@/constants/theme';

const BEEP_SRC = require('@/assets/sounds/beep.wav');
const DONE_SRC = require('@/assets/sounds/done.wav');

type Preset = { label: string; seconds: number; custom?: boolean };

const PRESETS: Preset[] = [
  { label: 'Rest 30s', seconds: 30 },
  { label: 'Rest 60s', seconds: 60 },
  { label: 'Plank 1m', seconds: 60 },
  { label: 'Custom', seconds: 0, custom: true },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function TimerScreen() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customSeconds, setCustomSeconds] = useState('90');
  const [totalSeconds, setTotalSeconds] = useState(30);
  const [remaining, setRemaining] = useState(30);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beepRef = useRef<Audio.Sound | null>(null);
  const doneRef = useRef<Audio.Sound | null>(null);

  const isCustom = PRESETS[selectedPreset].custom;

  // Load sounds and configure audio mode once
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    let beepSound: Audio.Sound;
    let doneSound: Audio.Sound;

    Audio.Sound.createAsync(BEEP_SRC).then(({ sound }) => {
      beepSound = sound;
      beepRef.current = sound;
    }).catch(() => {});

    Audio.Sound.createAsync(DONE_SRC).then(({ sound }) => {
      doneSound = sound;
      doneRef.current = sound;
    }).catch(() => {});

    return () => {
      beepSound?.unloadAsync();
      doneSound?.unloadAsync();
    };
  }, []);

  const playBeep = async () => {
    try {
      if (beepRef.current) {
        await beepRef.current.setPositionAsync(0);
        await beepRef.current.playAsync();
      }
    } catch {}
  };

  const playDone = async () => {
    try {
      if (doneRef.current) {
        await doneRef.current.setPositionAsync(0);
        await doneRef.current.playAsync();
      }
      // Play extra beeps for emphasis after the first
      setTimeout(async () => {
        if (doneRef.current) {
          await doneRef.current.setPositionAsync(0);
          await doneRef.current.playAsync();
        }
      }, 450);
      setTimeout(async () => {
        if (doneRef.current) {
          await doneRef.current.setPositionAsync(0);
          await doneRef.current.playAsync();
        }
      }, 900);
    } catch {}
  };

  const getTargetSeconds = useCallback(() => {
    if (isCustom) return Math.max(1, parseInt(customSeconds) || 1);
    return PRESETS[selectedPreset].seconds;
  }, [selectedPreset, customSeconds, isCustom]);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    const s = getTargetSeconds();
    setTotalSeconds(s);
    setRemaining(s);
  }, [getTargetSeconds]);

  useEffect(() => { reset(); }, [selectedPreset]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 3 && prev > 0) {
          playBeep();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Vibration.vibrate(80);
        }
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          playDone();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Vibration.vibrate([0, 300, 100, 300, 100, 400]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handlePlayPause = () => {
    if (remaining === 0) { reset(); return; }
    setRunning((r) => !r);
  };

  const handleAdd30 = () => {
    setRemaining((r) => r + 30);
    setTotalSeconds((t) => t + 30);
  };

  const handleCustomChange = (val: string) => {
    setCustomSeconds(val.replace(/[^0-9]/g, ''));
  };

  const handleCustomBlur = () => {
    const s = Math.max(1, parseInt(customSeconds) || 1);
    setCustomSeconds(String(s));
    setTotalSeconds(s);
    setRemaining(s);
    setRunning(false);
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isWarning = remaining <= 5 && remaining > 0 && running;
  const isDone = remaining === 0;

  const ringColor = isDone ? '#4CAF50' : isWarning ? '#FFA500' : Colors.accent;

  return (
    <Pressable style={styles.container} onPress={Keyboard.dismiss} accessible={false}>

      {/* Preset buttons */}
      <View style={styles.presets}>
        {PRESETS.map((p, i) => (
          <Pressable
            key={i}
            style={[styles.presetBtn, i === selectedPreset && styles.presetBtnActive]}
            onPress={() => setSelectedPreset(i)}
          >
            <Text style={[styles.presetText, i === selectedPreset && styles.presetTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Custom seconds input */}
      {isCustom && (
        <View style={styles.customRow}>
          <Text style={styles.customLabel}>SECONDS</Text>
          <TextInput
            style={styles.customInput}
            value={customSeconds}
            onChangeText={handleCustomChange}
            onBlur={handleCustomBlur}
            onSubmitEditing={handleCustomBlur}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={4}
            selectTextOnFocus
          />
        </View>
      )}

      {/* Timer ring */}
      <View style={styles.timerWrap}>
        <View style={[styles.timerRing, { borderColor: ringColor, backgroundColor: ringColor + '12' }]}>
          <Text style={[styles.timerText, { color: isDone || isWarning ? ringColor : Colors.textPrimary }]}>
            {pad(minutes)}:{pad(seconds)}
          </Text>
          {isDone && <Text style={[styles.doneLabel, { color: ringColor }]}>DONE!</Text>}
          {!isDone && !running && remaining < totalSeconds && (
            <Text style={styles.pausedLabel}>PAUSED</Text>
          )}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable style={styles.resetBtn} onPress={reset}>
          <Ionicons name="refresh" size={22} color={Colors.textSecondary} />
        </Pressable>

        <Pressable
          style={[styles.playBtn, { backgroundColor: ringColor }]}
          onPress={handlePlayPause}
        >
          <Ionicons
            name={running ? 'pause' : isDone ? 'refresh' : 'play'}
            size={34}
            color={Colors.bg}
          />
        </Pressable>

        <Pressable style={styles.add30Btn} onPress={handleAdd30}>
          <Text style={styles.add30Text}>+30s</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
  },
  presetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  presetBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  presetText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  presetTextActive: { color: Colors.bg },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  customLabel: { ...Typography.label, color: Colors.textSecondary },
  customInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    width: 100,
    textAlign: 'center',
  },
  timerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerRing: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 66,
    fontWeight: '800',
    letterSpacing: 2,
  },
  doneLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 6,
  },
  pausedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingBottom: 40,
  },
  resetBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 82,
    height: 82,
    borderRadius: 41,
    justifyContent: 'center',
    alignItems: 'center',
  },
  add30Btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent + '60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  add30Text: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
});
