import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClientCheckins } from '@/hooks/useWeeklyCheckins';
import { useTheme } from '@/context/ThemeContext';
import { ColorScheme, Typography } from '@/constants/theme';

const MOOD_LABEL = ['', 'Struggling', 'Low', 'Okay', 'Good', 'Great'];
const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄'];
const SLEEP_LABEL = ['', 'Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'];
const ENERGY_LABEL = ['', 'Drained', 'Low', 'Moderate', 'High', 'Peak'];

function scoreColor(val: number | null): string {
  if (!val) return '#888';
  if (val >= 4) return '#4CAF50';
  if (val === 3) return '#FF9800';
  return '#FF4D4D';
}

function ScoreBar({ value, label }: { value: number | null; label: string }) {
  const color = scoreColor(value);
  return (
    <View style={bar.row}>
      <Text style={bar.label}>{label}</Text>
      <View style={bar.track}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View
            key={n}
            style={[bar.pip, { backgroundColor: value && n <= value ? color : '#33333330' }]}
          />
        ))}
      </View>
      <Text style={[bar.val, { color }]}>{value ?? '—'}</Text>
    </View>
  );
}

const bar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  label: { fontSize: 11, color: '#888', width: 52, fontWeight: '600' },
  track: { flex: 1, flexDirection: 'row', gap: 4 },
  pip: { flex: 1, height: 6, borderRadius: 3 },
  val: { fontSize: 11, fontWeight: '800', width: 18, textAlign: 'right' },
});

function fmtWeek(isoDate: string) {
  const d = new Date(isoDate + 'T00:00:00');
  const end = new Date(d); end.setDate(d.getDate() + 6);
  const fmt = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(d)} – ${fmt(end)}`;
}

export function ClientCheckinsTab({ clientId }: { clientId: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { checkins, loading } = useClientCheckins(clientId);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (checkins.length === 0) {
    return (
      <View style={s.empty}>
        <Ionicons name="clipboard-outline" size={44} color={colors.border} />
        <Text style={s.emptyTitle}>No check-ins yet</Text>
        <Text style={s.emptySub}>Client hasn't submitted any weekly check-ins</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
      {checkins.map((c, i) => {
        const avgScore = [c.mood, c.sleep_quality, c.energy_level]
          .filter(Boolean).reduce((a, b) => a + (b ?? 0), 0) /
          ([c.mood, c.sleep_quality, c.energy_level].filter(Boolean).length || 1);
        const overallColor = scoreColor(Math.round(avgScore));

        return (
          <View key={c.id} style={[s.card, i === 0 && s.cardLatest]}>
            {/* Header */}
            <View style={s.cardHeader}>
              <View>
                <Text style={s.weekLabel}>Week of</Text>
                <Text style={s.weekDate}>{fmtWeek(c.week_date)}</Text>
              </View>
              <View style={[s.overallPill, { backgroundColor: overallColor + '20', borderColor: overallColor + '60' }]}>
                <Text style={[s.overallText, { color: overallColor }]}>
                  {MOOD_EMOJI[Math.round(avgScore)] ?? '—'} {avgScore.toFixed(1)}
                </Text>
              </View>
              {i === 0 && (
                <View style={s.latestBadge}>
                  <Text style={s.latestText}>LATEST</Text>
                </View>
              )}
            </View>

            {/* Weight */}
            {c.weight_kg != null && (
              <View style={s.weightRow}>
                <Ionicons name="scale-outline" size={14} color={colors.accent} />
                <Text style={s.weightText}>{c.weight_kg} kg</Text>
              </View>
            )}

            {/* Scores */}
            <View style={s.scores}>
              <ScoreBar value={c.mood}          label="Mood" />
              <ScoreBar value={c.sleep_quality} label="Sleep" />
              <ScoreBar value={c.energy_level}  label="Energy" />
            </View>

            {/* Mood + energy labels */}
            <View style={s.labelRow}>
              {c.mood         != null && <Text style={[s.feelLabel, { color: scoreColor(c.mood) }]}>{MOOD_LABEL[c.mood]}</Text>}
              {c.sleep_quality != null && <Text style={[s.feelLabel, { color: scoreColor(c.sleep_quality) }]}>{SLEEP_LABEL[c.sleep_quality]}</Text>}
              {c.energy_level != null && <Text style={[s.feelLabel, { color: scoreColor(c.energy_level) }]}>{ENERGY_LABEL[c.energy_level]}</Text>}
            </View>

            {/* Notes */}
            {c.notes ? (
              <View style={s.notesBox}>
                <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} />
                <Text style={s.notesText}>"{c.notes}"</Text>
              </View>
            ) : null}
          </View>
        );
      })}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary },
    emptySub: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },

    list: { paddingVertical: 16 },

    card: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      padding: 14, marginBottom: 10,
    },
    cardLatest: { borderColor: c.accent + '60' },

    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
    weekLabel: { ...Typography.caption, color: c.textSecondary },
    weekDate: { ...Typography.body, color: c.textPrimary, fontWeight: '700', marginTop: 1 },
    overallPill: {
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
      borderWidth: 1, marginLeft: 'auto',
    },
    overallText: { fontSize: 12, fontWeight: '800' },
    latestBadge: {
      backgroundColor: c.accent + '18', borderRadius: 6,
      paddingHorizontal: 6, paddingVertical: 3,
      borderWidth: 1, borderColor: c.accent + '40',
    },
    latestText: { color: c.accent, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

    weightRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    weightText: { ...Typography.body, color: c.accent, fontWeight: '800' },

    scores: { marginBottom: 4 },

    labelRow: { flexDirection: 'row', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
    feelLabel: { fontSize: 10, fontWeight: '700' },

    notesBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 6,
      backgroundColor: c.bg, borderRadius: 8,
      borderWidth: 1, borderColor: c.border,
      padding: 10, marginTop: 4,
    },
    notesText: { ...Typography.caption, color: c.textSecondary, flex: 1, fontStyle: 'italic', lineHeight: 16 },
  });
}
