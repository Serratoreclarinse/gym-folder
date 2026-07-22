import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

type NotificationsContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetch: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  loading: true,
  markRead: async () => {},
  markAllRead: async () => {},
  refetch: async () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60);
    setNotifications(data ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refetch();
    if (!user?.id) return;
    const ch = supabase
      .channel(`notifs:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications((prev) => [payload.new as AppNotification, ...prev]),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, refetch]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user?.id) await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
  }, [user?.id]);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      loading,
      markRead,
      markAllRead,
      refetch,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
