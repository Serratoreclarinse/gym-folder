import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

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
  expired: Colors.textSecondary,
  none: Colors.border,
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminClientsScreen() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [profilesRes, pkgsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email').eq('role', 'client').order('name'),
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

    // Best package per client (prefer active over expired)
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

  useEffect(() => { load(); }, [load]);

  const filtered = clients.filter(
    (c) => !search
      || c.name.toLowerCase().includes(search.toLowerCase())
      || c.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View style={s.root}>
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search clients…"
            placeholderTextColor={Colors.textSecondary}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <Pressable style={s.addBtn} onPress={() => router.push('/(admin)/add-client' as any)}>
          <Ionicons name="add" size={22} color={Colors.bg} />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="person-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>{search ? 'No clients match' : 'No clients yet'}</Text>
              {!search && <Text style={s.emptySub}>Tap + to add a client</Text>}
            </View>
          ) : filtered.map((client) => {
            const statusColor = STATUS_COLOR[client.packageStatus];
            return (
              <View key={client.id} style={s.clientCard}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials(client.name)}</Text>
                </View>
                <View style={s.info}>
                  <Text style={s.name}>{client.name}</Text>
                  <Text style={s.email}>{client.email}</Text>
                  {client.coachName ? (
                    <View style={s.coachRow}>
                      <Ionicons name="person-circle-outline" size={12} color={Colors.textSecondary} />
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
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  searchRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  addBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingTop: 8, gap: 10 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: Colors.textSecondary },

  clientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#4CAF5018', borderWidth: 1.5, borderColor: '#4CAF5040',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#4CAF50' },
  info: { flex: 1 },
  name:    { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  email:   { ...Typography.caption, color: Colors.textSecondary, marginBottom: 3 },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coachName: { ...Typography.caption, color: Colors.textSecondary },
  pkgBadge: {
    alignItems: 'center', borderRadius: 10,
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  pkgSessions: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  pkgLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
});
