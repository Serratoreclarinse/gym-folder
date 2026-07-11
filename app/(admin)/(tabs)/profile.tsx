import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminProfileScreen() {
  const { profile, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Edit profile
  const [editName, setEditName] = useState(profile?.name ?? '');
  const [editPhone, setEditPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  // Change password
  const [pwModal, setPwModal] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  const loadAvatar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setAvatarUrl(user?.user_metadata?.avatar_url ?? null);
  }, []);

  useFocusEffect(useCallback(() => { loadAvatar(); }, [loadAvatar]));

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const userId = profile?.id;
    if (!userId) return;

    setUploadingPhoto(true);
    try {
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const path = `${userId}.${ext}`;

      // Read the image as a blob (web) or use uri directly (native)
      let uploadData: Blob | ArrayBuffer;
      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        uploadData = await resp.blob();
      } else {
        const resp = await fetch(asset.uri);
        uploadData = await resp.blob();
      }

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, uploadData, { upsert: true, contentType: `image/${ext}` });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;

      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      setAvatarUrl(publicUrl);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload photo. Make sure the "avatars" bucket exists in Supabase Storage.');
    }
    setUploadingPhoto(false);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !profile?.id) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_update_profile', {
      p_user_id: profile.id,
      p_name: editName.trim(),
      p_phone: editPhone.trim(),
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    if (Platform.OS === 'web') { window.alert('Profile updated!'); }
    else { Alert.alert('Saved', 'Profile updated successfully.'); }
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

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Sign out?')) return;
      signOut();
      return;
    }
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const displayName = profile?.name ?? 'Admin';
  const displayEmail = profile?.email ?? '';

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* ── Profile header ── */}
        <View style={s.headerCard}>
          {/* Banner */}
          <View style={s.banner} />

          {/* Avatar */}
          <View style={s.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarInitials}>
                <Text style={s.avatarInitialsText}>{initials(displayName)}</Text>
              </View>
            )}
            <Pressable
              style={s.cameraBtn}
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={14} color="#fff" />
              }
            </Pressable>
          </View>

          {/* Info */}
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{displayName}</Text>
            <View style={s.adminBadge}>
              <Ionicons name="shield-checkmark-outline" size={11} color={colors.accent} />
              <Text style={s.adminBadgeText}>ADMIN</Text>
            </View>
            <Text style={s.profileEmail}>{displayEmail}</Text>
          </View>
        </View>

        {/* ── Edit Profile ── */}
        <Text style={s.sectionLabel}>EDIT PROFILE</Text>
        <View style={s.card}>
          <Text style={s.fieldLabel}>Full Name</Text>
          <TextInput
            style={s.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="Your name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
          />
          <Text style={[s.fieldLabel, { marginTop: 12 }]}>Phone</Text>
          <TextInput
            style={s.input}
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder="Phone number (optional)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
          <Pressable
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            <Ionicons name="checkmark-outline" size={16} color={colors.bg} />
            <Text style={s.saveBtnText}>{saving ? 'SAVING…' : 'SAVE CHANGES'}</Text>
          </Pressable>
        </View>

        {/* ── Security ── */}
        <Text style={s.sectionLabel}>SECURITY</Text>
        <View style={s.card}>
          <Pressable style={s.menuRow} onPress={() => { setPwModal(true); }}>
            <View style={[s.menuIcon, { backgroundColor: '#5C6BC018' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#5C6BC0" />
            </View>
            <View style={s.menuText}>
              <Text style={s.menuTitle}>Change Password</Text>
              <Text style={s.menuSub}>Update your login password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </Pressable>
        </View>

        {/* ── Preferences ── */}
        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.card}>
          <Pressable style={s.menuRow} onPress={toggleTheme}>
            <View style={[s.menuIcon, { backgroundColor: isDark ? '#FFB30018' : '#5C6BC018' }]}>
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={isDark ? '#FFB300' : '#5C6BC0'}
              />
            </View>
            <View style={s.menuText}>
              <Text style={s.menuTitle}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
              <Text style={s.menuSub}>Currently {isDark ? 'dark' : 'light'} theme</Text>
            </View>
            <View style={[s.toggleTrack, isDark && s.toggleTrackOn]}>
              <View style={[s.toggleThumb, isDark && s.toggleThumbOn]} />
            </View>
          </Pressable>
        </View>

        {/* ── Sign out ── */}
        <Pressable style={s.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#FF4D4D" />
          <Text style={s.signOutText}>Sign Out</Text>
        </Pressable>

        {/* ── Bug report ── */}
        <Pressable
          style={({ pressed }) => [s.bugReportBtn, pressed && { opacity: 0.7 }]}
          onPress={() => Linking.openURL(
            `mailto:hr@jhe-group.com?subject=${encodeURIComponent('Bug Report - ELEVATƎ App v' + (Constants.expoConfig?.version ?? '1.0.0'))}&body=${encodeURIComponent('Describe the bug:\n\n')}`
          )}
        >
          <Ionicons name="bug-outline" size={16} color="#888" />
          <Text style={s.bugReportText}>Report a Bug</Text>
        </Pressable>

        <Text style={s.versionText}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Change Password Modal ── */}
      <Modal visible={pwModal} transparent animationType="slide" onRequestClose={() => setPwModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Change Password</Text>
              <Pressable onPress={() => { setPwModal(false); setNewPw(''); setConfirmPw(''); setPwSuccess(false); }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {pwSuccess ? (
              <View style={s.pwSuccess}>
                <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
                <Text style={s.pwSuccessText}>Password Changed!</Text>
              </View>
            ) : (
              <>
                <Text style={s.modalLabel}>New Password</Text>
                <TextInput
                  style={s.modalInput}
                  value={newPw}
                  onChangeText={setNewPw}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoFocus
                />
                <Text style={[s.modalLabel, { marginTop: 12 }]}>Confirm Password</Text>
                <TextInput
                  style={s.modalInput}
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  placeholder="Repeat new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleChangePassword}
                />
                <Pressable
                  style={[s.modalBtn, changingPw && { opacity: 0.6 }]}
                  onPress={handleChangePassword}
                  disabled={changingPw}
                >
                  <Text style={s.modalBtnText}>{changingPw ? 'SAVING…' : 'UPDATE PASSWORD'}</Text>
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
    content: { paddingBottom: 40 },

    // ── Profile header ──
    headerCard: {
      backgroundColor: c.surface,
      borderBottomWidth: 1, borderBottomColor: c.border,
      marginBottom: 28, alignItems: 'center',
    },
    banner: {
      width: '100%', height: 120,
      backgroundColor: c.accent + '30',
    },
    avatarWrap: {
      marginTop: -44, marginBottom: 12,
      position: 'relative', alignItems: 'center',
    },
    avatarImg: {
      width: 88, height: 88, borderRadius: 44,
      borderWidth: 3, borderColor: c.surface,
    },
    avatarInitials: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: c.accent + '25',
      borderWidth: 3, borderColor: c.surface,
      justifyContent: 'center', alignItems: 'center',
    },
    avatarInitialsText: { fontSize: 30, fontWeight: '900', color: c.accent },
    cameraBtn: {
      position: 'absolute', bottom: 0, right: -4,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.accent,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: c.surface,
    },
    profileInfo: { alignItems: 'center', paddingBottom: 20, gap: 6 },
    profileName: { fontSize: 22, fontWeight: '900', color: c.textPrimary, letterSpacing: 0.3 },
    adminBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: c.accent + '18', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 4,
      borderWidth: 1, borderColor: c.accent + '50',
    },
    adminBadgeText: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    profileEmail: { ...Typography.body, color: c.textSecondary },

    // ── Sections ──
    sectionLabel: {
      ...Typography.label, color: c.textSecondary,
      marginBottom: 10, marginHorizontal: 20,
    },
    card: {
      backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 1, borderColor: c.border,
      marginHorizontal: 20, marginBottom: 24,
      padding: 16,
    },
    fieldLabel: { ...Typography.caption, color: c.textSecondary, marginBottom: 6 },
    input: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: c.textPrimary, fontSize: 15,
    },
    saveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.accent, borderRadius: 12,
      paddingVertical: 13, marginTop: 16,
    },
    saveBtnText: { color: c.bg, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

    menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    menuIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    menuText: { flex: 1 },
    menuTitle: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    menuSub: { ...Typography.caption, color: c.textSecondary },

    // Toggle switch
    toggleTrack: {
      width: 44, height: 24, borderRadius: 12,
      backgroundColor: c.border, padding: 2,
      justifyContent: 'center',
    },
    toggleTrackOn: { backgroundColor: c.accent },
    toggleThumb: {
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: '#fff',
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
    },
    toggleThumbOn: { alignSelf: 'flex-end' },

    signOutBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      marginHorizontal: 20, borderRadius: 14,
      borderWidth: 1, borderColor: '#FF4D4D40',
      backgroundColor: '#FF4D4D0C',
      paddingVertical: 15,
    },
    signOutText: { fontSize: 15, fontWeight: '700', color: '#FF4D4D' },
    bugReportBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginTop: 12, paddingVertical: 10,
    },
    bugReportText: { color: c.textSecondary, fontSize: 13 },
    versionText: { textAlign: 'center', color: c.textSecondary, fontSize: 12, marginTop: 4, opacity: 0.6 },

    // Modal
    overlay: { flex: 1, backgroundColor: '#00000070', justifyContent: 'flex-end' },
    modalBox: {
      backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, gap: 12,
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: 4,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { ...Typography.subtitle, color: c.textPrimary, fontWeight: '700' },
    modalLabel: { ...Typography.caption, color: c.textSecondary },
    modalInput: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: c.textPrimary, fontSize: 15,
    },
    modalBtn: {
      backgroundColor: c.accent, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center', marginTop: 8,
    },
    modalBtnText: { color: c.bg, fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },
    pwSuccess: { alignItems: 'center', paddingVertical: 28, gap: 12 },
    pwSuccessText: { fontSize: 18, fontWeight: '800', color: '#4CAF50' },
  });
}
