import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushNotifications';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type ClientProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  referred_by: string | null;
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
  extendedDays: number;
  coachId: string;
  coachName: string;
};

type FreezeRequest = {
  id: string;
  packageId: string;
  coachId: string;
  coachName: string;
  freezeStart: string;
  freezeEnd: string;
  daysFrozen: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
};

type SessionRow = {
  id: string;
  sessionDate: string;
  durationMinutes: number;
  sessionType: string;
  notes: string | null;
  status: string | null;
  exercises: Array<{
    exercise_name: string;
    sets: number | null;
    reps: number | null;
    weight: string | null;
    duration: string | null;
  }>;
};

type PaymentRow = {
  id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  paid_at: string;
  transaction_ref: string | null;
  invoice_number: string | null;
};

const PAY_METHOD: Record<string, string> = {
  cash: 'Cash', bank_muscat: 'Bank Muscat', nbo: 'NBO', oab: 'OAB',
  bank_dhofar: 'Bank Dhofar', ahli_bank: 'Ahli Bank', sohar: 'Sohar Intl',
  hsbc: 'HSBC Oman', bank_nizwa: 'Bank Nizwa', other: 'Other',
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
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Payment request
  const [showPayReqModal, setShowPayReqModal] = useState(false);
  const [payReqAmount, setPayReqAmount] = useState('');
  const [payReqNotes, setPayReqNotes] = useState('');
  const [sendingPayReq, setSendingPayReq] = useState(false);
  const [payReqSent, setPayReqSent] = useState(false);

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
  const [deactivating, setDeactivating] = useState(false);

  // Freeze requests
  const [freezes, setFreezes] = useState<FreezeRequest[]>([]);
  const [approvingFreezeId, setApprovingFreezeId] = useState<string | null>(null);
  const [rejectingFreezeId, setRejectingFreezeId] = useState<string | null>(null);

  // Assign package modal (first-time, no previous package)
  const [assignModal, setAssignModal] = useState(false);
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [assignCoachId, setAssignCoachId] = useState('');
  const [assignPkgType, setAssignPkgType] = useState<PackageType>('1hr');
  const [assignTotal, setAssignTotal] = useState('');
  const [assignWeeks, setAssignWeeks] = useState('');
  const [assigning, setAssigning] = useState(false);

  const handleDeactivateAccount = async () => {
    const msg = `Move ${client?.name ?? 'this client'} to the Recycle Bin? They will no longer appear in the clients list. You can restore them later.`;
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      setDeactivating(true);
      const { error } = await supabase.rpc('admin_deactivate_account', { p_user_id: id });
      setDeactivating(false);
      if (error) { window.alert('Error: ' + error.message); return; }
      router.back();
      return;
    }
    Alert.alert('Deactivate Account', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive',
        onPress: async () => {
          setDeactivating(true);
          const { error } = await supabase.rpc('admin_deactivate_account', { p_user_id: id });
          setDeactivating(false);
          if (error) { Alert.alert('Error', error.message); return; }
          router.back();
        },
      },
    ]);
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [profileRes, pkgsRes, sessRes, payRes, freezeRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email, phone, referred_by').eq('id', id).single(),
      supabase
        .from('packages')
        .select(`
          id, package_type, total_sessions, sessions_used, sessions_remaining,
          status, start_date, duration_weeks, extended_days, coach_id,
          coach:profiles!packages_coach_id_fkey(name)
        `)
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('workout_sessions')
        .select('id, session_date, duration_minutes, session_type, notes, status, exercises')
        .eq('client_id', id)
        .order('session_date', { ascending: false })
        .limit(200),
      supabase
        .from('payments')
        .select('id, amount, payment_method, notes, paid_at, transaction_ref, invoice_number')
        .eq('client_id', id)
        .order('paid_at', { ascending: false })
        .limit(10),
      supabase
        .from('package_freezes')
        .select(`
          id, package_id, coach_id, freeze_start, freeze_end, reason, status, requested_at,
          coach:profiles!package_freezes_coach_id_fkey(name)
        `)
        .eq('client_id', id)
        .in('status', ['pending', 'approved'])
        .order('requested_at', { ascending: false }),
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
        extendedDays: row.extended_days ?? 0,
        coachId: row.coach_id,
        coachName: (row.coach as { name: string } | null)?.name ?? 'Unknown',
      })),
    );

    setFreezes(
      (freezeRes.data ?? []).map((row: any) => {
        const start = new Date(row.freeze_start);
        const end   = new Date(row.freeze_end);
        const days  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
        return {
          id: row.id,
          packageId: row.package_id,
          coachId: row.coach_id,
          coachName: (row.coach as { name: string } | null)?.name ?? 'Unknown',
          freezeStart: row.freeze_start,
          freezeEnd: row.freeze_end,
          daysFrozen: days,
          reason: row.reason ?? null,
          status: row.status,
          requestedAt: row.requested_at,
        };
      }),
    );

    setSessions(
      (sessRes.data ?? []).map((row: any) => ({
        id: row.id,
        sessionDate: row.session_date,
        durationMinutes: row.duration_minutes,
        sessionType: row.session_type ?? 'gym',
        notes: row.notes ?? null,
        status: row.status ?? null,
        exercises: Array.isArray(row.exercises) ? row.exercises : (typeof row.exercises === 'string' ? (() => { try { return JSON.parse(row.exercises); } catch { return []; } })() : []),
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

    // Insert new package first — if this fails, old package remains untouched
    const { error: insertErr } = await supabase.from('packages').insert({
      coach_id: renewTarget.coachId,
      client_id: client.id,
      package_type: renewPkgType,
      total_sessions: parseInt(renewTotal, 10),
      sessions_used: 0,
      status: 'active',
      start_date: new Date().toISOString().slice(0, 10),
      ...(renewWeeks && parseInt(renewWeeks, 10) > 0 ? { duration_weeks: parseInt(renewWeeks, 10) } : {}),
    });

    if (insertErr) {
      setRenewing(false);
      Alert.alert('Error', insertErr.message ?? 'Failed to create new package');
      return;
    }

    // New package confirmed — now expire the previous one
    await supabase.from('packages').update({ status: 'expired' }).eq('id', renewTarget.id);

    setRenewing(false);
    setRenewModal(false);
    setRenewTotal('');
    setRenewWeeks('');
    load();
  };

  const openAssignModal = async () => {
    const { data } = await supabase.from('profiles').select('id, name').eq('role', 'coach').is('deactivated_at', null).order('name');
    setCoaches(data ?? []);
    setAssignCoachId('');
    setAssignPkgType('1hr');
    setAssignTotal('');
    setAssignWeeks('');
    setAssignModal(true);
  };

  const handleAssign = async () => {
    if (!assignCoachId) { Alert.alert('Select a coach', 'Choose which coach this client belongs to.'); return; }
    if (!assignTotal || parseInt(assignTotal, 10) < 1) { Alert.alert('Invalid', 'Enter total sessions (at least 1).'); return; }
    if (!client) return;
    setAssigning(true);
    const { error } = await supabase.from('packages').insert({
      coach_id: assignCoachId,
      client_id: client.id,
      package_type: assignPkgType,
      total_sessions: parseInt(assignTotal, 10),
      sessions_used: 0,
      status: 'active',
      start_date: new Date().toISOString().slice(0, 10),
      ...(assignWeeks && parseInt(assignWeeks, 10) > 0 ? { duration_weeks: parseInt(assignWeeks, 10) } : {}),
    });
    setAssigning(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setAssignModal(false);
    load();
  };

  const handleSendPaymentRequest = async () => {
    if (!id) return;
    setSendingPayReq(true);
    const amt = payReqAmount.trim();
    const bodyText = amt
      ? `OMR ${amt} is due for your training package. Please complete your payment at your earliest convenience.`
      : `You have a pending payment for your training package. Please contact your coach to settle.`;
    const notesPart = payReqNotes.trim() ? `\nNote: ${payReqNotes.trim()}` : '';
    await sendPushNotification(id, {
      title: '💳 Payment Request',
      body: bodyText + notesPart,
    });
    setSendingPayReq(false);
    setPayReqSent(true);
    setPayReqAmount('');
    setPayReqNotes('');
    setTimeout(() => { setShowPayReqModal(false); setPayReqSent(false); }, 1500);
  };

  const handleApproveFreeze = async (freeze: FreezeRequest) => {
    if (!activePkg) return;
    const msg = `Approve ${freeze.daysFrozen}-day freeze for ${client?.name ?? 'this client'}? End date will extend by ${freeze.daysFrozen} days.`;
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
    }
    setApprovingFreezeId(freeze.id);
    const newExtended = activePkg.extendedDays + freeze.daysFrozen;
    const [pkgErr, frzErr] = await Promise.all([
      supabase.from('packages').update({ extended_days: newExtended }).eq('id', activePkg.id).then(r => r.error),
      supabase.from('package_freezes').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', freeze.id).then(r => r.error),
    ]);
    setApprovingFreezeId(null);
    if (pkgErr || frzErr) {
      const msg2 = (pkgErr ?? frzErr)!.message;
      if (Platform.OS === 'web') window.alert('Error: ' + msg2);
      else Alert.alert('Error', msg2);
      return;
    }
    await sendPushNotification(id!, {
      title: '❄️ Freeze Approved',
      body: `Your package freeze (${freeze.freezeStart} → ${freeze.freezeEnd}) has been approved. End date extended by ${freeze.daysFrozen} days.`,
    });
    load();
  };

  const handleRejectFreeze = async (freeze: FreezeRequest) => {
    const msg = `Reject freeze request for ${client?.name ?? 'this client'}?`;
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
    }
    setRejectingFreezeId(freeze.id);
    await supabase.from('package_freezes').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', freeze.id);
    setRejectingFreezeId(null);
    await sendPushNotification(id!, {
      title: 'Freeze Request Update',
      body: `Your freeze request (${freeze.freezeStart} → ${freeze.freezeEnd}) was not approved.`,
    });
    load();
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
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
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={[s.editInput, { marginTop: 8 }]}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="Phone (optional)"
                    placeholderTextColor={colors.textSecondary}
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
                      <Ionicons name="person-circle-outline" size={13} color={colors.textSecondary} />
                      <Text style={s.coachPillText}>{activePkg.coachName}</Text>
                    </View>
                  )}
                  {client.referred_by && (
                    <View style={[s.coachPill, { marginTop: 4 }]}>
                      <Ionicons name="git-branch-outline" size={13} color={colors.textSecondary} />
                      <Text style={s.coachPillText}>Referred by {client.referred_by}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
            {!editing && (
              <Pressable style={s.editBtn} onPress={() => setEditing(true)}>
                <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Package section */}
          <Text style={s.sectionTitle}>CURRENT PACKAGE</Text>

          {!activePkg ? (
            <View style={s.noPkgCard}>
              <Ionicons name="cube-outline" size={36} color={colors.border} />
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
                <Pressable style={s.renewFromEmpty} onPress={openAssignModal}>
                  <Text style={s.renewFromEmptyText}>ASSIGN PACKAGE</Text>
                </Pressable>
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
                        backgroundColor: activePkg.sessionsRemaining <= 3 ? colors.accent : '#4CAF50',
                      },
                    ]}
                  />
                </View>
                <Text style={s.sessionsLeft}>
                  <Text style={{
                    color: activePkg.sessionsRemaining <= 3 ? colors.accent : '#4CAF50',
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
                {activePkg.durationWeeks && activePkg.startDate && (() => {
                  const end = new Date(activePkg.startDate);
                  end.setDate(end.getDate() + activePkg.durationWeeks * 7 + activePkg.extendedDays);
                  const daysLeft = Math.round((end.getTime() - Date.now()) / 86400000);
                  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const expired = daysLeft < 0;
                  const urgent  = daysLeft >= 0 && daysLeft <= 7;
                  const warn    = daysLeft > 7 && daysLeft <= 14;
                  const color   = expired ? '#FF1744' : urgent ? '#FF6D00' : warn ? '#FF9800' : '#4CAF50';
                  return (
                    <View style={s.pkgMetaRow}>
                      <Text style={s.pkgMetaLabel}>End Date</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[s.pkgMetaValue, { color }]}>{endLabel}</Text>
                        {expired && <Text style={[s.endBadge, { backgroundColor: '#FF174420', color: '#FF1744' }]}>EXPIRED</Text>}
                        {urgent  && <Text style={[s.endBadge, { backgroundColor: '#FF6D0020', color: '#FF6D00' }]}>{daysLeft}d left</Text>}
                        {warn    && <Text style={[s.endBadge, { backgroundColor: '#FF980020', color: '#FF9800' }]}>{daysLeft}d left</Text>}
                      </View>
                    </View>
                  );
                })()}
                <View style={s.pkgMetaRow}>
                  <Text style={s.pkgMetaLabel}>Coach</Text>
                  <Text style={s.pkgMetaValue}>{activePkg.coachName}</Text>
                </View>
              </View>

              {/* Freeze requests */}
              {freezes.filter(f => f.packageId === activePkg.id).map((freeze) => (
                <View key={freeze.id} style={[
                  s.freezeCard,
                  freeze.status === 'approved' && { borderColor: '#64B5F650', backgroundColor: '#64B5F608' },
                ]}>
                  <View style={s.freezeHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="snow-outline" size={15} color="#64B5F6" />
                      <Text style={s.freezeTitle}>
                        {freeze.status === 'pending' ? 'Freeze Request' : 'Freeze Approved'}
                      </Text>
                      <View style={[
                        s.freezeStatusPill,
                        freeze.status === 'approved'
                          ? { backgroundColor: '#64B5F620', borderColor: '#64B5F650' }
                          : { backgroundColor: '#FF980020', borderColor: '#FF980050' },
                      ]}>
                        <Text style={[s.freezeStatusText, { color: freeze.status === 'approved' ? '#64B5F6' : '#FF9800' }]}>
                          {freeze.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={s.freezeDateRange}>
                    {fmtDate(freeze.freezeStart)} → {fmtDate(freeze.freezeEnd)} · {freeze.daysFrozen} days
                  </Text>
                  {freeze.reason && <Text style={s.freezeReason}>"{freeze.reason}"</Text>}
                  <Text style={s.freezeCoach}>Requested by {freeze.coachName}</Text>
                  {freeze.status === 'pending' && (
                    <View style={s.freezeActions}>
                      <Pressable
                        style={[s.freezeApproveBtn, approvingFreezeId === freeze.id && { opacity: 0.5 }]}
                        onPress={() => handleApproveFreeze(freeze)}
                        disabled={!!approvingFreezeId || !!rejectingFreezeId}
                      >
                        <Ionicons name="checkmark-outline" size={14} color="#000" />
                        <Text style={s.freezeApproveBtnText}>
                          {approvingFreezeId === freeze.id ? 'Approving…' : 'Approve'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[s.freezeRejectBtn, rejectingFreezeId === freeze.id && { opacity: 0.5 }]}
                        onPress={() => handleRejectFreeze(freeze)}
                        disabled={!!approvingFreezeId || !!rejectingFreezeId}
                      >
                        <Ionicons name="close-outline" size={14} color={colors.accent} />
                        <Text style={s.freezeRejectBtnText}>
                          {rejectingFreezeId === freeze.id ? 'Rejecting…' : 'Reject'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}

              {/* Actions */}
              <View style={s.pkgActions}>
                <Pressable
                  style={s.actionPrimary}
                  onPress={() => { setAddTarget(activePkg); setSessionsToAdd(''); setAddModal(true); }}
                >
                  <Ionicons name="add-circle-outline" size={15} color={colors.bg} />
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
                  <Ionicons name="refresh-outline" size={15} color={colors.accent} />
                  <Text style={s.actionSecondaryText}>Renew</Text>
                </Pressable>
                <Pressable style={s.actionDanger} onPress={() => handleDeactivate(activePkg)}>
                  <Ionicons name="close-circle-outline" size={15} color={colors.accent} />
                  <Text style={s.actionDangerText}>Deactivate</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Session history */}
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>
            SESSION HISTORY{sessions.length > 0 ? ` (${sessions.length})` : ''}
          </Text>
          {sessions.length === 0 ? (
            <View style={[s.historyList, { padding: 24, alignItems: 'center' }]}>
              <Text style={s.grayText}>No sessions logged yet</Text>
            </View>
          ) : (
            <View style={s.historyList}>
              {sessions.map((sess) => {
                const expanded = expandedSessionId === sess.id;
                const d = new Date(sess.sessionDate + 'T00:00:00');
                const STATUS_COLOR: Record<string, string> = {
                  confirmed: '#4CAF50', pending: '#FF9800', absent: '#FF4D4D', no_show: '#FF4D4D',
                };
                const STATUS_LABEL: Record<string, string> = {
                  confirmed: 'Done', pending: 'Pending', absent: 'Absent', no_show: 'No Show',
                };
                const statusColor = STATUS_COLOR[sess.status ?? ''] ?? colors.textSecondary;
                return (
                  <Pressable
                    key={sess.id}
                    style={s.historyRow}
                    onPress={() => setExpandedSessionId(expanded ? null : sess.id)}
                  >
                    <View style={s.historyDateCol}>
                      <Text style={s.historyDay}>
                        {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      </Text>
                      <Text style={s.historyYear}>{d.getFullYear()}</Text>
                    </View>
                    <View style={s.historyMid}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <Text style={s.historyDur}>{sess.durationMinutes} min</Text>
                        <Ionicons
                          name={sess.sessionType === 'home' ? 'home-outline' : 'barbell-outline'}
                          size={11}
                          color={colors.textSecondary}
                        />
                        {sess.status && (
                          <View style={[s.sessStatusPill, { backgroundColor: statusColor + '20', borderColor: statusColor + '60' }]}>
                            <Text style={[s.sessStatusText, { color: statusColor }]}>
                              {STATUS_LABEL[sess.status] ?? sess.status}
                            </Text>
                          </View>
                        )}
                      </View>
                      {!expanded && sess.exercises.length > 0 && (
                        <Text style={s.historyNotes} numberOfLines={1}>
                          {sess.exercises.map((e) => e.exercise_name).join(', ')}
                        </Text>
                      )}
                      {expanded && (
                        <View style={{ marginTop: 8, gap: 4 }}>
                          {sess.exercises.length > 0 ? (
                            sess.exercises.map((ex, i) => (
                              <View key={i}>
                                <Text style={s.historyDur}>{ex.exercise_name}</Text>
                                <Text style={s.historyNotes}>
                                  {[
                                    ex.sets ? `${ex.sets} sets` : null,
                                    ex.reps ? `${ex.reps} reps` : null,
                                    ex.weight ? `@ ${ex.weight}` : null,
                                    ex.duration ?? null,
                                  ].filter(Boolean).join('  ·  ')}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={s.historyNotes}>No exercises recorded</Text>
                          )}
                          {sess.notes ? (
                            <Text style={[s.historyNotes, { fontStyle: 'italic', marginTop: 4 }]}>
                              "{sess.notes}"
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.border}
                    />
                  </Pressable>
                );
              })}
            </View>
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
          <View style={[s.sectionRow, { marginTop: 24 }]}>
            <Text style={s.sectionTitle}>PAYMENT HISTORY</Text>
            <Pressable style={s.reqPayBtn} onPress={() => setShowPayReqModal(true)}>
              <Ionicons name="send-outline" size={12} color="#fff" />
              <Text style={s.reqPayBtnText}>Request Payment</Text>
            </Pressable>
          </View>
          <View style={s.historyList}>
            {payments.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={s.grayText}>No payments recorded</Text>
              </View>
            ) : (
              payments.map((p) => {
                const d = new Date(p.paid_at);
                return (
                  <View key={p.id} style={[s.historyRow, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                    <View style={s.historyMid}>
                      <Text style={s.historyDur}>{PAY_METHOD[p.payment_method] ?? p.payment_method}</Text>
                      <Text style={s.historyNotes}>
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {p.transaction_ref ? ` · Ref: ${p.transaction_ref}` : ''}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </Text>
                      {p.invoice_number && (
                        <Text style={[s.historyNotes, { color: colors.accent, marginTop: 2 }]}>
                          Invoice #{p.invoice_number}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={s.payAmount}>
                        OMR {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </Text>
                      <Pressable
                        style={s.invoiceBtn}
                        onPress={() => router.push(`/(admin)/invoice/${p.id}` as any)}
                      >
                        <Ionicons name="document-text-outline" size={12} color={colors.accent} />
                        <Text style={s.invoiceBtnText}>Invoice</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
        {/* Danger Zone */}
        <View style={s.dangerSection}>
          <Text style={s.dangerLabel}>DANGER ZONE</Text>
          <Pressable
            style={[s.deactivateBtn, deactivating && { opacity: 0.5 }]}
            onPress={handleDeactivateAccount}
            disabled={deactivating}
          >
            <Ionicons name="archive-outline" size={16} color={colors.danger} />
            <Text style={s.deactivateBtnText}>{deactivating ? 'Deactivating…' : 'Deactivate Account'}</Text>
          </Pressable>
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
              placeholderTextColor={colors.textSecondary}
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
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />

            <Text style={s.modalLabel}>Duration (weeks) — optional</Text>
            <TextInput
              style={s.modalInput}
              value={renewWeeks}
              onChangeText={(v) => setRenewWeeks(v.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 6"
              placeholderTextColor={colors.textSecondary}
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

      {/* Assign Package Modal */}
      <Modal visible={assignModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Assign Package</Text>
            <Text style={s.modalSub}>Create a first package and assign a coach for this client.</Text>

            <Text style={s.modalLabel}>Coach *</Text>
            <View style={s.coachList}>
              {coaches.map((c) => (
                <Pressable
                  key={c.id}
                  style={[s.coachOption, assignCoachId === c.id && s.coachOptionActive]}
                  onPress={() => setAssignCoachId(c.id)}
                >
                  <Text style={[s.coachOptionText, assignCoachId === c.id && s.coachOptionTextActive]}>
                    {c.name}
                  </Text>
                  {assignCoachId === c.id && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </Pressable>
              ))}
            </View>

            <Text style={s.modalLabel}>Session Duration</Text>
            <View style={s.segmented}>
              {PKG_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[s.segment, assignPkgType === opt.value && s.segmentActive]}
                  onPress={() => setAssignPkgType(opt.value)}
                >
                  <Text style={[s.segmentText, assignPkgType === opt.value && s.segmentActiveText]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.modalLabel}>Total Sessions *</Text>
            <TextInput
              style={s.modalInput}
              value={assignTotal}
              onChangeText={(v) => setAssignTotal(v.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 12"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />

            <Text style={s.modalLabel}>Duration (weeks) — optional</Text>
            <TextInput
              style={s.modalInput}
              value={assignWeeks}
              onChangeText={(v) => setAssignWeeks(v.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 6"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />

            <View style={s.modalActions}>
              <Pressable
                style={[s.modalBtnPrimary, assigning && { opacity: 0.5 }]}
                onPress={handleAssign}
                disabled={assigning}
              >
                <Text style={s.modalBtnPrimaryText}>{assigning ? 'SAVING…' : 'ASSIGN'}</Text>
              </Pressable>
              <Pressable style={s.modalBtnCancel} onPress={() => setAssignModal(false)}>
                <Text style={s.modalBtnCancelText}>CANCEL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Request Payment Modal ── */}
      <Modal visible={showPayReqModal} transparent animationType="slide" onRequestClose={() => setShowPayReqModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={s.modalTitle}>REQUEST PAYMENT</Text>
              <Pressable onPress={() => setShowPayReqModal(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={[s.modalSub, { marginBottom: 20 }]}>
              Send a push notification to {client?.name} requesting payment.
            </Text>

            {payReqSent ? (
              <View style={s.payReqSuccess}>
                <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                <Text style={s.payReqSuccessText}>Request Sent!</Text>
              </View>
            ) : (
              <>
                <Text style={s.modalLabel}>Amount (OMR) — optional</Text>
                <TextInput
                  style={s.modalInput}
                  value={payReqAmount}
                  onChangeText={(v) => setPayReqAmount(v.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 545.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
                <Text style={[s.modalLabel, { marginTop: 12 }]}>Note — optional</Text>
                <TextInput
                  style={[s.modalInput, { height: 70 }]}
                  value={payReqNotes}
                  onChangeText={setPayReqNotes}
                  placeholder="e.g. Monthly renewal due"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />
                <Pressable
                  style={[s.modalBtnPrimary, sendingPayReq && { opacity: 0.5 }]}
                  onPress={handleSendPaymentRequest}
                  disabled={sendingPayReq}
                >
                  <Ionicons name="send-outline" size={15} color="#fff" />
                  <Text style={s.modalBtnPrimaryText}>
                    {sendingPayReq ? 'Sending…' : 'Send Payment Request'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 48 },
    contentDesktop: { padding: 40, paddingTop: 32 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    inner: { width: '100%' },
    innerDesktop: { maxWidth: 720, alignSelf: 'center' },
    grayText: { ...Typography.body, color: c.textSecondary },

    // Profile
    profileCard: {
      flexDirection: 'row', alignItems: 'flex-start',
      backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 1, borderColor: c.border,
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
    clientName: { ...Typography.subtitle, color: c.textPrimary, fontWeight: '700', marginBottom: 3 },
    clientEmail: { ...Typography.body, color: c.textSecondary, marginBottom: 2 },
    clientPhone: { ...Typography.caption, color: c.textSecondary, marginBottom: 4 },
    coachPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    coachPillText: { ...Typography.caption, color: c.textSecondary },
    editBtn: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: c.border + '40',
      justifyContent: 'center', alignItems: 'center',
    },
    editInput: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
      color: c.textPrimary, fontSize: 15,
    },
    editActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    saveBtn: {
      backgroundColor: c.accent, borderRadius: 9,
      paddingHorizontal: 16, paddingVertical: 8,
    },
    saveBtnText: { color: c.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
    cancelEditBtn: {
      backgroundColor: c.border + '40', borderRadius: 9,
      paddingHorizontal: 14, paddingVertical: 8,
    },
    cancelEditText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },

    sectionTitle: { ...Typography.label, color: c.textSecondary, marginBottom: 12 },

    coachList: { gap: 6, marginBottom: 14 },
    coachOption: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: 10, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.bg,
    },
    coachOptionActive: { borderColor: c.accent, backgroundColor: c.accent + '12' },
    coachOptionText: { ...Typography.body, color: c.textPrimary },
    coachOptionTextActive: { color: c.accent, fontWeight: '600' },

    // No package
    noPkgCard: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      alignItems: 'center', padding: 32, gap: 8,
    },
    noPkgText: { ...Typography.subtitle, color: c.textPrimary, marginTop: 4 },
    noPkgSub: { ...Typography.body, color: c.textSecondary },
    renewFromEmpty: {
      marginTop: 8, backgroundColor: c.accent, borderRadius: 10,
      paddingHorizontal: 20, paddingVertical: 10,
    },
    renewFromEmptyText: { color: c.bg, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

    // Package card
    pkgCard: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      padding: 18, gap: 16,
    },
    pkgHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pkgTypeBadge: {
      backgroundColor: c.accent + '18', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 4,
      borderWidth: 1, borderColor: c.accent + '40',
    },
    pkgTypeText: { color: c.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
    activePill: {
      backgroundColor: '#4CAF5018', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 4,
      borderWidth: 1, borderColor: '#4CAF5040',
    },
    activePillText: { color: '#4CAF50', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },

    progressSection: { gap: 6 },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { ...Typography.caption, color: c.textSecondary },
    progressFraction: { ...Typography.caption, color: c.textSecondary, fontWeight: '600' },
    progressBg: {
      height: 6, backgroundColor: c.border,
      borderRadius: 3, overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    sessionsLeft: { ...Typography.body, color: c.textSecondary },

    pkgMeta: {
      backgroundColor: c.bg, borderRadius: 10,
      borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 14, paddingVertical: 8,
    },
    pkgMetaRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.border + '60',
    },
    pkgMetaLabel: { ...Typography.caption, color: c.textSecondary },
    pkgMetaValue: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    endBadge: { fontSize: 10, fontWeight: '800', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },

    // Freeze cards
    freezeCard: {
      borderWidth: 1, borderColor: '#FF980050', backgroundColor: '#FF980008',
      borderRadius: 12, padding: 12, marginTop: 12,
    },
    freezeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    freezeTitle: { ...Typography.body, color: c.textPrimary, fontWeight: '700', fontSize: 13 },
    freezeStatusPill: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    freezeStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    freezeDateRange: { ...Typography.body, color: c.textPrimary, fontWeight: '600', fontSize: 13, marginBottom: 2 },
    freezeReason: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic', marginBottom: 2 },
    freezeCoach: { ...Typography.caption, color: c.textSecondary, marginBottom: 10 },
    freezeActions: { flexDirection: 'row', gap: 8 },
    freezeApproveBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      backgroundColor: '#64B5F6', borderRadius: 8, paddingVertical: 8,
    },
    freezeApproveBtnText: { color: '#000', fontSize: 12, fontWeight: '800' },
    freezeRejectBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      borderWidth: 1, borderColor: c.accent + '50', borderRadius: 8, paddingVertical: 8,
    },
    freezeRejectBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },

    pkgActions: { flexDirection: 'row', gap: 8 },
    actionPrimary: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      backgroundColor: c.accent, borderRadius: 10, paddingVertical: 10,
    },
    actionPrimaryText: { color: c.bg, fontSize: 12, fontWeight: '700' },
    actionSecondary: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      backgroundColor: c.accent + '15', borderRadius: 10, paddingVertical: 10,
      borderWidth: 1, borderColor: c.accent + '40',
    },
    actionSecondaryText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    actionDanger: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      backgroundColor: c.border + '40', borderRadius: 10, paddingVertical: 10,
    },
    actionDangerText: { color: c.accent, fontSize: 12, fontWeight: '700' },

    // Session history
    historyList: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    },
    historyRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border + '60',
    },
    historyDateCol: { width: 52, alignItems: 'center' },
    historyDay: { ...Typography.body, color: c.textPrimary, fontWeight: '700', textAlign: 'center' },
    historyYear: { ...Typography.caption, color: c.textSecondary, textAlign: 'center' },
    historyMid: { flex: 1 },
    historyDur: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    historyNotes: { ...Typography.caption, color: c.textSecondary },
    sessStatusPill: {
      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1,
    },
    sessStatusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

    // Past packages
    pastPkgRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border + '60',
    },
    pastPkgType: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    pastPkgDate: { ...Typography.caption, color: c.textSecondary },
    pastPkgUsed: { ...Typography.caption, color: c.textSecondary },
    payAmount: { fontSize: 15, fontWeight: '800', color: '#4CAF50', flexShrink: 0 },
    invoiceBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderWidth: 1, borderColor: c.accent + '60',
      borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    },
    invoiceBtnText: { fontSize: 11, fontWeight: '700', color: c.accent },

    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    reqPayBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: '#1a6b2a', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 6,
    },
    reqPayBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    payReqSuccess: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    payReqSuccessText: { fontSize: 16, fontWeight: '700', color: '#4CAF50' },

    // Modals
    overlay: {
      flex: 1, backgroundColor: '#00000080',
      justifyContent: 'flex-end',
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: 16,
    },
    modalBox: {
      backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, gap: 12,
    },
    modalTitle: { ...Typography.subtitle, color: c.textPrimary, fontWeight: '700' },
    modalSub: { ...Typography.body, color: c.textSecondary, marginTop: -4 },
    modalLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 8 },
    modalInput: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
      color: c.textPrimary, fontSize: 15,
    },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtnPrimary: {
      flex: 1, backgroundColor: c.accent, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center',
    },
    modalBtnPrimaryText: { color: c.bg, fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },
    modalBtnCancel: {
      backgroundColor: c.border + '40', borderRadius: 12,
      paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center',
    },
    modalBtnCancelText: { color: c.textSecondary, fontSize: 14, fontWeight: '700' },

    segmented: {
      flexDirection: 'row', backgroundColor: c.bg,
      borderRadius: 10, borderWidth: 1, borderColor: c.border,
      padding: 3, gap: 3,
    },
    segment: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    segmentActiveText: { color: c.bg },

    dangerSection: { marginTop: 36, marginBottom: 8, gap: 12 },
    dangerLabel: { fontSize: 11, fontWeight: '800', color: c.textSecondary, letterSpacing: 1 },
    deactivateBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderColor: c.danger + '60',
      borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16,
      backgroundColor: c.danger + '08',
    },
    deactivateBtnText: { fontSize: 14, fontWeight: '700', color: c.danger },
  });
}
