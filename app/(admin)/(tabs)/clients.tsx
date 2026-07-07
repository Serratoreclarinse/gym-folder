import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type ClientRow = {
  id: string;
  name: string;
  email: string;
  coachName: string | null;
  sessionsRemaining: number | null;
  packageStatus: 'active' | 'expired' | 'none';
};

const STATUS_COLOR: Record<string, string> = {
  active: '#4CAF50',
  expired: '#888888',
  none: '#444444',
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminClientsScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [profilesRes, pkgsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email').eq('role', 'client').is('deactivated_at', null).order('name'),
      supabase
        .from('packages')
        .select(`
          client_id,
          sessions_remaining,
          status,
          coach:profiles!packages_coach_id_fkey ( name )
        `)
        .order('created_at', { ascending: false }),
    ]);

    const pkgMap = new Map<string, { coachName: string | null; sessionsRemaining: number; status: 'active' | 'expired' }>();
    for (const pkg of pkgsRes.data ?? []) {
      const existing = pkgMap.get(pkg.client_id);
      if (!existing || pkg.status === 'active') {
        pkgMap.set(pkg.client_id, {
          coachName: (pkg.coach as { name: string } | null)?.name ?? null,
          sessionsRemaining: pkg.sessions_remaining,
          status: pkg.status as 'active' | 'expired',
        });
      }
    }

    setClients(
      (profilesRes.data ?? []).map((p) => {
        const pkg = pkgMap.get(p.id);
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          coachName: pkg?.coachName ?? null,
          sessionsRemaining: pkg?.sessionsRemaining ?? null,
          packageStatus: pkg ? (pkg.status as 'active' | 'expired') : 'none',
        };
      }),
    );
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const channel = supabase
      .channel('admin-clients-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const filtered = clients.filter(
    (c) => !search
      || c.name.toLowerCase().includes(search.toLowerCase())
      || c.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View style={s.root}>
      {/* Toolbar */}
      <View style={[s.toolbar, isDesktop && s.toolbarDesktop]}>
        <View style={[s.toolbarInner, isDesktop && s.toolbarInnerDesktop]}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search clients…"
              placeholderTextColor={colors.textSecondary}
            />
            {!!search && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
          <Pressable style={s.trashBtn} onPress={() => router.push('/(admin)/recycle-bin' as any)}>
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={s.addBtn} onPress={() => router.push('/(admin)/add-client' as any)}>
            <Ionicons name="add" size={20} color={colors.bg} />
            {isDesktop && <Text style={s.addBtnText}>Add Client</Text>}
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.list, isDesktop && s.listDesktop]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        >
          <View style={[s.listInner, isDesktop && s.listInnerDesktop]}>
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="person-outline" size={52} color={colors.border} />
                <Text style={s.emptyTitle}>{search ? 'No clients match' : 'No clients yet'}</Text>
                {!search && <Text style={s.emptySub}>Click "Add Client" to get started</Text>}
              </View>
            ) : isDesktop ? (
              /* ── Desktop table ── */
              <View style={s.table}>
                <View style={[s.tableRow, s.tableHeader]}>
                  <Text style={[s.thCell, { flex: 2 }]}>NAME</Text>
                  <Text style={[s.thCell, { flex: 2 }]}>EMAIL</Text>
                  <Text style={[s.thCell, { flex: 1.5 }]}>COACH</Text>
                  <Text style={[s.thCell, { flex: 1, textAlign: 'center' }]}>SESSIONS</Text>
                  <Text style={[s.thCell, { flex: 1, textAlign: 'center' }]}>STATUS</Text>
                </View>
                {filtered.map((client, i) => {
                  const statusColor = STATUS_COLOR[client.packageStatus];
                  return (
                    <Pressable
                      key={client.id}
                      style={[s.tableRow, s.tableDataRow, i % 2 === 1 && s.tableRowAlt]}
                      onPress={() => router.push(`/(admin)/client/${client.id}` as any)}
                    >
                      <View style={[s.tdCell, { flex: 2 }]}>
                        <View style={s.nameRow}>
                          <View style={s.avatarSm}>
                            <Text style={s.avatarSmText}>{initials(client.name)}</Text>
                          </View>
                          <Text style={s.tdName}>{client.name}</Text>
                        </View>
                      </View>
                      <Text style={[s.tdText, { flex: 2 }]}>{client.email}</Text>
                      <Text style={[s.tdText, { flex: 1.5 }]}>{client.coachName ?? '—'}</Text>
                      <Text style={[s.tdNum, { flex: 1, textAlign: 'center', color: statusColor }]}>
                        {client.packageStatus !== 'none' ? (client.sessionsRemaining ?? 0) : '—'}
                      </Text>
                      <View style={[{ flex: 1, alignItems: 'center' }]}>
                        {client.packageStatus !== 'none' ? (
                          <View style={[s.statusPill, { backgroundColor: statusColor + '18', borderColor: statusColor + '50' }]}>
                            <Text style={[s.statusPillText, { color: statusColor }]}>
                              {client.packageStatus.toUpperCase()}
                            </Text>
                          </View>
                        ) : (
                          <Text style={s.tdText}>—</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              /* ── Mobile cards ── */
              filtered.map((client) => {
                const statusColor = STATUS_COLOR[client.packageStatus];
                return (
                  <Pressable
                    key={client.id}
                    style={s.clientCard}
                    onPress={() => router.push(`/(admin)/client/${client.id}` as any)}
                  >
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{initials(client.name)}</Text>
                    </View>
                    <View style={s.info}>
                      <Text style={s.name}>{client.name}</Text>
                      <Text style={s.email}>{client.email}</Text>
                      {client.coachName ? (
                        <View style={s.coachRow}>
                          <Ionicons name="person-circle-outline" size={12} color={colors.textSecondary} />
                          <Text style={s.coachName}>{client.coachName}</Text>
                        </View>
                      ) : (
                        <Text style={[s.coachName, { fontStyle: 'italic' }]}>No coach assigned</Text>
                      )}
                    </View>
                    {client.packageStatus !== 'none' && (
                      <View style={[s.pkgBadge, { borderColor: statusColor + '50', backgroundColor: statusColor + '12' }]}>
                        <Text style={[s.pkgSessions, { color: statusColor }]}>
                          {client.sessionsRemaining ?? 0}
                        </Text>
                        <Text style={[s.pkgLabel, { color: statusColor }]}>sessions</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={colors.border} />
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    toolbar: { borderBottomWidth: 1, borderBottomColor: c.border, padding: 12 },
    toolbarDesktop: { padding: 20, paddingBottom: 16 },
    toolbarInner: { flexDirection: 'row', gap: 10 },
    toolbarInnerDesktop: { maxWidth: 960, alignSelf: 'center', width: '100%' },

    searchBox: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.surface, borderRadius: 10,
      borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    searchInput: { flex: 1, color: c.textPrimary, fontSize: 15 },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.accent, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10,
    },
    addBtnText: { color: c.bg, fontWeight: '700', fontSize: 14 },
    trashBtn: {
      padding: 10, borderRadius: 10,
      borderWidth: 1, borderColor: c.border,
      backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center',
    },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    list: { padding: 12 },
    listDesktop: { padding: 24, paddingTop: 20 },
    listInner: { gap: 10 },
    listInnerDesktop: { maxWidth: 960, alignSelf: 'center', width: '100%' },

    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
    emptySub: { ...Typography.body, color: c.textSecondary },

    // Desktop table
    table: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
    tableHeader: {
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border,
      backgroundColor: c.bg,
    },
    tableDataRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border + '80' },
    tableRowAlt: { backgroundColor: c.bg + '60' },
    thCell: { ...Typography.label, color: c.textSecondary, fontSize: 11, letterSpacing: 0.8 },
    tdCell: { flexDirection: 'row', alignItems: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarSm: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: '#4CAF5018', borderWidth: 1, borderColor: '#4CAF5040',
      justifyContent: 'center', alignItems: 'center',
    },
    avatarSmText: { fontSize: 11, fontWeight: '800', color: '#4CAF50' },
    tdName: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    tdText: { ...Typography.body, color: c.textSecondary },
    tdNum: { ...Typography.subtitle, fontWeight: '700' },
    statusPill: {
      borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
    },
    statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

    // Mobile cards
    clientCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, padding: 14,
    },
    avatar: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: '#4CAF5018', borderWidth: 1.5, borderColor: '#4CAF5040',
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    avatarText: { fontSize: 16, fontWeight: '800', color: '#4CAF50' },
    info: { flex: 1 },
    name:    { ...Typography.body, color: c.textPrimary, fontWeight: '700', marginBottom: 2 },
    email:   { ...Typography.caption, color: c.textSecondary, marginBottom: 3 },
    coachRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    coachName: { ...Typography.caption, color: c.textSecondary },
    pkgBadge: {
      alignItems: 'center', borderRadius: 10,
      borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
    },
    pkgSessions: { fontSize: 15, fontWeight: '800', lineHeight: 18 },
    pkgLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  });
}
