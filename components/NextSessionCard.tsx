import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NextSession } from '@/hooks/useActiveSession';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

function getDayLabel(scheduledAt: string, textSecondary: string): { label: string; color: string } {
  const sessionDate = new Date(scheduledAt);
  const now = new Date();
  const sessionDay = sessionDate.toDateString();
  const todayDay = now.toDateString();
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrowDay = tomorrowDate.toDateString();

  if (sessionDay === todayDay) return { label: 'TODAY', color: '#FF9800' };
  if (sessionDay === tomorrowDay) return { label: 'TOMORROW', color: '#4CAF50' };
  return {
    label: sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    color: textSecondary,
  };
}

function timeUntilLabel(scheduledAt: string): string {
  const msUntil = new Date(scheduledAt).getTime() - Date.now();
  const totalMins = Math.max(0, Math.floor(msUntil / 60000));
  if (totalMins < 1) return 'Starting now';
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `Starts in ${totalMins} min${totalMins !== 1 ? 's' : ''}`;
  if (hours < 24) return `Starts in ${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
  return `At ${fmtTime(scheduledAt)}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function NextSessionCard({ nextSession }: { nextSession: NextSession }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const initials = nextSession.client_name
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const { label: dayLabel, color: dayColor } = getDayLabel(nextSession.scheduled_at, colors.textSecondary);
  const isToday = dayLabel === 'TODAY';

  return (
    <Pressable
      style={({ pressed }) => [s.card, isToday && s.cardToday, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/(coach)/client/${nextSession.client_id}` as any)}
    >
      <View style={s.topRow}>
        <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
        <Text style={s.label}>NEXT SESSION</Text>
        <View style={[s.dayBadge, { backgroundColor: dayColor + '20', borderColor: dayColor + '50' }]}>
          <Text style={[s.dayBadgeText, { color: dayColor }]}>{dayLabel}</Text>
        </View>
      </View>

      <View style={s.clientRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.clientName}>{nextSession.client_name}</Text>
          <Text style={s.meta}>
            {fmtTime(nextSession.scheduled_at)} · {timeUntilLabel(nextSession.scheduled_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
      padding: 14, marginBottom: 10,
    },
    cardToday: {
      borderColor: '#FF980050',
      backgroundColor: '#FF980008',
    },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
    label: { ...Typography.label, color: c.textSecondary, flex: 1 },
    dayBadge: {
      borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
    },
    dayBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: c.textSecondary, fontWeight: '800', fontSize: 14 },
    clientName: { ...Typography.subtitle, color: c.textPrimary, marginBottom: 2 },
    meta: { ...Typography.caption, color: c.textSecondary },
  });
}
