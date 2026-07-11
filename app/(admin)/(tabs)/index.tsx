import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { registerPushToken } from '@/lib/pushNotifications';
import { useAuth } from '@/context/AuthContext';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

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

type RatingItem = {
  id: string;
  clientName: string;
  clientId: string;
  rating: number;
  sessionDate: string;
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
  const { profile } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (profile?.id) registerPushToken(profile.id);
  }, [profile?.id]);

  const [stats, setStats]     = useState<Stats | null>(null);
  const [alerts, setAlerts]   = useState<AlertItem[]>([]);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const ms = monthStart();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [coachRes, clientRes, pkgRes, sessRes, revMonthRes, revAllRes,
           lowPkgRes, coachAlertRes, neverPaidRes, allPaymentsRes,
           ratingsRes, pendingTransferRes, pendingFreezeRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'coach').is('deactivated_at', null),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client').is('deactivated_at', null),
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
        .is('deactivated_at', null)
        .not('visa_expiry', 'is', null),
      // Active clients with NO payment ever
      supabase.from('packages')
        .select('client_id, profiles!packages_client_id_fkey(name)')
        .eq('status', 'active'),
      // All payments: get distinct client_ids who have paid
      supabase.from('payments').select('client_id'),
      // Recent session ratings (last 30 days)
      supabase
        .from('workout_sessions')
        .select(`
          id, session_date, client_id,
          client:profiles!workout_sessions_client_id_fkey(name),
          session_ratings(rating)
        `)
        .gte('session_date', thirtyDaysAgo)
        .order('session_date', { ascending: false })
        .limit(100),
      // Pending transfers awaiting admin approval
      supabase
        .from('client_transfers')
        .select('id, client_id, from_coach_id, profiles!client_transfers_client_id_fkey(name)')
        .eq('status', 'pending_admin'),
      // Pending freeze requests
      supabase
        .from('package_freezes')
        .select('id, client_id, freeze_start, freeze_end, profiles!package_freezes_client_id_fkey(name)')
        .eq('status', 'pending'),
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

    // Payment alerts — clients with active package but NO payment on file (one alert per client)
    const paidClientIds = new Set((allPaymentsRes.data ?? []).map((p: any) => p.client_id));
    const noPayAlertedClients = new Set<string>();
    for (const pkg of (neverPaidRes.data ?? []) as any[]) {
      if (paidClientIds.has(pkg.client_id)) continue;
      if (noPayAlertedClients.has(pkg.client_id)) continue;
      noPayAlertedClients.add(pkg.client_id);
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

    // Pending transfer alerts
    for (const tx of (pendingTransferRes.data ?? []) as any[]) {
      const clientName = tx.profiles?.name ?? 'Unknown Client';
      newAlerts.push({
        id: `tx-${tx.id}`,
        level: 'notice',
        icon: 'swap-horizontal-outline',
        title: `Transfer Request — ${clientName}`,
        subtitle: 'Pending admin approval',
        route: '/(admin)/(tabs)/transfers',
      });
    }

    // Pending freeze alerts
    for (const fz of (pendingFreezeRes.data ?? []) as any[]) {
      const clientName = fz.profiles?.name ?? 'Unknown Client';
      newAlerts.push({
        id: `freeze-${fz.id}`,
        level: 'notice',
        icon: 'snow-outline',
        title: `Freeze Request — ${clientName}`,
        subtitle: `${fz.freeze_start} → ${fz.freeze_end} · pending approval`,
        route: `/(admin)/client/${fz.client_id}`,
      });
    }

    // Sort: critical first
    newAlerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, notice: 2 };
      return order[a.level] - order[b.level];
    });

    setAlerts(newAlerts);

    // Build ratings list
    const newRatings: RatingItem[] = [];
    for (const row of (ratingsRes.data ?? []) as any[]) {
      const ratingArr = row.session_ratings as { rating: number }[] | null;
      if (!ratingArr || ratingArr.length === 0) continue;
      newRatings.push({
        id: row.id,
        clientName: row.client?.name ?? 'Unknown',
        clientId: row.client_id,
        rating: ratingArr[0].rating,
        sessionDate: row.session_date,
      });
    }
    setRatings(newRatings);

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Real-time: silently re-fetch whenever any watched table changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' },          () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' },          () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_sessions' },  () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },          () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_transfers' },  () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_ratings' },   () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'package_freezes' },   () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  if (loading && !stats) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const statCards = [
    { icon: 'people-outline',  label: 'Coaches',                    value: stats?.coachCount ?? 0,        color: colors.accent, route: '/(admin)/(tabs)/coaches' },
    { icon: 'person-outline',  label: 'Clients',                    value: stats?.clientCount ?? 0,       color: '#4CAF50',     route: '/(admin)/(tabs)/clients' },
    { icon: 'cube-outline',    label: 'Active Packages',            value: stats?.activePackages ?? 0,    color: '#FF9800',     route: null },
    { icon: 'barbell-outline', label: `Sessions · ${monthName}`,   value: stats?.sessionsThisMonth ?? 0, color: '#9C27B0',     route: null },
  ] as const;

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <View style={[s.inner, isDesktop && s.innerDesktop]}>
        <View style={s.header}>
          <Text style={[s.brand, isDesktop && s.brandDesktop]}>ELEVATƎ</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={toggleTheme} style={s.themeBtn} hitSlop={8}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={16} color={colors.textSecondary} />
            </Pressable>
            <View style={s.adminPill}>
              <Text style={s.adminPillText}>ADMIN</Text>
            </View>
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
                      <Text style={[s.alertTitle, { color: colors.textPrimary }]}>{a.title}</Text>
                      <Text style={s.alertSub}>{a.subtitle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
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
            <Pressable
              key={c.label}
              style={({ pressed }) => [s.statCard, { borderColor: c.color + '30' }, isDesktop && s.statCardDesktop, pressed && c.route && { opacity: 0.75 }]}
              onPress={c.route ? () => router.push(c.route as any) : undefined}
            >
              <View style={[s.statIcon, { backgroundColor: c.color + '15' }]}>
                <Ionicons name={c.icon as any} size={isDesktop ? 20 : 16} color={c.color} />
              </View>
              <Text style={[s.statValue, { color: c.color }, isDesktop && s.statValueDesktop]}>{c.value}</Text>
              <Text style={s.statLabel}>{c.label}</Text>
            </Pressable>
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

        {/* ── Client Ratings ── */}
        <Text style={[s.sectionTitle, { marginTop: 28 }]}>CLIENT RATINGS (Last 30 Days)</Text>
        {ratings.length === 0 ? (
          <View style={s.noAlerts}>
            <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
            <Text style={[s.noAlertsText, { color: colors.textSecondary }]}>No ratings yet</Text>
          </View>
        ) : (
          <View style={s.alertsList}>
            {ratings.map((r, i) => {
              const stars = Math.round(r.rating);
              const isHigh = stars >= 4;
              const isLow  = stars <= 2;
              const color  = isHigh ? '#4CAF50' : isLow ? '#FF6D00' : '#FF9800';
              const icon   = isHigh ? 'star' : isLow ? 'star-half-outline' : 'star-outline';
              const dateStr = new Date(r.sessionDate + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
              });
              return (
                <Pressable
                  key={r.id}
                  style={[s.alertRow, { borderLeftColor: color }, i < ratings.length - 1 && s.alertRowBorder]}
                  onPress={() => router.push(`/(admin)/client/${r.clientId}` as any)}
                >
                  <View style={[s.alertIconWrap, { backgroundColor: color + '18' }]}>
                    <Ionicons name={icon as any} size={18} color={color} />
                  </View>
                  <View style={s.alertText}>
                    <Text style={[s.alertTitle, { color: colors.textPrimary }]}>
                      {r.clientName}
                    </Text>
                    <Text style={s.alertSub}>{dateStr} · {stars} star{stars !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={s.starRow}>
                    {[1,2,3,4,5].map((n) => (
                      <Ionicons
                        key={n}
                        name={n <= stars ? 'star' : 'star-outline'}
                        size={12}
                        color={color}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
  scroll: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 48 },
  contentDesktop: { padding: 40, paddingTop: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  inner: { width: '100%' },
  innerDesktop: { maxWidth: 960, alignSelf: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  brand: { fontSize: 18, fontWeight: '800', color: c.textPrimary, letterSpacing: 2 },
  brandDesktop: { fontSize: 22 },
  themeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  adminPill: {
    backgroundColor: c.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: c.accent + '50',
  },
  adminPillText: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  sectionTitle: { ...Typography.label, color: c.textSecondary, marginBottom: 16 },

  // Alerts
  alertsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 16 },
  alertBadge: {
    backgroundColor: c.accent, borderRadius: 10,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  alertBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  alertsList: {
    backgroundColor: c.surface, borderRadius: 14,
    borderWidth: 1, borderColor: c.border,
    overflow: 'hidden', marginBottom: 4,
  },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderLeftWidth: 3,
  },
  alertRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  alertIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  alertText: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  alertSub: { ...Typography.caption, color: c.textSecondary },
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
  statCard: { width: '47%', backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  statCardDesktop: { flex: 1, width: 'auto', padding: 18, gap: 8 },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  statValueDesktop: { fontSize: 30, lineHeight: 34 },
  statLabel: { ...Typography.caption, color: c.textSecondary, lineHeight: 15, fontSize: 11 },

  starRow: { flexDirection: 'row', gap: 2, alignItems: 'center' },

  // Revenue
  revenueCard: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: '#4CAF5030', overflow: 'hidden' },
  revenueItem: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  revenueDivider: { width: 1, backgroundColor: c.border },
  revenueLabel: { ...Typography.caption, color: c.textSecondary, marginBottom: 6 },
  revenueValue: { fontSize: 22, fontWeight: '900', color: '#4CAF50' },
  });
}
