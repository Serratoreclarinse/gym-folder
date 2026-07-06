import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

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
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [coachRes, pkgRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email, phone').eq('role', 'coach').is('deactivated_at', null).order('name'),
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
      {/* Toolbar */}
      <View style={[s.toolbar, isDesktop && s.toolbarDesktop]}>
        <View style={[s.toolbarInner, isDesktop && s.toolbarInnerDesktop]}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search coaches…"
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
          <Pressable style={s.addBtn} onPress={() => router.push('/(admin)/add-coach' as any)}>
            <Ionicons name="add" size={20} color={colors.bg} />
            {isDesktop && <Text style={s.addBtnText}>Add Coach</Text>}
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
                <Ionicons name="people-outline" size={52} color={colors.border} />
                <Text style={s.emptyTitle}>{search ? 'No coaches match' : 'No coaches yet'}</Text>
                {!search && <Text style={s.emptySub}>Click "Add Coach" to get started</Text>}
              </View>
            ) : isDesktop ? (
              /* ── Desktop table ── */
              <View style={s.table}>
                <View style={[s.tableRow, s.tableHeader]}>
                  <Text style={[s.thCell, { flex: 2 }]}>NAME</Text>
                  <Text style={[s.thCell, { flex: 2 }]}>EMAIL</Text>
                  <Text style={[s.thCell, { flex: 1 }]}>PHONE</Text>
                  <Text style={[s.thCell, { flex: 1, textAlign: 'right' }]}>CLIENTS</Text>
                </View>
                {filtered.map((coach, i) => (
                  <Pressable
                    key={coach.id}
                    style={[s.tableRow, s.tableDataRow, i % 2 === 1 && s.tableRowAlt]}
                    onPress={() => router.push(`/(admin)/coach/${coach.id}` as any)}
                  >
                    <View style={[s.tdCell, { flex: 2 }]}>
                      <View style={s.nameRow}>
                        <View style={s.avatarSm}>
                          <Text style={s.avatarSmText}>{initials(coach.name)}</Text>
                        </View>
                        <Text style={s.tdName}>{coach.name}</Text>
                      </View>
                    </View>
                    <Text style={[s.tdText, { flex: 2 }]}>{coach.email}</Text>
                    <Text style={[s.tdText, { flex: 1 }]}>{coach.phone ?? '—'}</Text>
                    <Text style={[s.tdNum, { flex: 1, textAlign: 'right' }]}>{coach.activeClients}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              /* ── Mobile cards ── */
              filtered.map((coach) => (
                <Pressable
                  key={coach.id}
                  style={s.coachCard}
                  onPress={() => router.push(`/(admin)/coach/${coach.id}` as any)}
                >
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
                  <Ionicons name="chevron-forward" size={16} color={colors.border} style={{ marginLeft: 4 }} />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1 },

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
      backgroundColor: c.accent + '18', borderWidth: 1, borderColor: c.accent + '40',
      justifyContent: 'center', alignItems: 'center',
    },
    avatarSmText: { fontSize: 11, fontWeight: '800', color: c.accent },
    tdName: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    tdText: { ...Typography.body, color: c.textSecondary },
    tdNum: { ...Typography.subtitle, color: c.accent, fontWeight: '700' },

    // Mobile cards
    coachCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, padding: 14,
    },
    avatar: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: c.accent + '18', borderWidth: 1.5, borderColor: c.accent + '40',
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    avatarText: { fontSize: 16, fontWeight: '800', color: c.accent },
    info: { flex: 1 },
    name:  { ...Typography.body, color: c.textPrimary, fontWeight: '700', marginBottom: 2 },
    email: { ...Typography.caption, color: c.textSecondary },
    phone: { ...Typography.caption, color: c.textSecondary },
    statCol: { alignItems: 'center', minWidth: 44 },
    statNum: { ...Typography.subtitle, color: c.accent, fontWeight: '800' },
    statLbl: { ...Typography.label, color: c.textSecondary, fontSize: 10 },
  });
}
