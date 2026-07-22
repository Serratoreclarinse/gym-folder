import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import { Typography, ColorScheme } from '@/constants/theme';

type Exercise = {
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight: string | null;
  duration: string | null;
  notes: string | null;
};

type Session = {
  id: string;
  sessionDate: string;
  durationMinutes: number;
  sessionType: string;
  notes: string | null;
  status: string | null;
  exercises: Exercise[];
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

export default function AdminClientSessionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [monthFilter, setMonthFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from('workout_sessions')
      .select('id, session_date, duration_minutes, session_type, notes, status, exercises')
      .eq('client_id', id)
      .order('session_date', { ascending: false })
      .limit(500);

    setSessions(
      (data ?? []).map((row: any) => ({
        id: row.id,
        sessionDate: row.session_date,
        durationMinutes: row.duration_minutes,
        sessionType: row.session_type ?? 'gym',
        notes: row.notes ?? null,
        status: row.status ?? null,
        exercises: Array.isArray(row.exercises)
          ? row.exercises
          : typeof row.exercises === 'string'
            ? (() => { try { return JSON.parse(row.exercises); } catch { return []; } })()
            : [],
      })),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => {
    const seen = new Set<string>();
    const result = ['All'];
    sessions.forEach((sess) => {
      const d = new Date(sess.sessionDate + 'T00:00:00');
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
        if (statusFilter === 'Absent'    && st !== 'absent' && st !== 'no_show')     return false;
        if (statusFilter === 'Pending'   && st !== 'pending')                        return false;
      }
      if (monthFilter !== 'All') {
        const d = new Date(sess.sessionDate + 'T00:00:00');
        const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (key !== monthFilter) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, monthFilter]);

  const exportCSV = () => {
    if (!Platform.OS === 'web' || sessions.length === 0) return;
    const header = 'Date,Duration,Type,Status,Exercises,Notes';
    const rows = sessions.map((s) => [
      s.sessionDate,
      `${s.durationMinutes} min`,
      s.sessionType,
      s.status ?? '',
      s.exercises.map((e) => e.exercise_name).join(' | '),
      (s.notes ?? '').replace(/,/g, ';'),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sessions-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {/* Summary strip */}
      <View style={s.summaryRow}>
        <View style={s.summaryBox}>
          <Text style={[s.summaryNum, { color: colors.accent }]}>{sessions.length}</Text>
          <Text style={s.summaryLbl}>Total</Text>
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

      {/* Filters row */}
      <View style={s.filtersHeader}>
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
        {Platform.OS === 'web' && sessions.length > 0 && (
          <Pressable style={s.exportBtn} onPress={exportCSV}>
            <Ionicons name="download-outline" size={14} color={colors.accent} />
            <Text style={s.exportTxt}>Export CSV</Text>
          </Pressable>
        )}
      </View>

      {months.length > 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.monthScroll} contentContainerStyle={s.monthRow}>
          {months.map((m) => (
            <Pressable key={m} style={[s.chip, s.chipSm, monthFilter === m && s.chipOn]} onPress={() => setMonthFilter(m)}>
              <Text style={[s.chipTxt, monthFilter === m && s.chipTxtOn]}>{m}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

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
            const expanded = expandedId === sess.id;
            const d = new Date(sess.sessionDate + 'T00:00:00');
            const statusColor = STATUS_COLOR[sess.status ?? ''] ?? colors.textSecondary;
            return (
              <Pressable
                key={sess.id}
                style={[s.row, i === filtered.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => setExpandedId(expanded ? null : sess.id)}
              >
                <View style={s.dateCol}>
                  <Text style={s.dateDay}>{d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</Text>
                  <Text style={s.dateYear}>{d.getFullYear()}</Text>
                </View>
                <View style={s.info}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <Text style={s.dur}>{sess.durationMinutes} min</Text>
                    <Ionicons
                      name={sess.sessionType === 'home' ? 'home-outline' : 'barbell-outline'}
                      size={11} color={colors.textSecondary}
                    />
                    {sess.status && (
                      <View style={[s.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor + '60' }]}>
                        <Text style={[s.statusTxt, { color: statusColor }]}>{STATUS_LABEL[sess.status] ?? sess.status}</Text>
                      </View>
                    )}
                  </View>
                  {!expanded && sess.exercises.length > 0 && (
                    <Text style={s.exPreview} numberOfLines={1}>
                      {sess.exercises.map((e) => e.exercise_name).join(', ')}
                    </Text>
                  )}
                  {expanded && (
                    <View style={{ marginTop: 8, gap: 4 }}>
                      {sess.exercises.length > 0 ? sess.exercises.map((ex, ei) => (
                        <View key={ei}>
                          <Text style={s.exName}>{ex.exercise_name}</Text>
                          <Text style={s.exMeta}>
                            {[ex.sets ? `${ex.sets} sets` : null, ex.reps ? `${ex.reps} reps` : null, ex.weight ?? null, ex.duration ?? null].filter(Boolean).join('  ·  ')}
                          </Text>
                        </View>
                      )) : <Text style={s.exMeta}>No exercises logged</Text>}
                      {sess.notes ? <Text style={[s.exMeta, { marginTop: 4, fontStyle: 'italic' }]}>{sess.notes}</Text> : null}
                    </View>
                  )}
                </View>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={14} color={colors.border}
                  style={{ flexShrink: 0 }}
                />
              </Pressable>
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

    filtersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
    filterRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
    monthScroll:   { marginBottom: 10 },
    monthRow:      { gap: 8, paddingRight: 4 },

    chip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    chipSm:    { paddingHorizontal: 12, paddingVertical: 5 },
    chipOn:    { backgroundColor: c.accent + '18', borderColor: c.accent + '60' },
    chipTxt:   { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    chipTxtOn: { color: c.accent },

    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: c.accent + '50', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: c.accent + '10' },
    exportTxt: { ...Typography.caption, color: c.accent, fontWeight: '700' },

    resultCount: { ...Typography.caption, color: c.textSecondary, marginBottom: 12 },

    list:      { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: c.border + '70' },
    dateCol:   { alignItems: 'center', minWidth: 40 },
    dateDay:   { fontSize: 13, fontWeight: '700', color: c.textPrimary },
    dateYear:  { fontSize: 10, color: c.textSecondary, marginTop: 1 },
    info:      { flex: 1 },
    dur:       { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    statusPill:{ borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 0 },
    statusTxt: { fontSize: 10, fontWeight: '700' },
    exPreview: { ...Typography.caption, color: c.textSecondary, marginTop: 2 },
    exName:    { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    exMeta:    { ...Typography.caption, color: c.textSecondary },

    empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTxt: { ...Typography.body, color: c.textSecondary },
  });
}
