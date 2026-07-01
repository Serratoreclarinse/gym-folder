import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AddCoachScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const isEmailValid = EMAIL_RE.test(email.trim());
  const emailError = emailTouched && email.trim() && !isEmailValid
    ? 'Enter a valid email address'
    : '';
  const isValid = name.trim() && email.trim() && isEmailValid;

  const handleSubmit = async () => {
    setEmailTouched(true);
    if (!name.trim() || !email.trim() || !isEmailValid) {
      Alert.alert('Missing fields', 'Please fill in name and a valid email.');
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
        Alert.alert('Error', data?.error ?? error?.message ?? 'Something went wrong');
        return;
      }
      Alert.alert(
        'Coach added!',
        `${name.trim()} has been added as a coach. They'll receive an email to set their password.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create coach');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.sectionTitle}>COACH INFO</Text>

        <Field
          label="Full Name"
          value={name}
          onChange={setName}
          placeholder="John Smith"
          required
        />
        <Field
          label="Email"
          value={email}
          onChange={(v) => { setEmail(v); if (!emailTouched && v.includes('@')) setEmailTouched(true); }}
          placeholder="coach@example.com"
          keyboard="email-address"
          required
          error={emailError}
        />
        <Field
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="+968 1234 5678"
          keyboard="phone-pad"
        />

        <View style={s.note}>
          <Text style={s.noteText}>
            The coach will receive a password-setup email at the address above. They can log in once they set their password.
          </Text>
        </View>

        <Pressable
          style={[s.submitBtn, (!isValid || loading) && s.submitDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || loading}
        >
          <Text style={s.submitText}>{loading ? 'CREATING…' : 'ADD COACH'}</Text>
        </Pressable>
      </ScrollView>
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
});
