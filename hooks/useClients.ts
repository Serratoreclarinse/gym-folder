import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type ClientPackage = {
  id: string;
  package_type: '30min' | '45min' | '1hr';
  total_sessions: number;
  sessions_used: number;
  sessions_remaining: number;
  status: 'active' | 'expired';
  start_date: string;
};

export type ClientWithPackage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  birthday: string | null; // MM-DD e.g. "12-25"
  activePackage: ClientPackage | null;
};

export function useClients() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<ClientWithPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // Fetch all packages for this coach, joined with client profiles
    const { data, error: err } = await supabase
      .from('packages')
      .select(`
        id,
        package_type,
        total_sessions,
        sessions_used,
        sessions_remaining,
        status,
        start_date,
        client:profiles!packages_client_id_fkey (
          id, name, email, phone, birthday
        )
      `)
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Deduplicate by client — each client gets their most recent active package
    const clientMap = new Map<string, ClientWithPackage>();
    for (const row of data ?? []) {
      const c = row.client as { id: string; name: string; email: string; phone: string | null; birthday: string | null };
      if (!c) continue;

      const pkg: ClientPackage = {
        id: row.id,
        package_type: row.package_type,
        total_sessions: row.total_sessions,
        sessions_used: row.sessions_used,
        sessions_remaining: row.sessions_remaining,
        status: row.status,
        start_date: row.start_date,
      };

      if (!clientMap.has(c.id)) {
        clientMap.set(c.id, {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          birthday: c.birthday,
          activePackage: row.status === 'active' ? pkg : null,
        });
      } else if (row.status === 'active') {
        // Overwrite with an active package if one is found
        const existing = clientMap.get(c.id)!;
        if (!existing.activePackage) existing.activePackage = pkg;
      }
    }

    setClients(Array.from(clientMap.values()));
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { clients, loading, error, refetch: fetch };
}
