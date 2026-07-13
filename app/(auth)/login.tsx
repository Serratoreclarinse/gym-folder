import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isWeb = Platform.OS === 'web';
  const cardWidth = isWeb ? Math.min(width - 40, 420) : undefined;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'newpass'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  const resetForgot = () => {
    setShowForgot(false);
    setForgotStep('email');
    setForgotEmail('');
    setOtpCode('');
    setNewPass('');
    setConfirmPass('');
    setErrorMsg('');
  };

  const handleSendOtp = async () => {
    const trimmed = forgotEmail.trim().toLowerCase();
    if (!trimmed) { setErrorMsg('Enter your email address.'); return; }
    setErrorMsg('');
    setForgotLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: false },
    });
    setForgotLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    setForgotStep('code');
  };

  const handleVerifyOtp = async () => {
    const trimmed = otpCode.trim();
    if (trimmed.length < 6) { setErrorMsg('Enter the 6-digit code from your email.'); return; }
    setErrorMsg('');
    setForgotLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: forgotEmail.trim().toLowerCase(),
      token: trimmed,
      type: 'email',
    });
    setForgotLoading(false);
    if (error) { setErrorMsg('Invalid or expired code. Try again.'); return; }
    setForgotStep('newpass');
  };

  const handleSetNewPassword = async () => {
    if (newPass.length < 6) { setErrorMsg('Password must be at least 6 characters.'); return; }
    if (newPass !== confirmPass) { setErrorMsg('Passwords do not match.'); return; }
    setErrorMsg('');
    setForgotLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setForgotLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    resetForgot();
  };

  const handleLogin = async () => {
    setErrorMsg('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setErrorMsg(error.message);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, isWeb && styles.innerDesktop]}>
        <View style={[isWeb ? styles.card : undefined, cardWidth !== undefined && { width: cardWidth }]}>
        <View style={styles.logoWrap}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.heading}>Welcome{'\n'}back.</Text>
        <Text style={styles.sub}>Sign in to continue</Text>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

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
              placeholder="••••••••"
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

        {!showForgot ? (
          <Pressable style={styles.forgotLink} onPress={() => { setShowForgot(true); setForgotEmail(email); setForgotStep('email'); setErrorMsg(''); }}>
            <Text style={styles.forgotLinkText}>Forgot password?</Text>
          </Pressable>
        ) : forgotStep === 'email' ? (
          <View style={styles.forgotBox}>
            <Text style={styles.forgotBoxTitle}>Reset Password</Text>
            <Text style={styles.forgotBoxSub}>We'll send a verification code to your email.</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={forgotEmail}
              onChangeText={setForgotEmail}
            />
            <Pressable
              style={[styles.btn, forgotLoading && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={forgotLoading}
            >
              <Text style={styles.btnText}>{forgotLoading ? 'SENDING…' : 'SEND CODE'}</Text>
            </Pressable>
            <Pressable style={styles.forgotLink} onPress={resetForgot}>
              <Text style={styles.forgotBackText}>Back to sign in</Text>
            </Pressable>
          </View>
        ) : forgotStep === 'code' ? (
          <View style={styles.forgotBox}>
            <Text style={styles.forgotBoxTitle}>Enter Code</Text>
            <Text style={styles.forgotBoxSub}>Check your email for a 6-digit code.</Text>
            <TextInput
              style={[styles.input, { letterSpacing: 6, textAlign: 'center', fontSize: 22 }]}
              placeholder="000000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={setOtpCode}
              autoFocus
            />
            <Pressable
              style={[styles.btn, forgotLoading && styles.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={forgotLoading}
            >
              <Text style={styles.btnText}>{forgotLoading ? 'VERIFYING…' : 'VERIFY CODE'}</Text>
            </Pressable>
            <Pressable style={styles.forgotLink} onPress={() => { setForgotStep('email'); setOtpCode(''); setErrorMsg(''); }}>
              <Text style={styles.forgotBackText}>Resend code</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.forgotBox}>
            <Text style={styles.forgotBoxTitle}>New Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showNewPass}
                value={newPass}
                onChangeText={setNewPass}
                autoFocus
              />
              <Pressable style={styles.eyeBtn} onPress={() => setShowNewPass(v => !v)}>
                <Ionicons name={showNewPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Confirm password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showNewPass}
              value={confirmPass}
              onChangeText={setConfirmPass}
              returnKeyType="done"
              onSubmitEditing={handleSetNewPassword}
            />
            <Pressable
              style={[styles.btn, forgotLoading && styles.btnDisabled]}
              onPress={handleSetNewPassword}
              disabled={forgotLoading}
            >
              <Text style={styles.btnText}>{forgotLoading ? 'SAVING…' : 'SET PASSWORD'}</Text>
            </Pressable>
          </View>
        )}

        {!showForgot && (
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'SIGNING IN…' : 'SIGN IN'}</Text>
        </Pressable>
        )}

        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
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
  error: {
    color: c.danger,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 16,
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
  forgotLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  forgotLinkText: {
    ...Typography.caption,
    color: c.textSecondary,
    textDecorationLine: 'underline',
  },
  forgotBox: {
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    marginBottom: 12,
    gap: 10,
    alignItems: 'stretch',
  },
  forgotBoxTitle: {
    ...Typography.subtitle,
    color: c.textPrimary,
    marginBottom: 2,
  },
  forgotBoxSub: {
    ...Typography.caption,
    color: c.textSecondary,
    marginBottom: 4,
  },
  forgotBackText: {
    ...Typography.caption,
    color: c.textSecondary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  });
}
