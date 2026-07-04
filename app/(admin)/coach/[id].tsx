import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Colors, Typography } from '@/constants/theme';

type CoachProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  birthday: string | null;
  visa_expiry: string | null;
};

type ActiveClient = {
  id: string;
  name: string;
  email: string;
  sessionsRemaining: number;
  packageType: '30min' | '45min' | '1hr';
  totalPaid: number;
};

type UpcomingSession = {
  id: string;
  scheduled_at: string;
  notes: string | null;
  client_name: string;
};

type BlockedDate = {
  id: string;
  date: string;
  type: string;
  notes: string | null;
};

const TYPE_LABEL: Record<string, string> = { leave: 'Leave', meeting: 'Meeting', other: 'Other' };
const TYPE_COLOR: Record<string, string> = { leave: Colors.danger, meeting: '#2196F3', other: Colors.textSecondary };

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function nextBirthdayDays(birthdayISO: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const bd = new Date(birthdayISO);
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export default function CoachDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: adminProfile } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [clients, setClients] = useState<ActiveClient[]>([]);
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [editVisaExpiry, setEditVisaExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState('');
  const [blockType, setBlockType] = useState<'leave' | 'meeting' | 'other'>('leave');
  const [blockNotes, setBlockNotes] = useState('');
  const [addingBlock, setAddingBlock] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const today = new Date().toISOString().split('T')[0];

    const [profileRes, pkgsRes, sessRes, revRes, schedRes, blockRes, payRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email, phone, birthday, visa_expiry').eq('id', id).single(),
      supabase
        .from('packages')
        .select('sessions_remaining, package_type, client:profiles!packages_client_id_fkey(id, name, email)')
        .eq('coach_id', id).eq('status', 'active'),
      supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', id).gte('session_date', monthStart.toISOString().split('T')[0]),
      supabase
        .from('payments').select('amount').eq('coach_id', id)
        .gte('paid_at', monthStart.toISOString().split('T')[0]),
      supabase
        .from('scheduled_sessions')
        .select('id, scheduled_at, notes, client:profiles!scheduled_sessions_client_id_fkey(name)')
        .eq('coach_id', id).gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at').limit(10),
      supabase
        .from('coach_blocked_dates')
        .select('id, date, type, notes')
        .eq('coach_id', id).gte('date', today)
        .order('date').limit(30),
      supabase
        .from('payments').select('amount, client_id').eq('coach_id', id),
    ]);

    if (profileRes.data) {
      const p = profileRes.data as any;
      setCoach(p);
      setEditName(p.name);
      setEditPhone(p.phone ?? '');
      setEditBirthday(p.birthday ?? '');
      setEditVisaExpiry(p.visa_expiry ?? '');
    }

    // Build payment totals per client
    const payTotals: Record<string, number> = {};
    (payRes.data ?? []).forEach((r: any) => {
      payTotals[r.client_id] = (payTotals[r.client_id] ?? 0) + Number(r.amount);
    });

    setClients(
      (pkgsRes.data ?? []).map((row: any) => ({
        id: row.client.id,
        name: row.client.name,
        email: row.client.email,
        sessionsRemaining: row.sessions_remaining,
        packageType: row.package_type,
        totalPaid: payTotals[row.client.id] ?? 0,
      })),
    );

    setSessionsThisMonth(sessRes.count ?? 0);
    setRevenueThisMonth((revRes.data ?? []).reduce((sum, r: any) => sum + Number(r.amount), 0));

    setUpcomingSessions(
      (schedRes.data ?? []).map((row: any) => ({
        id: row.id,
        scheduled_at: row.scheduled_at,
        notes: row.notes,
        client_name: (row.client as any)?.name ?? '—',
      })),
    );

    setBlockedDates((blockRes.data ?? []) as BlockedDate[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editName.trim() || !id) return;
    setSaving(true);
    await Promise.all([
      supabase.rpc('admin_update_profile', {
        p_user_id: id, p_name: editName.trim(), p_phone: editPhone.trim(),
      }),
      supabase.rpc('admin_update_coach_details', {
        p_coach_id: id,
        p_birthday: editBirthday.trim() || null,
        p_visa_expiry: editVisaExpiry.trim() || null,
      }),
    ]);
    setSaving(false);
    setCoach((c) => c ? {
      ...c,
      name: editName.trim(),
      phone: editPhone.trim() || null,
      birthday: editBirthday.trim() || null,
      visa_expiry: editVisaExpiry.trim() || null,
    } : c);
    setEditing(false);
  };

  const handleAddBlock = async () => {
    if (!blockDate.trim() || !id || !adminProfile?.id) return;
    setAddingBlock(true);
    const { error } = await supabase.from('coach_blocked_dates').insert({
      coach_id: id,
      date: blockDate.trim(),
      type: blockType,
      notes: blockNotes.trim() || null,
      created_by: adminProfile.id,
    });
    setAddingBlock(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowBlockModal(false);
    setBlockDate('');
    setBlockNotes('');
    setBlockType('leave');
    load();
  };

  const handleRemoveBlock = (bd: BlockedDate) => {
    Alert.alert('Remove', `Remove ${TYPE_LABEL[bd.type]} on ${fmtDate(bd.date)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('coach_blocked_dates').delete().eq('id', bd.id);
          setBlockedDates((prev) => prev.filter((x) => x.id !== bd.id));
        },
      },
    ]);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }
  if (!coach) {
    return <View style={s.center}><Text style={s.grayText}>Coach not found.</Text></View>;
  }

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Warning computations
  const bdDays  = coach.birthday    ? nextBirthdayDays(coach.birthday)  : null;
  const visaDays = coach.visa_expiry ? daysUntil(coach.visa_expiry)       : null;
  const bdWarn   = bdDays !== null  && bdDays <= 14;
  const visaWarn = visaDays !== null && visaDays <= 60;

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
      >
        <View style={[s.inner, isDesktop && s.innerDesktop]}>

          {/* ── Alerts ───────────────────────────────────────── */}
          {bdWarn && (
            <View style={[s.alertBanner, { borderColor: '#FF980060', backgroundColor: '#FF980010' }]}>
              <Ionicons name="gift-outline" size={16} color="#FF9800" />
              <Text style={[s.alertText, { color: '#FF9800' }]}>
                {coach.name.split(' ')[0]}'s birthday is in {bdDays === 0 ? 'TODAY! 🎉' : `${bdDays} day${bdDays !== 1 ? 's' : ''}`}
              </Text>
            </View>
          )}
          {visaWarn && visaDays !== null && (
            <View style={[s.alertBanner, { borderColor: Colors.danger + '60', backgroundColor: Colors.danger + '10' }]}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
              <Text style={[s.alertText, { color: Colors.danger }]}>
                {visaDays <= 0
                  ? `Visa EXPIRED ${Math.abs(visaDays)} day${Math.abs(visaDays) !== 1 ? 's' : ''} ago!`
                  : `Visa expires in ${visaDays} day${visaDays !== 1 ? 's' : ''} — ${fmtDate(coach.visa_expiry!)}`}
              </Text>
            </View>
          )}

          {/* ── Profile Card ─────────────────────────────────── */}
          <View style={s.profileCard}>
            <View style={s.avatarLg}>
              <Text style={s.avatarLgText}>{initials(coach.name)}</Text>
            </View>
            <View style={s.profileRight}>
              {editing ? (
                <>
                  <TextInput style={s.editInput} value={editName} onChangeText={setEditName}
                    placeholder="Full name" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" />
                  <TextInput style={[s.editInput, { marginTop: 6 }]} value={editPhone} onChangeText={setEditPhone}
                    placeholder="Phone (optional)" placeholderTextColor={Colors.textSecondary} keyboardType="phone-pad" />
                  <TextInput style={[s.editInput, { marginTop: 6 }]} value={editBirthday} onChangeText={setEditBirthday}
                    placeholder="Birthday (YYYY-MM-DD)" placeholderTextColor={Colors.textSecondary} />
                  <TextInput style={[s.editInput, { marginTop: 6 }]} value={editVisaExpiry} onChangeText={setEditVisaExpiry}
                    placeholder="Visa Expiry (YYYY-MM-DD)" placeholderTextColor={Colors.textSecondary} />
                  <View style={s.editActions}>
                    <Pressable style={s.saveBtn} onPress={handleSave} disabled={saving}>
                      <Text style={s.saveBtnText}>{saving ? 'SAVING…' : 'SAVE'}</Text>
                    </Pressable>
                    <Pressable style={s.cancelEditBtn} onPress={() => {
                      setEditing(false);
                      setEditName(coach.name); setEditPhone(coach.phone ?? '');
                      setEditBirthday(coach.birthday ?? ''); setEditVisaExpiry(coach.visa_expiry ?? '');
                    }}>
                      <Text style={s.cancelEditText}>CANCEL</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.coachName}>{coach.name}</Text>
                  <Text style={s.coachEmail}>{coach.email}</Text>
                  {coach.phone && <Text style={s.coachSub}>{coach.phone}</Text>}
                  {coach.birthday && (
                    <View style={s.pillRow}>
                      <Ionicons name="gift-outline" size={12} color={Colors.textSecondary} />
                      <Text style={s.pillText}>{fmtDate(coach.birthday)}</Text>
                    </View>
                  )}
                  {coach.visa_expiry && (
                    <View style={s.pillRow}>
                      <Ionicons name="card-outline" size={12} color={visaWarn ? Colors.danger : Colors.textSecondary} />
                      <Text style={[s.pillText, visaWarn && { color: Colors.danger }]}>
                        Visa: {fmtDate(coach.visa_expiry)}
                      </Text>
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

          {/* ── Stats ────────────────────────────────────────── */}
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
                OMR {revenueThisMonth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
              <Text style={s.statLbl}>Revenue · {monthName}</Text>
            </View>
          </View>

          {/* ── Coach Sales ───────────────────────────────────── */}
          <Text style={s.sectionTitle}>COACH SALES</Text>
          {clients.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="person-outline" size={40} color={Colors.border} />
              <Text style={s.emptyText}>No active clients</Text>
            </View>
          ) : (
            <View style={s.clientList}>
              {clients.map((c, i) => (
                <Pressable
                  key={c.id}
                  style={[s.clientRow, i === clients.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => router.push(`/(admin)/client/${c.id}` as any)}
                >
                  <View style={s.clientAvatar}>
                    <Text style={s.clientAvatarText}>{initials(c.name)}</Text>
                  </View>
                  <View style={s.clientInfo}>
                    <Text style={s.clientName}>{c.name}</Text>
                    <Text style={s.clientEmail}>{c.email}</Text>
                    {c.totalPaid > 0 && (
                      <Text style={s.clientPaid}>
                        OMR {c.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total paid
                      </Text>
                    )}
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

          {/* ── Upcoming Schedule ─────────────────────────────── */}
          <Text style={[s.sectionTitle, { marginTop: 28 }]}>UPCOMING SESSIONS</Text>
          {upcomingSessions.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.grayText}>No upcoming sessions scheduled</Text>
            </View>
          ) : (
            <View style={s.scheduleList}>
              {upcomingSessions.map((sess, i) => (
                <View key={sess.id} style={[s.scheduleRow, i === upcomingSessions.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={s.scheduleIcon}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
                  </View>
                  <View style={s.scheduleInfo}>
                    <Text style={s.scheduleClient}>{sess.client_name}</Text>
                    <Text style={s.scheduleTime}>{fmtDateTime(sess.scheduled_at)}</Text>
                    {sess.notes ? <Text style={s.scheduleNotes}>{sess.notes}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Blocked Dates ─────────────────────────────────── */}
          <View style={[s.sectionRow, { marginTop: 28 }]}>
            <Text style={s.sectionTitle}>BLOCKED DATES</Text>
            <Pressable style={s.addBlockBtn} onPress={() => {
              const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
              setBlockDate(tomorrow.toISOString().split('T')[0]);
              setBlockType('leave');
              setBlockNotes('');
              setShowBlockModal(true);
            }}>
              <Ionicons name="add" size={14} color={Colors.bg} />
              <Text style={s.addBlockBtnText}>Add</Text>
            </Pressable>
          </View>
          {blockedDates.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.grayText}>No upcoming blocked dates</Text>
            </View>
          ) : (
            <View style={s.scheduleList}>
              {blockedDates.map((bd, i) => {
                const color = TYPE_COLOR[bd.type] ?? Colors.textSecondary;
                return (
                  <Pressable
                    key={bd.id}
                    style={[s.scheduleRow, i === blockedDates.length - 1 && { borderBottomWidth: 0 }]}
                    onLongPress={() => handleRemoveBlock(bd)}
                  >
                    <View style={[s.typeChip, { backgroundColor: color + '18', borderColor: color + '50' }]}>
                      <Text style={[s.typeChipText, { color }]}>{TYPE_LABEL[bd.type]}</Text>
                    </View>
                    <View style={s.scheduleInfo}>
                      <Text style={s.scheduleClient}>{fmtDate(bd.date)}</Text>
                      {bd.notes ? <Text style={s.scheduleNotes}>{bd.notes}</Text> : null}
                    </View>
                    <Ionicons name="trash-outline" size={16} color={Colors.border}
                      style={{ marginLeft: 4 }} onPress={() => handleRemoveBlock(bd)} />
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text style={s.longPressTip}>Tap trash icon to remove a blocked date</Text>

        </View>
      </ScrollView>

      {/* ── Add Blocked Date Modal ────────────────────────── */}
      <Modal visible={showBlockModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Block Date</Text>

            <Text style={s.modalLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={s.modalInput}
              value={blockDate}
              onChangeText={setBlockDate}
              placeholder="e.g. 2026-07-15"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numbers-and-punctuation"
              autoFocus
            />

            <Text style={s.modalLabel}>Type</Text>
            <View style={s.typeRow}>
              {(['leave', 'meeting', 'other'] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[s.typeBtn, blockType === t && { backgroundColor: Colors.accent, borderColor: Colors.accent }]}
                  onPress={() => setBlockType(t)}
                >
                  <Text style={[s.typeBtnText, blockType === t && { color: Colors.bg }]}>
                    {TYPE_LABEL[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.modalLabel}>Notes (optional)</Text>
            <TextInput
              style={[s.modalInput, { minHeight: 52, textAlignVertical: 'top' }]}
              value={blockNotes}
              onChangeText={setBlockNotes}
              placeholder="e.g. Staff meeting at 10am…"
              placeholderTextColor={Colors.textSecondary}
              multiline
            />

            <View style={s.modalActions}>
              <Pressable
                style={[s.modalBtnPrimary, addingBlock && { opacity: 0.5 }]}
                onPress={handleAddBlock}
                disabled={addingBlock}
              >
                <Text style={s.modalBtnPrimaryText}>{addingBlock ? 'SAVING…' : 'BLOCK DATE'}</Text>
              </Pressable>
              <Pressable style={s.modalBtnCancel} onPress={() => setShowBlockModal(false)}>
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

  // Alerts
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10,
  },
  alertText: { ...Typography.body, fontWeight: '600', flex: 1 },

  // Profile
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
  coachSub: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 3 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  pillText: { ...Typography.caption, color: Colors.textSecondary },
  editBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.border + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  editInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    color: Colors.textPrimary, fontSize: 14,
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: Colors.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  cancelEditBtn: { backgroundColor: Colors.border + '40', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  cancelEditText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },

  // Stats
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },

  // Coach Sales (client list)
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { ...Typography.body, color: Colors.textSecondary },
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, alignItems: 'center',
  },

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
  clientPaid: { fontSize: 11, color: '#4CAF50', fontWeight: '600', marginTop: 2 },
  sessionsBadge: { alignItems: 'center', minWidth: 38 },
  sessionsBadgeNum: { fontSize: 18, fontWeight: '800', color: Colors.accent, lineHeight: 22 },
  sessionsBadgeLbl: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },

  // Upcoming schedule + blocked dates
  scheduleList: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border + '70',
  },
  scheduleIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.accent + '12', borderWidth: 1, borderColor: Colors.accent + '30',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  scheduleInfo: { flex: 1 },
  scheduleClient: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  scheduleTime: { ...Typography.caption, color: Colors.textSecondary },
  scheduleNotes: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },

  typeChip: {
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
    flexShrink: 0, minWidth: 58, alignItems: 'center',
  },
  typeChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  addBlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accent, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addBlockBtnText: { color: Colors.bg, fontSize: 12, fontWeight: '800' },
  longPressTip: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },

  // Modal
  overlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 12,
  },
  modalTitle: { ...Typography.subtitle, color: Colors.textPrimary, fontWeight: '700' },
  modalLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: -4 },
  modalInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
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
});
