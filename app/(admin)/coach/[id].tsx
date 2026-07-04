import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type CoachProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type ActiveClient = {
  id: string;
  name: string;
  email: string;
  sessionsRemaining: number;
  packageType: '30min' | '45min' | '1hr';
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function CoachDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [clients, setClients] = useState<ActiveClient[]>([]);
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [profileRes, pkgsRes, sessRes, revRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email, phone').eq('id', id).single(),
      supabase
        .from('packages')
        .select('sessions_remaining, package_type, client:profiles!packages_client_id_fkey(id, name, email)')
        .eq('coach_id', id)
        .eq('status', 'active'),
      supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', id)
        .gte('session_date', monthStart.toISOString().split('T')[0]),
      supabase
        .from('payments')
        .select('amount')
        .eq('coach_id', id)
        .gte('paid_at', monthStart.toISOString().split('T')[0]),
    ]);

    if (profileRes.data) {
      const p = profileRes.data as any;
      setCoach(p);
      setEditName(p.name);
      setEditPhone(p.phone ?? '');
    }

    setClients(
      (pkgsRes.data ?? []).map((row: any) => ({
        id: row.client.id,
        name: row.client.name,
        email: row.client.email,
        sessionsRemaining: row.sessions_remaining,
        packageType: row.package_type,
      })),
    );

    setSessionsThisMonth(sessRes.count ?? 0);
    setRevenueThisMonth((revRes.data ?? []).reduce((sum, r: any) => sum + Number(r.amount), 0));
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editName.trim() || !id) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_update_profile', {
      p_user_id: id,
      p_name: editName.trim(),
      p_phone: editPhone.trim(),
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setCoach((c) => c ? { ...c, name: editName.trim(), phone: editPhone.trim() || null } : c);
    setEditing(false);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }
  if (!coach) {
    return <View style={s.center}><Text style={s.grayText}>Coach not found.</Text></View>;
  }

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
    >
      <View style={[s.inner, isDesktop && s.innerDesktop]}>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatarLg}>
            <Text style={s.avatarLgText}>{initials(coach.name)}</Text>
          </View>
          <View style={s.profileRight}>
            {editing ? (
              <>
                <TextInput
                  style={s.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full name"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[s.editInput, { marginTop: 8 }]}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Phone (optional)"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="phone-pad"
                />
                <View style={s.editActions}>
                  <Pressable style={s.saveBtn} onPress={handleSave} disabled={saving}>
                    <Text style={s.saveBtnText}>{saving ? 'SAVING…' : 'SAVE'}</Text>
                  </Pressable>
                  <Pressable
                    style={s.cancelEditBtn}
                    onPress={() => { setEditing(false); setEditName(coach.name); setEditPhone(coach.phone ?? ''); }}
                  >
                    <Text style={s.cancelEditText}>CANCEL</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={s.coachName}>{coach.name}</Text>
                <Text style={s.coachEmail}>{coach.email}</Text>
                {coach.phone && <Text style={s.coachPhone}>{coach.phone}</Text>}
              </>
            )}
          </View>
          {!editing && (
            <Pressable style={s.editBtn} onPress={() => setEditing(true)}>
              <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: Colors.accent }]}>{clients.length}</Text>
            <Text style={s.statLbl}>Active Clients</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: '#9C27B0' }]}>{sessionsThisMonth}</Text>
            <Text style={s.statLbl}>Sessions · {monthName}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: '#4CAF50', fontSize: 20 }]} numberOfLines={1} adjustsFontSizeToFit>
              ₱{revenueThisMonth.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
            <Text style={s.statLbl}>Revenue · {monthName}</Text>
          </View>
        </View>

        {/* Active clients list */}
        <Text style={s.sectionTitle}>ACTIVE CLIENTS</Text>
        {clients.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="person-outline" size={40} color={Colors.border} />
            <Text style={s.emptyText}>No active clients</Text>
          </View>
        ) : (
          <View style={s.clientList}>
            {clients.map((c) => (
              <Pressable
                key={c.id}
                style={s.clientRow}
                onPress={() => router.push(`/(admin)/client/${c.id}` as any)}
              >
                <View style={s.clientAvatar}>
                  <Text style={s.clientAvatarText}>{initials(c.name)}</Text>
                </View>
                <View style={s.clientInfo}>
                  <Text style={s.clientName}>{c.name}</Text>
                  <Text style={s.clientEmail}>{c.email}</Text>
                </View>
                <View style={s.sessionsBadge}>
                  <Text style={s.sessionsBadgeNum}>{c.sessionsRemaining}</Text>
                  <Text style={s.sessionsBadgeLbl}>left</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.border} style={{ marginLeft: 4 }} />
              </Pressable>
            ))}
          </View>
        )}
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
  innerDesktop: { maxWidth: 720, alignSelf: 'center' },
  grayText: { ...Typography.body, color: Colors.textSecondary },

  profileCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18, gap: 14, marginBottom: 16,
  },
  avatarLg: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.accent + '18',
    borderWidth: 2, borderColor: Colors.accent + '50',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarLgText: { fontSize: 20, fontWeight: '800', color: Colors.accent },
  profileRight: { flex: 1 },
  coachName: { ...Typography.subtitle, color: Colors.textPrimary, fontWeight: '700', marginBottom: 3 },
  coachEmail: { ...Typography.body, color: Colors.textSecondary, marginBottom: 2 },
  coachPhone: { ...Typography.caption, color: Colors.textSecondary },
  editBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.border + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  editInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    color: Colors.textPrimary, fontSize: 15,
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 9,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  saveBtnText: { color: Colors.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  cancelEditBtn: {
    backgroundColor: Colors.border + '40', borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  cancelEditText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 24, overflow: 'hidden',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statVal: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  statLbl: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3, textAlign: 'center' },

  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 12 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { ...Typography.body, color: Colors.textSecondary },

  clientList: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border + '80',
  },
  clientAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#4CAF5018', borderWidth: 1, borderColor: '#4CAF5040',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  clientAvatarText: { fontSize: 13, fontWeight: '700', color: '#4CAF50' },
  clientInfo: { flex: 1 },
  clientName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  clientEmail: { ...Typography.caption, color: Colors.textSecondary },
  sessionsBadge: { alignItems: 'center', minWidth: 38 },
  sessionsBadgeNum: { fontSize: 18, fontWeight: '800', color: Colors.accent, lineHeight: 22 },
  sessionsBadgeLbl: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
});
