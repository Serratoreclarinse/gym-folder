import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type HistorySession = {
  id: string;
  client_id: string;
  client_name: string;
  session_date: string;
  scheduled_time: string | null;
  duration_minutes: number;
  session_type: 'gym' | 'home';
  status: string;
  notes: string | null;
  rating: number | null;
  exercises: Array<{
    exercise_name: string;
    sets: number | null;
    reps: number | null;
    weight: string | null;
    duration: string | null;
    notes: string | null;
  }>;
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#4CAF50',
  pending:   '#FF9800',
  absent:    '#FF4D4D',
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Done',
  pending:   'Pending',
  absent:    'Absent',
};

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function SessionHistoryScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('workout_sessions')
      .select(`
        id, client_id, session_date, scheduled_time,
        duration_minutes, session_type, status, notes, exercises,
        client:profiles!workout_sessions_client_id_fkey(name),
        session_ratings(rating)
      `)
      .eq('coach_id', profile.id)
      .order('session_date', { ascending: false })
      .limit(200);

    setSessions(
      (data ?? []).map((row: any) => ({
        id: row.id,
        client_id: row.client_id,
        client_name: row.client?.name ?? 'Unknown',
        session_date: row.session_date,
        scheduled_time: row.scheduled_time ?? null,
        duration_minutes: row.duration_minutes,
        session_type: row.session_type ?? 'gym',
        status: row.status ?? 'confirmed',
        notes: row.notes ?? null,
        rating: Array.isArray(row.session_ratings) && row.session_ratings.length > 0 ? row.session_ratings[0].rating : null,
        exercises: Array.isArray(row.exercises) ? row.exercises : (typeof row.exercises === 'string' ? (() => { try { return JSON.parse(row.exercises); } catch { return []; } })() : []),
      })),
    );
    setLoading(false);
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => s.client_name.toLowerCase().includes(q));
  }, [sessions, search]);

  function handleRestore(session: HistorySession) {
    router.push({
      pathname: '/(coach)/log-session',
      params: {
        clientId: session.client_id,
        duration: String(session.duration_minutes),
        sessionType: session.session_type,
        exercises: JSON.stringify(session.exercises),
      },
    });
  }

  return (
    <View style={s.container}>
      {/* Search bar */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.textSecondary} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by client name…"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="time-outline" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>{search ? 'No results' : 'No sessions yet'}</Text>
              <Text style={s.emptySub}>{search ? 'Try a different name' : 'Log your first session to see history'}</Text>
            </View>
          ) : (
            filtered.map((session) => {
              const expanded = expandedId === session.id;
              const statusColor = STATUS_COLOR[session.status] ?? colors.textSecondary;

              return (
                <Pressable
                  key={session.id}
                  style={s.card}
                  onPress={() => setExpandedId(expanded ? null : session.id)}
                >
                  {/* Top row */}
                  <View style={s.cardTop}>
                    <View style={s.cardLeft}>
                      <Text style={s.clientName}>{session.client_name}</Text>
                      <Text style={s.dateLine}>{fmtDate(session.session_date)}</Text>
                      <View style={s.metaRow}>
                        <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
                        <Text style={s.metaText}>{session.duration_minutes} min</Text>
                        <Text style={s.dot}>·</Text>
                        <Ionicons
                          name={session.session_type === 'home' ? 'home-outline' : 'barbell-outline'}
                          size={11}
                          color={colors.textSecondary}
                        />
                        <Text style={s.metaText}>{session.session_type === 'home' ? 'Home' : 'Gym'}</Text>
                      </View>
                    </View>
                    <View style={s.cardRight}>
                      <View style={[s.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor + '60' }]}>
                        <Text style={[s.statusText, { color: statusColor }]}>
                          {STATUS_LABEL[session.status] ?? session.status}
                        </Text>
                      </View>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.textSecondary}
                        style={{ marginTop: 8 }}
                      />
                    </View>
                  </View>

                  {/* Exercise summary (collapsed) */}
                  {!expanded && session.exercises.length > 0 && (
                    <Text style={s.exerciseSummary} numberOfLines={1}>
                      {session.exercises.map((e) => e.exercise_name).join(', ')}
                    </Text>
                  )}

                  {/* Expanded detail */}
                  {expanded && (
                    <View style={s.detail}>
                      {session.exercises.length > 0 ? (
                        session.exercises.map((ex, i) => (
                          <View key={i} style={s.exRow}>
                            <Text style={s.exName}>{ex.exercise_name}</Text>
                            <Text style={s.exMeta}>
                              {[
                                ex.sets ? `${ex.sets} sets` : null,
                                ex.reps ? `${ex.reps} reps` : null,
                                ex.weight ? `@ ${ex.weight}` : null,
                                ex.duration ? ex.duration : null,
                              ].filter(Boolean).join('  ·  ')}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={s.noEx}>No exercises recorded</Text>
                      )}

                      {session.notes ? (
                        <Text style={s.sessionNotes}>"{session.notes}"</Text>
                      ) : null}

                      {session.rating != null && (
                        <View style={s.ratingRow}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Ionicons key={i} name={i < session.rating! ? 'star' : 'star-outline'} size={14} color={i < session.rating! ? '#FFD700' : colors.border} />
                          ))}
                          <Text style={s.ratingText}>Client rated {session.rating}/5</Text>
                        </View>
                      )}

                      <Pressable style={s.restoreBtn} onPress={() => handleRestore(session)}>
                        <Ionicons name="refresh-outline" size={15} color={colors.bg} />
                        <Text style={s.restoreBtnText}>RESTORE AS NEW SESSION</Text>
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: 20, marginTop: 12, marginBottom: 8,
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, ...Typography.body, color: c.textPrimary },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },

    empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary },
    emptySub: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },

    card: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      padding: 14, marginBottom: 10,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardLeft: { flex: 1 },
    cardRight: { alignItems: 'flex-end' },

    clientName: { ...Typography.body, color: c.textPrimary, fontWeight: '700', marginBottom: 2 },
    dateLine: { ...Typography.caption, color: c.textSecondary, marginBottom: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { ...Typography.caption, color: c.textSecondary },
    dot: { color: c.border, fontSize: 10 },

    statusPill: {
      borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1,
    },
    statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

    exerciseSummary: {
      ...Typography.caption, color: c.textSecondary,
      marginTop: 8, fontStyle: 'italic',
    },

    detail: {
      marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, gap: 6,
    },
    exRow: { gap: 1 },
    exName: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    exMeta: { ...Typography.caption, color: c.textSecondary },
    noEx: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic' },
    sessionNotes: {
      ...Typography.caption, color: c.textSecondary,
      fontStyle: 'italic', marginTop: 4,
    },

    ratingRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
    },
    ratingText: { ...Typography.caption, color: c.textSecondary, marginLeft: 4 },

    restoreBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.accent, borderRadius: 10,
      paddingVertical: 11, marginTop: 12,
    },
    restoreBtnText: { color: c.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  });
}
