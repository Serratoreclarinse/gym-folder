import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

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
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [profiles, setProfiles] = useState<DeactivatedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === profiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(profiles.map((p) => p.id)));
    }
  };

  const handleRestore = async (p: DeactivatedProfile) => {
    setActionId(p.id);
    const { error } = await supabase.rpc('admin_restore_account', { p_user_id: p.id });
    setActionId(null);
    if (error) { Alert.alert('Error', error.message); return; }
    setProfiles((prev) => prev.filter((x) => x.id !== p.id));
  };

  const fiveMonthsAgo = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString();
  const oldProfiles = profiles.filter((p) => p.deactivated_at < fiveMonthsAgo);

  const handlePurgeOld = () => {
    const count = oldProfiles.length;
    if (count === 0) return;
    const confirmed = window.confirm(`Purge ${count} account${count !== 1 ? 's' : ''} deactivated 5+ months ago?\n\nThis CANNOT be undone.`);
    if (!confirmed) return;
    (async () => {
      setPurging(true);
      for (const p of oldProfiles) {
        await supabase.functions.invoke('delete-user', { body: { user_id: p.id } });
      }
      setPurging(false);
      load();
    })();
  };

  const handleDeleteForever = (p: DeactivatedProfile) => {
    const confirmed = window.confirm(`Delete Forever: ${p.name}?\n\nThis will permanently delete their account and all data (sessions, packages, payments). This CANNOT be undone.`);
    if (!confirmed) return;
    (async () => {
      setActionId(p.id);
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { user_id: p.id } });
      setActionId(null);
      const errMsg = data?.error ?? error?.message ?? null;
      if (errMsg) { Alert.alert('Delete Failed', errMsg); return; }
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
    })();
  };

  const handleDeleteSelected = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    const names = profiles
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.name)
      .join(', ');
    const confirmed = window.confirm(
      `Delete ${count} account${count !== 1 ? 's' : ''} forever?\n\n${names}\n\nThis will permanently delete all their data. This CANNOT be undone.`
    );
    if (!confirmed) return;
    (async () => {
      setPurging(true);
      for (const id of selectedIds) {
        await supabase.functions.invoke('delete-user', { body: { user_id: id } });
      }
      setPurging(false);
      setSelectedIds(new Set());
      setSelectMode(false);
      load();
    })();
  };

  const clients = profiles.filter((p) => p.role === 'client');
  const coaches = profiles.filter((p) => p.role === 'coach');
  const allSelected = selectedIds.size === profiles.length && profiles.length > 0;

  const renderRow = (p: DeactivatedProfile) => {
    const busy = actionId === p.id;
    const roleColor = p.role === 'coach' ? colors.accent : colors.success;
    const isSelected = selectedIds.has(p.id);

    if (selectMode) {
      return (
        <Pressable
          key={p.id}
          style={({ pressed }) => [
            s.row, isDesktop && s.rowDesktop,
            isSelected && { backgroundColor: colors.danger + '12' },
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => toggleSelect(p.id)}
        >
          <View style={[s.checkbox, isSelected && { backgroundColor: colors.danger, borderColor: colors.danger }]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <View style={[s.avatar, { backgroundColor: roleColor + '18', borderColor: roleColor + '40' }]}>
            <Text style={[s.avatarText, { color: roleColor }]}>{initials(p.name)}</Text>
          </View>
          <View style={s.info}>
            <Text style={s.name}>{p.name}</Text>
            <Text style={s.email}>{p.email}</Text>
            <Text style={s.deactivatedDate}>Deactivated {fmtDate(p.deactivated_at)}</Text>
          </View>
        </Pressable>
      );
    }

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
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <>
                  <Ionicons name="refresh-outline" size={14} color={colors.accent} />
                  <Text style={s.restoreBtnText}>Restore</Text>
                </>
            }
          </Pressable>
          <Pressable
            style={[s.deleteBtn, busy && { opacity: 0.4 }]}
            onPress={() => handleDeleteForever(p)}
            disabled={!!actionId}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
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
        <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[s.content, isDesktop && s.contentDesktop, selectMode && { paddingBottom: 100 }]}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
          >
            <View style={[s.inner, isDesktop && s.innerDesktop]}>
              {profiles.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="trash-outline" size={52} color={colors.border} />
                  <Text style={s.emptyTitle}>Recycle bin is empty</Text>
                  <Text style={s.emptySub}>Deactivated accounts will appear here</Text>
                </View>
              ) : (
                <>
                  {/* Toolbar row */}
                  <View style={s.toolbar}>
                    <View style={s.hint}>
                      <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
                      <Text style={s.hintText}>
                        Restore to bring an account back. Delete Forever is permanent and removes all data.
                      </Text>
                    </View>
                    <Pressable
                      style={[s.selectBtn, selectMode && s.selectBtnActive]}
                      onPress={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                    >
                      <Ionicons
                        name={selectMode ? 'close-outline' : 'checkmark-circle-outline'}
                        size={16}
                        color={selectMode ? colors.textPrimary : colors.accent}
                      />
                      <Text style={[s.selectBtnText, selectMode && { color: colors.textPrimary }]}>
                        {selectMode ? 'Cancel' : 'Select'}
                      </Text>
                    </Pressable>
                  </View>

                  {!selectMode && oldProfiles.length > 0 && (
                    <Pressable
                      style={[s.purgeBtn, purging && { opacity: 0.5 }]}
                      onPress={handlePurgeOld}
                      disabled={purging || !!actionId}
                    >
                      {purging
                        ? <ActivityIndicator size="small" color={colors.danger} />
                        : <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      }
                      <Text style={s.purgeBtnText}>
                        Purge {oldProfiles.length} Old Account{oldProfiles.length !== 1 ? 's' : ''} (5+ months)
                      </Text>
                    </Pressable>
                  )}

                  <Section title="COACHES" items={coaches} />
                  <Section title="CLIENTS" items={clients} />
                </>
              )}
            </View>
          </ScrollView>

          {/* Floating bottom bar — select mode only */}
          {selectMode && (
            <View style={s.bottomBar}>
              <Pressable style={s.selectAllBtn} onPress={handleSelectAll}>
                <Ionicons
                  name={allSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={allSelected ? colors.danger : colors.textSecondary}
                />
                <Text style={[s.selectAllText, allSelected && { color: colors.danger }]}>
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Text>
              </Pressable>
              <Text style={s.selectedCount}>
                {selectedIds.size} selected
              </Text>
              <Pressable
                style={[s.deleteSelectedBtn, selectedIds.size === 0 && { opacity: 0.4 }]}
                onPress={handleDeleteSelected}
                disabled={selectedIds.size === 0 || purging}
              >
                {purging
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="trash-outline" size={15} color="#fff" />
                }
                <Text style={s.deleteSelectedText}>
                  Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    content: { padding: 16, paddingBottom: 48 },
    contentDesktop: { padding: 32 },
    inner: { gap: 20 },
    innerDesktop: { maxWidth: 760, alignSelf: 'center', width: '100%' },

    toolbar: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    hint: {
      flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      padding: 12, backgroundColor: c.surface,
      borderRadius: 10, borderWidth: 1, borderColor: c.border,
    },
    hintText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 18 },

    selectBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: c.accent + '60', borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10,
      backgroundColor: c.accent + '0D', flexShrink: 0,
    },
    selectBtnActive: {
      borderColor: c.border, backgroundColor: c.surface,
    },
    selectBtnText: { fontSize: 13, fontWeight: '700', color: c.accent },

    section: { gap: 10 },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: c.textSecondary, letterSpacing: 1 },
    card: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    },
    divider: { height: 1, backgroundColor: c.border },

    row: { padding: 14, gap: 12, flexDirection: 'row', alignItems: 'center' },
    rowDesktop: { paddingVertical: 16, paddingHorizontal: 20 },
    checkbox: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 1.5, borderColor: c.border,
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    avatar: {
      width: 42, height: 42, borderRadius: 21,
      borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    avatarText: { fontSize: 14, fontWeight: '800' },
    info: { flex: 1, gap: 2 },
    name: { ...Typography.body, color: c.textPrimary, fontWeight: '700' },
    email: { ...Typography.caption, color: c.textSecondary },
    deactivatedDate: { fontSize: 11, color: c.textSecondary, fontStyle: 'italic', marginTop: 2 },

    actions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
    restoreBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: c.accent + '60',
      borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10,
      backgroundColor: c.accent + '0D', minWidth: 80, justifyContent: 'center',
    },
    restoreBtnText: { fontSize: 12, fontWeight: '700', color: c.accent },
    deleteBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: c.danger + '60',
      borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10,
      backgroundColor: c.danger + '08',
    },
    deleteBtnText: { fontSize: 12, fontWeight: '700', color: c.danger },

    purgeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderWidth: 1, borderColor: c.danger + '60', borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10,
      backgroundColor: c.danger + '0A',
    },
    purgeBtnText: { fontSize: 13, fontWeight: '700', color: c.danger, flex: 1 },

    // Bottom action bar
    bottomBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: c.surface,
      borderTopWidth: 1, borderTopColor: c.border,
    },
    selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    selectAllText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    selectedCount: { flex: 1, fontSize: 13, fontWeight: '700', color: c.textPrimary, textAlign: 'center' },
    deleteSelectedBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.danger, borderRadius: 10,
      paddingHorizontal: 16, paddingVertical: 10,
    },
    deleteSelectedText: { fontSize: 13, fontWeight: '800', color: '#fff' },

    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
    emptySub: { ...Typography.body, color: c.textSecondary },
  });
}
