import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { PhoneInput } from '@/components/PhoneInput';
import { useAuth } from '@/context/AuthContext';
import { useClientData } from '@/hooks/useClientData';
import { Typography } from '@/constants/theme';
import type { ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const PAY_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', bank_muscat: 'Bank Muscat', nbo: 'NBO', oab: 'OAB',
  bank_dhofar: 'Bank Dhofar', ahli_bank: 'Ahli Bank', sohar: 'Sohar Intl',
  hsbc: 'HSBC Oman', bank_nizwa: 'Bank Nizwa', other: 'Other',
};

type ClientPayment = { id: string; amount: number; payment_method: string; paid_at: string; notes: string | null };
type RenewalRecord = { id: string; total_sessions: number; package_type: string; created_at: string; payment_status: string; balance_due_date: string | null };
type ClientGoal = { id: string; title: string; description: string | null; target_date: string | null; status: 'active' | 'achieved' | 'dropped' };

export default function ClientProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { coachInfo } = useClientData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [saving, setSaving] = useState(false);

  // Goals + payments + renewals
  const [goals, setGoals] = useState<ClientGoal[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('client_goals').select('id, title, description, target_date, status')
      .eq('client_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setGoals((data ?? []) as ClientGoal[]));
    supabase.from('payments').select('id, amount, payment_method, paid_at, notes')
      .eq('client_id', user.id).order('paid_at', { ascending: false }).limit(20)
      .then(({ data }) => setClientPayments((data ?? []) as ClientPayment[]));
    supabase.from('renewal_requests')
      .select('id, total_sessions, package_type, created_at, payment_status, balance_due_date')
      .eq('client_id', user.id).eq('status', 'accepted')
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setRenewals((data ?? []) as RenewalRecord[]));
  }, [user?.id]);

  const markGoalAchieved = async (id: string) => {
    await supabase.from('client_goals').update({ status: 'achieved' }).eq('id', id);
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, status: 'achieved' } : g));
  };

  // Change password
  const [pwModal, setPwModal] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);


  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !profile?.id) return;
    const uri = result.assets[0].uri;
    try {
      const fileName = `${profile.id}.jpg`;
      const formData = new FormData();
      formData.append('file', { uri, name: fileName, type: 'image/jpeg' } as any);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) { Alert.alert('Upload failed', uploadError.message); return; }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: urlWithBust }).eq('id', profile.id);
      await refreshProfile();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleStartEdit = () => {
    setName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
    setWhatsapp(profile?.whatsapp ?? '');
    setInstagram(profile?.instagram ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      name: name.trim() || profile?.name,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      instagram: instagram.trim().replace(/^@/, '') || null,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await refreshProfile();
    setEditing(false);
  };

  const handleChangePassword = async () => {
    if (newPw.length < 6) { Alert.alert('Too short', 'Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setChangingPw(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setPwSuccess(true);
    setNewPw(''); setConfirmPw('');
    setTimeout(() => { setPwModal(false); setPwSuccess(false); }, 1500);
  };

  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  const initials = profile?.name
    ?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <Pressable onPress={handlePickPhoto} style={styles.avatarPressable}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Ionicons name="camera" size={12} color={colors.bg} />
          </View>
        </Pressable>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>CLIENT</Text>
        </View>
      </View>

      <Text style={styles.name}>{profile?.name ?? '—'}</Text>
      <Text style={styles.email}>{profile?.email ?? '—'}</Text>


      {/* My Coach */}
      {coachInfo && (
        <>
          <View style={[styles.sectionHeader, { marginTop: 20 }]}>
            <Text style={styles.sectionLabel}>MY COACH</Text>
          </View>
          <View style={[styles.infoSection, { marginBottom: 24 }]}>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Ionicons name="person-outline" size={18} color={colors.accent} style={styles.rowIcon} />
              <View style={styles.rowContent}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{coachInfo.name}</Text>
              </View>
            </View>
            {coachInfo.phone && (
              <SocialRow
                icon="call-outline"
                label="Phone"
                value={coachInfo.phone}
                onPress={() => Linking.openURL(`tel:${coachInfo.phone}`)}
                styles={styles}
                colors={colors}
              />
            )}
            {coachInfo.whatsapp && (
              <SocialRow
                icon="logo-whatsapp"
                label="WhatsApp"
                value={coachInfo.whatsapp}
                iconColor="#25D366"
                onPress={() => Linking.openURL(`whatsapp://send?phone=${coachInfo.whatsapp!.replace(/\D/g, '')}`)}
                styles={styles}
                colors={colors}
              />
            )}
            {coachInfo.instagram && (
              <SocialRow
                icon="logo-instagram"
                label="Instagram"
                value={`@${coachInfo.instagram}`}
                iconColor="#E1306C"
                onPress={() => Linking.openURL(`https://instagram.com/${coachInfo.instagram}`)}
                last
                styles={styles}
                colors={colors}
              />
            )}
            {!coachInfo.phone && !coachInfo.whatsapp && !coachInfo.instagram && (
              <View style={[styles.infoRow]}>
                <Text style={[styles.infoValue, { color: colors.textSecondary, fontSize: 13 }]}>
                  No contact info available yet
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Goals */}
      <>
        <View style={[styles.sectionHeader, { marginTop: 4 }]}>
          <Text style={styles.sectionLabel}>MY GOALS</Text>
        </View>
        <View style={[styles.infoSection, { marginBottom: 24 }]}>
          {goals.length === 0 ? (
            <View style={styles.goalEmptyRow}>
              <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.goalEmptyText}>Your coach will set goals for you here</Text>
            </View>
          ) : goals.map((goal, i) => {
            const achieved = goal.status === 'achieved';
            const dropped = goal.status === 'dropped';
            const color = achieved ? colors.success : dropped ? colors.textSecondary : colors.accent;
            return (
              <Pressable
                key={goal.id}
                style={[styles.goalRow, i < goals.length - 1 && styles.goalRowBorder]}
                onPress={() => { if (!achieved && !dropped) markGoalAchieved(goal.id); }}
              >
                <Ionicons
                  name={achieved ? 'checkmark-circle' : dropped ? 'close-circle-outline' : 'radio-button-off-outline'}
                  size={20} color={color}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.goalTitle, achieved && { textDecorationLine: 'line-through', color: colors.textSecondary }]}>
                    {goal.title}
                  </Text>
                  {goal.target_date && !achieved && !dropped && (
                    <Text style={styles.goalDate}>
                      Target: {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  )}
                </View>
                {!achieved && !dropped && (
                  <Text style={styles.goalTapHint}>Tap to achieve</Text>
                )}
                {achieved && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
              </Pressable>
            );
          })}
        </View>
      </>

      {/* Contact & Social */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>CONTACT & SOCIAL</Text>
        {!editing && (
          <Pressable style={styles.editBtn} onPress={handleStartEdit}>
            <Ionicons name="pencil-outline" size={13} color={colors.accent} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View style={styles.editCard}>
          <EditField icon="person-outline" label="NAME" value={name} onChangeText={setName} placeholder="Your full name" styles={styles} colors={colors} />
          <View style={[styles.editField, styles.editFieldBorder]}>
            <Ionicons name="call-outline" size={18} color={colors.textSecondary} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={styles.infoLabel}>PHONE</Text>
              <PhoneInput value={phone} onChange={setPhone} colors={colors} inputStyle={{ backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 2, ...Typography.body, color: colors.textPrimary }} />
            </View>
          </View>
          <View style={[styles.editField, styles.editFieldBorder]}>
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={styles.infoLabel}>WHATSAPP</Text>
              <PhoneInput value={whatsapp} onChange={setWhatsapp} colors={colors} inputStyle={{ backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 2, ...Typography.body, color: colors.textPrimary }} placeholder="WhatsApp number" />
            </View>
          </View>
          <EditField icon="logo-instagram" label="INSTAGRAM" value={instagram} onChangeText={setInstagram} placeholder="@yourhandle" iconColor="#E1306C" last styles={styles} colors={colors} />
          <View style={styles.editActions}>
            <Pressable style={styles.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.infoSection}>
          <SocialRow
            icon="call-outline"
            label="Phone"
            value={profile?.phone}
            onPress={profile?.phone ? () => openLink(`tel:${profile.phone}`) : undefined}
            styles={styles}
            colors={colors}
          />
          <SocialRow
            icon="logo-whatsapp"
            label="WhatsApp"
            value={profile?.whatsapp}
            iconColor="#25D366"
            onPress={profile?.whatsapp ? () => openLink(`whatsapp://send?phone=${profile.whatsapp!.replace(/\D/g, '')}`) : undefined}
            styles={styles}
            colors={colors}
          />
          <SocialRow
            icon="logo-instagram"
            label="Instagram"
            value={profile?.instagram ? `@${profile.instagram}` : null}
            iconColor="#E1306C"
            onPress={profile?.instagram ? () => openLink(`https://instagram.com/${profile.instagram}`) : undefined}
            last
            styles={styles}
            colors={colors}
          />
        </View>
      )}

      {/* Payment History */}
      {clientPayments.length > 0 && (
        <>
          <View style={[styles.sectionHeader, { marginTop: 4 }]}>
            <Text style={styles.sectionLabel}>PAYMENT HISTORY</Text>
          </View>
          <View style={[styles.infoSection, { marginBottom: 24 }]}>
            {clientPayments.map((pay, i) => (
              <View key={pay.id} style={[styles.payRow, i < clientPayments.length - 1 && styles.payRowBorder]}>
                <Ionicons name="cash-outline" size={18} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.payAmount}>
                    OMR {Number(pay.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={styles.payMeta}>
                    {new Date(pay.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' · '}{PAY_METHOD_LABEL[pay.payment_method] ?? pay.payment_method}
                  </Text>
                  {pay.notes ? <Text style={styles.payNotes}>"{pay.notes}"</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Package Renewal History */}
      {renewals.length > 0 && (
        <>
          <View style={[styles.sectionHeader, { marginTop: 4 }]}>
            <Text style={styles.sectionLabel}>PACKAGE RENEWALS</Text>
          </View>
          <View style={[styles.infoSection, { marginBottom: 24 }]}>
            {renewals.map((r, i) => {
              const pkgLabel: Record<string, string> = { '30min': '30 min', '45min': '45 min', '1hr': '1 hour' };
              const dateStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const isPartial = r.payment_status === 'partial';
              const dueDateStr = r.balance_due_date
                ? new Date(r.balance_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : null;
              return (
                <View key={r.id} style={[styles.payRow, i < renewals.length - 1 && styles.payRowBorder]}>
                  <Ionicons name="refresh-circle-outline" size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payAmount, { color: colors.accent }]}>+{r.total_sessions} sessions</Text>
                    <Text style={styles.payMeta}>{dateStr} · {pkgLabel[r.package_type] ?? r.package_type}</Text>
                    {isPartial && (
                      <Text style={[styles.payMeta, { color: '#F59E0B', marginTop: 2 }]}>
                        ⚠️ Balance pending{dueDateStr ? ` · due ${dueDateStr}` : ''}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Pressable
        style={({ pressed }) => [styles.guideBtn, pressed && { opacity: 0.7 }]}
        onPress={() => router.push('/(client)/guide')}
      >
        <Ionicons name="book-outline" size={16} color={colors.accent} />
        <Text style={styles.guideBtnText}>User Guide</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.accent} style={{ marginLeft: 'auto' }} />
      </Pressable>


      {/* Change Password */}
      <Pressable
        style={({ pressed }) => [styles.guideBtn, pressed && { opacity: 0.7 }, { marginBottom: 10 }]}
        onPress={() => setPwModal(true)}
      >
        <Ionicons name="lock-closed-outline" size={16} color={colors.accent} />
        <Text style={styles.guideBtnText}>Change Password</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.accent} style={{ marginLeft: 'auto' }} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      {/* Bug report */}
      <Pressable
        style={({ pressed }) => [styles.bugReportBtn, pressed && { opacity: 0.7 }]}
        onPress={() => Linking.openURL(
          `mailto:hr@jhe-group.com?subject=${encodeURIComponent('Bug Report - ELEVATƎ App v' + (Constants.expoConfig?.version ?? '1.0.0'))}&body=${encodeURIComponent('Describe the bug:\n\n')}`
        )}
      >
        <Ionicons name="bug-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.bugReportText}>Report a Bug</Text>
      </Pressable>

      <Text style={styles.versionText}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>

      {/* Change Password Modal */}
      <Modal visible={pwModal} transparent animationType="slide" onRequestClose={() => { setPwModal(false); setNewPw(''); setConfirmPw(''); setPwSuccess(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <Pressable onPress={() => { setPwModal(false); setNewPw(''); setConfirmPw(''); setPwSuccess(false); }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            {pwSuccess ? (
              <View style={styles.pwSuccess}>
                <Ionicons name="checkmark-circle" size={36} color={colors.success} />
                <Text style={styles.pwSuccessText}>Password Changed!</Text>
              </View>
            ) : (
              <>
                <View style={styles.pwInputRow}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, borderWidth: 0 }]}
                    value={newPw}
                    onChangeText={setNewPw}
                    placeholder="New password (min 6 chars)"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showNewPw}
                    autoFocus
                  />
                  <Pressable onPress={() => setShowNewPw(v => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={[styles.pwInputRow, { marginTop: 10 }]}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, borderWidth: 0 }]}
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showConfirmPw}
                    returnKeyType="done"
                    onSubmitEditing={handleChangePassword}
                  />
                  <Pressable onPress={() => setShowConfirmPw(v => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.saveBtn, { borderRadius: 12, marginTop: 14 }, changingPw && { opacity: 0.6 }]}
                  onPress={handleChangePassword}
                  disabled={changingPw}
                >
                  <Text style={styles.saveBtnText}>{changingPw ? 'Saving…' : 'Update Password'}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SocialRow({
  icon, label, value, iconColor, onPress, last, styles, colors,
}: {
  icon: string; label: string; value: string | null | undefined;
  iconColor?: string; onPress?: () => void; last?: boolean;
  styles: ReturnType<typeof makeStyles>; colors: ColorScheme;
}) {
  const color = iconColor ?? colors.textSecondary;
  return (
    <Pressable
      style={({ pressed }) => [styles.infoRow, !last && styles.infoRowBorder, pressed && onPress && { opacity: 0.65 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Ionicons name={icon as any} size={18} color={value ? color : colors.border} style={styles.rowIcon} />
      <View style={styles.rowContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, !value && { color: colors.textSecondary }]}>
          {value ?? 'Not set'}
        </Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={14} color={colors.textSecondary} />}
    </Pressable>
  );
}

function EditField({
  icon, label, value, onChangeText, placeholder, keyboardType, iconColor, last, styles, colors,
}: {
  icon: string; label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; iconColor?: string; last?: boolean;
  styles: ReturnType<typeof makeStyles>; colors: ColorScheme;
}) {
  return (
    <View style={[styles.editField, !last && styles.editFieldBorder]}>
      <Ionicons name={icon as any} size={18} color={iconColor ?? colors.textSecondary} style={styles.rowIcon} />
      <View style={styles.rowContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <TextInput
          style={styles.editInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary + '80'}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 24, paddingBottom: 80, alignItems: 'center' },
    avatarWrap: { alignItems: 'center', marginTop: 20, marginBottom: 16 },
    avatarPressable: { position: 'relative' },
    avatar: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: c.accent + '20', borderWidth: 2, borderColor: c.accent,
      justifyContent: 'center', alignItems: 'center',
    },
    avatarImg: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: c.accent },
    editBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: c.bg,
    },
    initials: { fontSize: 30, fontWeight: '800', color: c.accent },
    rolePill: {
      marginTop: 10, backgroundColor: c.accent + '20', borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: c.accent + '60',
    },
    roleText: { ...Typography.label, color: c.accent, fontSize: 10 },
    name: { ...Typography.title, color: c.textPrimary, marginBottom: 4, textAlign: 'center' },
    email: { ...Typography.body, color: c.textSecondary, marginBottom: 28, textAlign: 'center' },
    qrCard: {
      width: '100%', backgroundColor: c.surface, borderRadius: 20,
      borderWidth: 1, borderColor: c.accent + '40', padding: 20,
      alignItems: 'center', marginBottom: 24, gap: 4,
    },
    qrTitle: { ...Typography.label, color: c.accent, letterSpacing: 1.5 },
    qrSub: { ...Typography.caption, color: c.textSecondary, marginBottom: 12 },
    qrWrap: { padding: 16, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border },
    qrExpiry: { ...Typography.caption, color: c.textSecondary, marginTop: 10, textAlign: 'center' },

    goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
    goalRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    goalTitle: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    goalDate: { ...Typography.caption, color: c.textSecondary },
    goalTapHint: { ...Typography.caption, color: c.accent, fontSize: 10, fontWeight: '700' },
    goalEmptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    goalEmptyText: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic' },

    payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
    payRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    payAmount: { ...Typography.body, color: c.success, fontWeight: '800', marginBottom: 2 },
    payMeta: { ...Typography.caption, color: c.textSecondary },
    payNotes: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic', marginTop: 2 },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 },
    sectionLabel: { ...Typography.label, color: c.textSecondary },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    editBtnText: { color: c.accent, fontSize: 13, fontWeight: '600' },

    infoSection: {
      width: '100%', backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden', marginBottom: 24,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    infoRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    rowIcon: { marginRight: 12 },
    rowContent: { flex: 1 },
    infoLabel: { ...Typography.label, color: c.textSecondary, fontSize: 10, marginBottom: 2 },
    infoValue: { ...Typography.body, color: c.textPrimary, fontWeight: '500' },

    editCard: {
      width: '100%', backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden', marginBottom: 24,
    },
    editField: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    editFieldBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    editInput: { ...Typography.body, color: c.textPrimary, paddingVertical: 2 },
    editActions: { flexDirection: 'row', gap: 10, padding: 14 },
    cancelBtn: {
      flex: 1, borderRadius: 10, borderWidth: 1, borderColor: c.border,
      paddingVertical: 11, alignItems: 'center',
    },
    cancelBtnText: { color: c.textSecondary, fontWeight: '600', fontSize: 14 },
    saveBtn: {
      flex: 1, borderRadius: 10, backgroundColor: c.accent,
      paddingVertical: 11, alignItems: 'center',
    },
    saveBtnText: { color: c.bg, fontWeight: '800', fontSize: 14 },
    guideBtn: {
      width: '100%', borderRadius: 12, paddingVertical: 14, marginTop: 8, marginBottom: 10,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderColor: c.accent + '50',
      backgroundColor: c.accent + '08', paddingHorizontal: 16,
    },
    guideBtnText: { color: c.accent, fontSize: 15, fontWeight: '700' },
    signOutBtn: {
      width: '100%', borderRadius: 12, paddingVertical: 15,
      alignItems: 'center', borderWidth: 1, borderColor: c.danger, marginTop: 8,
    },
    signOutText: { color: c.danger, fontSize: 15, fontWeight: '700' },
    bugReportBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginTop: 12, paddingVertical: 10,
    },
    bugReportText: { color: c.textSecondary, fontSize: 13 },
    versionText: { textAlign: 'center', color: c.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 20, opacity: 0.6 },

    modalOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: c.overlay, justifyContent: 'flex-end',
    },
    modalBox: {
      backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, gap: 12,
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: 4,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    modalInput: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: c.textPrimary, fontSize: 15,
    },
    pwInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12 },
    eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
    pwSuccess: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    pwSuccessText: { fontSize: 18, fontWeight: '800', color: c.success },
  });
}
