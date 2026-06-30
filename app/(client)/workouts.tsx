import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useState } from 'react';
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
  const isNoShow = session.status === 'absent';
  const date = new Date(session.session_date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <View style={[styles.card, isNoShow && styles.cardNoShow]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardDate}>{date}</Text>
          <Text style={styles.cardCoach}>with {session.coach_name}</Text>
        </View>
        {isNoShow ? (
          <View style={styles.noShowBadge}>
            <Text style={styles.noShowBadgeText}>NO-SHOW</Text>
          </View>
        ) : (
          <View style={styles.durationChip}>
            <Ionicons name="time-outline" size={12} color={Colors.accent} />
            <Text style={styles.durationText}>{session.duration_minutes} min</Text>
          </View>
        )}
      </View>

      {isNoShow ? (
        <Text style={styles.noShowNote}>1 session was deducted from your package.</Text>
      ) : session.exercises.length > 0 ? (
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

      {!isNoShow && session.notes ? (
        <View style={styles.notesBox}>
          <Ionicons name="document-text-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.notesText}>{session.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Group sessions by month, newest month first ─────────────
function groupByMonth(sessions: ClientSession[]): { label: string; key: string; items: ClientSession[] }[] {
  const map = new Map<string, ClientSession[]>();
  for (const s of sessions) {
    const d = new Date(s.session_date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // newest month first
    .map(([key, items]) => ({
      key,
      label: new Date(key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      items,
    }));
}

// ─── Screen ──────────────────────────────────────────────────
export default function ClientWorkoutsScreen() {
  const { sessions, loading, error, refetch } = useClientData();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const allGroups = groupByMonth(sessions);
  const confirmedSessions = sessions.filter((s) => s.status !== 'absent');

  const displayedGroups = selectedMonth
    ? allGroups.filter((g) => g.key === selectedMonth)
    : allGroups;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />}
    >
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Summary line */}
      {confirmedSessions.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryNum}>{confirmedSessions.length}</Text>
            <Text style={styles.summaryLabel}>total sessions</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryNum}>
              {confirmedSessions.reduce((acc, s) => acc + s.duration_minutes, 0)}
            </Text>
            <Text style={styles.summaryLabel}>total minutes</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryNum}>
              {[...new Set(confirmedSessions.flatMap((s) => s.exercises.map((e) => e.exercise_name)))].length}
            </Text>
            <Text style={styles.summaryLabel}>exercises done</Text>
          </View>
        </View>
      )}

      {/* Month filter chips */}
      {allGroups.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          <Pressable
            style={[styles.filterChip, !selectedMonth && styles.filterChipActive]}
            onPress={() => setSelectedMonth(null)}
          >
            <Text style={[styles.filterChipText, !selectedMonth && styles.filterChipTextActive]}>All</Text>
          </Pressable>
          {allGroups.map((g) => (
            <Pressable
              key={g.key}
              style={[styles.filterChip, selectedMonth === g.key && styles.filterChipActive]}
              onPress={() => setSelectedMonth(selectedMonth === g.key ? null : g.key)}
            >
              <Text style={[styles.filterChipText, selectedMonth === g.key && styles.filterChipTextActive]}>
                {g.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
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
      {displayedGroups.map(({ label, key, items }) => (
        <View key={key}>
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
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryChip: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  summaryNum:   { ...Typography.subtitle, color: Colors.accent, marginBottom: 2 },
  summaryLabel: { ...Typography.label, color: Colors.textSecondary, fontSize: 10, textAlign: 'center' },

  // Month filter
  filterRow: { marginBottom: 20 },
  filterContent: { gap: 8, paddingRight: 4 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.bg },

  // Month group
  monthHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12, marginTop: 4,
  },
  monthLabel: { ...Typography.label, color: Colors.textSecondary },
  monthCount: { ...Typography.caption, color: Colors.textSecondary },

  // Session card
  card: {
    backgroundColor: Colors.surface, borderRadius: 18,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  cardNoShow: { borderColor: '#FFA50040', backgroundColor: '#FFA50008' },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cardHeaderLeft: { flex: 1, marginRight: 10 },
  cardDate:  { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  cardCoach: { ...Typography.caption, color: Colors.textSecondary },
  durationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent + '18', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accent + '40',
  },
  durationText: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  noShowBadge: {
    backgroundColor: '#FFA50020', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#FFA50050',
  },
  noShowBadgeText: { color: '#FFA500', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  noShowNote: { ...Typography.caption, color: '#FFA500', fontStyle: 'italic' },

  // Exercise list
  exList:  { gap: 10 },
  exRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  exBullet: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.accent, marginTop: 7, flexShrink: 0,
  },
  exBody:  { flex: 1 },
  exName:  { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  exMeta:  { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  exNotes: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 1 },
  noExercises: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },

  // Session notes
  notesBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.bg, borderRadius: 10, padding: 10,
    marginTop: 12, borderWidth: 1, borderColor: Colors.border,
  },
  notesText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub:   { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
});
