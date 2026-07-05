import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type RankRow = {
  coachId: string;
  name: string;
  total: number;
  count: number;
  rank: number;
};

type Period = 'month' | 'alltime';

const MEDAL = ['🥇', '🥈', '🥉'];

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function fmt(n: number) {
  return `OMR ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

export default function AdminRankingsScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [period, setPeriod] = useState<Period>('month');
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const [paymentsRes, coachRes] = await Promise.all([
      p === 'month'
        ? supabase.from('payments').select('coach_id, amount').gte('paid_at', monthStart())
        : supabase.from('payments').select('coach_id, amount'),
      supabase.from('profiles').select('id, name').eq('role', 'coach').is('deactivated_at', null),
    ]);

    const nameMap = new Map<string, string>();
    for (const c of coachRes.data ?? []) nameMap.set(c.id, c.name);

    const totals = new Map<string, { total: number; count: number }>();
    for (const pay of paymentsRes.data ?? []) {
      const existing = totals.get(pay.coach_id) ?? { total: 0, count: 0 };
      totals.set(pay.coach_id, { total: existing.total + Number(pay.amount), count: existing.count + 1 });
    }

    const ranked: RankRow[] = [...totals.entries()]
      .map(([coachId, { total, count }]) => ({
        coachId, total, count, rank: 0,
        name: nameMap.get(coachId) ?? 'Unknown Coach',
      }))
      .sort((a, b) => b.total - a.total)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    setRows(ranked);
    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  const switchPeriod = (p: Period) => { if (p !== period) { setPeriod(p); } };

  return (
    <View style={s.root}>
      {/* Period tabs */}
      <View style={[s.toolbar, isDesktop && s.toolbarDesktop]}>
        <View style={[s.toolbarInner, isDesktop && s.toolbarInnerDesktop]}>
          <View style={s.segmented}>
            <Pressable style={[s.seg, period === 'month' && s.segActive]} onPress={() => switchPeriod('month')}>
              <Text style={[s.segText, period === 'month' && s.segTextActive]}>This Month</Text>
            </Pressable>
            <Pressable style={[s.seg, period === 'alltime' && s.segActive]} onPress={() => switchPeriod('alltime')}>
              <Text style={[s.segText, period === 'alltime' && s.segTextActive]}>All-Time</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(period)} tintColor={Colors.accent} />}
        >
          <View style={[s.inner, isDesktop && s.innerDesktop]}>
            {rows.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="podium-outline" size={52} color={Colors.border} />
                <Text style={s.emptyTitle}>No sales data yet</Text>
                <Text style={s.emptySub}>Rankings will appear once coaches record payments</Text>
              </View>
            ) : (
              <>
                {/* Top 3 podium cards */}
                {rows.length >= 1 && (
                  <View style={[s.podium, isDesktop && s.podiumDesktop]}>
                    {rows.slice(0, Math.min(3, rows.length)).map((r) => (
                      <View key={r.coachId} style={[s.podiumCard, r.rank === 1 && s.podiumFirst]}>
                        <Text style={s.podiumMedal}>{MEDAL[r.rank - 1]}</Text>
                        <Text style={s.podiumName} numberOfLines={1}>{r.name}</Text>
                        <Text style={[s.podiumTotal, r.rank === 1 && { color: Colors.accent }]}>{fmt(r.total)}</Text>
                        <Text style={s.podiumCount}>{r.count} payment{r.count !== 1 ? 's' : ''}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Full table */}
                <View style={s.card}>
                  <View style={[s.tableHeader]}>
                    <Text style={[s.th, { width: 36 }]}>#</Text>
                    <Text style={[s.th, { flex: 1 }]}>COACH</Text>
                    <Text style={[s.th, { width: 110, textAlign: 'right' }]}>REVENUE</Text>
                    <Text style={[s.th, { width: 70, textAlign: 'right' }]}>SALES</Text>
                  </View>
                  {rows.map((r, i) => (
                    <View key={r.coachId} style={[s.row, i % 2 === 1 && s.rowAlt, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[s.rankCell, { width: 36 }]}>
                        {r.rank <= 3
                          ? <Text style={s.rankMedal}>{MEDAL[r.rank - 1]}</Text>
                          : <Text style={s.rankNum}>{r.rank}</Text>
                        }
                      </View>
                      <View style={[s.nameCell, { flex: 1 }]}>
                        <View style={s.avatar}>
                          <Text style={s.avatarText}>{r.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</Text>
                        </View>
                        <Text style={s.nameText} numberOfLines={1}>{r.name}</Text>
                      </View>
                      <Text style={[s.revenueText, { width: 110, textAlign: 'right' }]}>{fmt(r.total)}</Text>
                      <Text style={[s.countText, { width: 70, textAlign: 'right' }]}>{r.count}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  toolbar: { borderBottomWidth: 1, borderBottomColor: Colors.border, padding: 12 },
  toolbarDesktop: { padding: 20, paddingBottom: 16 },
  toolbarInner: { flexDirection: 'row' },
  toolbarInnerDesktop: { maxWidth: 960, alignSelf: 'center', width: '100%' },

  segmented: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 3, gap: 2,
  },
  seg: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  segActive: { backgroundColor: Colors.accent },
  segText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  segTextActive: { color: Colors.bg },

  content: { padding: 16, paddingBottom: 48 },
  contentDesktop: { padding: 32 },
  inner: { gap: 16 },
  innerDesktop: { maxWidth: 760, alignSelf: 'center', width: '100%' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },

  podium: { flexDirection: 'row', gap: 10 },
  podiumDesktop: { gap: 14 },
  podiumCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, alignItems: 'center', gap: 4,
  },
  podiumFirst: { borderColor: Colors.accent + '60', backgroundColor: Colors.accent + '08' },
  podiumMedal: { fontSize: 24 },
  podiumName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  podiumTotal: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary },
  podiumCount: { fontSize: 11, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  th: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.8 },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border + '80',
  },
  rowAlt: { backgroundColor: Colors.bg + '50' },
  rankCell: { alignItems: 'center', justifyContent: 'center' },
  rankMedal: { fontSize: 18 },
  rankNum: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.accent + '18', borderWidth: 1, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 10, fontWeight: '800', color: Colors.accent },
  nameText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  revenueText: { fontSize: 13, fontWeight: '700', color: Colors.accent },
  countText: { fontSize: 13, color: Colors.textSecondary },
});
