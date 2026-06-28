import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NextSession } from '@/hooks/useActiveSession';
import { Colors, Typography } from '@/constants/theme';

function timeUntilLabel(scheduledAt: string): string {
  const msUntil = new Date(scheduledAt).getTime() - Date.now();
  const totalMins = Math.max(0, Math.floor(msUntil / 60000));
  if (totalMins < 1) return 'Starting now';
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `Starts in ${totalMins} min${totalMins !== 1 ? 's' : ''}`;
  return `Starts in ${hours}h ${mins}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function NextSessionCard({ nextSession }: { nextSession: NextSession }) {
  const initials = nextSession.client_name
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/(coach)/client/${nextSession.client_id}` as any)}
    >
      <View style={s.topRow}>
        <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
        <Text style={s.label}>NEXT SESSION</Text>
        <Text style={s.timeUntil}>{timeUntilLabel(nextSession.scheduled_at)}</Text>
      </View>

      <View style={s.clientRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.clientName}>{nextSession.client_name}</Text>
          <Text style={s.meta}>{fmtTime(nextSession.scheduled_at)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  label: { ...Typography.label, color: Colors.textSecondary, flex: 1 },
  timeUntil: { fontSize: 12, fontWeight: '700', color: '#4CAF50' },

  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textSecondary, fontWeight: '800', fontSize: 14 },
  clientName: { ...Typography.subtitle, color: Colors.textPrimary, marginBottom: 2 },
  meta: { ...Typography.caption, color: Colors.textSecondary },
});
