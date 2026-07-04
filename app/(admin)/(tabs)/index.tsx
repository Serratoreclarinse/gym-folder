import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { router } from 'expo-router';
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

type AlertItem = {
  id: string;
  level: 'critical' | 'warning' | 'notice';
  icon: string;
  title: string;
  subtitle: string;
  route: string;
};

const LEVEL_COLOR = {
  critical: '#FF1744',
  warning:  '#FF6D00',
  notice:   '#FF9800',
};

function monthStart(): string {
  const d = new Date();
  d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export default function AdminDashboardScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [stats, setStats]   = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const ms = monthStart();

    const [coachRes, clientRes, pkgRes, sessRes, revMonthRes, revAllRes,
           lowPkgRes, coachAlertRes, neverPaidRes, allPaymentsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'coach'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('packages').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).gte('session_date', ms),
      supabase.from('payments').select('amount').gte('paid_at', ms),
      supabase.from('payments').select('amount'),
      // Packages with ≤ 3 sessions remaining
      supabase.from('packages')
        .select('id, sessions_remaining, client_id, profiles!packages_client_id_fkey(name)')
        .eq('status', 'active')
        .lte('sessions_remaining', 3),
      // Coaches with visa expiry within 30 days
      supabase.from('profiles')
        .select('id, name, visa_expiry')
        .eq('role', 'coach')
        .not('visa_expiry', 'is', null),
      // Active clients with NO payment ever
      supabase.from('packages')
        .select('client_id, profiles!packages_client_id_fkey(name)')
        .eq('status', 'active'),
      // All payments: get distinct client_ids who have paid
      supabase.from('payments').select('client_id'),
    ]);

    const revenueThisMonth = (revMonthRes.data ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
    const revenueAllTime   = (revAllRes.data  ?? []).reduce((s, r: any) => s + Number(r.amount), 0);

    setStats({
      coachCount: coachRes.count ?? 0,
      clientCount: clientRes.count ?? 0,
      activePackages: pkgRes.count ?? 0,
      sessionsThisMonth: sessRes.count ?? 0,
      revenueThisMonth,
      revenueAllTime,
    });

    // Build alerts
    const newAlerts: AlertItem[] = [];

    // Package alerts
    for (const pkg of (lowPkgRes.data ?? []) as any[]) {
      const clientName = pkg.profiles?.name ?? 'Unknown Client';
      const rem = pkg.sessions_remaining ?? 0;
      if (rem === 0) {
        newAlerts.push({
          id: `pkg-${pkg.id}`,
          level: 'critical',
          icon: 'alert-circle',
          title: `${clientName} — Package Depleted`,
          subtitle: 'No sessions remaining — renewal needed',
          route: `/(admin)/client/${pkg.client_id}`,
        });
      } else {
        newAlerts.push({
          id: `pkg-${pkg.id}`,
          level: rem === 1 ? 'critical' : 'warning',
          icon: rem === 1 ? 'alert-circle-outline' : 'warning-outline',
          title: `${clientName} — ${rem} session${rem === 1 ? '' : 's'} left`,
          subtitle: 'Package running low — consider renewal',
          route: `/(admin)/client/${pkg.client_id}`,
        });
      }
    }

    // Visa alerts
    for (const coach of (coachAlertRes.data ?? []) as any[]) {
      if (!coach.visa_expiry) continue;
      const days = daysUntil(coach.visa_expiry);
      if (days > 30) continue;
      if (days < 0) {
        newAlerts.push({
          id: `visa-${coach.id}`,
          level: 'critical',
          icon: 'alert-circle',
          title: `${coach.name} — Visa Expired`,
          subtitle: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`,
          route: `/(admin)/coach/${coach.id}`,
        });
      } else if (days <= 7) {
        newAlerts.push({
          id: `visa-${coach.id}`,
          level: 'critical',
          icon: 'alert-circle-outline',
          title: `${coach.name} — Visa Expiring`,
          subtitle: `Expires in ${days} day${days === 1 ? '' : 's'}`,
          route: `/(admin)/coach/${coach.id}`,
        });
      } else if (days <= 15) {
        newAlerts.push({
          id: `visa-${coach.id}`,
          level: 'warning',
          icon: 'warning-outline',
          title: `${coach.name} — Visa Expiring Soon`,
          subtitle: `Expires in ${days} days`,
          route: `/(admin)/coach/${coach.id}`,
        });
      } else {
        newAlerts.push({
          id: `visa-${coach.id}`,
          level: 'notice',
          icon: 'time-outline',
          title: `${coach.name} — Visa Notice`,
          subtitle: `Expires in ${days} days`,
          route: `/(admin)/coach/${coach.id}`,
        });
      }
    }

    // Payment alerts — clients with active package but NO payment on file
    const paidClientIds = new Set((allPaymentsRes.data ?? []).map((p: any) => p.client_id));
    for (const pkg of (neverPaidRes.data ?? []) as any[]) {
      if (paidClientIds.has(pkg.client_id)) continue;
      const clientName = pkg.profiles?.name ?? 'Unknown Client';
      newAlerts.push({
        id: `nopay-${pkg.client_id}`,
        level: 'warning',
        icon: 'cash-outline',
        title: `${clientName} — No Payment Recorded`,
        subtitle: 'Active package but no payment on file',
        route: `/(admin)/client/${pkg.client_id}`,
      });
    }

    // Sort: critical first
    newAlerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, notice: 2 };
      return order[a.level] - order[b.level];
    });

    setAlerts(newAlerts);
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
    { icon: 'people-outline',  label: 'Coaches',                    value: stats?.coachCount ?? 0,        color: Colors.accent },
    { icon: 'person-outline',  label: 'Clients',                    value: stats?.clientCount ?? 0,       color: '#4CAF50' },
    { icon: 'cube-outline',    label: 'Active Packages',            value: stats?.activePackages ?? 0,    color: '#FF9800' },
    { icon: 'barbell-outline', label: `Sessions · ${monthName}`,   value: stats?.sessionsThisMonth ?? 0, color: '#9C27B0' },
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

        {/* ── Alerts ── */}
        {alerts.length > 0 && (
          <>
            <View style={s.alertsHeader}>
              <Text style={s.sectionTitle}>ALERTS</Text>
              <View style={s.alertBadge}>
                <Text style={s.alertBadgeText}>{alerts.length}</Text>
              </View>
            </View>
            <View style={s.alertsList}>
              {alerts.map((a, i) => {
                const color = LEVEL_COLOR[a.level];
                return (
                  <Pressable
                    key={a.id}
                    style={[
                      s.alertRow,
                      { borderLeftColor: color },
                      i < alerts.length - 1 && s.alertRowBorder,
                    ]}
                    onPress={() => router.push(a.route as any)}
                  >
                    <View style={[s.alertIconWrap, { backgroundColor: color + '18' }]}>
                      <Ionicons name={a.icon as any} size={18} color={color} />
                    </View>
                    <View style={s.alertText}>
                      <Text style={[s.alertTitle, { color: Colors.textPrimary }]}>{a.title}</Text>
                      <Text style={s.alertSub}>{a.subtitle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {alerts.length === 0 && !loading && (
          <>
            <Text style={s.sectionTitle}>ALERTS</Text>
            <View style={s.noAlerts}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
              <Text style={s.noAlertsText}>All clear — no warnings</Text>
            </View>
          </>
        )}

        {/* ── Stats ── */}
        <Text style={[s.sectionTitle, { marginTop: 28 }]}>OVERVIEW</Text>
        <View style={[s.statsGrid, isDesktop && s.statsGridDesktop]}>
          {statCards.map((c) => (
            <View key={c.label} style={[s.statCard, { borderColor: c.color + '30' }, isDesktop && s.statCardDesktop]}>
              <View style={[s.statIcon, { backgroundColor: c.color + '15' }]}>
                <Ionicons name={c.icon as any} size={isDesktop ? 20 : 16} color={c.color} />
              </View>
              <Text style={[s.statValue, { color: c.color }, isDesktop && s.statValueDesktop]}>{c.value}</Text>
              <Text style={s.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Revenue ── */}
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

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  brand: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 2 },
  brandDesktop: { fontSize: 22 },
  adminPill: {
    backgroundColor: Colors.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.accent + '50',
  },
  adminPillText: { color: Colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 16 },

  // Alerts
  alertsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  alertBadge: {
    backgroundColor: Colors.accent, borderRadius: 10,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  alertBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  alertsList: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', marginBottom: 4,
  },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderLeftWidth: 3,
  },
  alertRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  alertIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  alertText: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  alertSub: { ...Typography.caption, color: Colors.textSecondary },
  noAlerts: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#4CAF5010', borderRadius: 12,
    borderWidth: 1, borderColor: '#4CAF5030',
    padding: 14, marginBottom: 4,
  },
  noAlertsText: { ...Typography.body, color: '#4CAF50' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statsGridDesktop: { flexWrap: 'nowrap' },
  statCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  statCardDesktop: { flex: 1, width: 'auto', padding: 18, gap: 8 },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  statValueDesktop: { fontSize: 30, lineHeight: 34 },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 15, fontSize: 11 },

  // Revenue
  revenueCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: '#4CAF5030', overflow: 'hidden' },
  revenueItem: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  revenueDivider: { width: 1, backgroundColor: Colors.border },
  revenueLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 6 },
  revenueValue: { fontSize: 22, fontWeight: '900', color: '#4CAF50' },
});
