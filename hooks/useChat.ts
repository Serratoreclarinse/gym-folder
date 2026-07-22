import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  attachment_url: string | null;
  attachment_type: 'image' | 'video' | 'file' | 'session_invite' | null;
  attachment_name: string | null;
  read_at: string | null;
  created_at: string;
  is_edited: boolean;
  edited_at: string | null;
  deleted_for_sender: boolean;
  deleted_for_receiver: boolean;
  metadata: Record<string, any> | null;
};

export function useChat(otherUserId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const myId = user?.id ?? '';

  const load = useCallback(async () => {
    if (!myId || !otherUserId) return;
    setLoading(true);

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });

    setMessages((data as Message[]) ?? []);
    setLoading(false);

    // Mark unread messages as read
    if (data && data.length > 0) {
      const unreadIds = (data as Message[])
        .filter((m) => m.sender_id === otherUserId && !m.read_at)
        .map((m) => m.id);
      if (unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds);
      }
    }
  }, [myId, otherUserId]);

  const sendMessage = useCallback(async (
    content: string,
    attachment?: { url: string; type: 'image' | 'video' | 'file'; name?: string },
    metadata?: Record<string, any>,
  ) => {
    if (!myId || !otherUserId || (!content.trim() && !attachment)) return;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: myId,
        receiver_id: otherUserId,
        content: content.trim(),
        attachment_url: attachment?.url ?? null,
        attachment_type: attachment?.type ?? null,
        attachment_name: attachment?.name ?? null,
        metadata: metadata ?? null,
      })
      .select()
      .single();
    if (!error && data) {
      setMessages((prev) => [...prev, data as Message]);
    }
  }, [myId, otherUserId]);

  const editMessage = useCallback(async (id: string, newContent: string) => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from('messages')
      .update({ content: trimmed, is_edited: true, edited_at: new Date().toISOString() })
      .eq('id', id)
      .eq('sender_id', myId);
    if (!error) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: trimmed, is_edited: true, edited_at: new Date().toISOString() } : m));
    }
  }, [myId]);

  const deleteMessage = useCallback(async (id: string, forEveryone: boolean) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    const isSender = msg.sender_id === myId;
    const updates: Partial<Message> = forEveryone
      ? { deleted_for_sender: true, deleted_for_receiver: true }
      : isSender
        ? { deleted_for_sender: true }
        : { deleted_for_receiver: true };
    const { error } = await supabase.from('messages').update(updates).eq('id', id);
    if (!error) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    }
  }, [myId, messages]);

  // Real-time subscription
  useEffect(() => {
    if (!myId || !otherUserId) return;

    channelRef.current = supabase
      .channel(`chat:${[myId, otherUserId].sort().join(':')}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${myId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        // Only show messages from the correct conversation partner
        if (msg.sender_id !== otherUserId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Mark as read immediately on receipt
        if (!msg.read_at) {
          supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, ...updated } : m));
      })
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [myId, otherUserId]);

  useEffect(() => { load(); }, [load]);

  return { messages, loading, sendMessage, editMessage, deleteMessage, refetch: load, myId };
}

// Hook to count all unread messages received by the current user
export function useMyUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { count: c } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .is('read_at', null);
    setCount(c ?? 0);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Keep badge in sync without requiring a restart
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`unread-count:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [user?.id, load]);

  return { count, refetch: load };
}

// Hook to count unread messages from a specific sender
export function useUnreadCount(fromUserId: string) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!user?.id || !fromUserId) return;
    const { count: c } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', fromUserId)
      .eq('receiver_id', user.id)
      .is('read_at', null);
    setCount(c ?? 0);
  }, [user?.id, fromUserId]);

  useEffect(() => { load(); }, [load]);

  return { count, refetch: load };
}
