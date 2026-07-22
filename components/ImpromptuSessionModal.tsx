import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { useAuth } from '@/context/AuthContext';
import { useClients, ClientWithPackage } from '@/hooks/useClients';
import { useActiveSessionContext } from '@/context/ActiveSessionContext';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const DURATIONS = [30, 45, 60, 90] as const;
const SESSION_TYPES = ['gym', 'home'] as const;

// ── Client row ────────────────────────────────────────────────────────────────

function ClientRow({
  client,
  selected,
  onSelect,
}: {
  client: ClientWithPackage;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const initials = client.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const hasSession =
    client.activePackage &&
    client.activePackage.status === 'active' &&
    client.activePackage.sessions_remaining > 0;

  return (
    <Pressable
      style={({ pressed }) => [
        s.clientRow,
        selected && s.clientRowSelected,
        pressed && { opacity: 0.7 },
        !hasSession && s.clientRowDisabled,
      ]}
      onPress={hasSession ? onSelect : undefined}
    >
      <View
        style={[
          s.avatar,
          selected
            ? { backgroundColor: colors.accent + '20', borderColor: colors.accent }
            : { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[s.avatarText, selected && { color: colors.accent }]}>
          {initials}
        </Text>
      </View>
      <View style={s.clientInfo}>
        <Text style={[s.clientName, !hasSession && { color: colors.textSecondary }]}>
          {client.name}
        </Text>
        <Text style={s.clientSub}>
          {hasSession
            ? `${client.activePackage!.sessions_remaining} session${client.activePackage!.sessions_remaining !== 1 ? 's' : ''} left`
            : 'No active package'}
        </Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
    </Pressable>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function ImpromptuSessionModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { profile } = useAuth();
  const { clients, loading: clientsLoading } = useClients();
  const { refetch: refetchSession } = useActiveSessionContext();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [duration, setDuration] = useState<30 | 45 | 60 | 90>(60);
  const [sessionType, setSessionType] = useState<'gym' | 'home'>('gym');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const activeClients = clients.filter(
    (c) =>
      c.activePackage &&
      c.activePackage.status === 'active' &&
      c.activePackage.sessions_remaining > 0,
  );

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  const handleClose = () => {
    setSelectedClientId(null);
    setDuration(60);
    setSessionType('gym');
    setNotes('');
    onClose();
  };

  const handleStart = async () => {
    if (!selectedClientId || !selectedClient || !profile?.id) {
      Alert.alert('Select a client', 'Please choose a client before starting.');
      return;
    }

    const pkg = selectedClient.activePackage;
    if (!pkg || pkg.sessions_remaining <= 0) {
      Alert.alert('No sessions left', 'This client has no sessions remaining.');
      return;
    }

    const { data: existing } = await supabase
      .from('active_sessions')
      .select('id')
      .eq('coach_id', profile.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      Alert.alert('Session already active', 'End the current session before starting a new one.');
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: sessionData, error: sessionErr } = await supabase
        .from('workout_sessions')
        .insert({
          coach_id: profile.id,
          client_id: selectedClientId,
          package_id: pkg.id,
          session_date: today,
          duration_minutes: duration,
          session_type: sessionType,
          exercises: [],
          notes: notes.trim() || null,
        })
        .select('id')
        .single();

      if (sessionErr || !sessionData) {
        Alert.alert('Error', sessionErr?.message ?? 'Failed to create session.');
        return;
      }

      const { error: activeErr } = await supabase.from('active_sessions').insert({
        coach_id: profile.id,
        client_id: selectedClientId,
        session_id: sessionData.id,
        start_time: new Date().toISOString(),
        original_duration: duration,
        current_duration: duration,
        is_active: true,
        is_paused: false,
      });

      if (activeErr) {
        Alert.alert('Error', activeErr.message);
        return;
      }

      await refetchSession();
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={handleClose} hitSlop={12} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={s.headerTitle}>QUICK SESSION</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Client picker */}
          <Text style={s.label}>SELECT CLIENT</Text>
          {clientsLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
          ) : activeClients.length === 0 ? (
            <View style={s.emptyClients}>
              <Ionicons name="people-outline" size={32} color={colors.border} />
              <Text style={s.emptyText}>No clients with active packages</Text>
            </View>
          ) : (
            <View style={s.clientList}>
              {activeClients.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  selected={selectedClientId === client.id}
                  onSelect={() => setSelectedClientId(client.id)}
                />
              ))}
            </View>
          )}

          {/* Duration */}
          <Text style={[s.label, { marginTop: 24 }]}>DURATION</Text>
          <View style={s.chipRow}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                style={[s.chip, duration === d && s.chipActive]}
                onPress={() => setDuration(d)}
              >
                <Text style={[s.chipText, duration === d && s.chipTextActive]}>
                  {d} min
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Session type */}
          <Text style={[s.label, { marginTop: 20 }]}>SESSION TYPE</Text>
          <View style={s.chipRow}>
            {SESSION_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[s.chip, sessionType === t && s.chipActive]}
                onPress={() => setSessionType(t)}
              >
                <Text style={[s.chipText, sessionType === t && s.chipTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Notes */}
          <Text style={[s.label, { marginTop: 20 }]}>NOTES (optional)</Text>
          <TextInput
            style={[s.notesInput, { color: colors.textPrimary }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Focus areas, client goals…"
            placeholderTextColor={colors.textSecondary + '70'}
            multiline
            numberOfLines={3}
            returnKeyType="done"
          />
        </ScrollView>

        {/* Start button */}
        <View style={s.footer}>
          <Pressable
            style={({ pressed }) => [
              s.startBtn,
              (!selectedClientId || loading) && s.startBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleStart}
            disabled={!selectedClientId || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <Ionicons name="flash" size={18} color="#fff" />
                <Text style={s.startBtnText}>START SESSION</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Style factory ─────────────────────────────────────────────────────────────

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    closeBtn: { padding: 4, width: 36 },
    headerTitle: { ...Typography.label, color: c.textPrimary, fontSize: 14 },

    scrollContent: { padding: 20, paddingBottom: 16 },

    label: {
      ...Typography.label,
      color: c.textSecondary,
      marginBottom: 10,
    },

    clientList: { gap: 8 },
    clientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    clientRowSelected: {
      borderColor: c.accent,
      backgroundColor: c.accent + '08',
    },
    clientRowDisabled: { opacity: 0.45 },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '800',
      color: c.textSecondary,
    },
    clientInfo: { flex: 1 },
    clientName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    clientSub: { ...Typography.caption, color: c.textSecondary },

    emptyClients: {
      alignItems: 'center',
      paddingVertical: 28,
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyText: { ...Typography.body, color: c.textSecondary },

    chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.textSecondary, fontWeight: '700', fontSize: 13 },
    chipTextActive: { color: '#fff' },

    notesInput: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      minHeight: 80,
      textAlignVertical: 'top',
    },

    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 16,
    },
    startBtnDisabled: { opacity: 0.45 },
    startBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 1,
    },
  });
}
