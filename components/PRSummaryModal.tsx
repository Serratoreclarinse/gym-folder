import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

export type PRBeat = {
  exercise: string;
  metric: 'kg' | 'reps' | 'duration';
  prev: number | null;
  next: number;
};

function formatMetric(beat: PRBeat): { label: string; prev: string; next: string; diff: string } {
  if (beat.metric === 'kg') {
    return {
      label: 'Weight',
      prev: beat.prev != null ? `${beat.prev} kg` : '—',
      next: `${beat.next} kg`,
      diff: beat.prev != null ? `+${(beat.next - beat.prev).toFixed(beat.next % 1 !== 0 ? 1 : 0)} kg` : 'First time!',
    };
  }
  if (beat.metric === 'reps') {
    return {
      label: 'Reps',
      prev: beat.prev != null ? `${beat.prev}` : '—',
      next: `${beat.next}`,
      diff: beat.prev != null ? `+${beat.next - beat.prev} reps` : 'First time!',
    };
  }
  // duration (seconds)
  const fmt = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  return {
    label: 'Duration',
    prev: beat.prev != null ? fmt(beat.prev) : '—',
    next: fmt(beat.next),
    diff: beat.prev != null ? `+${beat.next - beat.prev}s` : 'First time!',
  };
}

type Props = {
  beats: PRBeat[];
  clientName: string;
  onClose: () => void;
};

export function PRSummaryModal({ beats, clientName, onClose }: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  if (beats.length === 0) return null;

  const firstTimePRs  = beats.filter(b => b.prev === null);
  const improvedPRs   = beats.filter(b => b.prev !== null);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View
          style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity, transform: [{ scale }] }]}
        >
          {/* Header */}
          <View style={[s.header, { backgroundColor: colors.accent + '18', borderBottomColor: colors.border }]}>
            <Text style={s.trophy}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.accent }]}>New Personal Records!</Text>
              <Text style={[s.subtitle, { color: colors.textSecondary }]}>
                {clientName} crushed it today
              </Text>
            </View>
          </View>

          {/* PR list */}
          <ScrollView style={s.list} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
            {beats.map((beat, i) => {
              const fmt = formatMetric(beat);
              const isFirst = beat.prev === null;
              return (
                <View key={i} style={[s.row, { backgroundColor: colors.bg, borderColor: isFirst ? colors.accent + '40' : colors.success + '40', borderWidth: 1 }]}>
                  <View style={[s.rowIcon, { backgroundColor: isFirst ? colors.accent + '20' : colors.success + '20' }]}>
                    <Ionicons
                      name={isFirst ? 'star' : 'trending-up'}
                      size={18}
                      color={isFirst ? colors.accent : colors.success}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.exName, { color: colors.textPrimary }]}>{beat.exercise}</Text>
                    <Text style={[s.metricLabel, { color: colors.textSecondary }]}>{fmt.label}</Text>
                  </View>
                  <View style={s.numbers}>
                    {beat.prev != null && (
                      <Text style={[s.prevNum, { color: colors.textSecondary }]}>{fmt.prev}</Text>
                    )}
                    <Text style={[s.nextNum, { color: isFirst ? colors.accent : colors.success }]}>{fmt.next}</Text>
                    <View style={[s.diffBadge, { backgroundColor: isFirst ? colors.accent + '18' : colors.success + '18' }]}>
                      <Text style={[s.diffText, { color: isFirst ? colors.accent : colors.success }]}>{fmt.diff}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Summary line */}
          <Text style={[s.summary, { color: colors.textSecondary }]}>
            {improvedPRs.length > 0 && firstTimePRs.length > 0
              ? `${improvedPRs.length} improved · ${firstTimePRs.length} new`
              : improvedPRs.length > 0
              ? `${improvedPRs.length} record${improvedPRs.length !== 1 ? 's' : ''} improved`
              : `${firstTimePRs.length} new record${firstTimePRs.length !== 1 ? 's' : ''} set`}
          </Text>

          {/* CTA */}
          <Pressable
            style={[s.btn, { backgroundColor: colors.accent }]}
            onPress={onClose}
          >
            <Text style={[s.btnText, { color: colors.bg }]}>Awesome!</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1,
    overflow: 'hidden', maxHeight: '80%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 20, borderBottomWidth: 1,
  },
  trophy: { fontSize: 36 },
  title: { fontFamily: 'Montserrat_800ExtraBold', fontSize: 18 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  list: { padding: 16, maxHeight: 360 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 12,
  },
  rowIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  exName: { fontFamily: 'Montserrat_600SemiBold', fontSize: 14, marginBottom: 2 },
  metricLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  numbers: { alignItems: 'flex-end', gap: 3 },
  prevNum: { fontFamily: 'Inter_400Regular', fontSize: 12, textDecorationLine: 'line-through' },
  nextNum: { fontFamily: 'Montserrat_700Bold', fontSize: 16 },
  diffBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  diffText: { fontFamily: 'Montserrat_600SemiBold', fontSize: 11 },
  summary: {
    fontFamily: 'Inter_400Regular', fontSize: 12,
    textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4,
  },
  btn: {
    margin: 16, marginTop: 8, paddingVertical: 14,
    borderRadius: 12, alignItems: 'center',
  },
  btnText: { fontFamily: 'Montserrat_700Bold', fontSize: 15, letterSpacing: 0.5 },
});
