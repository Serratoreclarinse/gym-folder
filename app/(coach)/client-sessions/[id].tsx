import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
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
  session_date: string;
  duration_minutes: number;
  session_type: string;
  notes: string | null;
  status: string;
  exercises: Exercise[];
  rating: number | null;
};

const STATUS_FILTERS = ['All', 'Completed', 'Absent', 'Pending'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#4CAF50', completed: '#4CAF50',
  pending: '#FF9800', absent: '#FF4D4D', no_show: '#FF4D4D',
};
const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Done', completed: 'Completed',
  pending: 'Pending', absent: 'Absent', no_show: 'No Show',
};

export default function CoachClientSessionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [monthFilter, setMonthFilter] = useState('All');

  const load = useCallback(async () => {
    if (!id || !profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('workout_sessions')
      .select(`
        id, session_date, duration_minutes, session_type, notes, status, exercises,
        session_ratings (rating)
      `)
      .eq('coach_id', profile.id)
      .eq('client_id', id)
      .order('session_date', { ascending: false })
      .limit(500);

    setSessions(
      (data ?? []).map((row: any) => ({
        id: row.id,
        session_date: row.session_date,
        duration_minutes: row.duration_minutes,
        session_type: row.session_type ?? 'gym',
        notes: row.notes ?? null,
        status: row.status ?? 'confirmed',
        exercises: Array.isArray(row.exercises) ? row.exercises : [],
        rating: (row.session_ratings as { rating: number }[] | null)?.[0]?.rating ?? null,
      })),
    );
    setLoading(false);
  }, [id, profile?.id]);

  useEffect(() => { load(); }, [load]);

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
        const st = sess.status;
        if (statusFilter === 'Completed' && st !== 'completed' && st !== 'confirmed') return false;
        if (statusFilter === 'Absent'    && st !== 'absent' && st !== 'no_show')     return false;
        if (statusFilter === 'Pending'   && st !== 'pending')                        return false;
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
          <Text style={[s.summaryNum, { color: colors.warning }]}>
            {(() => {
              const rated = sessions.filter((s) => s.rating != null);
              if (rated.length === 0) return '—';
              const avg = rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length;
              return avg.toFixed(1) + ' ★';
            })()}
          </Text>
          <Text style={s.summaryLbl}>Avg Rating</Text>
        </View>
      </View>

      {/* Status filter */}
      <View style={s.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable key={f} style={[s.chip, statusFilter === f && s.chipOn]} onPress={() => setStatusFilter(f)}>
            <Text style={[s.chipTxt, statusFilter === f && s.chipTxtOn]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {/* Month filter */}
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
        filtered.map((sess) => {
          const d = new Date(sess.session_date + 'T00:00:00');
          const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
          const statusColor = STATUS_COLOR[sess.status] ?? colors.textSecondary;
          return (
            <View key={sess.id} style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.cardDate}>{dateStr}</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <View style={[s.typeChip, sess.session_type === 'home' && s.typeChipHome]}>
                    <Ionicons
                      name={sess.session_type === 'home' ? 'home-outline' : 'barbell-outline'}
                      size={11}
                      color={sess.session_type === 'home' ? '#2196F3' : colors.accent}
                    />
                    <Text style={[s.typeChipTxt, sess.session_type === 'home' && { color: '#2196F3' }]}>
                      {sess.session_type === 'home' ? 'Home' : 'Gym'}
                    </Text>
                  </View>
                  <View style={s.durChip}>
                    <Ionicons name="time-outline" size={12} color={colors.accent} />
                    <Text style={s.durChipTxt}>{sess.duration_minutes} min</Text>
                  </View>
                  {sess.status && (
                    <View style={[s.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor + '60' }]}>
                      <Text style={[s.statusTxt, { color: statusColor }]}>{STATUS_LABEL[sess.status] ?? sess.status}</Text>
                    </View>
                  )}
                </View>
              </View>

              {sess.exercises.map((ex, i) => (
                <View key={i} style={s.exRow}>
                  <View style={s.exBullet} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.exName}>{ex.exercise_name}</Text>
                    <Text style={s.exMeta}>
                      {[
                        ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : null,
                        ex.weight ?? null,
                        ex.notes ?? null,
                      ].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                </View>
              ))}

              {sess.notes ? <Text style={s.sessionNotes}>{sess.notes}</Text> : null}

              {sess.rating != null && (
                <View style={s.ratingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= sess.rating! ? 'star' : 'star-outline'}
                      size={14}
                      color={star <= sess.rating! ? '#FFD700' : colors.border}
                    />
                  ))}
                  <Text style={s.ratingLbl}>Client rating</Text>
                </View>
              )}
            </View>
          );
        })
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

    filterRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
    monthScroll: { marginBottom: 10 },
    monthRow:    { gap: 8, paddingRight: 4 },
    chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    chipSm:      { paddingHorizontal: 12, paddingVertical: 5 },
    chipOn:      { backgroundColor: c.accent + '18', borderColor: c.accent + '60' },
    chipTxt:     { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    chipTxtOn:   { color: c.accent },

    resultCount: { ...Typography.caption, color: c.textSecondary, marginBottom: 12 },

    card: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8, flexWrap: 'wrap' },
    cardDate: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },

    typeChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accent + '15', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    typeChipHome: { backgroundColor: '#2196F315' },
    typeChipTxt:  { fontSize: 11, fontWeight: '600', color: c.accent },
    durChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accent + '15', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    durChipTxt:   { fontSize: 11, fontWeight: '600', color: c.accent },
    statusPill:   { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
    statusTxt:    { fontSize: 10, fontWeight: '700' },

    exRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5, borderTopWidth: 1, borderTopColor: c.border + '50' },
    exBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 5, flexShrink: 0 },
    exName:   { ...Typography.body, color: c.textPrimary, fontWeight: '500' },
    exMeta:   { ...Typography.caption, color: c.textSecondary },

    sessionNotes: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic', marginTop: 8, borderTopWidth: 1, borderTopColor: c.border + '50', paddingTop: 8 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: c.border + '50', paddingTop: 8 },
    ratingLbl: { ...Typography.caption, color: c.textSecondary, marginLeft: 4 },

    empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTxt: { ...Typography.body, color: c.textSecondary },
  });
}
