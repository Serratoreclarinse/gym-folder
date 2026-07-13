import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
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

  const sendMessage = useCallback(async (content: string) => {
    if (!myId || !otherUserId || !content.trim()) return;
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: myId, receiver_id: otherUserId, content: content.trim() })
      .select()
      .single();
    if (!error && data) {
      setMessages((prev) => [...prev, data as Message]);
    }
  }, [myId, otherUserId]);

  // Real-time subscription
  useEffect(() => {
    if (!myId || !otherUserId) return;

    channelRef.current = supabase
      .channel(`chat:${[myId, otherUserId].sort().join(':')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          const isOurs =
            (msg.sender_id === myId && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === myId);
          if (!isOurs) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Mark as read if we received it
          if (msg.sender_id === otherUserId && !msg.read_at) {
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', msg.id);
          }
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [myId, otherUserId]);

  useEffect(() => { load(); }, [load]);

  return { messages, loading, sendMessage, refetch: load, myId };
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
