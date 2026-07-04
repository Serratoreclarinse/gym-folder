import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type DeactivatedProfile = {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'coach';
  deactivated_at: string;
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RecycleBinScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [profiles, setProfiles] = useState<DeactivatedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role, deactivated_at')
      .not('deactivated_at', 'is', null)
      .in('role', ['client', 'coach'])
      .order('deactivated_at', { ascending: false });
    setProfiles((data ?? []) as DeactivatedProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (p: DeactivatedProfile) => {
    setActionId(p.id);
    const { error } = await supabase
      .from('profiles')
      .update({ deactivated_at: null })
      .eq('id', p.id);
    setActionId(null);
    if (error) { Alert.alert('Error', error.message); return; }
    setProfiles((prev) => prev.filter((x) => x.id !== p.id));
  };

  const handleDeleteForever = (p: DeactivatedProfile) => {
    Alert.alert(
      'Delete Forever',
      `This will permanently delete ${p.name} and all their data (sessions, packages, payments). This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            setActionId(p.id);
            const { error } = await supabase.rpc('admin_hard_delete_user', { p_user_id: p.id });
            setActionId(null);
            if (error) { Alert.alert('Error', error.message); return; }
            setProfiles((prev) => prev.filter((x) => x.id !== p.id));
          },
        },
      ],
    );
  };

  const clients = profiles.filter((p) => p.role === 'client');
  const coaches = profiles.filter((p) => p.role === 'coach');

  const renderRow = (p: DeactivatedProfile) => {
    const busy = actionId === p.id;
    const roleColor = p.role === 'coach' ? Colors.accent : '#4CAF50';
    return (
      <View key={p.id} style={[s.row, isDesktop && s.rowDesktop]}>
        <View style={[s.avatar, { backgroundColor: roleColor + '18', borderColor: roleColor + '40' }]}>
          <Text style={[s.avatarText, { color: roleColor }]}>{initials(p.name)}</Text>
        </View>
        <View style={s.info}>
          <Text style={s.name}>{p.name}</Text>
          <Text style={s.email}>{p.email}</Text>
          <Text style={s.deactivatedDate}>Deactivated {fmtDate(p.deactivated_at)}</Text>
        </View>
        <View style={s.actions}>
          <Pressable
            style={[s.restoreBtn, busy && { opacity: 0.4 }]}
            onPress={() => handleRestore(p)}
            disabled={!!actionId}
          >
            {busy
              ? <ActivityIndicator size="small" color={Colors.accent} />
              : <>
                  <Ionicons name="refresh-outline" size={14} color={Colors.accent} />
                  <Text style={s.restoreBtnText}>Restore</Text>
                </>
            }
          </Pressable>
          <Pressable
            style={[s.deleteBtn, busy && { opacity: 0.4 }]}
            onPress={() => handleDeleteForever(p)}
            disabled={!!actionId}
          >
            <Ionicons name="trash-outline" size={14} color={Colors.danger} />
            <Text style={s.deleteBtnText}>Delete Forever</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const Section = ({ title, items }: { title: string; items: DeactivatedProfile[] }) => {
    if (items.length === 0) return null;
    return (
      <View style={s.section}>
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={s.card}>
          {items.map((p, i) => (
            <View key={p.id}>
              {renderRow(p)}
              {i < items.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
        >
          <View style={[s.inner, isDesktop && s.innerDesktop]}>
            {profiles.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="trash-outline" size={52} color={Colors.border} />
                <Text style={s.emptyTitle}>Recycle bin is empty</Text>
                <Text style={s.emptySub}>Deactivated accounts will appear here</Text>
              </View>
            ) : (
              <>
                <View style={s.hint}>
                  <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
                  <Text style={s.hintText}>
                    Restore to bring an account back. Delete Forever is permanent and removes all data.
                  </Text>
                </View>
                <Section title="COACHES" items={coaches} />
                <Section title="CLIENTS" items={clients} />
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

  content: { padding: 16, paddingBottom: 48 },
  contentDesktop: { padding: 32 },
  inner: { gap: 20 },
  innerDesktop: { maxWidth: 760, alignSelf: 'center', width: '100%' },

  hint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, backgroundColor: Colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  hintText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.border },

  row: { padding: 14, gap: 12, flexDirection: 'row', alignItems: 'center' },
  rowDesktop: { paddingVertical: 16, paddingHorizontal: 20 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 14, fontWeight: '800' },
  info: { flex: 1, gap: 2 },
  name: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700' },
  email: { ...Typography.caption, color: Colors.textSecondary },
  deactivatedDate: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },

  actions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.accent + '60',
    borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10,
    backgroundColor: Colors.accent + '0D', minWidth: 80, justifyContent: 'center',
  },
  restoreBtnText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.danger + '60',
    borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10,
    backgroundColor: Colors.danger + '08',
  },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: Colors.danger },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: Colors.textSecondary },
});
