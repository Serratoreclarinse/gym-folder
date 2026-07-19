import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { PhoneInput } from '@/components/PhoneInput';
import { useAuth } from '@/context/AuthContext';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

export default function CoachProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Equipment request
  const [showEqModal, setShowEqModal] = useState(false);
  const [eqItem, setEqItem] = useState('');
  const [eqQty, setEqQty] = useState('1');
  const [eqNotes, setEqNotes] = useState('');
  const [submittingEq, setSubmittingEq] = useState(false);
  const [myRequests, setMyRequests] = useState<{ id: string; itemName: string; quantity: number; status: string; createdAt: string }[]>([]);

  const loadMyRequests = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('equipment_requests')
      .select('id, item_name, quantity, status, created_at')
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setMyRequests(
      (data ?? []).map((r: any) => ({
        id: r.id,
        itemName: r.item_name,
        quantity: r.quantity,
        status: r.status,
        createdAt: r.created_at,
      })),
    );
  }, [profile?.id]);

  useEffect(() => { loadMyRequests(); }, [loadMyRequests]);

  const handleSubmitEquipment = async () => {
    if (!eqItem.trim() || !profile?.id) return;
    setSubmittingEq(true);
    const { error } = await supabase.from('equipment_requests').insert({
      coach_id: profile.id,
      item_name: eqItem.trim(),
      quantity: Math.max(1, parseInt(eqQty, 10) || 1),
      notes: eqNotes.trim() || null,
      status: 'pending',
    });
    setSubmittingEq(false);
    if (error) { Alert.alert('Error', error.message); return; }

    // Notify admin
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
    if (admins?.[0]?.id) {
      const { sendPushNotification } = await import('@/lib/pushNotifications');
      await sendPushNotification(admins[0].id, {
        title: '🔧 Equipment Request',
        body: `${profile.name ?? 'A coach'} requested: ${eqItem.trim()}${parseInt(eqQty, 10) > 1 ? ` ×${eqQty}` : ''}`,
      });
    }

    setShowEqModal(false);
    setEqItem(''); setEqQty('1'); setEqNotes('');
    loadMyRequests();
    Alert.alert('Request Sent', 'Your equipment request has been submitted to the admin.');
  };

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
    setPhone(profile?.phone ?? '');
    setWhatsapp(profile?.whatsapp ?? '');
    setInstagram(profile?.instagram ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      instagram: instagram.trim().replace(/^@/, '') || null,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await refreshProfile();
    setEditing(false);
  };

  const handleChangeName = async () => {
    if (!newName.trim() || !profile?.id) return;
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ name: newName.trim() }).eq('id', profile.id);
    setSavingName(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await refreshProfile();
    setEditingName(false);
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSavingEmail(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Confirmation sent', 'Check your new email inbox to confirm the change.');
    setEditingEmail(false);
    setNewEmail('');
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Success', 'Password updated!');
    setEditingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
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
          <Text style={styles.roleText}>COACH</Text>
        </View>
      </View>

      <Text style={styles.name}>{profile?.name ?? '—'}</Text>
      <Text style={styles.email}>{profile?.email ?? '—'}</Text>

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
          <EditField icon="logo-instagram" label="INSTAGRAM" value={instagram} onChangeText={setInstagram} placeholder="@yourhandle" iconColor="#E1306C" last colors={colors} />
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
            colors={colors}
            styles={styles}
          />
          <SocialRow
            icon="logo-whatsapp"
            label="WhatsApp"
            value={profile?.whatsapp}
            iconColor="#25D366"
            onPress={profile?.whatsapp ? () => openLink(`whatsapp://send?phone=${profile.whatsapp!.replace(/\D/g, '')}`) : undefined}
            colors={colors}
            styles={styles}
          />
          <SocialRow
            icon="logo-instagram"
            label="Instagram"
            value={profile?.instagram ? `@${profile.instagram}` : null}
            iconColor="#E1306C"
            onPress={profile?.instagram ? () => openLink(`https://instagram.com/${profile.instagram}`) : undefined}
            last
            colors={colors}
            styles={styles}
          />
        </View>
      )}

      {/* Settings */}
      <View style={[styles.sectionHeader, { marginTop: 8 }]}>
        <Text style={styles.sectionLabel}>SETTINGS</Text>
      </View>
      <View style={styles.infoSection}>
        <Pressable
          style={({ pressed }) => [styles.infoRow, styles.infoRowBorder, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/(coach)/availability')}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} style={styles.rowIcon} />
          <View style={styles.rowContent}>
            <Text style={styles.infoLabel}>AVAILABILITY</Text>
            <Text style={styles.infoValue}>Set your weekly schedule & blocked dates</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Account */}
      <View style={[styles.sectionHeader, { marginTop: 8 }]}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
      </View>

      {editingEmail ? (
        <View style={styles.editCard}>
          <EditField
            icon="mail-outline"
            label="NEW EMAIL"
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="Enter new email address"
            keyboardType="email-address"
            last
            colors={colors}
          />
          <View style={styles.editActions}>
            <Pressable style={styles.cancelBtn} onPress={() => { setEditingEmail(false); setNewEmail(''); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, (!newEmail.trim() || savingEmail) && { opacity: 0.4 }]}
              onPress={handleChangeEmail}
              disabled={!newEmail.trim() || savingEmail}
            >
              <Text style={styles.saveBtnText}>{savingEmail ? 'Sending…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      ) : editingName ? (
        <View style={styles.editCard}>
          <EditField
            icon="person-outline"
            label="NEW NAME"
            value={newName}
            onChangeText={setNewName}
            placeholder="Enter your name"
            last
            colors={colors}
          />
          <View style={styles.editActions}>
            <Pressable style={styles.cancelBtn} onPress={() => setEditingName(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, (!newName.trim() || savingName) && { opacity: 0.4 }]}
              onPress={handleChangeName}
              disabled={!newName.trim() || savingName}
            >
              <Text style={styles.saveBtnText}>{savingName ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      ) : editingPassword ? (
        <View style={styles.editCard}>
          <EditField
            icon="lock-closed-outline"
            label="NEW PASSWORD"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Min. 6 characters"
            secureTextEntry
            colors={colors}
          />
          <EditField
            icon="lock-closed-outline"
            label="CONFIRM PASSWORD"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat new password"
            secureTextEntry
            last
            colors={colors}
          />
          <View style={styles.editActions}>
            <Pressable style={styles.cancelBtn} onPress={() => { setEditingPassword(false); setNewPassword(''); setConfirmPassword(''); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, savingPassword && { opacity: 0.4 }]}
              onPress={handleChangePassword}
              disabled={savingPassword}
            >
              <Text style={styles.saveBtnText}>{savingPassword ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.infoSection}>
          <Pressable
            style={({ pressed }) => [styles.infoRow, styles.infoRowBorder, pressed && { opacity: 0.7 }]}
            onPress={() => { setNewName(profile?.name ?? ''); setEditingName(true); }}
          >
            <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={styles.infoLabel}>DISPLAY NAME</Text>
              <Text style={styles.infoValue}>{profile?.name ?? '—'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.infoRow, styles.infoRowBorder, pressed && { opacity: 0.7 }]}
            onPress={() => { setNewEmail(profile?.email ?? ''); setEditingEmail(true); }}
          >
            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={styles.infoLabel}>EMAIL</Text>
              <Text style={styles.infoValue}>{profile?.email ?? '—'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.infoRow, pressed && { opacity: 0.7 }]}
            onPress={() => setEditingPassword(true)}
          >
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={styles.infoLabel}>PASSWORD</Text>
              <Text style={styles.infoValue}>••••••••</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Equipment Request */}
      <Pressable
        style={({ pressed }) => [styles.guideBtn, { borderColor: colors.warning + '50', backgroundColor: colors.warning + '08' }, pressed && { opacity: 0.7 }]}
        onPress={() => setShowEqModal(true)}
      >
        <Ionicons name="construct-outline" size={16} color={colors.warning} />
        <Text style={[styles.guideBtnText, { color: colors.warning }]}>Request Equipment</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.warning} style={{ marginLeft: 'auto' }} />
      </Pressable>

      {/* Recent equipment requests */}
      {myRequests.length > 0 && (
        <View style={styles.eqHistory}>
          {myRequests.map((r) => {
            const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
              pending:   { label: 'PENDING',  color: colors.warning },
              approved:  { label: 'INCOMING', color: '#2196F3' },
              fulfilled: { label: 'RECEIVED', color: colors.success },
              rejected:  { label: 'REJECTED', color: colors.danger },
            };
            const { label, color } = STATUS_DISPLAY[r.status] ?? { label: r.status.toUpperCase(), color: colors.textSecondary };
            return (
              <View key={r.id} style={styles.eqHistoryRow}>
                <Text style={styles.eqHistoryItem} numberOfLines={1}>{r.itemName}{r.quantity > 1 ? ` ×${r.quantity}` : ''}</Text>
                <View style={[styles.eqStatusBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                  <Text style={[styles.eqStatusText, { color }]}>{label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Equipment Request Modal */}
      <Modal visible={showEqModal} transparent animationType="slide" onRequestClose={() => setShowEqModal(false)}>
        <View style={styles.eqOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowEqModal(false)} />
          <View style={styles.eqSheet}>
            <View style={styles.eqHandle} />
            <Text style={styles.eqSheetTitle}>Request Equipment</Text>

            <Text style={styles.eqLabel}>ITEM NAME <Text style={{ color: colors.accent }}>*</Text></Text>
            <TextInput
              style={styles.eqInput}
              placeholder="e.g. Resistance bands, Kettlebell 16kg…"
              placeholderTextColor={colors.textSecondary}
              value={eqItem}
              onChangeText={setEqItem}
              autoFocus
            />

            <Text style={styles.eqLabel}>QUANTITY</Text>
            <TextInput
              style={[styles.eqInput, { width: 80 }]}
              placeholder="1"
              placeholderTextColor={colors.textSecondary}
              value={eqQty}
              onChangeText={setEqQty}
              keyboardType="number-pad"
            />

            <Text style={styles.eqLabel}>NOTES (optional)</Text>
            <TextInput
              style={[styles.eqInput, { minHeight: 70 }]}
              placeholder="Reason, brand preference, urgency…"
              placeholderTextColor={colors.textSecondary}
              value={eqNotes}
              onChangeText={setEqNotes}
              multiline
            />

            <Pressable
              style={({ pressed }) => [styles.eqSubmitBtn, (!eqItem.trim() || submittingEq) && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
              onPress={handleSubmitEquipment}
              disabled={!eqItem.trim() || submittingEq}
            >
              <Text style={styles.eqSubmitText}>{submittingEq ? 'SUBMITTING…' : 'SUBMIT REQUEST'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Sign out */}
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
    </ScrollView>
  );
}

function SocialRow({
  icon, label, value, iconColor, onPress, last, colors, styles,
}: {
  icon: string; label: string; value: string | null | undefined;
  iconColor?: string; onPress?: () => void; last?: boolean;
  colors: ColorScheme; styles: ReturnType<typeof makeStyles>;
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
  icon, label, value, onChangeText, placeholder, keyboardType, iconColor, secureTextEntry, last, colors,
}: {
  icon: string; label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; iconColor?: string; secureTextEntry?: boolean; last?: boolean;
  colors: ColorScheme;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [hidden, setHidden] = useState(secureTextEntry ?? false);
  return (
    <View style={[styles.editField, !last && styles.editFieldBorder]}>
      <Ionicons name={icon as any} size={18} color={iconColor ?? colors.textSecondary} style={styles.rowIcon} />
      <View style={styles.rowContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.pwRow}>
          <TextInput
            style={[styles.editInput, { flex: 1 }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary + '80'}
            keyboardType={keyboardType}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={hidden}
          />
          {secureTextEntry && (
            <Pressable onPress={() => setHidden((h) => !h)} style={styles.eyeBtn}>
              <Ionicons
                name={hidden ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 24, paddingBottom: 60, alignItems: 'center' },
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
    pwRow: { flexDirection: 'row', alignItems: 'center' },
    eyeBtn: { paddingLeft: 8, paddingVertical: 4 },
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
      width: '100%', borderRadius: 12, paddingVertical: 14, marginBottom: 10,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderColor: c.accent + '50',
      backgroundColor: c.accent + '08', paddingHorizontal: 16,
    },
    guideBtnText: { color: c.accent, fontSize: 15, fontWeight: '700' },
    signOutBtn: {
      width: '100%', borderRadius: 12, paddingVertical: 15,
      alignItems: 'center', borderWidth: 1, borderColor: c.danger,
    },
    signOutText: { color: c.danger, fontSize: 15, fontWeight: '700' },
    bugReportBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginTop: 12, paddingVertical: 10,
    },
    bugReportText: { color: c.textSecondary, fontSize: 13 },
    versionText: { textAlign: 'center', color: c.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 20, opacity: 0.6 },

    // Equipment request
    eqHistory: {
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1,
      borderColor: c.border, marginBottom: 10, overflow: 'hidden',
    },
    eqHistoryRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    eqHistoryItem: { ...Typography.body, color: c.textPrimary, flex: 1, marginRight: 8 },
    eqStatusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    eqStatusText: { fontSize: 10, fontWeight: '800' },
    eqOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    eqSheet: {
      backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, gap: 6,
    },
    eqHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: 12 },
    eqSheetTitle: { ...Typography.title, color: c.textPrimary, fontWeight: '800', marginBottom: 8 },
    eqLabel: { ...Typography.label, color: c.textSecondary, marginTop: 8, marginBottom: 4 },
    eqInput: {
      ...Typography.body, color: c.textPrimary,
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    eqSubmitBtn: {
      backgroundColor: c.warning, borderRadius: 12,
      paddingVertical: 15, alignItems: 'center', marginTop: 16,
    },
    eqSubmitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
}
