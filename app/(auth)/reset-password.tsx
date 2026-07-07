import { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    if (password.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setDone(true);
  };

  if (done) {
    return (
      <View style={s.doneWrap}>
        <View style={s.doneIcon}>
          <Ionicons name="checkmark-circle" size={56} color={colors.accent} />
        </View>
        <Text style={s.doneTitle}>Password Updated!</Text>
        <Text style={s.doneSub}>Your password has been changed successfully.</Text>
        <Pressable style={s.btn} onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.btnText}>SIGN IN</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.inner}>
        <View style={s.iconWrap}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.accent} />
        </View>
        <Text style={s.title}>Reset Password</Text>
        <Text style={s.sub}>Enter your new password below.</Text>

        <Text style={s.fieldLabel}>NEW PASSWORD</Text>
        <View style={s.passwordWrap}>
          <TextInput
            style={s.passwordInput}
            placeholder="Min. 6 characters"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            autoFocus
          />
          <Pressable style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={s.fieldLabel}>CONFIRM PASSWORD</Text>
        <TextInput
          style={s.input}
          placeholder="Re-enter password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={!showPassword}
          value={confirm}
          onChangeText={setConfirm}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <Pressable
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={s.btnText}>{loading ? 'SAVING…' : 'UPDATE PASSWORD'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    inner: {
      flex: 1, justifyContent: 'center',
      paddingHorizontal: 28, paddingBottom: 40,
    },
    iconWrap: { alignItems: 'center', marginBottom: 20 },
    title: { ...Typography.heading, color: c.textPrimary, textAlign: 'center', marginBottom: 8 },
    sub: { ...Typography.body, color: c.textSecondary, textAlign: 'center', marginBottom: 32 },

    fieldLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 8 },
    input: {
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 16, paddingVertical: 14,
      ...Typography.body, color: c.textPrimary,
      marginBottom: 20,
    },
    passwordWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
      marginBottom: 20,
    },
    passwordInput: {
      flex: 1, paddingHorizontal: 16, paddingVertical: 14,
      ...Typography.body, color: c.textPrimary,
    },
    eyeBtn: { paddingHorizontal: 14 },

    btn: {
      backgroundColor: c.accent, borderRadius: 14,
      paddingVertical: 16, alignItems: 'center', marginTop: 8,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { ...Typography.label, color: '#fff', letterSpacing: 1.2 },

    doneWrap: {
      flex: 1, backgroundColor: c.bg,
      justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 32,
    },
    doneIcon: { marginBottom: 20 },
    doneTitle: { ...Typography.heading, color: c.textPrimary, textAlign: 'center', marginBottom: 8 },
    doneSub: { ...Typography.body, color: c.textSecondary, textAlign: 'center', marginBottom: 36 },
  });
}
