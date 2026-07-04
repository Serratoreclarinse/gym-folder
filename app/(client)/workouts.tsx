import { Alert, Modal, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useClientData, type ClientSession } from '@/hooks/useClientData';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
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
function SessionCard({ session, showRateBadge, onRate, ratingExpired }: {
  session: ClientSession;
  showRateBadge?: boolean;
  onRate?: () => void;
  ratingExpired?: boolean;
}) {
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

      {showRateBadge && onRate && !isNoShow && (
        <Pressable style={styles.ratePromptBtn} onPress={onRate}>
          <Ionicons name="star-outline" size={14} color="#FFD700" />
          <Text style={styles.ratePromptText}>Rate this session</Text>
        </Pressable>
      )}
      {ratingExpired && !isNoShow && (
        <View style={styles.rateExpiredRow}>
          <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.rateExpiredText}>Rating window closed (48 hrs)</Text>
        </View>
      )}
    </View>
  );
}

// ─── Group sessions by month, newest month first ─────────────
function groupByMonth(sessions: ClientSession[]): { label: string; key: string; items: ClientSession[] }[] {
  const map = new Map<string, ClientSession[]>();
  for (const s of sessions) {
    const d = new Date(s.session_date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({
      key,
      label: new Date(key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      items,
    }));
}

// ─── Screen ──────────────────────────────────────────────────
export default function ClientWorkoutsScreen() {
  const { user } = useAuth();
  const { sessions, loading, error, refetch } = useClientData();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // ── Session rating ───────────────────────────────────────────
  const [unratedSession, setUnratedSession] = useState<ClientSession | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  const [ratingExpiredSession, setRatingExpiredSession] = useState<ClientSession | null>(null);

  useEffect(() => {
    if (sessions.length === 0) return;
    const recent = sessions[0];
    if (recent.status === 'absent') return;
    const sessionDate = new Date(recent.session_date + 'T00:00:00');
    const diffHours = (Date.now() - sessionDate.getTime()) / 3600000;
    if (diffHours > 48 && diffHours <= 7 * 24) {
      // Recently passed — show "window closed" hint
      supabase
        .from('session_ratings')
        .select('id')
        .eq('session_id', recent.id)
        .maybeSingle()
        .then(({ data }) => { if (!data) setRatingExpiredSession(recent); });
      return;
    }
    if (diffHours > 48) return;
    supabase
      .from('session_ratings')
      .select('id')
      .eq('session_id', recent.id)
      .maybeSingle()
      .then(({ data }) => { if (!data) setUnratedSession(recent); });
  }, [sessions]);

  const handleSubmitRating = async () => {
    if (!unratedSession || selectedRating === 0 || !user?.id) return;
    setSubmittingRating(true);
    const { error: rErr } = await supabase.from('session_ratings').insert({
      session_id: unratedSession.id,
      client_id: user.id,
      coach_id: unratedSession.coach_id,
      rating: selectedRating,
    });
    setSubmittingRating(false);
    if (rErr) { Alert.alert('Error', 'Could not save rating. Please try again.'); return; }
    setShowRatingModal(false);
    setUnratedSession(null);
    setSelectedRating(0);
  };

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
          {items.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              showRateBadge={unratedSession?.id === s.id}
              onRate={() => { setSelectedRating(0); setShowRatingModal(true); }}
              ratingExpired={ratingExpiredSession?.id === s.id}
            />
          ))}
        </View>
      ))}

      {/* Rating modal */}
      <Modal visible={showRatingModal} transparent animationType="fade">
        <View style={styles.ratingBg}>
          <View style={styles.ratingCard}>
            <Ionicons name="star" size={32} color="#FFD700" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.ratingTitle}>How was your session?</Text>
            <Text style={styles.ratingSub}>Your rating helps your coach improve</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setSelectedRating(star)} hitSlop={8}>
                  <Ionicons
                    name={star <= selectedRating ? 'star' : 'star-outline'}
                    size={44}
                    color={star <= selectedRating ? '#FFD700' : Colors.border}
                  />
                </Pressable>
              ))}
            </View>

            <View style={styles.ratingBtns}>
              <Pressable
                style={styles.ratingSkipBtn}
                onPress={() => { setShowRatingModal(false); setSelectedRating(0); }}
              >
                <Text style={styles.ratingSkipText}>Maybe Later</Text>
              </Pressable>
              <Pressable
                style={[styles.ratingSubmitBtn, (selectedRating === 0 || submittingRating) && { opacity: 0.4 }]}
                onPress={handleSubmitRating}
                disabled={selectedRating === 0 || submittingRating}
              >
                <Text style={styles.ratingSubmitText}>{submittingRating ? 'Saving…' : 'Submit'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryChip: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  summaryNum:   { ...Typography.subtitle, color: Colors.accent, marginBottom: 2 },
  summaryLabel: { ...Typography.label, color: Colors.textSecondary, fontSize: 10, textAlign: 'center' },

  filterRow: { marginBottom: 20 },
  filterContent: { gap: 8, paddingRight: 4 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.bg },

  monthHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12, marginTop: 4,
  },
  monthLabel: { ...Typography.label, color: Colors.textSecondary },
  monthCount: { ...Typography.caption, color: Colors.textSecondary },

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

  notesBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.bg, borderRadius: 10, padding: 10,
    marginTop: 12, borderWidth: 1, borderColor: Colors.border,
  },
  notesText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Rate prompt button (on session card)
  ratePromptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
    justifyContent: 'center',
  },
  ratePromptText: { color: '#FFD700', fontWeight: '700', fontSize: 13 },
  rateExpiredRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border,
    justifyContent: 'center',
  },
  rateExpiredText: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },

  // Rating modal
  ratingBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  ratingCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: 24,
    padding: 28, borderWidth: 1, borderColor: Colors.border,
  },
  ratingTitle: { ...Typography.subtitle, color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  ratingSub:   { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 28 },
  ratingBtns: { flexDirection: 'row', gap: 10 },
  ratingSkipBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  ratingSkipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  ratingSubmitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#FFD700',
  },
  ratingSubmitText: { color: '#000', fontSize: 14, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub:   { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
});
