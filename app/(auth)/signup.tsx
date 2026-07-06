import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

export default function SignUpScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isWeb = Platform.OS === 'web';
  const cardWidth = isWeb ? Math.min(width - 40, 420) : undefined;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'coach' | 'client'>('coach');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { name: trimmedName, role } },
      });
      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ name: trimmedName, role })
          .eq('id', data.user.id);
        if (profileError) {
          console.warn('Profile update error:', profileError.message);
        }
      }
      if (!data.session) {
        Alert.alert(
          'Check your email',
          'We sent a confirmation link to ' + trimmedEmail + '. Click it to activate your account.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={[styles.inner, isWeb && styles.innerDesktop]} keyboardShouldPersistTaps="handled">
        <View style={[isWeb ? styles.card : undefined, cardWidth !== undefined && { width: cardWidth }]}>
        <View style={styles.logoWrap}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.heading}>Create{'\n'}account.</Text>
        <Text style={styles.sub}>Get started today</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>FULL NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>I AM A</Text>
          <View style={styles.roleRow}>
            <Pressable
              style={[styles.roleBtn, role === 'coach' && styles.roleBtnActive]}
              onPress={() => setRole('coach')}
            >
              <Text style={[styles.roleBtnText, role === 'coach' && styles.roleBtnTextActive]}>
                Coach
              </Text>
            </Pressable>
            <Pressable
              style={[styles.roleBtn, role === 'client' && styles.roleBtnActive]}
              onPress={() => setRole('client')}
            >
              <Text style={[styles.roleBtnText, role === 'client' && styles.roleBtnTextActive]}>
                Client
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'CREATING…' : 'CREATE ACCOUNT'}</Text>
        </Pressable>

        <Pressable style={styles.loginLink} onPress={() => router.back()}>
          <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkAccent}>Sign in</Text></Text>
        </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  innerDesktop: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  card: {
    alignSelf: 'center',
    backgroundColor: c.surface + 'CC',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: c.border,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 80,
  },
  heading: {
    ...Typography.hero,
    color: c.textPrimary,
    marginBottom: 4,
    lineHeight: 36,
    textAlign: 'center',
  },
  sub: {
    ...Typography.body,
    color: c.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    ...Typography.label,
    color: c.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: c.textPrimary,
    fontSize: 15,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: c.textPrimary,
    fontSize: 15,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
  },
  roleBtnActive: {
    borderColor: c.accent,
    backgroundColor: c.accent,
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textSecondary,
  },
  roleBtnTextActive: {
    color: '#FFFFFF',
  },
  btn: {
    backgroundColor: c.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  loginLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginLinkText: {
    ...Typography.body,
    color: c.textSecondary,
  },
  loginLinkAccent: {
    color: c.accent,
    fontWeight: '600',
  },
  });
}
