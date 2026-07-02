import { useCallback, useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type PackageType = '30min' | '45min' | '1hr';
const PKG_OPTIONS: { value: PackageType; label: string }[] = [
  { value: '30min', label: '30 min' },
  { value: '45min', label: '45 min' },
  { value: '1hr',   label: '1 hour' },
];

type CoachOption = { id: string; name: string; email: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminAddClientScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  // Coach selection
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [selectedCoachId, setSelectedCoachId] = useState('');

  // Client fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [phone, setPhone] = useState('');

  // Package fields
  const [pkgType, setPkgType] = useState<PackageType>('1hr');
  const [totalSessions, setTotalSessions] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadCoaches = useCallback(async () => {
    setLoadingCoaches(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'coach')
      .order('name');
    setCoaches(data ?? []);
    setLoadingCoaches(false);
  }, []);

  useEffect(() => { loadCoaches(); }, [loadCoaches]);

  const isEmailValid = EMAIL_RE.test(email.trim());
  const emailError = emailTouched && email.trim() && !isEmailValid ? 'Enter a valid email' : '';
  const isValid =
    selectedCoachId &&
    name.trim() &&
    email.trim() &&
    isEmailValid &&
    totalSessions.trim() &&
    Number(totalSessions) > 0;

  const handleSubmit = async () => {
    setEmailTouched(true);
    setErrorMsg('');
    setSuccessMsg('');
    if (!selectedCoachId) { setErrorMsg('Please choose which coach this client belongs to.'); return; }
    if (!name.trim() || !email.trim() || !isEmailValid || !totalSessions || Number(totalSessions) <= 0) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-client', {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          package_type: pkgType,
          total_sessions: Number(totalSessions),
          coach_id: selectedCoachId,
          ...(durationWeeks && Number(durationWeeks) > 0 ? { duration_weeks: Number(durationWeeks) } : {}),
        },
      });
      if (error || data?.error) {
        setErrorMsg(data?.error ?? error?.message ?? 'Something went wrong');
        return;
      }
      const pwdLine = data.temp_password ? `\n\nEmail: ${email.trim().toLowerCase()}\nTemp Password: ${data.temp_password}\n\nGive these credentials to the client. They can change their password after logging in.` : '\n\nPackage added to existing account.';
      setSuccessMsg(`Client added!${pwdLine}`);
      setName('');
      setEmail('');
      setPhone('');
      setTotalSessions('');
      setDurationWeeks('');
      setSelectedCoachId('');
      setEmailTouched(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create client');
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

        {!!errorMsg && <Text style={s.errorBanner}>{errorMsg}</Text>}
        {!!successMsg && <Text style={s.successBanner}>{successMsg}</Text>}

        {/* Coach selection */}
        <Text style={s.sectionTitle}>ASSIGN TO COACH <Text style={{ color: Colors.accent }}>*</Text></Text>
        {loadingCoaches ? (
          <View style={s.loadingRow}>
            <Text style={s.loadingText}>Loading coaches…</Text>
          </View>
        ) : coaches.length === 0 ? (
          <View style={s.noCoaches}>
            <Ionicons name="warning-outline" size={20} color="#FFA500" />
            <Text style={s.noCoachesText}>No coaches found. Add a coach first.</Text>
          </View>
        ) : (
          <View style={s.coachList}>
            {coaches.map((c) => {
              const selected = selectedCoachId === c.id;
              return (
                <Pressable
                  key={c.id}
                  style={[s.coachRow, selected && s.coachRowSelected]}
                  onPress={() => setSelectedCoachId(c.id)}
                >
                  <View style={[s.coachAvatar, selected && s.coachAvatarSelected]}>
                    <Text style={[s.coachAvatarText, selected && { color: Colors.accent }]}>
                      {initials(c.name)}
                    </Text>
                  </View>
                  <View style={s.coachInfo}>
                    <Text style={[s.coachName, selected && { color: Colors.textPrimary }]}>{c.name}</Text>
                    <Text style={s.coachEmail}>{c.email}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Client info */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>CLIENT INFO</Text>

        <Field label="Full Name" value={name} onChange={setName} placeholder="Jane Smith" required />
        <Field
          label="Email"
          value={email}
          onChange={(v) => { setEmail(v); if (!emailTouched && v.includes('@')) setEmailTouched(true); }}
          placeholder="jane@example.com"
          keyboard="email-address"
          required
          error={emailError}
        />
        <Field label="Phone" value={phone} onChange={setPhone} placeholder="+968 1234 5678" keyboard="phone-pad" />

        {/* Package */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>PACKAGE</Text>

        <Text style={s.fieldLabel}>Session Duration <Text style={{ color: Colors.accent }}>*</Text></Text>
        <View style={s.segmented}>
          {PKG_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[s.segment, pkgType === opt.value && s.segmentActive]}
              onPress={() => setPkgType(opt.value)}
            >
              <Text style={[s.segmentText, pkgType === opt.value && s.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="Total Sessions"
          value={totalSessions}
          onChange={(v) => setTotalSessions(v.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 12"
          keyboard="number-pad"
          required
        />
        <Field
          label="Duration (weeks) — optional"
          value={durationWeeks}
          onChange={(v) => setDurationWeeks(v.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 6"
          keyboard="number-pad"
        />

        <Pressable
          style={[s.submitBtn, (!isValid || loading) && s.submitDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || loading}
        >
          <Text style={s.submitText}>{loading ? 'CREATING…' : 'ADD CLIENT'}</Text>
        </Pressable>
        </View>
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
      <Text style={s.fieldLabel}>
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
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 12 },

  loadingRow: { paddingVertical: 16, alignItems: 'center' },
  loadingText: { ...Typography.body, color: Colors.textSecondary },
  noCoaches: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFA50010', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FFA50040', marginBottom: 8,
  },
  noCoachesText: { ...Typography.body, color: '#FFA500', flex: 1 },

  coachList: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    marginBottom: 4,
  },
  coachRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  coachRowSelected: { backgroundColor: Colors.accent + '10' },
  coachAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  coachAvatarSelected: { backgroundColor: Colors.accent + '20', borderWidth: 1.5, borderColor: Colors.accent + '60' },
  coachAvatarText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  coachInfo: { flex: 1 },
  coachName:  { ...Typography.body, color: Colors.textSecondary, fontWeight: '600' },
  coachEmail: { ...Typography.caption, color: Colors.textSecondary },

  field: { marginBottom: 16 },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: Colors.textPrimary, fontSize: 15,
  },
  inputError: { borderColor: Colors.accent },
  fieldError: { ...Typography.caption, color: Colors.accent, marginTop: 5 },

  segmented: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 4, marginBottom: 16, gap: 4,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: Colors.bg },

  submitBtn: {
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: Colors.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
  errorBanner: { backgroundColor: '#3a1a1a', borderRadius: 10, padding: 12, color: Colors.accent, marginBottom: 16, fontSize: 14 },
  successBanner: { backgroundColor: '#1a3a1a', borderRadius: 10, padding: 12, color: '#4caf50', marginBottom: 16, fontSize: 14 },
});
