import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useClients, ClientWithPackage } from '@/hooks/useClients';
import { sendPushNotification } from '@/lib/pushNotifications';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const NO_SHOW_ORANGE = '#FFA500';

function getDateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

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
            ? { backgroundColor: NO_SHOW_ORANGE + '20', borderColor: NO_SHOW_ORANGE }
            : { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[s.avatarText, selected && { color: NO_SHOW_ORANGE }]}>
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
      {selected && <Ionicons name="checkmark-circle" size={22} color={NO_SHOW_ORANGE} />}
    </Pressable>
  );
}

export function NoShowModal({
  visible,
  onClose,
  onLogged,
}: {
  visible: boolean;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const { profile } = useAuth();
  const { clients, loading: clientsLoading } = useClients();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState<0 | -1>(0);
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
    setDayOffset(0);
    onClose();
  };

  const handleLog = async () => {
    if (!selectedClientId || !selectedClient || !profile?.id) {
      Alert.alert('Select a client', 'Please choose a client before logging.');
      return;
    }

    const pkg = selectedClient.activePackage;
    if (!pkg || pkg.sessions_remaining <= 0) {
      Alert.alert('No sessions left', 'This client has no sessions remaining.');
      return;
    }

    Alert.alert(
      'Log No-Show?',
      `This will deduct 1 session from ${selectedClient.name}'s package (${pkg.sessions_remaining} → ${pkg.sessions_remaining - 1} remaining).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log No-Show',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase.from('workout_sessions').insert({
                coach_id: profile.id,
                client_id: selectedClientId,
                package_id: pkg.id,
                session_date: getDateOffset(dayOffset),
                duration_minutes: 1,
                exercises: [],
                notes: 'No-show',
                status: 'absent',
                session_type: 'gym',
              });

              if (error) {
                Alert.alert('Error', error.message);
                return;
              }

              const sessionsLeft = pkg.sessions_remaining - 1;
              await sendPushNotification(selectedClientId, {
                title: '⚠️ No-Show Recorded',
                body: sessionsLeft > 0
                  ? `A session was deducted from your package. ${sessionsLeft} session${sessionsLeft !== 1 ? 's' : ''} remaining.`
                  : 'A session was deducted — your package is now empty. Please renew soon.',
              });

              onLogged?.();
              handleClose();
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const dateDisplay = getDateOffset(dayOffset);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={s.root}>
        <View style={s.header}>
          <Pressable onPress={handleClose} hitSlop={12} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={s.headerCenter}>
            <Ionicons name="person-remove-outline" size={16} color={NO_SHOW_ORANGE} />
            <Text style={s.headerTitle}>LOG NO-SHOW</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.warningBanner}>
          <Ionicons name="information-circle-outline" size={16} color={NO_SHOW_ORANGE} />
          <Text style={s.warningText}>
            1 session will be deducted from the client's package.
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.label}>SELECT CLIENT</Text>
          {clientsLoading ? (
            <ActivityIndicator color={NO_SHOW_ORANGE} style={{ marginVertical: 20 }} />
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

          <Text style={[s.label, { marginTop: 24 }]}>DATE</Text>
          <View style={s.dateRow}>
            {([0, -1] as const).map((offset) => (
              <Pressable
                key={offset}
                style={[s.dateChip, dayOffset === offset && s.dateChipActive]}
                onPress={() => setDayOffset(offset)}
              >
                <Text style={[s.dateChipLabel, dayOffset === offset && s.dateChipLabelActive]}>
                  {offset === 0 ? 'Today' : 'Yesterday'}
                </Text>
                <Text style={[s.dateChipSub, dayOffset === offset && s.dateChipSubActive]}>
                  {getDateOffset(offset)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={s.footer}>
          {selectedClient && (
            <View style={s.summaryRow}>
              <Text style={s.summaryText}>
                {selectedClient.name}  ·  {dayOffset === 0 ? 'Today' : 'Yesterday'}  ({dateDisplay})
              </Text>
              <Text style={s.summaryBadge}>
                {selectedClient.activePackage!.sessions_remaining - 1} left after
              </Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [
              s.logBtn,
              (!selectedClientId || loading) && s.logBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleLog}
            disabled={!selectedClientId || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="person-remove-outline" size={18} color="#fff" />
                <Text style={s.logBtnText}>LOG NO-SHOW</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

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
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTitle: { ...Typography.label, color: c.textPrimary, fontSize: 14 },

    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: NO_SHOW_ORANGE + '12',
      borderBottomWidth: 1,
      borderBottomColor: NO_SHOW_ORANGE + '30',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    warningText: { ...Typography.caption, color: NO_SHOW_ORANGE, flex: 1 },

    scrollContent: { padding: 20, paddingBottom: 16 },

    label: { ...Typography.label, color: c.textSecondary, marginBottom: 10 },

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
    clientRowSelected: { borderColor: NO_SHOW_ORANGE, backgroundColor: NO_SHOW_ORANGE + '08' },
    clientRowDisabled: { opacity: 0.45 },
    avatar: {
      width: 42, height: 42, borderRadius: 21,
      borderWidth: 1.5, justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '800', color: c.textSecondary },
    clientInfo: { flex: 1 },
    clientName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    clientSub: { ...Typography.caption, color: c.textSecondary },

    emptyClients: {
      alignItems: 'center', paddingVertical: 28, gap: 8,
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
    },
    emptyText: { ...Typography.body, color: c.textSecondary },

    dateRow: { flexDirection: 'row', gap: 10 },
    dateChip: {
      flex: 1, alignItems: 'center', paddingVertical: 14,
      borderRadius: 14, borderWidth: 1.5, borderColor: c.border,
      backgroundColor: c.surface,
    },
    dateChipActive: { backgroundColor: NO_SHOW_ORANGE + '12', borderColor: NO_SHOW_ORANGE },
    dateChipLabel: { color: c.textSecondary, fontWeight: '700', fontSize: 14 },
    dateChipLabelActive: { color: NO_SHOW_ORANGE },
    dateChipSub: { color: c.textSecondary, fontSize: 11, marginTop: 3 },
    dateChipSubActive: { color: NO_SHOW_ORANGE + 'CC' },

    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 10,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    summaryText: { ...Typography.caption, color: c.textSecondary, flex: 1 },
    summaryBadge: { ...Typography.caption, color: NO_SHOW_ORANGE, fontWeight: '700' },

    logBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: NO_SHOW_ORANGE, borderRadius: 14, paddingVertical: 16,
    },
    logBtnDisabled: { opacity: 0.45 },
    logBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  });
}
