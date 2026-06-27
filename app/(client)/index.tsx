import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useClientData, type ClientPackage } from '@/hooks/useClientData';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Colors, Typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

// ─── Package type labels ─────────────────────────────────────
const PKG_LABEL: Record<string, string> = {
  '30min': '30-Minute Sessions',
  '45min': '45-Minute Sessions',
  '1hr':   '1-Hour Sessions',
};

// ─── Status helpers ──────────────────────────────────────────
function packageColor(pkg: ClientPackage): string {
  if (pkg.status === 'expired')        return Colors.textSecondary;
  if (pkg.sessions_remaining <= 2)     return '#FFA500';
  return Colors.accent;
}

function packageStatusLabel(pkg: ClientPackage): string {
  if (pkg.status === 'expired')        return 'EXPIRED';
  if (pkg.sessions_remaining === 0)    return 'ALL DONE';
  if (pkg.sessions_remaining <= 2)     return 'ALMOST OUT';
  return 'ACTIVE';
}

// ─── Package card ────────────────────────────────────────────
function PackageCard({ pkg }: { pkg: ClientPackage }) {
  const color      = packageColor(pkg);
  const pct        = pkg.total_sessions > 0 ? pkg.sessions_used / pkg.total_sessions : 0;
  const statusLabel = packageStatusLabel(pkg);

  // Divide total into equal segments for the segmented progress bar
  const segments   = Math.min(pkg.total_sessions, 20); // cap visual segments at 20
  const filledSegs = Math.round(pct * segments);

  return (
    <View style={[styles.pkgCard, { borderColor: color + '40' }]}>

      {/* Top row: type + status badge */}
      <View style={styles.pkgTop}>
        <Text style={styles.pkgType}>{PKG_LABEL[pkg.package_type] ?? pkg.package_type}</Text>
        <View style={[styles.statusPill, { backgroundColor: color + '18', borderColor: color + '50' }]}>
          <Text style={[styles.statusText, { color }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Hero number */}
      <View style={styles.heroRow}>
        <Text style={[styles.heroNumber, { color }]}>{pkg.sessions_remaining}</Text>
        <Text style={styles.heroLabel}>sessions{'\n'}remaining</Text>
      </View>

      {/* Segmented progress bar */}
      <View style={styles.segmentRow}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < filledSegs ? color : Colors.border },
              { width: `${(1 / segments) * 100 - 1.5}%` },
            ]}
          />
        ))}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Stat label="TOTAL"     value={String(pkg.total_sessions)} />
        <View style={styles.statDivider} />
        <Stat label="USED"      value={String(pkg.sessions_used)} color={color} />
        <View style={styles.statDivider} />
        <Stat label="REMAINING" value={String(pkg.sessions_remaining)} color={color} />
      </View>

      {/* Start date */}
      <Text style={styles.startDate}>
        Package started{' '}
        {new Date(pkg.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </Text>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Recent session row (compact) ───────────────────────────
function RecentSessionRow({
  session,
}: {
  session: { session_date: string; duration_minutes: number; exercises: { exercise_name: string }[]; coach_name: string };
}) {
  const date = new Date(session.session_date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
  const topExercises = session.exercises.slice(0, 2).map((e) => e.exercise_name).join(', ');
  const extra = session.exercises.length > 2 ? ` +${session.exercises.length - 2}` : '';

  return (
    <View style={styles.recentRow}>
      <View style={styles.recentDot} />
      <View style={styles.recentInfo}>
        <Text style={styles.recentDate}>{date}  ·  {session.duration_minutes} min</Text>
        <Text style={styles.recentExercises} numberOfLines={1}>
          {topExercises}{extra}
        </Text>
      </View>
      <Text style={styles.recentCoach}>{session.coach_name}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────
export default function ClientProgressScreen() {
  const { profile } = useAuth();
  const firstName = profile?.name?.split(' ')[0] ?? 'there';
  const { pkg, sessions, loading, error, refetch } = useClientData();

  const recentSessions = sessions.slice(0, 3);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Let's go, {firstName} 💪</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Package status */}
      <Text style={styles.sectionTitle}>MY PACKAGE</Text>
      {!loading && !pkg ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cube-outline" size={32} color={Colors.border} />
          <Text style={styles.emptyText}>No package assigned yet</Text>
          <Text style={styles.emptySub}>Your coach will set up your package</Text>
        </View>
      ) : pkg ? (
        <PackageCard pkg={pkg} />
      ) : null}

      {/* Recent workouts */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>RECENT WORKOUTS</Text>
      {!loading && recentSessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="barbell-outline" size={32} color={Colors.border} />
          <Text style={styles.emptyText}>No sessions logged yet</Text>
        </View>
      ) : (
        <View style={styles.recentCard}>
          {recentSessions.map((s, i) => (
            <View key={s.id}>
              <RecentSessionRow session={s} />
              {i < recentSessions.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
          {sessions.length > 3 && (
            <Text style={styles.viewAllHint}>See all {sessions.length} sessions in Workouts tab</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: Colors.bg },
  content:  { padding: 20, paddingBottom: 48 },

  header:   { marginBottom: 28 },
  greeting: { ...Typography.title, color: Colors.textPrimary, marginBottom: 4 },
  date:     { ...Typography.body, color: Colors.textSecondary },

  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 14 },

  // Package card
  pkgCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 4,
  },
  pkgTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pkgType: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600', flex: 1, marginRight: 8 },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  heroRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 20 },
  heroNumber: { fontSize: 64, fontWeight: '800', lineHeight: 68, letterSpacing: -2 },
  heroLabel:  { ...Typography.body, color: Colors.textSecondary, marginBottom: 8, lineHeight: 20 },

  segmentRow: { flexDirection: 'row', gap: 3, marginBottom: 20 },
  segment:    { height: 6, borderRadius: 3 },

  statsRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stat:        { flex: 1, alignItems: 'center' },
  statValue:   { ...Typography.subtitle, color: Colors.textPrimary, marginBottom: 2 },
  statLabel:   { ...Typography.label, color: Colors.textSecondary, fontSize: 10 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  startDate: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },

  // Recent sessions
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  recentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  recentInfo: { flex: 1 },
  recentDate: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 2 },
  recentExercises: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  recentCoach: { ...Typography.caption, color: Colors.textSecondary },
  rowDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 35 },
  viewAllHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  // Empty states
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { ...Typography.body, color: Colors.textPrimary, marginTop: 8 },
  emptySub:  { ...Typography.caption, color: Colors.textSecondary },
});
