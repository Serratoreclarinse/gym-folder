import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClientData, type ClientSession } from '@/hooks/useClientData';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Colors, Typography } from '@/constants/theme';

// ─── Single exercise row ─────────────────────────────────────
function ExerciseRow({ name, sets, reps, weight, notes }: {
  name: string;
  sets: number | null;
  reps: number | null;
  weight: string | null;
  notes: string | null;
}) {
  const meta = [
    sets != null && reps != null ? `${sets} × ${reps}` : sets != null ? `${sets} sets` : null,
    weight ?? null,
  ].filter(Boolean).join('  @  ');

  return (
    <View style={styles.exRow}>
      <View style={styles.exBullet} />
      <View style={styles.exBody}>
        <Text style={styles.exName}>{name}</Text>
        {meta ? <Text style={styles.exMeta}>{meta}</Text> : null}
        {notes ? <Text style={styles.exNotes}>{notes}</Text> : null}
      </View>
    </View>
  );
}

// ─── Session card ────────────────────────────────────────────
function SessionCard({ session }: { session: ClientSession }) {
  const date = new Date(session.session_date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <View style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardDate}>{date}</Text>
          <Text style={styles.cardCoach}>with {session.coach_name}</Text>
        </View>
        <View style={styles.durationChip}>
          <Ionicons name="time-outline" size={12} color={Colors.accent} />
          <Text style={styles.durationText}>{session.duration_minutes} min</Text>
        </View>
      </View>

      {/* Exercises */}
      {session.exercises.length > 0 ? (
        <View style={styles.exList}>
          {session.exercises.map((ex, i) => (
            <ExerciseRow
              key={i}
              name={ex.exercise_name}
              sets={ex.sets}
              reps={ex.reps}
              weight={ex.weight}
              notes={ex.notes}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.noExercises}>No exercises recorded</Text>
      )}

      {/* Session notes */}
      {session.notes ? (
        <View style={styles.notesBox}>
          <Ionicons name="document-text-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.notesText}>{session.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Group sessions by month ─────────────────────────────────
function groupByMonth(sessions: ClientSession[]): { label: string; items: ClientSession[] }[] {
  const map = new Map<string, ClientSession[]>();
  for (const s of sessions) {
    const label = new Date(s.session_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(s);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ─── Screen ──────────────────────────────────────────────────
export default function ClientWorkoutsScreen() {
  const { sessions, loading, error, refetch } = useClientData();
  const groups = groupByMonth(sessions);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />}
    >
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Summary line */}
      {sessions.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryNum}>{sessions.length}</Text>
            <Text style={styles.summaryLabel}>total sessions</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryNum}>
              {sessions.reduce((acc, s) => acc + s.duration_minutes, 0)}
            </Text>
            <Text style={styles.summaryLabel}>total minutes</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryNum}>
              {[...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exercise_name)))].length}
            </Text>
            <Text style={styles.summaryLabel}>exercises done</Text>
          </View>
        </View>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="barbell-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Your completed workouts will appear here</Text>
        </View>
      )}

      {/* Grouped history */}
      {groups.map(({ label, items }) => (
        <View key={label}>
          <View style={styles.monthHeader}>
            <Text style={styles.monthLabel}>{label.toUpperCase()}</Text>
            <Text style={styles.monthCount}>{items.length} session{items.length !== 1 ? 's' : ''}</Text>
          </View>
          {items.map((s) => <SessionCard key={s.id} session={s} />)}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },

  // Summary chips
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  summaryChip: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryNum:   { ...Typography.subtitle, color: Colors.accent, marginBottom: 2 },
  summaryLabel: { ...Typography.label, color: Colors.textSecondary, fontSize: 10, textAlign: 'center' },

  // Month group
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  monthLabel: { ...Typography.label, color: Colors.textSecondary },
  monthCount: { ...Typography.caption, color: Colors.textSecondary },

  // Session card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cardHeaderLeft: { flex: 1, marginRight: 10 },
  cardDate:  { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  cardCoach: { ...Typography.caption, color: Colors.textSecondary },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent + '18',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  durationText: { fontSize: 12, fontWeight: '600', color: Colors.accent },

  // Exercise list
  exList: { gap: 10 },
  exRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  exBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 7,
    flexShrink: 0,
  },
  exBody:  { flex: 1 },
  exName:  { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  exMeta:  { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  exNotes: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 1 },
  noExercises: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },

  // Session notes
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.bg,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub:   { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
});
