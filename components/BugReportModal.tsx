import { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/theme';

type Props = { visible: boolean; onClose: () => void };

export function BugReportModal({ visible, onClose }: Props) {
  const { user, profile } = useAuth();
  const { colors } = useTheme();

  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);

  const reset = () => {
    setTitle('');
    setDesc('');
    setDone(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!title.trim() || !desc.trim() || !user?.id) return;
    setSubmitting(true);
    await supabase.from('bug_reports').insert({
      submitted_by: user.id,
      role: profile?.role ?? 'unknown',
      title: title.trim(),
      description: desc.trim(),
      app_version: Constants.expoConfig?.version ?? '1.0.0',
    });
    setSubmitting(false);
    setDone(true);
  };

  const canSubmit = title.trim().length > 0 && desc.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[s.header, { borderBottomColor: colors.border }]}>
            <Ionicons name="bug-outline" size={20} color={colors.danger} />
            <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Report a Bug</Text>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {done ? (
            /* Success state */
            <View style={s.doneBox}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
              <Text style={[s.doneTitle, { color: colors.textPrimary }]}>Report Sent!</Text>
              <Text style={[s.doneSub, { color: colors.textSecondary }]}>
                Your bug report has been submitted. We'll look into it.
              </Text>
              <Pressable style={[s.doneBtn, { backgroundColor: colors.accent }]} onPress={handleClose}>
                <Text style={[s.doneBtnText, { color: colors.bg }]}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
              <Text style={[s.label, { color: colors.textSecondary }]}>TITLE</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Brief summary of the issue"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />

              <Text style={[s.label, { color: colors.textSecondary }]}>DESCRIPTION</Text>
              <TextInput
                style={[s.input, s.inputMulti, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="What happened? What did you expect? Steps to reproduce..."
                placeholderTextColor={colors.textSecondary}
                value={desc}
                onChangeText={setDesc}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={1000}
              />

              <Text style={[s.meta, { color: colors.textSecondary }]}>
                v{Constants.expoConfig?.version ?? '1.0.0'} · {profile?.role ?? ''}
              </Text>

              <Pressable
                style={[s.submitBtn, { backgroundColor: colors.danger }, !canSubmit && { opacity: 0.4 }]}
                onPress={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                <Text style={s.submitText}>{submitting ? 'Sending…' : 'Submit Report'}</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
  },
  body: { padding: 20, gap: 6, paddingBottom: 40 },
  label: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  inputMulti: { minHeight: 120, paddingTop: 12 },
  meta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'right',
  },
  submitBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Done state
  doneBox: { alignItems: 'center', padding: 36, gap: 12 },
  doneTitle: { fontFamily: 'Montserrat_800ExtraBold', fontSize: 20 },
  doneSub: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  doneBtn: { marginTop: 12, paddingVertical: 13, paddingHorizontal: 40, borderRadius: 12 },
  doneBtnText: { fontFamily: 'Montserrat_700Bold', fontSize: 14 },
});
