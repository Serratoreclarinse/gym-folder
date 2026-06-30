import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClientPRs } from '@/hooks/useClientPRs';
import { Colors, Typography } from '@/constants/theme';

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function RecordsScreen() {
  const { prs, loading, refetch } = useClientPRs();

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />}
    >
      <Text style={s.heading}>PERSONAL RECORDS</Text>
      <Text style={s.sub}>Your best lift for each exercise, tracked automatically from your sessions.</Text>

      {!loading && prs.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="trophy-outline" size={56} color={Colors.border} />
          <Text style={s.emptyTitle}>No records yet</Text>
          <Text style={s.emptySub}>Complete sessions with weighted exercises to start tracking PRs</Text>
        </View>
      ) : (
        prs.map((pr, i) => (
          <View key={pr.exercise_name} style={s.card}>
            <View style={s.rankCol}>
              {i === 0 ? (
                <Text style={s.medal}>🥇</Text>
              ) : i === 1 ? (
                <Text style={s.medal}>🥈</Text>
              ) : i === 2 ? (
                <Text style={s.medal}>🥉</Text>
              ) : (
                <Text style={s.rankNum}>{i + 1}</Text>
              )}
            </View>

            <View style={s.info}>
              <Text style={s.exerciseName}>{pr.exercise_name}</Text>
              <View style={s.metaRow}>
                <Ionicons name="calendar-outline" size={11} color={Colors.textSecondary} />
                <Text style={s.metaText}>{fmtDate(pr.achieved_date)}</Text>
                <Text style={s.dot}>·</Text>
                <Ionicons name="repeat-outline" size={11} color={Colors.textSecondary} />
                <Text style={s.metaText}>{pr.session_count}× performed</Text>
              </View>
            </View>

            <View style={s.weightCol}>
              <Text style={s.weight}>{pr.best_weight_str}</Text>
              <Text style={s.weightLabel}>BEST</Text>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingTop: 24 },

  heading: { ...Typography.label, color: Colors.textSecondary, marginBottom: 4 },
  sub: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 24, lineHeight: 18 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 14,
    marginBottom: 8, gap: 12,
  },
  rankCol: { width: 28, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { ...Typography.label, color: Colors.textSecondary, fontSize: 13 },

  info: { flex: 1 },
  exerciseName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.caption, color: Colors.textSecondary },
  dot: { color: Colors.border, fontSize: 10 },

  weightCol: { alignItems: 'flex-end' },
  weight: { ...Typography.subtitle, color: Colors.accent, fontWeight: '700' },
  weightLabel: { ...Typography.label, color: Colors.textSecondary, fontSize: 9, marginTop: 1 },
});
