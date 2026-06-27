import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

type PackageType = '30min' | '45min' | '1hr';
const PACKAGE_OPTIONS: { value: PackageType; label: string }[] = [
  { value: '30min', label: '30 Minutes' },
  { value: '45min', label: '45 Minutes' },
  { value: '1hr', label: '1 Hour' },
];

function Field({
  label, value, onChangeText, placeholder, keyboardType, required,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={{ color: Colors.accent }}> *</Text> : ''}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
      />
    </View>
  );
}

export default function AddClientScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [packageType, setPackageType] = useState<PackageType>('1hr');
  const [totalSessions, setTotalSessions] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = name.trim() && email.trim() && totalSessions.trim() && Number(totalSessions) > 0;

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('Missing fields', 'Please fill in name, email, and number of sessions.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-client', {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          package_type: packageType,
          total_sessions: Number(totalSessions),
        },
      });

      if (error || data?.error) {
        Alert.alert('Error', data?.error ?? error?.message ?? 'Something went wrong');
        return;
      }

      Alert.alert(
        'Client added!',
        `${name} has been added. They'll receive an email to set their password.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Client info section */}
        <Text style={styles.sectionTitle}>CLIENT INFO</Text>
        <Field label="Full Name" value={name} onChangeText={setName} placeholder="Jane Smith" required />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="jane@example.com" keyboardType="email-address" required />
        <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+1 555 000 0000" keyboardType="phone-pad" />

        {/* Package section */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>PACKAGE</Text>

        <Text style={styles.label}>Session Duration <Text style={{ color: Colors.accent }}>*</Text></Text>
        <View style={styles.segmented}>
          {PACKAGE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.segment, packageType === opt.value && styles.segmentActive]}
              onPress={() => setPackageType(opt.value)}
            >
              <Text style={[styles.segmentText, packageType === opt.value && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Total Sessions Purchased <Text style={{ color: Colors.accent }}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={totalSessions}
            onChangeText={(v) => setTotalSessions(v.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 10"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>The number of sessions the client purchased in this package</Text>
        </View>

        {/* Summary preview */}
        {isValid && (
          <View style={styles.preview}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
            <Text style={styles.previewText}>
              {name} · {PACKAGE_OPTIONS.find(o => o.value === packageType)?.label} · {totalSessions} sessions
            </Text>
          </View>
        )}

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, (!isValid || loading) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || loading}
        >
          <Text style={styles.submitText}>
            {loading ? 'CREATING ACCOUNT…' : 'ADD CLIENT'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  hint: { ...Typography.caption, color: Colors.textSecondary, marginTop: 6 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: Colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: Colors.bg },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent + '12',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  previewText: { ...Typography.body, color: Colors.accent, flex: 1 },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: Colors.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
});
