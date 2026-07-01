import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type CoachRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  activeClients: number;
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminCoachesScreen() {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [coachRes, pkgRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email, phone').eq('role', 'coach').order('name'),
      supabase.from('packages').select('coach_id').eq('status', 'active'),
    ]);

    const clientCounts = new Map<string, number>();
    for (const pkg of pkgRes.data ?? []) {
      clientCounts.set(pkg.coach_id, (clientCounts.get(pkg.coach_id) ?? 0) + 1);
    }

    setCoaches(
      (coachRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone ?? null,
        activeClients: clientCounts.get(c.id) ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = coaches.filter(
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
            placeholder="Search coaches…"
            placeholderTextColor={Colors.textSecondary}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <Pressable style={s.addBtn} onPress={() => router.push('/(admin)/add-coach' as any)}>
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
              <Ionicons name="people-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>{search ? 'No coaches match' : 'No coaches yet'}</Text>
              {!search && <Text style={s.emptySub}>Tap + to add the first coach</Text>}
            </View>
          ) : filtered.map((coach) => (
            <View key={coach.id} style={s.coachCard}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials(coach.name)}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.name}>{coach.name}</Text>
                <Text style={s.email}>{coach.email}</Text>
                {coach.phone ? <Text style={s.phone}>{coach.phone}</Text> : null}
              </View>
              <View style={s.statCol}>
                <Text style={s.statNum}>{coach.activeClients}</Text>
                <Text style={s.statLbl}>clients</Text>
              </View>
            </View>
          ))}
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

  coachCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.accent + '18', borderWidth: 1.5, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: Colors.accent },
  info: { flex: 1 },
  name:  { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  email: { ...Typography.caption, color: Colors.textSecondary },
  phone: { ...Typography.caption, color: Colors.textSecondary },
  statCol: { alignItems: 'center', minWidth: 44 },
  statNum: { ...Typography.subtitle, color: Colors.accent, fontWeight: '800' },
  statLbl: { ...Typography.label, color: Colors.textSecondary, fontSize: 10 },
});
