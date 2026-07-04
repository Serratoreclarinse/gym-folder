import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type Stats = {
  coachCount: number;
  clientCount: number;
  activePackages: number;
  sessionsThisMonth: number;
  revenueThisMonth: number;
  revenueAllTime: number;
};

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

export default function AdminDashboardScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const ms = monthStart();
    const [coachRes, clientRes, pkgRes, sessRes, revMonthRes, revAllRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'coach'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('packages').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).gte('session_date', ms),
      supabase.from('payments').select('amount').gte('paid_at', ms),
      supabase.from('payments').select('amount'),
    ]);
    const revenueThisMonth = (revMonthRes.data ?? []).reduce((sum, r: any) => sum + Number(r.amount), 0);
    const revenueAllTime   = (revAllRes.data  ?? []).reduce((sum, r: any) => sum + Number(r.amount), 0);
    setStats({
      coachCount: coachRes.count ?? 0,
      clientCount: clientRes.count ?? 0,
      activePackages: pkgRes.count ?? 0,
      sessionsThisMonth: sessRes.count ?? 0,
      revenueThisMonth,
      revenueAllTime,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !stats) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const statCards = [
    { icon: 'people-outline',  label: 'Coaches',             value: stats?.coachCount ?? 0,        color: Colors.accent },
    { icon: 'person-outline',  label: 'Clients',             value: stats?.clientCount ?? 0,       color: '#4CAF50' },
    { icon: 'cube-outline',    label: 'Active Packages',     value: stats?.activePackages ?? 0,    color: '#FF9800' },
    { icon: 'barbell-outline', label: `Sessions · ${monthName}`, value: stats?.sessionsThisMonth ?? 0, color: '#9C27B0' },
  ] as const;

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
    >
      <View style={[s.inner, isDesktop && s.innerDesktop]}>
        <View style={s.header}>
          <Text style={[s.brand, isDesktop && s.brandDesktop]}>ELEVATE</Text>
          <View style={s.adminPill}>
            <Text style={s.adminPillText}>ADMIN</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>OVERVIEW</Text>
        <View style={[s.statsGrid, isDesktop && s.statsGridDesktop]}>
          {statCards.map((c) => (
            <View
              key={c.label}
              style={[
                s.statCard,
                { borderColor: c.color + '30' },
                isDesktop && s.statCardDesktop,
              ]}
            >
              <View style={[s.statIcon, { backgroundColor: c.color + '15' }]}>
                <Ionicons name={c.icon as any} size={isDesktop ? 20 : 16} color={c.color} />
              </View>
              <Text style={[s.statValue, { color: c.color }, isDesktop && s.statValueDesktop]}>
                {c.value}
              </Text>
              <Text style={s.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Revenue summary */}
        <Text style={[s.sectionTitle, { marginTop: 28 }]}>REVENUE</Text>
        <View style={s.revenueCard}>
          <View style={s.revenueItem}>
            <Text style={s.revenueLabel}>{monthName}</Text>
            <Text style={s.revenueValue}>
              OMR {(stats?.revenueThisMonth ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={s.revenueDivider} />
          <View style={s.revenueItem}>
            <Text style={s.revenueLabel}>All Time</Text>
            <Text style={s.revenueValue}>
              OMR {(stats?.revenueAllTime ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  contentDesktop: { padding: 40, paddingTop: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  inner: { width: '100%' },
  innerDesktop: { maxWidth: 960, alignSelf: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 32,
  },
  brand: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 2 },
  brandDesktop: { fontSize: 22 },
  adminPill: {
    backgroundColor: Colors.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.accent + '50',
  },
  adminPillText: { color: Colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 16 },

  // Mobile: 2×2 grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Desktop: 4-in-a-row
  statsGridDesktop: { flexWrap: 'nowrap' },

  statCard: {
    width: '47%', backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, padding: 14, gap: 6,
  },
  statCardDesktop: { flex: 1, width: 'auto', padding: 18, gap: 8 },

  statIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  statValueDesktop: { fontSize: 30, lineHeight: 34 },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 15, fontSize: 11 },

  revenueCard: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: '#4CAF5030', overflow: 'hidden',
  },
  revenueItem: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  revenueDivider: { width: 1, backgroundColor: Colors.border },
  revenueLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 6 },
  revenueValue: { fontSize: 22, fontWeight: '900', color: '#4CAF50' },
});
