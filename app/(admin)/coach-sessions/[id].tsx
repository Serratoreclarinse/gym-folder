import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import { Typography, ColorScheme } from '@/constants/theme';

type Session = {
  id: string;
  session_date: string;
  duration_minutes: number;
  session_type: string;
  status: string | null;
  client_name: string;
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#4CAF50', completed: '#4CAF50',
  pending: '#FF9800', absent: '#FF4D4D', no_show: '#FF4D4D',
};
const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Done', completed: 'Completed',
  pending: 'Pending', absent: 'Absent', no_show: 'No Show',
};

const STATUS_FILTERS = ['All', 'Completed', 'Absent', 'Pending'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function CoachSessionsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [monthFilter, setMonthFilter] = useState('All');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from('workout_sessions')
      .select(`
        id, session_date, duration_minutes, session_type, status,
        client:profiles!workout_sessions_client_id_fkey(name)
      `)
      .eq('coach_id', id)
      .order('session_date', { ascending: false })
      .limit(500);

    setSessions(
      (data ?? []).map((row: any) => ({
        id: row.id,
        session_date: row.session_date,
        duration_minutes: row.duration_minutes,
        session_type: row.session_type ?? 'gym',
        status: row.status,
        client_name: row.client?.name ?? '—',
      })),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Unique months from data for the month filter
  const months = useMemo(() => {
    const seen = new Set<string>();
    const result = ['All'];
    sessions.forEach((sess) => {
      const d = new Date(sess.session_date + 'T00:00:00');
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!seen.has(key)) { seen.add(key); result.push(key); }
    });
    return result;
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter((sess) => {
      if (statusFilter !== 'All') {
        const st = sess.status ?? '';
        if (statusFilter === 'Completed' && st !== 'completed' && st !== 'confirmed') return false;
        if (statusFilter === 'Absent'    && (st !== 'absent' && st !== 'no_show'))     return false;
        if (statusFilter === 'Pending'   && st !== 'pending')                          return false;
      }
      if (monthFilter !== 'All') {
        const d = new Date(sess.session_date + 'T00:00:00');
        const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (key !== monthFilter) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, monthFilter]);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {/* Summary header */}
      <View style={s.summaryRow}>
        <View style={s.summaryBox}>
          <Text style={[s.summaryNum, { color: colors.accent }]}>{sessions.length}</Text>
          <Text style={s.summaryLbl}>Total Sessions</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryBox}>
          <Text style={[s.summaryNum, { color: colors.success }]}>
            {sessions.filter((s) => s.status === 'completed' || s.status === 'confirmed').length}
          </Text>
          <Text style={s.summaryLbl}>Completed</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryBox}>
          <Text style={[s.summaryNum, { color: colors.danger }]}>
            {sessions.filter((s) => s.status === 'absent' || s.status === 'no_show').length}
          </Text>
          <Text style={s.summaryLbl}>Absent</Text>
        </View>
      </View>

      {/* Status filter */}
      <View style={s.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[s.chip, statusFilter === f && s.chipOn]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[s.chipTxt, statusFilter === f && s.chipTxtOn]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {/* Month filter — only shown when there are multiple months */}
      {months.length > 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.monthScroll}
          contentContainerStyle={s.monthRow}
        >
          {months.map((m) => (
            <Pressable
              key={m}
              style={[s.chip, s.chipSm, monthFilter === m && s.chipOn]}
              onPress={() => setMonthFilter(m)}
            >
              <Text style={[s.chipTxt, monthFilter === m && s.chipTxtOn]}>{m}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Results count */}
      <Text style={s.resultCount}>
        {filtered.length} session{filtered.length !== 1 ? 's' : ''}
        {statusFilter !== 'All' || monthFilter !== 'All' ? ' (filtered)' : ''}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="calendar-outline" size={44} color={colors.border} />
          <Text style={s.emptyTxt}>No sessions match this filter</Text>
        </View>
      ) : (
        <View style={s.list}>
          {filtered.map((sess, i) => {
            const d = new Date(sess.session_date + 'T00:00:00');
            const statusColor = STATUS_COLOR[sess.status ?? ''] ?? colors.textSecondary;
            return (
              <View
                key={sess.id}
                style={[s.row, i === filtered.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={s.dateCol}>
                  <Text style={s.dateDay}>
                    {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={s.dateYear}>{d.getFullYear()}</Text>
                </View>
                <View style={s.info}>
                  <Text style={s.clientName} numberOfLines={1}>{sess.client_name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={s.meta}>{sess.duration_minutes} min</Text>
                    <Ionicons
                      name={sess.session_type === 'home' ? 'home-outline' : 'barbell-outline'}
                      size={11}
                      color={colors.textSecondary}
                    />
                  </View>
                </View>
                {sess.status && (
                  <View style={[s.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor + '60' }]}>
                    <Text style={[s.statusTxt, { color: statusColor }]}>
                      {STATUS_LABEL[sess.status] ?? sess.status}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 48 },

    summaryRow: {
      flexDirection: 'row', backgroundColor: c.surface,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
      marginBottom: 20, overflow: 'hidden',
    },
    summaryBox:     { flex: 1, alignItems: 'center', paddingVertical: 16 },
    summaryDivider: { width: 1, backgroundColor: c.border },
    summaryNum:     { fontSize: 26, fontWeight: '800', lineHeight: 30 },
    summaryLbl:     { ...Typography.caption, color: c.textSecondary, marginTop: 3 },

    filterRow:  { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    monthScroll:{ marginBottom: 10 },
    monthRow:   { gap: 8, paddingRight: 4 },

    chip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    chipSm:    { paddingHorizontal: 12, paddingVertical: 5 },
    chipOn:    { backgroundColor: c.accent + '18', borderColor: c.accent + '60' },
    chipTxt:   { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    chipTxtOn: { color: c.accent },

    resultCount: { ...Typography.caption, color: c.textSecondary, marginBottom: 12 },

    list: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, borderBottomWidth: 1, borderBottomColor: c.border + '70',
    },
    dateCol:    { alignItems: 'center', minWidth: 40 },
    dateDay:    { fontSize: 13, fontWeight: '700', color: c.textPrimary },
    dateYear:   { fontSize: 10, color: c.textSecondary, marginTop: 1 },
    info:       { flex: 1 },
    clientName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    meta:       { ...Typography.caption, color: c.textSecondary },
    statusPill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 0 },
    statusTxt:  { fontSize: 10, fontWeight: '700' },

    empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTxt: { ...Typography.body, color: c.textSecondary },
  });
}
