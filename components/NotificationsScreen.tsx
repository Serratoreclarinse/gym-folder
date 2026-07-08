import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useNotifications, type AppNotification } from '@/context/NotificationsContext';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/theme';
import type { ColorScheme } from '@/constants/theme';

// ─── Icon mapping based on title keywords ─────────────────────────────────────

function iconForTitle(title: string): { name: string; color: string } {
  const t = title.toLowerCase();
  if (t.includes('session') || t.includes('📅') || t.includes('schedule'))
    return { name: 'calendar-outline', color: '#4CAF50' };
  if (t.includes('payment') || t.includes('💳') || t.includes('invoice'))
    return { name: 'card-outline', color: '#FF9800' };
  if (t.includes('cancel') || t.includes('no-show') || t.includes('⚠️'))
    return { name: 'warning-outline', color: '#F44336' };
  if (t.includes('message') || t.includes('💬') || t.includes('chat'))
    return { name: 'chatbubble-outline', color: '#2196F3' };
  if (t.includes('pr') || t.includes('🏆') || t.includes('milestone') || t.includes('record'))
    return { name: 'trophy-outline', color: '#FFC107' };
  if (t.includes('check') || t.includes('✅') || t.includes('confirmed'))
    return { name: 'checkmark-circle-outline', color: '#4CAF50' };
  if (t.includes('transfer'))
    return { name: 'swap-horizontal-outline', color: '#9C27B0' };
  if (t.includes('package') || t.includes('session') || t.includes('remaining'))
    return { name: 'cube-outline', color: '#FF5722' };
  if (t.includes('reschedule'))
    return { name: 'refresh-outline', color: '#00BCD4' };
  if (t.includes('announcement') || t.includes('📢'))
    return { name: 'megaphone-outline', color: '#E91E63' };
  return { name: 'notifications-outline', color: '#888' };
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function dayLabel(isoString: string): string {
  const d = new Date(isoString);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  // Group by day label
  const grouped = useMemo(() => {
    const groups: { label: string; data: AppNotification[] }[] = [];
    let currentLabel = '';
    for (const n of notifications) {
      const label = dayLabel(n.created_at);
      if (label !== currentLabel) {
        groups.push({ label, data: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].data.push(n);
    }
    return groups;
  }, [notifications]);

  // Flat list items: day headers + notification rows
  const items = useMemo(() => {
    const result: ({ type: 'header'; label: string } | { type: 'row'; item: AppNotification })[] = [];
    for (const group of grouped) {
      result.push({ type: 'header', label: group.label });
      for (const n of group.data) result.push({ type: 'row', item: n });
    }
    return result;
  }, [grouped]);

  return (
    <View style={s.root}>
      {/* Header bar */}
      <View style={s.topBar}>
        <View>
          <Text style={s.topTitle}>NOTIFICATIONS</Text>
          {unreadCount > 0 && (
            <Text style={s.topSub}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable style={s.markAllBtn} onPress={markAllRead}>
            <Ionicons name="checkmark-done-outline" size={14} color={colors.accent} />
            <Text style={s.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <Text style={s.emptyText}>Loading…</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.border} />
          <Text style={s.emptyTitle}>No notifications yet</Text>
          <Text style={s.emptyText}>You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) =>
            item.type === 'header' ? `h-${item.label}` : item.item.id
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={s.dayLabel}>{item.label}</Text>;
            }
            const { name: iconName, color: iconColor } = iconForTitle(item.item.title);
            return (
              <Pressable
                style={[s.row, !item.item.read && s.rowUnread]}
                onPress={() => markRead(item.item.id)}
              >
                <View style={[s.iconWrap, { backgroundColor: iconColor + '18' }]}>
                  <Ionicons name={iconName as any} size={20} color={iconColor} />
                </View>
                <View style={s.rowContent}>
                  <View style={s.rowTop}>
                    <Text style={[s.rowTitle, !item.item.read && s.rowTitleUnread]} numberOfLines={1}>
                      {item.item.title}
                    </Text>
                    <Text style={s.rowTime}>{relativeTime(item.item.created_at)}</Text>
                  </View>
                  <Text style={s.rowBody} numberOfLines={2}>{item.item.body}</Text>
                </View>
                {!item.item.read && <View style={s.unreadDot} />}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    topTitle: { ...Typography.label, color: c.textSecondary, fontSize: 11, letterSpacing: 1.5 },
    topSub: { ...Typography.caption, color: c.accent, fontWeight: '700', marginTop: 2 },
    markAllBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: c.accent + '50', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: c.accent + '10',
    },
    markAllText: { ...Typography.caption, color: c.accent, fontWeight: '700' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, fontWeight: '700', marginTop: 8 },
    emptyText: { ...Typography.body, color: c.textSecondary },

    dayLabel: {
      ...Typography.label, color: c.textSecondary,
      fontSize: 11, letterSpacing: 1,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    },

    row: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: c.border + '50',
    },
    rowUnread: { backgroundColor: c.accent + '08' },
    iconWrap: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    rowContent: { flex: 1 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    rowTitle: { ...Typography.body, color: c.textSecondary, flex: 1 },
    rowTitleUnread: { color: c.textPrimary, fontWeight: '700' },
    rowTime: { ...Typography.caption, color: c.textSecondary, flexShrink: 0 },
    rowBody: { ...Typography.caption, color: c.textSecondary, marginTop: 3, lineHeight: 17 },
    unreadDot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: c.accent, alignSelf: 'center', flexShrink: 0,
    },
  });
}
