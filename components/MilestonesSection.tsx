import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMilestones } from '@/hooks/useMilestones';
import { useTheme } from '@/context/ThemeContext';
import { ColorScheme, Typography } from '@/constants/theme';

const GROUPS: { key: 'sessions' | 'membership' | 'achievements'; label: string }[] = [
  { key: 'sessions',     label: 'Sessions'     },
  { key: 'membership',   label: 'Membership'   },
  { key: 'achievements', label: 'Achievements' },
];

export function MilestonesSection({
  clientId,
  createdAt,
}: {
  clientId: string;
  createdAt?: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { milestones, loading, earnedCount } = useMilestones(clientId, createdAt);

  if (loading) {
    return (
      <View style={s.loadWrap}>
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }

  const total = milestones.length;

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>MILESTONES</Text>
        <View style={s.countPill}>
          <Text style={s.countText}>{earnedCount} / {total}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${(earnedCount / total) * 100}%` as any }]} />
      </View>

      {/* Badge groups */}
      {GROUPS.map((g) => {
        const badges = milestones.filter((m) => m.group === g.key);
        return (
          <View key={g.key} style={s.group}>
            <Text style={s.groupLabel}>{g.label.toUpperCase()}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.badgeRow}
            >
              {badges.map((b) => (
                <View key={b.id} style={[s.badge, !b.earned && s.badgeLocked]}>
                  <Text style={[s.badgeEmoji, !b.earned && s.badgeEmojiLocked]}>
                    {b.earned ? b.emoji : '🔒'}
                  </Text>
                  <Text style={[s.badgeName, !b.earned && s.badgeNameLocked]} numberOfLines={2}>
                    {b.name}
                  </Text>
                  <Text style={s.badgeDesc} numberOfLines={2}>
                    {b.description}
                  </Text>
                  {b.earned && (
                    <View style={s.earnedDot} />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    loadWrap: { padding: 20, alignItems: 'center' },

    wrap: { paddingBottom: 8 },

    header: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 10,
    },
    headerTitle: {
      ...Typography.label, color: c.textSecondary, fontSize: 11, letterSpacing: 1,
    },
    countPill: {
      backgroundColor: c.accent + '20', borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 3,
      borderWidth: 1, borderColor: c.accent + '40',
    },
    countText: { color: c.accent, fontSize: 11, fontWeight: '800' },

    progressTrack: {
      height: 4, backgroundColor: c.border,
      borderRadius: 2, marginBottom: 16, overflow: 'hidden',
    },
    progressFill: {
      height: 4, backgroundColor: c.accent, borderRadius: 2,
    },

    group: { marginBottom: 16 },
    groupLabel: {
      ...Typography.label, color: c.textSecondary,
      fontSize: 9, letterSpacing: 1.2, marginBottom: 8, marginLeft: 2,
    },
    badgeRow: { gap: 8, paddingRight: 4 },

    badge: {
      width: 88, backgroundColor: c.surface,
      borderRadius: 14, padding: 10,
      borderWidth: 1, borderColor: c.accent + '50',
      alignItems: 'center', gap: 4,
      position: 'relative',
    },
    badgeLocked: {
      borderColor: c.border, backgroundColor: c.bg,
      opacity: 0.5,
    },
    badgeEmoji: { fontSize: 28 },
    badgeEmojiLocked: { opacity: 0.4 },
    badgeName: {
      ...Typography.caption, color: c.textPrimary,
      fontWeight: '700', textAlign: 'center', fontSize: 10,
    },
    badgeNameLocked: { color: c.textSecondary },
    badgeDesc: {
      ...Typography.caption, color: c.textSecondary,
      fontSize: 9, textAlign: 'center', lineHeight: 13,
    },
    earnedDot: {
      position: 'absolute', top: 6, right: 6,
      width: 7, height: 7, borderRadius: 4,
      backgroundColor: c.accent,
    },
  });
}
