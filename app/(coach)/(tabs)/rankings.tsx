import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type RankRow = {
  coachId: string;
  total: number;
  count: number;
  rank: number;
  isMe: boolean;
};

type Period = 'month' | 'alltime';

const MEDAL = ['🥇', '🥈', '🥉'];

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function fmtOMR(n: number) {
  return `OMR ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

export default function CoachRankingsScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const myId = profile?.id ?? '';

  const [period, setPeriod] = useState<Period>('month');
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const q = p === 'month'
      ? supabase.from('payments').select('coach_id, amount').gte('paid_at', monthStart())
      : supabase.from('payments').select('coach_id, amount');
    const { data: payments } = await q;

    const totals = new Map<string, { total: number; count: number }>();
    for (const pay of payments ?? []) {
      const existing = totals.get(pay.coach_id) ?? { total: 0, count: 0 };
      totals.set(pay.coach_id, { total: existing.total + Number(pay.amount), count: existing.count + 1 });
    }

    const ranked: RankRow[] = [...totals.entries()]
      .map(([coachId, { total, count }]) => ({ coachId, total, count, rank: 0, isMe: coachId === myId }))
      .sort((a, b) => b.total - a.total)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    setRows(ranked);
    setLoading(false);
  }, [myId]);

  useEffect(() => { load(period); }, [load, period]);

  const me = rows.find((r) => r.isMe);

  return (
    <View style={s.root}>
      {/* Period tabs */}
      <View style={s.toolbar}>
        <View style={s.segmented}>
          <Pressable style={[s.seg, period === 'month' && s.segActive]} onPress={() => { if (period !== 'month') setPeriod('month'); }}>
            <Text style={[s.segText, period === 'month' && s.segTextActive]}>This Month</Text>
          </Pressable>
          <Pressable style={[s.seg, period === 'alltime' && s.segActive]} onPress={() => { if (period !== 'alltime') setPeriod('alltime'); }}>
            <Text style={[s.segText, period === 'alltime' && s.segTextActive]}>All-Time</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(period)} tintColor={colors.accent} />}
        >
          {/* My rank banner */}
          {me ? (
            <View style={s.myBanner}>
              <View style={s.myBannerLeft}>
                <Text style={s.myBannerLabel}>{period === 'month' ? 'Your rank this month' : 'Your all-time rank'}</Text>
                <Text style={s.myBannerRank}>
                  {me.rank <= 3 ? MEDAL[me.rank - 1] + ' ' : ''}#{me.rank} of {rows.length}
                </Text>
              </View>
              <View style={s.myBannerRight}>
                <Text style={s.myBannerRevLabel}>Your revenue</Text>
                <Text style={s.myBannerRev}>{fmtOMR(me.total)}</Text>
                <Text style={s.myBannerCount}>{me.count} payment{me.count !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          ) : (
            <View style={s.unranked}>
              <Ionicons name="podium-outline" size={32} color={colors.textSecondary} />
              <Text style={s.unrankedText}>
                {period === 'month' ? 'No sales recorded this month yet.' : 'No sales recorded yet.'}
              </Text>
            </View>
          )}

          {/* Leaderboard */}
          {rows.length > 0 && (
            <View style={s.card}>
              <View style={s.hint}>
                <Ionicons name="eye-off-outline" size={13} color={colors.textSecondary} />
                <Text style={s.hintText}>Other coaches' details are private</Text>
              </View>
              {rows.map((r, i) => (
                <View
                  key={r.coachId}
                  style={[
                    s.row,
                    r.isMe && s.rowMe,
                    i === rows.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  {/* Rank */}
                  <View style={s.rankCell}>
                    {r.rank <= 3
                      ? <Text style={s.rankMedal}>{MEDAL[r.rank - 1]}</Text>
                      : <Text style={s.rankNum}>{r.rank}</Text>
                    }
                  </View>

                  {/* Name / avatar */}
                  {r.isMe ? (
                    <View style={s.nameCell}>
                      <View style={[s.avatar, s.avatarMe]}>
                        <Text style={[s.avatarText, { color: colors.accent }]}>
                          {(profile?.name ?? 'ME').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                        </Text>
                      </View>
                      <View>
                        <Text style={s.myName}>{profile?.name ?? 'You'}</Text>
                        <Text style={s.youBadge}>You</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={s.nameCell}>
                      <View style={s.avatar}>
                        <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                      </View>
                      <Text style={s.maskedName}>Coach #{r.rank}</Text>
                    </View>
                  )}

                  {/* Revenue — only shown for self */}
                  <View style={s.revenueCell}>
                    {r.isMe ? (
                      <>
                        <Text style={s.myRevenue}>{fmtOMR(r.total)}</Text>
                        <Text style={s.myCount}>{r.count} sale{r.count !== 1 ? 's' : ''}</Text>
                      </>
                    ) : (
                      <Text style={s.hidden}>———</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    toolbar: { borderBottomWidth: 1, borderBottomColor: c.border, padding: 12, alignItems: 'flex-start' },
    segmented: {
      flexDirection: 'row', backgroundColor: c.surface,
      borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 3, gap: 2,
    },
    seg: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
    segActive: { backgroundColor: c.accent },
    segText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    segTextActive: { color: c.bg },

    content: { padding: 14, paddingBottom: 48, gap: 14 },

    myBanner: {
      backgroundColor: c.accent + '10', borderRadius: 16,
      borderWidth: 1.5, borderColor: c.accent + '40',
      padding: 16, flexDirection: 'row', alignItems: 'center',
    },
    myBannerLeft: { flex: 1, gap: 4 },
    myBannerLabel: { fontSize: 12, color: c.accent, fontWeight: '600' },
    myBannerRank: { fontSize: 28, fontWeight: '800', color: c.textPrimary },
    myBannerRight: { alignItems: 'flex-end', gap: 2 },
    myBannerRevLabel: { fontSize: 11, color: c.textSecondary },
    myBannerRev: { fontSize: 15, fontWeight: '800', color: c.accent },
    myBannerCount: { fontSize: 11, color: c.textSecondary },

    unranked: {
      alignItems: 'center', gap: 10, paddingVertical: 32,
      backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 1, borderColor: c.border,
    },
    unrankedText: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },

    card: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    },
    hint: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      padding: 10, borderBottomWidth: 1, borderBottomColor: c.border,
      backgroundColor: c.bg,
    },
    hintText: { fontSize: 11, color: c.textSecondary },

    row: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
      paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.border + '80',
      gap: 10,
    },
    rowMe: { backgroundColor: c.accent + '08' },

    rankCell: { width: 32, alignItems: 'center' },
    rankMedal: { fontSize: 20 },
    rankNum: { fontSize: 14, fontWeight: '700', color: c.textSecondary },

    nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.border + '40',
      justifyContent: 'center', alignItems: 'center',
    },
    avatarMe: { backgroundColor: c.accent + '18', borderWidth: 1, borderColor: c.accent + '40' },
    avatarText: { fontSize: 11, fontWeight: '800' },
    myName: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
    youBadge: { fontSize: 10, color: c.accent, fontWeight: '700' },
    maskedName: { fontSize: 14, color: c.textSecondary, fontStyle: 'italic' },

    revenueCell: { alignItems: 'flex-end', minWidth: 90 },
    myRevenue: { fontSize: 13, fontWeight: '700', color: c.accent },
    myCount: { fontSize: 11, color: c.textSecondary },
    hidden: { fontSize: 14, color: c.border, letterSpacing: 2 },
  });
}
