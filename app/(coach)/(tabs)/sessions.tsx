import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessions } from '@/hooks/useSessions';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

function SessionCard({ session }: { session: ReturnType<typeof useSessions>['sessions'][number] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dateStr = new Date(session.session_date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/(coach)/client/${session.client_id}`)}
    >
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.clientName}>{session.client_name}</Text>
          <Text style={styles.dateLine}>{dateStr}</Text>
        </View>
        <View style={styles.durationBadge}>
          <Ionicons name="time-outline" size={12} color={colors.accent} />
          <Text style={styles.durationText}>{session.duration_minutes} min</Text>
        </View>
      </View>

      {session.exercises.length > 0 && (
        <View style={styles.exerciseList}>
          {session.exercises.slice(0, 3).map((ex, i) => (
            <Text key={i} style={styles.exerciseItem}>
              · {ex.exercise_name}
              {ex.sets ? `  ${ex.sets}×${ex.reps ?? '?'}` : ''}
              {ex.weight ? `  @${ex.weight}` : ''}
            </Text>
          ))}
          {session.exercises.length > 3 && (
            <Text style={styles.exerciseMore}>+{session.exercises.length - 3} more</Text>
          )}
        </View>
      )}

      {session.notes ? (
        <Text style={styles.notes} numberOfLines={1}>{session.notes}</Text>
      ) : null}
    </Pressable>
  );
}

export default function CoachSessionsScreen() {
  const { sessions, loading, error, refetch } = useSessions();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
    >
      {error && <ErrorBanner message={error} onRetry={refetch} />}
      <View style={styles.header}>
        <Text style={styles.count}>
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} logged
        </Text>
        <View style={styles.headerBtns}>
          <Pressable style={styles.tplBtn} onPress={() => router.push('/(coach)/session-history')}>
            <Ionicons name="time-outline" size={16} color={colors.accent} />
          </Pressable>
          <Pressable style={styles.tplBtn} onPress={() => router.push('/(coach)/templates')}>
            <Ionicons name="copy-outline" size={16} color={colors.accent} />
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => router.push('/(coach)/log-session')}>
            <Ionicons name="add" size={18} color={colors.bg} />
            <Text style={styles.addBtnText}>LOG SESSION</Text>
          </Pressable>
        </View>
      </View>

      {!loading && sessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={48} color={colors.border} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Tap "Log Session" to record your first workout</Text>
        </View>
      ) : (
        sessions.map((s) => <SessionCard key={s.id} session={s} />)
      )}
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    count: { ...Typography.body, color: c.textSecondary },
    headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tplBtn: {
      width: 36,
      height: 36,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: c.accent + '50',
      backgroundColor: c.accent + '12',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    addBtnText: { color: c.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    clientName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    dateLine: { ...Typography.caption, color: c.textSecondary },
    durationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.accent + '18',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: c.accent + '40',
    },
    durationText: { fontSize: 12, fontWeight: '600', color: c.accent },
    exerciseList: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 4 },
    exerciseItem: { ...Typography.caption, color: c.textSecondary },
    exerciseMore: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic' },
    notes: { ...Typography.caption, color: c.textSecondary, marginTop: 8, fontStyle: 'italic' },
    empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
    emptySub: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },
  });
}
