import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AddCoachScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<{ coachName: string; email: string; password: string } | null>(null);

  const isEmailValid = EMAIL_RE.test(email.trim());
  const emailError = emailTouched && email.trim() && !isEmailValid
    ? 'Enter a valid email address'
    : '';
  const isValid = name.trim() && email.trim() && isEmailValid;

  const handleSubmit = async () => {
    setEmailTouched(true);
    setErrorMsg('');
    setSuccessData(null);
    if (!name.trim() || !email.trim() || !isEmailValid) {
      setErrorMsg('Please fill in name and a valid email.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-coach', {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
        },
      });
      if (error || data?.error) {
        setErrorMsg(data?.error ?? error?.message ?? 'Something went wrong');
        return;
      }
      setSuccessData({
        coachName: name.trim(),
        email: email.trim().toLowerCase(),
        password: data.temp_password ?? '(see email)',
      });
      setName('');
      setEmail('');
      setPhone('');
      setEmailTouched(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create coach');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.form, isDesktop && s.formDesktop]}>
          <Text style={s.sectionTitle}>COACH INFO</Text>

          {!!errorMsg && <Text style={s.errorBanner}>{errorMsg}</Text>}

          <Field label="Full Name" value={name} onChange={setName} placeholder="John Smith" required />
          <Field
            label="Email"
            value={email}
            onChange={(v) => { setEmail(v); if (!emailTouched && v.includes('@')) setEmailTouched(true); }}
            placeholder="coach@example.com"
            keyboard="email-address"
            required
            error={emailError}
          />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="+968 1234 5678" keyboard="phone-pad" />

          <View style={s.note}>
            <Text style={s.noteText}>
              A temporary password will be generated. Give it to the coach so they can log in and change it from their profile.
            </Text>
          </View>

          <Pressable
            style={[s.submitBtn, (!isValid || loading) && s.submitDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || loading}
          >
            <Text style={s.submitText}>{loading ? 'CREATING…' : 'ADD COACH'}</Text>
          </Pressable>
        </View>
      </ScrollView>
      {/* Success modal */}
      <Modal visible={!!successData} transparent animationType="fade" onRequestClose={() => setSuccessData(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIcon}>
              <Ionicons name="checkmark-circle" size={36} color="#4CAF50" />
            </View>
            <Text style={s.modalTitle}>Coach Added!</Text>
            <Text style={s.modalSub}>{successData?.coachName} is now in the system.</Text>
            <View style={s.credBox}>
              <Text style={s.credLabel}>EMAIL</Text>
              <Text style={s.credValue}>{successData?.email}</Text>
              <Text style={s.credLabel}>TEMP PASSWORD</Text>
              <Text style={[s.credValue, s.modalBold]}>{successData?.password}</Text>
            </View>
            <Text style={s.credHint}>Give these credentials to the coach. They can change their password from their profile.</Text>
            <Pressable style={s.modalBtn} onPress={() => { setSuccessData(null); router.replace('/(admin)/(tabs)/coaches' as any); }}>
              <Text style={s.modalBtnText}>GO TO COACHES</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, required, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; required?: boolean; error?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required && <Text style={{ color: Colors.accent }}> *</Text>}
      </Text>
      <TextInput
        style={[s.input, !!error && s.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
      />
      {!!error && <Text style={s.fieldError}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  contentDesktop: { padding: 40, paddingTop: 32, alignItems: 'center' },
  form: {},
  formDesktop: { width: '100%', maxWidth: 560 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: Colors.textPrimary, fontSize: 15,
  },
  inputError: { borderColor: Colors.accent },
  fieldError: { ...Typography.caption, color: Colors.accent, marginTop: 5 },
  note: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 24,
  },
  noteText: { ...Typography.body, color: Colors.textSecondary, lineHeight: 20 },
  submitBtn: {
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: Colors.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
  errorBanner: { backgroundColor: '#3a1a1a', borderRadius: 10, padding: 12, color: Colors.accent, marginBottom: 16, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  modalIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#4CAF5018', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  modalSub: { ...Typography.body, color: Colors.textSecondary, marginBottom: 20, textAlign: 'center' },
  modalBold: { fontWeight: '800', color: Colors.accent, fontSize: 16 },
  credBox: { width: '100%', backgroundColor: Colors.bg, borderRadius: 12, padding: 16, gap: 4, marginBottom: 12 },
  credLabel: { ...Typography.label, color: Colors.textSecondary, marginTop: 8 },
  credValue: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  credHint: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  modalBtn: { backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%' },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
