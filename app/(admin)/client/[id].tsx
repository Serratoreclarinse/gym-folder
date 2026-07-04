import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type ClientProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type Pkg = {
  id: string;
  packageType: '30min' | '45min' | '1hr';
  totalSessions: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  status: 'active' | 'expired';
  startDate: string;
  durationWeeks: number | null;
  coachId: string;
  coachName: string;
};

type SessionRow = {
  id: string;
  sessionDate: string;
  durationMinutes: number;
  notes: string | null;
  status: string | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  paid_at: string;
};

const PAY_METHOD: Record<string, string> = {
  cash: 'Cash', gcash: 'GCash', maya: 'Maya', bank_transfer: 'Bank Transfer', other: 'Other',
};

type PackageType = '30min' | '45min' | '1hr';
const PKG_OPTIONS: { value: PackageType; label: string }[] = [
  { value: '30min', label: '30 min' },
  { value: '45min', label: '45 min' },
  { value: '1hr',   label: '1 hour' },
];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit profile
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Add sessions modal
  const [addModal, setAddModal] = useState(false);
  const [addTarget, setAddTarget] = useState<Pkg | null>(null);
  const [sessionsToAdd, setSessionsToAdd] = useState('');
  const [addingSessions, setAddingSessions] = useState(false);

  // Renew modal
  const [renewModal, setRenewModal] = useState(false);
  const [renewTarget, setRenewTarget] = useState<Pkg | null>(null);
  const [renewPkgType, setRenewPkgType] = useState<PackageType>('1hr');
  const [renewTotal, setRenewTotal] = useState('');
  const [renewWeeks, setRenewWeeks] = useState('');
  const [renewing, setRenewing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [profileRes, pkgsRes, sessRes, payRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email, phone').eq('id', id).single(),
      supabase
        .from('packages')
        .select(`
          id, package_type, total_sessions, sessions_used, sessions_remaining,
          status, start_date, duration_weeks, coach_id,
          coach:profiles!packages_coach_id_fkey(name)
        `)
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('workout_sessions')
        .select('id, session_date, duration_minutes, notes, status')
        .eq('client_id', id)
        .order('session_date', { ascending: false })
        .limit(15),
      supabase
        .from('payments')
        .select('id, amount, payment_method, notes, paid_at')
        .eq('client_id', id)
        .order('paid_at', { ascending: false })
        .limit(10),
    ]);

    if (profileRes.data) {
      const p = profileRes.data as any;
      setClient(p);
      setEditName(p.name);
      setEditPhone(p.phone ?? '');
    }

    setPackages(
      (pkgsRes.data ?? []).map((row: any) => ({
        id: row.id,
        packageType: row.package_type,
        totalSessions: row.total_sessions,
        sessionsUsed: row.sessions_used,
        sessionsRemaining: row.sessions_remaining,
        status: row.status,
        startDate: row.start_date,
        durationWeeks: row.duration_weeks ?? null,
        coachId: row.coach_id,
        coachName: (row.coach as { name: string } | null)?.name ?? 'Unknown',
      })),
    );

    setSessions(
      (sessRes.data ?? []).map((row: any) => ({
        id: row.id,
        sessionDate: row.session_date,
        durationMinutes: row.duration_minutes,
        notes: row.notes ?? null,
        status: row.status ?? null,
      })),
    );

    setPayments((payRes.data ?? []) as PaymentRow[]);

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
    setClient((c) => c ? { ...c, name: editName.trim(), phone: editPhone.trim() || null } : c);
    setEditing(false);
  };

  const handleDeactivate = (pkg: Pkg) => {
    Alert.alert(
      'Deactivate Package',
      `This will mark ${client?.name ?? "this client"}'s package as expired. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('admin_deactivate_package', { p_package_id: pkg.id });
            if (error) { Alert.alert('Error', error.message); return; }
            load();
          },
        },
      ],
    );
  };

  const handleAddSessions = async () => {
    if (!addTarget) return;
    const n = parseInt(sessionsToAdd, 10);
    if (!n || n < 1) { Alert.alert('Invalid', 'Enter a number greater than 0.'); return; }
    setAddingSessions(true);
    const { error } = await supabase.rpc('admin_add_sessions', {
      p_package_id: addTarget.id,
      p_sessions_to_add: n,
    });
    setAddingSessions(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setAddModal(false);
    setSessionsToAdd('');
    load();
  };

  const handleRenew = async () => {
    if (!renewTarget || !renewTotal || parseInt(renewTotal, 10) < 1) {
      Alert.alert('Invalid', 'Enter total sessions (at least 1).');
      return;
    }
    if (!client) return;
    setRenewing(true);
    const { data, error } = await supabase.functions.invoke('create-client', {
      body: {
        name: client.name,
        email: client.email,
        phone: client.phone || null,
        package_type: renewPkgType,
        total_sessions: parseInt(renewTotal, 10),
        coach_id: renewTarget.coachId,
        ...(renewWeeks && parseInt(renewWeeks, 10) > 0 ? { duration_weeks: parseInt(renewWeeks, 10) } : {}),
      },
    });
    setRenewing(false);
    if (error || data?.error) {
      Alert.alert('Error', data?.error ?? error?.message ?? 'Failed to renew');
      return;
    }
    setRenewModal(false);
    setRenewTotal('');
    setRenewWeeks('');
    load();
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }
  if (!client) {
    return <View style={s.center}><Text style={s.grayText}>Client not found.</Text></View>;
  }

  const activePkg = packages.find((p) => p.status === 'active') ?? null;
  const pastPkgs = packages.filter((p) => p.status !== 'active');
  const fillPct = activePkg
    ? Math.min(100, (activePkg.sessionsUsed / activePkg.totalSessions) * 100)
    : 0;

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
      >
        <View style={[s.inner, isDesktop && s.innerDesktop]}>

          {/* Profile card */}
          <View style={s.profileCard}>
            <View style={s.avatarLg}>
              <Text style={s.avatarLgText}>{initials(client.name)}</Text>
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
                      onPress={() => { setEditing(false); setEditName(client.name); setEditPhone(client.phone ?? ''); }}
                    >
                      <Text style={s.cancelEditText}>CANCEL</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.clientName}>{client.name}</Text>
                  <Text style={s.clientEmail}>{client.email}</Text>
                  {client.phone && <Text style={s.clientPhone}>{client.phone}</Text>}
                  {activePkg && (
                    <View style={s.coachPill}>
                      <Ionicons name="person-circle-outline" size={13} color={Colors.textSecondary} />
                      <Text style={s.coachPillText}>{activePkg.coachName}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
            {!editing && (
              <Pressable style={s.editBtn} onPress={() => setEditing(true)}>
                <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Package section */}
          <Text style={s.sectionTitle}>CURRENT PACKAGE</Text>

          {!activePkg ? (
            <View style={s.noPkgCard}>
              <Ionicons name="cube-outline" size={36} color={Colors.border} />
              <Text style={s.noPkgText}>No active package</Text>
              {pastPkgs.length > 0 ? (
                <Pressable
                  style={s.renewFromEmpty}
                  onPress={() => {
                    setRenewTarget(pastPkgs[0]);
                    setRenewPkgType(pastPkgs[0].packageType);
                    setRenewTotal('');
                    setRenewWeeks('');
                    setRenewModal(true);
                  }}
                >
                  <Text style={s.renewFromEmptyText}>RENEW PACKAGE</Text>
                </Pressable>
              ) : (
                <Text style={s.noPkgSub}>Use Add Client to create a package.</Text>
              )}
            </View>
          ) : (
            <View style={s.pkgCard}>
              {/* Header row */}
              <View style={s.pkgHeader}>
                <View style={s.pkgTypeBadge}>
                  <Text style={s.pkgTypeText}>
                    {activePkg.packageType === '30min' ? '30 MIN'
                      : activePkg.packageType === '45min' ? '45 MIN' : '1 HOUR'}
                  </Text>
                </View>
                <View style={s.activePill}>
                  <Text style={s.activePillText}>ACTIVE</Text>
                </View>
              </View>

              {/* Progress */}
              <View style={s.progressSection}>
                <View style={s.progressLabelRow}>
                  <Text style={s.progressLabel}>Sessions Used</Text>
                  <Text style={s.progressFraction}>
                    {activePkg.sessionsUsed} / {activePkg.totalSessions}
                  </Text>
                </View>
                <View style={s.progressBg}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${fillPct}%` as any,
                        backgroundColor: activePkg.sessionsRemaining <= 3 ? Colors.accent : '#4CAF50',
                      },
                    ]}
                  />
                </View>
                <Text style={s.sessionsLeft}>
                  <Text style={{
                    color: activePkg.sessionsRemaining <= 3 ? Colors.accent : '#4CAF50',
                    fontWeight: '800',
                  }}>
                    {activePkg.sessionsRemaining}
                  </Text>
                  {' '}sessions remaining
                </Text>
              </View>

              {/* Meta */}
              <View style={s.pkgMeta}>
                <View style={s.pkgMetaRow}>
                  <Text style={s.pkgMetaLabel}>Started</Text>
                  <Text style={s.pkgMetaValue}>{fmtDate(activePkg.startDate)}</Text>
                </View>
                {activePkg.durationWeeks && (
                  <View style={s.pkgMetaRow}>
                    <Text style={s.pkgMetaLabel}>Duration</Text>
                    <Text style={s.pkgMetaValue}>{activePkg.durationWeeks} weeks</Text>
                  </View>
                )}
                <View style={s.pkgMetaRow}>
                  <Text style={s.pkgMetaLabel}>Coach</Text>
                  <Text style={s.pkgMetaValue}>{activePkg.coachName}</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={s.pkgActions}>
                <Pressable
                  style={s.actionPrimary}
                  onPress={() => { setAddTarget(activePkg); setSessionsToAdd(''); setAddModal(true); }}
                >
                  <Ionicons name="add-circle-outline" size={15} color={Colors.bg} />
                  <Text style={s.actionPrimaryText}>Add Sessions</Text>
                </Pressable>
                <Pressable
                  style={s.actionSecondary}
                  onPress={() => {
                    setRenewTarget(activePkg);
                    setRenewPkgType(activePkg.packageType);
                    setRenewTotal('');
                    setRenewWeeks('');
                    setRenewModal(true);
                  }}
                >
                  <Ionicons name="refresh-outline" size={15} color={Colors.accent} />
                  <Text style={s.actionSecondaryText}>Renew</Text>
                </Pressable>
                <Pressable style={s.actionDanger} onPress={() => handleDeactivate(activePkg)}>
                  <Ionicons name="close-circle-outline" size={15} color={Colors.accent} />
                  <Text style={s.actionDangerText}>Deactivate</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Session history */}
          {sessions.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 24 }]}>SESSION HISTORY</Text>
              <View style={s.historyList}>
                {sessions.map((sess) => {
                  const d = new Date(sess.sessionDate);
                  return (
                    <View key={sess.id} style={s.historyRow}>
                      <View style={s.historyDateCol}>
                        <Text style={s.historyDay}>
                          {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </Text>
                        <Text style={s.historyYear}>{d.getFullYear()}</Text>
                      </View>
                      <View style={s.historyMid}>
                        <Text style={s.historyDur}>{sess.durationMinutes} min</Text>
                        {sess.notes
                          ? <Text style={s.historyNotes} numberOfLines={1}>{sess.notes}</Text>
                          : null}
                      </View>
                      {sess.status === 'no_show' && (
                        <View style={s.noShowBadge}>
                          <Text style={s.noShowText}>NO SHOW</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Past packages */}
          {pastPkgs.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 24 }]}>PAST PACKAGES</Text>
              <View style={s.historyList}>
                {pastPkgs.map((pkg) => (
                  <View key={pkg.id} style={s.pastPkgRow}>
                    <View>
                      <Text style={s.pastPkgType}>
                        {pkg.packageType === '30min' ? '30 min'
                          : pkg.packageType === '45min' ? '45 min' : '1 hour'}
                      </Text>
                      <Text style={s.pastPkgDate}>{fmtDate(pkg.startDate)}</Text>
                    </View>
                    <Text style={s.pastPkgUsed}>{pkg.sessionsUsed}/{pkg.totalSessions} used</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Payment history */}
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>PAYMENT HISTORY</Text>
          <View style={s.historyList}>
            {payments.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={s.grayText}>No payments recorded</Text>
              </View>
            ) : (
              payments.map((p) => {
                const d = new Date(p.paid_at);
                return (
                  <View key={p.id} style={[s.historyRow, { justifyContent: 'space-between' }]}>
                    <View style={s.historyMid}>
                      <Text style={s.historyDur}>{PAY_METHOD[p.payment_method] ?? p.payment_method}</Text>
                      <Text style={s.historyNotes}>
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </Text>
                    </View>
                    <Text style={s.payAmount}>
                      OMR {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Sessions Modal */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Add Sessions</Text>
            <Text style={s.modalSub}>
              Current remaining: {addTarget?.sessionsRemaining ?? 0}
            </Text>
            <TextInput
              style={s.modalInput}
              value={sessionsToAdd}
              onChangeText={(v) => setSessionsToAdd(v.replace(/[^0-9]/g, ''))}
              placeholder="Number of sessions to add"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={s.modalActions}>
              <Pressable
                style={[s.modalBtnPrimary, addingSessions && { opacity: 0.5 }]}
                onPress={handleAddSessions}
                disabled={addingSessions}
              >
                <Text style={s.modalBtnPrimaryText}>{addingSessions ? 'ADDING…' : 'ADD'}</Text>
              </Pressable>
              <Pressable style={s.modalBtnCancel} onPress={() => setAddModal(false)}>
                <Text style={s.modalBtnCancelText}>CANCEL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Renew Modal */}
      <Modal visible={renewModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Renew Package</Text>
            <Text style={s.modalSub}>A new package will be created for this client.</Text>

            <Text style={s.modalLabel}>Session Duration</Text>
            <View style={s.segmented}>
              {PKG_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[s.segment, renewPkgType === opt.value && s.segmentActive]}
                  onPress={() => setRenewPkgType(opt.value)}
                >
                  <Text style={[s.segmentText, renewPkgType === opt.value && s.segmentActiveText]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.modalLabel}>Total Sessions *</Text>
            <TextInput
              style={s.modalInput}
              value={renewTotal}
              onChangeText={(v) => setRenewTotal(v.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 12"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="number-pad"
            />

            <Text style={s.modalLabel}>Duration (weeks) — optional</Text>
            <TextInput
              style={s.modalInput}
              value={renewWeeks}
              onChangeText={(v) => setRenewWeeks(v.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 6"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="number-pad"
            />

            <View style={s.modalActions}>
              <Pressable
                style={[s.modalBtnPrimary, renewing && { opacity: 0.5 }]}
                onPress={handleRenew}
                disabled={renewing}
              >
                <Text style={s.modalBtnPrimaryText}>{renewing ? 'CREATING…' : 'RENEW'}</Text>
              </Pressable>
              <Pressable style={s.modalBtnCancel} onPress={() => setRenewModal(false)}>
                <Text style={s.modalBtnCancelText}>CANCEL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
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

  // Profile
  profileCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18, gap: 14, marginBottom: 16,
  },
  avatarLg: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#4CAF5018',
    borderWidth: 2, borderColor: '#4CAF5050',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarLgText: { fontSize: 20, fontWeight: '800', color: '#4CAF50' },
  profileRight: { flex: 1 },
  clientName: { ...Typography.subtitle, color: Colors.textPrimary, fontWeight: '700', marginBottom: 3 },
  clientEmail: { ...Typography.body, color: Colors.textSecondary, marginBottom: 2 },
  clientPhone: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 4 },
  coachPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coachPillText: { ...Typography.caption, color: Colors.textSecondary },
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

  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 12 },

  // No package
  noPkgCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', padding: 32, gap: 8,
  },
  noPkgText: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 4 },
  noPkgSub: { ...Typography.body, color: Colors.textSecondary },
  renewFromEmpty: {
    marginTop: 8, backgroundColor: Colors.accent, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  renewFromEmptyText: { color: Colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

  // Package card
  pkgCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18, gap: 16,
  },
  pkgHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pkgTypeBadge: {
    backgroundColor: Colors.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  pkgTypeText: { color: Colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  activePill: {
    backgroundColor: '#4CAF5018', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#4CAF5040',
  },
  activePillText: { color: '#4CAF50', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },

  progressSection: { gap: 6 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...Typography.caption, color: Colors.textSecondary },
  progressFraction: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  progressBg: {
    height: 6, backgroundColor: Colors.border,
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  sessionsLeft: { ...Typography.body, color: Colors.textSecondary },

  pkgMeta: {
    backgroundColor: Colors.bg, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  pkgMetaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border + '60',
  },
  pkgMetaLabel: { ...Typography.caption, color: Colors.textSecondary },
  pkgMetaValue: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },

  pkgActions: { flexDirection: 'row', gap: 8 },
  actionPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 10,
  },
  actionPrimaryText: { color: Colors.bg, fontSize: 12, fontWeight: '700' },
  actionSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: Colors.accent + '15', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  actionSecondaryText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  actionDanger: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: Colors.border + '40', borderRadius: 10, paddingVertical: 10,
  },
  actionDangerText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },

  // Session history
  historyList: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border + '60',
  },
  historyDateCol: { width: 52, alignItems: 'center' },
  historyDay: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  historyYear: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  historyMid: { flex: 1 },
  historyDur: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  historyNotes: { ...Typography.caption, color: Colors.textSecondary },
  noShowBadge: {
    backgroundColor: Colors.accent + '18', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  noShowText: { color: Colors.accent, fontSize: 10, fontWeight: '700' },

  // Past packages
  pastPkgRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border + '60',
  },
  pastPkgType: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  pastPkgDate: { ...Typography.caption, color: Colors.textSecondary },
  pastPkgUsed: { ...Typography.caption, color: Colors.textSecondary },
  payAmount: { fontSize: 15, fontWeight: '800', color: '#4CAF50', flexShrink: 0 },

  // Modals
  overlay: {
    flex: 1, backgroundColor: '#00000080',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 12,
  },
  modalTitle: { ...Typography.subtitle, color: Colors.textPrimary, fontWeight: '700' },
  modalSub: { ...Typography.body, color: Colors.textSecondary, marginTop: -4 },
  modalLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: -4 },
  modalInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: Colors.textPrimary, fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtnPrimary: {
    flex: 1, backgroundColor: Colors.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  modalBtnPrimaryText: { color: Colors.bg, fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },
  modalBtnCancel: {
    backgroundColor: Colors.border + '40', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center',
  },
  modalBtnCancelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },

  segmented: {
    flexDirection: 'row', backgroundColor: Colors.bg,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    padding: 3, gap: 3,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  segmentActiveText: { color: Colors.bg },
});
