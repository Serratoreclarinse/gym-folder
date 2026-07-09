import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '@/hooks/useChat';
import { useClientData } from '@/hooks/useClientData';
import { Typography } from '@/constants/theme';
import type { ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtDay(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ClientMessagesScreen() {
  const { pkg, coachInfo } = useClientData();
  const coachId = pkg?.coach_id ?? '';
  const coachName = coachInfo?.name ?? 'Coach';
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { messages, loading, sendMessage, myId } = useChat(coachId);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  if (!coachId) {
    return (
      <View style={s.noCoach}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
        <Text style={s.noCoachText}>No active package found.</Text>
        <Text style={s.noCoachSub}>Chat becomes available once your coach activates your package.</Text>
      </View>
    );
  }

  const items: ({ type: 'day'; label: string } | { type: 'msg'; id: string; msg: (typeof messages)[0] })[] = [];
  let lastDay = '';
  for (const msg of messages) {
    const day = fmtDay(msg.created_at);
    if (day !== lastDay) {
      items.push({ type: 'day', label: day });
      lastDay = day;
    }
    items.push({ type: 'msg', id: msg.id, msg });
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Coach info bar */}
      <View style={s.coachBar}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {coachName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
          </Text>
        </View>
        <View>
          <Text style={s.coachName}>{coachName}</Text>
          <Text style={s.coachRole}>Your Coach</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.type === 'day' ? item.label : item.id}
        contentContainerStyle={s.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          if (item.type === 'day') {
            return (
              <View style={s.dayRow}>
                <View style={s.dayLine} />
                <Text style={s.dayLabel}>{item.label}</Text>
                <View style={s.dayLine} />
              </View>
            );
          }
          const mine = item.msg.sender_id === myId;
          return (
            <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
              <Text style={[s.bubbleText, mine ? s.bubbleTextMine : s.bubbleTextTheirs]}>
                {item.msg.content}
              </Text>
              <View style={s.bubbleMeta}>
                <Text style={[s.bubbleTime, mine && s.bubbleTimeMine]}>{fmtTime(item.msg.created_at)}</Text>
                {mine && (
                  <Ionicons
                    name={item.msg.read_at ? 'checkmark-done' : 'checkmark'}
                    size={12}
                    color={item.msg.read_at ? colors.accent : colors.textSecondary}
                  />
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
              <Text style={s.emptyText}>Send your coach a message!</Text>
            </View>
          ) : null
        }
      />

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder={`Message ${coachName}…`}
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <Pressable
          style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={18} color={text.trim() ? colors.bg : colors.textSecondary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    noCoach: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
    noCoachText: { ...Typography.subtitle, color: c.textPrimary, textAlign: 'center', marginTop: 12 },
    noCoachSub: { ...Typography.body, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },

    coachBar: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.accent + '22', borderWidth: 1, borderColor: c.accent + '44',
      justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '800', color: c.accent },
    coachName: { ...Typography.body, color: c.textPrimary, fontWeight: '700' },
    coachRole: { ...Typography.caption, color: c.textSecondary },

    list: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },

    dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
    dayLine: { flex: 1, height: 1, backgroundColor: c.border },
    dayLabel: { ...Typography.caption, color: c.textSecondary },

    bubble: {
      maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9,
      marginBottom: 4,
    },
    bubbleMine: {
      alignSelf: 'flex-end', backgroundColor: c.accent,
      borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
      alignSelf: 'flex-start', backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4,
    },
    bubbleText: { fontSize: 15, lineHeight: 21 },
    bubbleTextMine: { color: c.bg },
    bubbleTextTheirs: { color: c.textPrimary },
    bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, justifyContent: 'flex-end' },
    bubbleTime: { fontSize: 10, color: c.textSecondary },
    bubbleTimeMine: { color: c.bg + 'BB' },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
    emptyText: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },

    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border,
    },
    input: {
      flex: 1, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
      borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
      color: c.textPrimary, fontSize: 15, maxHeight: 120,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  });
}
