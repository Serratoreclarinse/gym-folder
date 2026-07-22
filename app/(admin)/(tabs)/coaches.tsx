import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type CoachRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  activeClients: number;
};

type AvailStatus = 'available' | 'busy' | 'blocked' | 'day_off' | 'outside_hours';

const AVAIL_CONFIG: Record<AvailStatus, { label: string; icon: string; color: string }> = {
  available:     { label: 'Available',      icon: 'checkmark-circle',  color: '#22c55e' },
  busy:          { label: 'Busy',           icon: 'close-circle',      color: '#ef4444' },
  blocked:       { label: 'Blocked',        icon: 'lock-closed',       color: '#f97316' },
  day_off:       { label: 'Day Off',        icon: 'moon-outline',      color: '#94a3b8' },
  outside_hours: { label: 'Outside Hours',  icon: 'time-outline',      color: '#94a3b8' },
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

  // Availability search state
  const [findMode, setFindMode] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [availMap, setAvailMap] = useState<Map<string, AvailStatus>>(new Map());
  const [avLoading, setAvLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const channel = supabase
      .channel('admin-coaches-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Trigger availability search with debounce
  useEffect(() => {
    if (!findMode) { setAvailMap(new Map()); return; }
    if (!targetDate.match(/^\d{4}-\d{2}-\d{2}$/) || !targetTime.match(/^\d{2}:\d{2}$/)) {
      setAvailMap(new Map());
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runAvailSearch(), 500);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [findMode, targetDate, targetTime, coaches]);

  const runAvailSearch = async () => {
    if (!targetDate || !targetTime) return;
    setAvLoading(true);

    const [year, month, day] = targetDate.split('-').map(Number);
    const [hour, minute] = targetTime.split(':').map(Number);
    const dow = new Date(year, month - 1, day).getDay();
    const targetMinutes = hour * 60 + minute;

    const dayStart = `${targetDate}T00:00:00`;
    const dayEnd   = `${targetDate}T23:59:59`;

    const [avRes, bdRes, sessRes] = await Promise.all([
      supabase.from('coach_availability')
        .select('coach_id, is_active, start_time, end_time')
        .eq('day_of_week', dow)
        .eq('is_active', true),
      supabase.from('coach_blocked_dates')
        .select('coach_id')
        .eq('date', targetDate),
      supabase.from('scheduled_sessions')
        .select('coach_id, scheduled_at, duration_minutes')
        .gte('scheduled_at', dayStart)
        .lte('scheduled_at', dayEnd),
    ]);

    const workingMap = new Map(
      (avRes.data ?? []).map((a: any) => [a.coach_id, a]),
    );
    const blockedSet = new Set((bdRes.data ?? []).map((b: any) => b.coach_id));
    const busySet = new Set<string>();

    for (const sess of sessRes.data ?? [] as any[]) {
      const d = new Date(sess.scheduled_at);
      const sessMin = d.getHours() * 60 + d.getMinutes();
      const dur = sess.duration_minutes ?? 60;
      if (sessMin <= targetMinutes && targetMinutes < sessMin + dur) {
        busySet.add(sess.coach_id);
      }
    }

    const result = new Map<string, AvailStatus>();
    for (const coach of coaches) {
      const avail = workingMap.get(coach.id) as any;
      if (!avail) {
        result.set(coach.id, 'day_off');
      } else if (blockedSet.has(coach.id)) {
        result.set(coach.id, 'blocked');
      } else {
        const [sh, sm] = (avail.start_time as string).split(':').map(Number);
        const [eh, em] = (avail.end_time   as string).split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin   = eh * 60 + em;
        if (targetMinutes < startMin || targetMinutes >= endMin) {
          result.set(coach.id, 'outside_hours');
        } else if (busySet.has(coach.id)) {
          result.set(coach.id, 'busy');
        } else {
          result.set(coach.id, 'available');
        }
      }
    }

    setAvailMap(result);
    setAvLoading(false);
  };

  const filtered = coaches.filter(
    (c) => !search
      || c.name.toLowerCase().includes(search.toLowerCase())
      || c.email.toLowerCase().includes(search.toLowerCase()),
  );

  // In find mode, sort available coaches first
  const sorted = findMode && availMap.size > 0
    ? [...filtered].sort((a, b) => {
        const order: Record<AvailStatus, number> = {
          available: 0, busy: 1, blocked: 2, outside_hours: 3, day_off: 4,
        };
        return (order[availMap.get(a.id) ?? 'day_off'] ?? 4)
             - (order[availMap.get(b.id) ?? 'day_off'] ?? 4);
      })
    : filtered;

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
          <Pressable
            style={[s.iconBtn, findMode && s.iconBtnActive]}
            onPress={() => setFindMode((v) => !v)}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={findMode ? colors.bg : colors.textSecondary}
            />
          </Pressable>
          <Pressable style={s.trashBtn} onPress={() => router.push('/(admin)/recycle-bin' as any)}>
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={s.addBtn} onPress={() => router.push('/(admin)/add-coach' as any)}>
            <Ionicons name="add" size={20} color={colors.bg} />
            {isDesktop && <Text style={s.addBtnText}>Add Coach</Text>}
          </Pressable>
        </View>

        {/* Availability search panel */}
        {findMode && (
          <View style={[s.findPanel, isDesktop && s.findPanelDesktop]}>
            <View style={s.findPanelInner}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={s.findLabel}>Find Available Coach</Text>
              {avLoading && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 'auto' }} />}
            </View>
            <View style={s.findRow}>
              <View style={s.findField}>
                <Text style={s.findFieldLabel}>DATE</Text>
                <TextInput
                  style={s.findInput}
                  value={targetDate}
                  onChangeText={setTargetDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>
              <View style={s.findField}>
                <Text style={s.findFieldLabel}>TIME</Text>
                <TextInput
                  style={s.findInput}
                  value={targetTime}
                  onChangeText={setTargetTime}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>
            {availMap.size > 0 && (
              <View style={s.legendRow}>
                {(['available', 'busy', 'blocked', 'day_off'] as AvailStatus[]).map((k) => (
                  <View key={k} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: AVAIL_CONFIG[k].color }]} />
                    <Text style={s.legendText}>{AVAIL_CONFIG[k].label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.list, isDesktop && s.listDesktop]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        >
          <View style={[s.listInner, isDesktop && s.listInnerDesktop]}>
            {sorted.length === 0 ? (
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
                  {findMode && availMap.size > 0 && (
                    <Text style={[s.thCell, { width: 120, textAlign: 'right' }]}>STATUS</Text>
                  )}
                </View>
                {sorted.map((coach, i) => {
                  const avStatus = availMap.get(coach.id);
                  const cfg = avStatus ? AVAIL_CONFIG[avStatus] : null;
                  return (
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
                      {findMode && availMap.size > 0 && (
                        <View style={[s.tdCell, { width: 120, justifyContent: 'flex-end' }]}>
                          {cfg ? (
                            <View style={[s.statusChip, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}>
                              <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                              <Text style={[s.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              /* ── Mobile cards ── */
              sorted.map((coach) => {
                const avStatus = availMap.get(coach.id);
                const cfg = avStatus ? AVAIL_CONFIG[avStatus] : null;
                return (
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
                      {cfg && (
                        <View style={[s.statusChip, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40', alignSelf: 'flex-start', marginTop: 6 }]}>
                          <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                          <Text style={[s.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                      )}
                    </View>
                    <View style={s.statCol}>
                      <Text style={s.statNum}>{coach.activeClients}</Text>
                      <Text style={s.statLbl}>clients</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.border} style={{ marginLeft: 4 }} />
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
    iconBtn: {
      padding: 10, borderRadius: 10,
      borderWidth: 1, borderColor: c.border,
      backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center',
    },
    iconBtnActive: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },

    // Find available panel
    findPanel: {
      marginTop: 12, gap: 10,
    },
    findPanelDesktop: {
      maxWidth: 960, alignSelf: 'center', width: '100%',
    },
    findPanelInner: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    findLabel: {
      ...Typography.label, color: c.accent, fontWeight: '700', fontSize: 12, letterSpacing: 0.5,
    },
    findRow: {
      flexDirection: 'row', gap: 10,
    },
    findField: { flex: 1 },
    findFieldLabel: {
      ...Typography.label, color: c.textSecondary, fontSize: 10, letterSpacing: 0.8, marginBottom: 4,
    },
    findInput: {
      backgroundColor: c.surface, borderRadius: 10,
      borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 12, paddingVertical: 10,
      color: c.textPrimary, fontSize: 15,
    },
    legendRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    },
    legendItem: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
    },
    legendDot: {
      width: 8, height: 8, borderRadius: 4,
    },
    legendText: {
      ...Typography.caption, color: c.textSecondary, fontSize: 11,
    },

    // Status chip
    statusChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: 8, borderWidth: 1,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    statusChipText: {
      fontSize: 11, fontWeight: '700',
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
