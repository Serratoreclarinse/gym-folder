import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

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
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  // Coach selection
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [coachSearch, setCoachSearch] = useState('');

  // Client fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [phone, setPhone] = useState('');

  // Package fields
  const [pkgType, setPkgType] = useState<PackageType>('1hr');
  const [totalSessions, setTotalSessions] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<{ clientName: string; email: string; password?: string } | null>(null);

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
      // Save referral info if provided
      if (referredBy.trim()) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email.trim().toLowerCase())
          .single();
        if (prof?.id) {
          await supabase.from('profiles').update({ referred_by: referredBy.trim() }).eq('id', prof.id);
        }
      }
      setSuccessData({
        clientName: name.trim(),
        email: email.trim().toLowerCase(),
        password: data.temp_password ?? undefined,
      });
      setName(''); setEmail(''); setPhone('');
      setTotalSessions(''); setDurationWeeks(''); setReferredBy('');
      setSelectedCoachId(''); setEmailTouched(false);
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

        {/* Coach selection */}
        <Text style={s.sectionTitle}>ASSIGN TO COACH <Text style={{ color: colors.accent }}>*</Text></Text>
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
          <>
          <View style={s.coachSearchWrap}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={s.coachSearchInput}
              value={coachSearch}
              onChangeText={setCoachSearch}
              placeholder="Search coach…"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
          <View style={s.coachList}>
            {coaches.filter((c) =>
              c.name.toLowerCase().includes(coachSearch.toLowerCase()) ||
              c.email.toLowerCase().includes(coachSearch.toLowerCase())
            ).map((c) => {
              const selected = selectedCoachId === c.id;
              return (
                <Pressable
                  key={c.id}
                  style={[s.coachRow, selected && s.coachRowSelected]}
                  onPress={() => setSelectedCoachId(c.id)}
                >
                  <View style={[s.coachAvatar, selected && s.coachAvatarSelected]}>
                    <Text style={[s.coachAvatarText, selected && { color: colors.accent }]}>
                      {initials(c.name)}
                    </Text>
                  </View>
                  <View style={s.coachInfo}>
                    <Text style={[s.coachName, selected && { color: colors.textPrimary }]}>{c.name}</Text>
                    <Text style={s.coachEmail}>{c.email}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
          </>
        )}

        {/* Client info */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>CLIENT INFO</Text>

        <Field label="Full Name" value={name} onChange={setName} placeholder="Jane Smith" required colors={colors} s={s} />
        <Field
          label="Email"
          value={email}
          onChange={(v) => { setEmail(v); if (!emailTouched && v.includes('@')) setEmailTouched(true); }}
          placeholder="jane@example.com"
          keyboard="email-address"
          required
          error={emailError}
          colors={colors}
          s={s}
        />
        <Field label="Phone" value={phone} onChange={setPhone} placeholder="+968 1234 5678" keyboard="phone-pad" colors={colors} s={s} />
        <Field label="Referred By (optional)" value={referredBy} onChange={setReferredBy} placeholder="Name of person who referred this client" colors={colors} s={s} />

        {/* Package */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>PACKAGE</Text>

        <Text style={s.fieldLabel}>Session Duration <Text style={{ color: colors.accent }}>*</Text></Text>
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
          colors={colors}
          s={s}
        />
        <Field
          label="Duration (weeks) — optional"
          value={durationWeeks}
          onChange={(v) => setDurationWeeks(v.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 6"
          keyboard="number-pad"
          colors={colors}
          s={s}
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
      {/* ── Success Modal ── */}
      <Modal visible={!!successData} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalIcon}>✅</Text>
            <Text style={s.modalTitle}>Client Added!</Text>
            <Text style={s.modalSub}>
              <Text style={s.modalBold}>{successData?.clientName}</Text> has been created and assigned.
            </Text>

            <View style={s.credBox}>
              <Text style={s.credLabel}>EMAIL</Text>
              <Text style={s.credValue}>{successData?.email}</Text>
              {successData?.password ? (
                <>
                  <Text style={[s.credLabel, { marginTop: 12 }]}>TEMP PASSWORD</Text>
                  <Text style={[s.credValue, { color: colors.accent, fontSize: 18, letterSpacing: 2 }]}>
                    {successData.password}
                  </Text>
                  <Text style={s.credHint}>Share these credentials with the client. They can change their password after logging in.</Text>
                </>
              ) : (
                <Text style={s.credHint}>Package added to existing account.</Text>
              )}
            </View>

            <Pressable style={s.modalBtn} onPress={() => {
              setSuccessData(null);
              router.replace('/(admin)/(tabs)/clients');
            }}>
              <Text style={s.modalBtnText}>GO TO CLIENTS</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, required, error, colors, s,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; required?: boolean; error?: string;
  colors: any; s: any;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>
        {label}
        {required && <Text style={{ color: colors.accent }}> *</Text>}
      </Text>
      <TextInput
        style={[s.input, !!error && s.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
      />
      {!!error && <Text style={s.fieldError}>{error}</Text>}
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    kav: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 60 },
    contentDesktop: { padding: 40, paddingTop: 32, alignItems: 'center' },
    form: {},
    formDesktop: { width: '100%', maxWidth: 560 },
    sectionTitle: { ...Typography.label, color: c.textSecondary, marginBottom: 12 },

    loadingRow: { paddingVertical: 16, alignItems: 'center' },
    loadingText: { ...Typography.body, color: c.textSecondary },
    noCoaches: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: '#FFA50010', borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: '#FFA50040', marginBottom: 8,
    },
    noCoachesText: { ...Typography.body, color: '#FFA500', flex: 1 },

    coachSearchWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
    },
    coachSearchInput: { flex: 1, color: c.textPrimary, fontSize: 14 },
    coachList: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden',
      marginBottom: 4,
    },
    coachRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 12, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    coachRowSelected: { backgroundColor: c.accent + '10' },
    coachAvatar: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.border, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    coachAvatarSelected: { backgroundColor: c.accent + '20', borderWidth: 1.5, borderColor: c.accent + '60' },
    coachAvatarText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
    coachInfo: { flex: 1 },
    coachName:  { ...Typography.body, color: c.textSecondary, fontWeight: '600' },
    coachEmail: { ...Typography.caption, color: c.textSecondary },

    field: { marginBottom: 16 },
    fieldLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 8 },
    input: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
      color: c.textPrimary, fontSize: 15,
    },
    inputError: { borderColor: c.accent },
    fieldError: { ...Typography.caption, color: c.accent, marginTop: 5 },

    segmented: {
      flexDirection: 'row', backgroundColor: c.surface,
      borderRadius: 12, borderWidth: 1, borderColor: c.border,
      padding: 4, marginBottom: 16, gap: 4,
    },
    segment: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    segmentTextActive: { color: c.bg },

    submitBtn: {
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8,
    },
    submitDisabled: { opacity: 0.4 },
    submitText: { color: c.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
    errorBanner: { backgroundColor: '#3a1a1a', borderRadius: 10, padding: 12, color: c.accent, marginBottom: 16, fontSize: 14 },

    // Success modal
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    modalCard: {
      backgroundColor: c.surface, borderRadius: 20,
      borderWidth: 1, borderColor: c.border,
      padding: 28, width: '100%', maxWidth: 420, alignItems: 'center',
    },
    modalIcon: { fontSize: 40, marginBottom: 12 },
    modalTitle: { ...Typography.heading, color: c.textPrimary, marginBottom: 6, textAlign: 'center' },
    modalSub: { ...Typography.body, color: c.textSecondary, marginBottom: 20, textAlign: 'center' },
    modalBold: { fontWeight: '700', color: c.textPrimary },
    credBox: {
      width: '100%', backgroundColor: c.bg, borderRadius: 12,
      borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 24,
    },
    credLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 4 },
    credValue: { ...Typography.body, color: c.textPrimary, fontWeight: '700', fontSize: 15 },
    credHint: { ...Typography.caption, color: c.textSecondary, marginTop: 10, lineHeight: 18 },
    modalBtn: {
      backgroundColor: c.accent, borderRadius: 12,
      paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%',
    },
    modalBtnText: { color: c.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
  });
}
