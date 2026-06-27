import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Colors, Typography } from '@/constants/theme';

export default function ClientProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [saving, setSaving] = useState(false);

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
        .upload(fileName, formData, { upsert: true, contentType: 'multipart/form-data' });
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
            <Ionicons name="camera" size={12} color={Colors.bg} />
          </View>
        </Pressable>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>CLIENT</Text>
        </View>
      </View>

      <Text style={styles.name}>{profile?.name ?? '—'}</Text>
      <Text style={styles.email}>{profile?.email ?? '—'}</Text>

      {/* QR Code */}
      {profile?.id && (
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>MY QR CODE</Text>
          <Text style={styles.qrSub}>Show this to your coach to check in</Text>
          <View style={styles.qrWrap}>
            <QRCode value={profile.id} size={180} color={Colors.textPrimary} backgroundColor={Colors.surface} />
          </View>
        </View>
      )}

      {/* Contact & Social */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>CONTACT & SOCIAL</Text>
        {!editing && (
          <Pressable style={styles.editBtn} onPress={handleStartEdit}>
            <Ionicons name="pencil-outline" size={13} color={Colors.accent} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View style={styles.editCard}>
          <EditField icon="call-outline" label="PHONE" value={phone} onChangeText={setPhone} placeholder="+63 912 345 6789" keyboardType="phone-pad" />
          <EditField icon="logo-whatsapp" label="WHATSAPP" value={whatsapp} onChangeText={setWhatsapp} placeholder="+63 912 345 6789" keyboardType="phone-pad" iconColor="#25D366" />
          <EditField icon="logo-instagram" label="INSTAGRAM" value={instagram} onChangeText={setInstagram} placeholder="@yourhandle" iconColor="#E1306C" last />
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
          />
          <SocialRow
            icon="logo-whatsapp"
            label="WhatsApp"
            value={profile?.whatsapp}
            iconColor="#25D366"
            onPress={profile?.whatsapp ? () => openLink(`whatsapp://send?phone=${profile.whatsapp!.replace(/\D/g, '')}`) : undefined}
          />
          <SocialRow
            icon="logo-instagram"
            label="Instagram"
            value={profile?.instagram ? `@${profile.instagram}` : null}
            iconColor="#E1306C"
            onPress={profile?.instagram ? () => openLink(`https://instagram.com/${profile.instagram}`) : undefined}
            last
          />
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function SocialRow({
  icon, label, value, iconColor, onPress, last,
}: {
  icon: string; label: string; value: string | null | undefined;
  iconColor?: string; onPress?: () => void; last?: boolean;
}) {
  const color = iconColor ?? Colors.textSecondary;
  return (
    <Pressable
      style={({ pressed }) => [styles.infoRow, !last && styles.infoRowBorder, pressed && onPress && { opacity: 0.65 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Ionicons name={icon as any} size={18} color={value ? color : Colors.border} style={styles.rowIcon} />
      <View style={styles.rowContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, !value && { color: Colors.textSecondary }]}>
          {value ?? 'Not set'}
        </Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={14} color={Colors.textSecondary} />}
    </Pressable>
  );
}

function EditField({
  icon, label, value, onChangeText, placeholder, keyboardType, iconColor, last,
}: {
  icon: string; label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; iconColor?: string; last?: boolean;
}) {
  return (
    <View style={[styles.editField, !last && styles.editFieldBorder]}>
      <Ionicons name={icon as any} size={18} color={iconColor ?? Colors.textSecondary} style={styles.rowIcon} />
      <View style={styles.rowContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <TextInput
          style={styles.editInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary + '80'}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  avatarWrap: { alignItems: 'center', marginTop: 20, marginBottom: 16 },
  avatarPressable: { position: 'relative' },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.accent + '20', borderWidth: 2, borderColor: Colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImg: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: Colors.accent },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.bg,
  },
  initials: { fontSize: 30, fontWeight: '800', color: Colors.accent },
  rolePill: {
    marginTop: 10, backgroundColor: Colors.accent + '20', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accent + '60',
  },
  roleText: { ...Typography.label, color: Colors.accent, fontSize: 10 },
  name: { ...Typography.title, color: Colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  email: { ...Typography.body, color: Colors.textSecondary, marginBottom: 28, textAlign: 'center' },
  qrCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.accent + '40', padding: 20,
    alignItems: 'center', marginBottom: 24, gap: 4,
  },
  qrTitle: { ...Typography.label, color: Colors.accent, letterSpacing: 1.5 },
  qrSub: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 12 },
  qrWrap: { padding: 16, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 },
  sectionLabel: { ...Typography.label, color: Colors.textSecondary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },

  infoSection: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 24,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { marginRight: 12 },
  rowContent: { flex: 1 },
  infoLabel: { ...Typography.label, color: Colors.textSecondary, fontSize: 10, marginBottom: 2 },
  infoValue: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },

  editCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 24,
  },
  editField: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  editFieldBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  editInput: { ...Typography.body, color: Colors.textPrimary, paddingVertical: 2 },
  editActions: { flexDirection: 'row', gap: 10, padding: 14 },
  cancelBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 11, alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flex: 1, borderRadius: 10, backgroundColor: Colors.accent,
    paddingVertical: 11, alignItems: 'center',
  },
  saveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14 },
  signOutBtn: {
    width: '100%', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.danger, marginTop: 8,
  },
  signOutText: { color: Colors.danger, fontSize: 15, fontWeight: '700' },
});
