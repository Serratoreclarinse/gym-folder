import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type ConversationItem = {
  clientId: string;
  clientName: string;
  lastMessage: string | null;
  lastMessageType: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isFromMe: boolean;
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function CoachMessagesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [clientsRes, msgsRes] = await Promise.all([
        // All active clients under this coach
        supabase
          .from('packages')
          .select('client_id, profiles!packages_client_id_fkey(id, name)')
          .eq('coach_id', user.id)
          .eq('status', 'active'),
        // All messages this coach is part of
        supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, attachment_type, created_at, read_at')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: false }),
      ]);

      const clients = (clientsRes.data ?? []).map((row: any) => ({
        id: (row.profiles as any)?.id ?? row.client_id,
        name: (row.profiles as any)?.name ?? 'Unknown',
      }));

      const msgs = msgsRes.data ?? [];

      // Build a map: clientId → { last message info, unread count }
      const msgMap: Record<string, {
        content: string; attachmentType: string | null; at: string; unread: number; fromMe: boolean;
      }> = {};

      for (const msg of msgs) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!msgMap[partnerId]) {
          // First entry per partner = most recent (already ordered desc)
          msgMap[partnerId] = {
            content: msg.content,
            attachmentType: msg.attachment_type ?? null,
            at: msg.created_at,
            unread: 0,
            fromMe: msg.sender_id === user.id,
          };
        }
        // Count unread messages sent TO me
        if (msg.receiver_id === user.id && !msg.read_at) {
          msgMap[partnerId].unread += 1;
        }
      }

      const convos: ConversationItem[] = clients.map((c) => ({
        clientId: c.id,
        clientName: c.name,
        lastMessage: msgMap[c.id]?.content || null,
        lastMessageType: msgMap[c.id]?.attachmentType ?? null,
        lastMessageAt: msgMap[c.id]?.at ?? null,
        unreadCount: msgMap[c.id]?.unread ?? 0,
        isFromMe: msgMap[c.id]?.fromMe ?? false,
      }));

      // Sort: clients with messages first (most recent first), rest alphabetically
      convos.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        }
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return a.clientName.localeCompare(b.clientName);
      });

      setConversations(convos);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Refresh when navigating back from a chat
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Real-time: new message from any client → refresh inbox
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`coach-inbox:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [user?.id, load]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  if (conversations.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
        <Text style={s.emptyTitle}>No active clients</Text>
        <Text style={s.emptyText}>Clients with active packages appear here</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.clientId}
      style={s.root}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
          onPress={() => router.push({
            pathname: '/(coach)/chat',
            params: { clientId: item.clientId, clientName: item.clientName },
          } as any)}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials(item.clientName)}</Text>
          </View>
          <View style={s.rowContent}>
            <View style={s.rowTop}>
              <Text
                style={[s.clientName, item.unreadCount > 0 && s.clientNameUnread]}
                numberOfLines={1}
              >
                {item.clientName}
              </Text>
              {item.lastMessageAt && (
                <Text style={s.time}>{fmtTime(item.lastMessageAt)}</Text>
              )}
            </View>
            <View style={s.rowBottom}>
              <Text
                style={[s.preview, item.unreadCount > 0 && s.previewUnread]}
                numberOfLines={1}
              >
                {(() => {
                  const prefix = item.isFromMe ? 'You: ' : '';
                  if (item.lastMessage) return `${prefix}${item.lastMessage}`;
                  if (item.lastMessageType === 'image') return `${prefix}📷 Photo`;
                  if (item.lastMessageType === 'video') return `${prefix}🎬 Video`;
                  if (item.lastMessageType === 'file')  return `${prefix}📎 File`;
                  return 'Tap to start a conversation';
                })()}
              </Text>
              {item.unreadCount > 0 && (
                <View style={[s.badge, { backgroundColor: colors.accent }]}>
                  <Text style={[s.badgeText, { color: colors.bg }]}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.border} style={{ flexShrink: 0 }} />
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={s.separator} />}
    />
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, fontWeight: '700', marginTop: 8 },
    emptyText: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 20, paddingVertical: 14,
    },
    avatar: {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: c.accent + '18',
      borderWidth: 1, borderColor: c.accent + '40',
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    avatarText: { fontSize: 16, fontWeight: '800', color: c.accent },
    rowContent: { flex: 1, gap: 3 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    clientName: { ...Typography.body, color: c.textPrimary, flex: 1 },
    clientNameUnread: { fontWeight: '700' },
    time: { ...Typography.caption, color: c.textSecondary, flexShrink: 0 },
    rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    preview: { ...Typography.caption, color: c.textSecondary, flex: 1 },
    previewUnread: { color: c.textPrimary, fontWeight: '600' },
    badge: {
      borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
      minWidth: 20, alignItems: 'center', flexShrink: 0,
    },
    badgeText: { fontSize: 11, fontWeight: '800' },
    separator: { height: 1, backgroundColor: c.border + '60', marginLeft: 84 },
  });
}
