import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'other';
export type PaymentStatus = 'paid' | 'pending';

export type Payment = {
  id: string;
  client_id: string;
  client_name: string;
  package_type: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string; // YYYY-MM-DD
  status: PaymentStatus;
  notes: string | null;
  created_at: string;
};

export type NewPayment = Omit<Payment, 'id' | 'client_name' | 'created_at'>;

export function usePayments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }
    setLoading(true);

    const { data } = await supabase
      .from('payments')
      .select(`
        id, client_id, package_type, amount, payment_method,
        payment_date, status, notes, created_at,
        client:profiles!payments_client_id_fkey(name)
      `)
      .eq('coach_id', profile.id)
      .order('payment_date', { ascending: false });

    setPayments(
      (data ?? []).map((row) => ({
        id: row.id,
        client_id: row.client_id,
        client_name: (row.client as { name: string } | null)?.name ?? 'Unknown',
        package_type: row.package_type,
        amount: Number(row.amount),
        payment_method: row.payment_method as PaymentMethod,
        payment_date: row.payment_date,
        status: row.status as PaymentStatus,
        notes: row.notes,
        created_at: row.created_at,
      }))
    );
    setLoading(false);
  }, [profile?.id]);

  const addPayment = async (data: NewPayment) => {
    if (!profile?.id) return;
    await supabase.from('payments').insert({ ...data, coach_id: profile.id });
    await fetchPayments();
  };

  const updatePayment = async (id: string, data: Partial<NewPayment>) => {
    await supabase.from('payments').update(data).eq('id', id);
    await fetchPayments();
  };

  const deletePayment = async (id: string) => {
    await supabase.from('payments').delete().eq('id', id);
    await fetchPayments();
  };

  const toggleStatus = async (id: string, current: PaymentStatus) => {
    const next: PaymentStatus = current === 'paid' ? 'pending' : 'paid';
    await supabase.from('payments').update({ status: next }).eq('id', id);
    await fetchPayments();
  };

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  return { payments, loading, refetch: fetchPayments, addPayment, updatePayment, deletePayment, toggleStatus };
}
