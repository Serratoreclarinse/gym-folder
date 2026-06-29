import { useState } from 'react';
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
import { Colors, Typography } from '@/constants/theme';

const DURATIONS = [30, 45, 60, 90] as const;
const SESSION_TYPES = ['gym', 'home'] as const;

// ── Clients list at module scope — avoids TextInput nesting issues ─────────────

function ClientRow({
  client,
  selected,
  onSelect,
}: {
  client: ClientWithPackage;
  selected: boolean;
  onSelect: () => void;
}) {
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
            ? { backgroundColor: Colors.accent + '20', borderColor: Colors.accent }
            : { backgroundColor: Colors.surface, borderColor: Colors.border },
        ]}
      >
        <Text
          style={[s.avatarText, selected && { color: Colors.accent }]}
        >
          {initials}
        </Text>
      </View>
      <View style={s.clientInfo}>
        <Text style={[s.clientName, !hasSession && { color: Colors.textSecondary }]}>
          {client.name}
        </Text>
        <Text style={s.clientSub}>
          {hasSession
            ? `${client.activePackage!.sessions_remaining} session${client.activePackage!.sessions_remaining !== 1 ? 's' : ''} left`
            : 'No active package'}
        </Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
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

    // Check if a session is already running
    const { data: existing } = await supabase
      .from('active_sessions')
      .select('id')
      .eq('coach_id', profile.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      Alert.alert(
        'Session already active',
        'End the current session before starting a new one.',
      );
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
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={s.headerTitle}>IMPROMPTU SESSION</Text>
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
            <ActivityIndicator color={Colors.accent} style={{ marginVertical: 20 }} />
          ) : activeClients.length === 0 ? (
            <View style={s.emptyClients}>
              <Ionicons name="people-outline" size={32} color={Colors.border} />
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
            style={s.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Focus areas, client goals…"
            placeholderTextColor={Colors.textSecondary + '70'}
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
              <ActivityIndicator color={Colors.bg} />
            ) : (
              <>
                <Ionicons name="flash" size={18} color={Colors.bg} />
                <Text style={s.startBtnText}>START SESSION</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: { padding: 4, width: 36 },
  headerTitle: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },

  scrollContent: { padding: 20, paddingBottom: 16 },

  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: 10,
  },

  clientList: { gap: 8 },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  clientRowSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '08',
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
    color: Colors.textSecondary,
  },
  clientInfo: { flex: 1 },
  clientName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  clientSub: { ...Typography.caption, color: Colors.textSecondary },

  emptyClients: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textSecondary },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: Colors.bg },

  notesInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
  },
  startBtnDisabled: { opacity: 0.45 },
  startBtnText: {
    color: Colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
