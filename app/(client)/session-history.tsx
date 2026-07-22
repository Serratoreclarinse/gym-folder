import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useClientData, type ClientSession } from '@/hooks/useClientData';
import { Typography } from '@/constants/theme';
import type { ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function groupByMonth(sessions: ClientSession[]) {
  const map = new Map<string, ClientSession[]>();
  for (const s of sessions) {
    const d = new Date(s.session_date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const [y, m] = key.split('-');
      const label = new Date(+y, +m - 1, 1).toLocaleDateString('en-US', {
        month: 'long', year: 'numeric',
      });
      return { key, label, items };
    });
}

function SessionRow({
  session, isLast, styles, colors,
}: {
  session: ClientSession;
  isLast: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorScheme;
}) {
  const isNoShow = session.status === 'absent';
  const exCount  = session.exercises.length;

  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={[styles.rowDot, { backgroundColor: isNoShow ? colors.danger : colors.accent }]} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowDate, isNoShow && { color: colors.textSecondary }]}>
          {fmtDate(session.session_date)}
        </Text>
        <Text style={styles.rowCoach}>with {session.coach_name}</Text>
      </View>
      <View style={styles.rowRight}>
        {isNoShow ? (
          <View style={styles.noShowBadge}>
            <Text style={styles.noShowText}>NO-SHOW</Text>
          </View>
        ) : (
          <>
            <Text style={styles.duration}>{session.duration_minutes} min</Text>
            {exCount > 0 && <Text style={styles.exCount}>{exCount} ex</Text>}
          </>
        )}
      </View>
    </View>
  );
}

export default function SessionHistoryScreen() {
  const { colors } = useTheme();
  const styles  = useMemo(() => makeStyles(colors), [colors]);
  const { sessions, loading, refetch } = useClientData();
  const grouped = useMemo(() => groupByMonth(sessions), [sessions]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
    >
      {sessions.length === 0 && !loading && (
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={48} color={colors.border} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Your completed workout sessions will appear here</Text>
        </View>
      )}

      {grouped.map(({ key, label, items }) => (
        <View key={key} style={styles.monthGroup}>
          <Text style={styles.monthLabel}>{label.toUpperCase()}</Text>
          <View style={styles.monthCards}>
            {items.map((s, i) => (
              <SessionRow
                key={s.id}
                session={s}
                isLast={i === items.length - 1}
                styles={styles}
                colors={colors}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll:      { flex: 1, backgroundColor: c.bg },
    content:     { padding: 20, paddingBottom: 40 },

    empty:       { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyTitle:  { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
    emptySub:    { ...Typography.body, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 20 },

    monthGroup:  { marginBottom: 24 },
    monthLabel:  { ...Typography.label, color: c.accent, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10, fontSize: 11 },
    monthCards:  { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },

    row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
    rowDivider:  { borderBottomWidth: 1, borderBottomColor: c.border },
    rowDot:      { width: 8, height: 8, borderRadius: 4, marginRight: 12, flexShrink: 0 },
    rowBody:     { flex: 1 },
    rowDate:     { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    rowCoach:    { ...Typography.caption, color: c.textSecondary, marginTop: 1 },
    rowRight:    { alignItems: 'flex-end', gap: 2 },
    duration:    { ...Typography.caption, color: c.accent, fontWeight: '700' },
    exCount:     { ...Typography.caption, color: c.textSecondary },
    noShowBadge: { backgroundColor: c.danger + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    noShowText:  { ...Typography.label, fontSize: 9, color: c.danger, fontWeight: '800' },
  });
}
