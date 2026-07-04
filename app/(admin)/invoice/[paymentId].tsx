import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

const COMPANY = {
  name: 'Elevate Personal Training',
  cr: 'CR No. 1432027',
  address: 'Madinat Qaboos, Muscat, Oman',
  phone: '+968 91760908',
  website: 'www.elevate-training.com',
  vat: '', // Add VAT registration number when available
};

const PAY_LABEL: Record<string, string> = {
  cash: 'Cash', bank_muscat: 'Bank Muscat', nbo: 'NBO', oab: 'OAB',
  bank_dhofar: 'Bank Dhofar', ahli_bank: 'Ahli Bank', sohar: 'Sohar International',
  hsbc: 'HSBC Oman', bank_nizwa: 'Bank Nizwa', other: 'Other',
};

function formatInvoiceNumber(seq: number, date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}${dd}${yyyy}${seq}`;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

type InvoiceData = {
  id: string;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  invoice_number: string | null;
  notes: string | null;
  paid_at: string;
  client_name: string;
  coach_name: string;
  package_type: string | null;
  is_renewal: boolean;
};

export default function InvoicePage() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadInvoice(); }, [paymentId]);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const { data: pay, error: payErr } = await supabase
        .from('payments')
        .select('id, amount, payment_method, transaction_ref, invoice_number, notes, paid_at, client_id, coach_id, package_id')
        .eq('id', paymentId)
        .single();
      if (payErr || !pay) { setError('Payment not found.'); return; }

      const [clientRes, coachRes, pkgRes, pkgCountRes] = await Promise.all([
        supabase.from('profiles').select('name').eq('id', pay.client_id).single(),
        supabase.from('profiles').select('name').eq('id', pay.coach_id).single(),
        pay.package_id
          ? supabase.from('packages').select('package_type').eq('id', pay.package_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('packages').select('id').eq('client_id', pay.client_id).order('created_at', { ascending: true }).limit(1),
      ]);

      setData({
        id: pay.id,
        amount: Number(pay.amount),
        payment_method: pay.payment_method,
        transaction_ref: pay.transaction_ref,
        invoice_number: pay.invoice_number,
        notes: pay.notes,
        paid_at: pay.paid_at,
        client_name: clientRes.data?.name ?? 'Unknown',
        coach_name: coachRes.data?.name ?? 'Unknown',
        package_type: (pkgRes as any).data?.package_type ?? null,
        is_renewal: pay.package_id ? (pkgCountRes.data?.[0]?.id !== pay.package_id) : false,
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (Platform.OS === 'web') {
      window.print();
    }
  };

  const handleGenerate = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      const { data: newNum, error: counterErr } = await supabase.rpc('next_invoice_number');
      if (counterErr || newNum == null) throw new Error(counterErr?.message ?? 'Failed to allocate invoice number');
      const invoiceNumber = formatInvoiceNumber(newNum as number, new Date(data.paid_at));
      await supabase.from('payments').update({ invoice_number: invoiceNumber }).eq('id', data.id);
      setData(prev => prev ? { ...prev, invoice_number: invoiceNumber } : prev);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to generate invoice number');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  );

  if (error || !data) return (
    <View style={s.center}>
      <Text style={s.errorText}>{error || 'No data'}</Text>
    </View>
  );

  const vatRate = 0.05;
  const baseAmount = data.amount;
  const vatAmount = baseAmount * vatRate;
  const totalAmount = baseAmount + vatAmount;
  const payDate = new Date(data.paid_at);
  const formattedDate = `${String(payDate.getDate()).padStart(2, '0')}/${String(payDate.getMonth() + 1).padStart(2, '0')}/${payDate.getFullYear()}`;
  const description = `PERSONAL TRAINING${data.is_renewal ? ' (RENEWAL)' : ' (NEW)'}`;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.pageContent}>
      {/* Action bar — hidden when printing */}
      <View style={s.actionBar}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
          <Text style={s.backBtnText}>Back</Text>
        </Pressable>
        {Platform.OS === 'web' && data.invoice_number && (
          <Pressable style={s.printBtn} onPress={handlePrint}>
            <Ionicons name="print-outline" size={16} color={Colors.bg} />
            <Text style={s.printBtnText}>Print / Save PDF</Text>
          </Pressable>
        )}
      </View>

      {/* Invoice Card */}
      <View style={s.invoice}>
        {/* Header */}
        <View style={s.invoiceHeader}>
          <View style={s.companyBlock}>
            <Text style={s.companyName}>{COMPANY.name}</Text>
            <Text style={s.companyDetail}>{COMPANY.cr}</Text>
            <Text style={s.companyDetail}>{COMPANY.address}</Text>
            <Text style={s.companyDetail}>{COMPANY.phone}</Text>
            <Text style={s.companyDetail}>{COMPANY.website}</Text>
            {COMPANY.vat ? <Text style={s.companyDetail}>VAT No. {COMPANY.vat}</Text> : null}
          </View>
          <View style={s.invoiceMeta}>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            {data.invoice_number ? (
              <Text style={s.invoiceNum}>Invoice No: {data.invoice_number}</Text>
            ) : (
              <Pressable style={s.generateBtn} onPress={handleGenerate} disabled={generating}>
                {generating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Ionicons name="document-text-outline" size={14} color="#fff" /><Text style={s.generateBtnText}>Generate invoice number</Text></>
                }
              </Pressable>
            )}
            <Text style={s.invoiceDate}>Date: {formattedDate}</Text>
            <Text style={s.invoiceTo}>To: {data.client_name}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Table */}
        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={[s.thCell, { flex: 0.5 }]}>Qty</Text>
            <Text style={[s.thCell, { flex: 3 }]}>Description</Text>
            <Text style={[s.thCell, { flex: 1.2, textAlign: 'right' }]}>Unit Price</Text>
            <Text style={[s.thCell, { flex: 1.2, textAlign: 'right' }]}>Total (OMR)</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tdCell, { flex: 0.5 }]}>1</Text>
            <Text style={[s.tdCell, { flex: 3 }]}>{description}</Text>
            <Text style={[s.tdCell, { flex: 1.2, textAlign: 'right' }]}>{fmt(baseAmount)}</Text>
            <Text style={[s.tdCell, { flex: 1.2, textAlign: 'right' }]}>{fmt(baseAmount)}</Text>
          </View>
          <View style={[s.tableRow, { backgroundColor: 'transparent' }]}>
            <Text style={[s.tdCell, { flex: 0.5 }]} />
            <Text style={[s.tdCell, { flex: 3 }]}>5% VAT</Text>
            <Text style={[s.tdCell, { flex: 1.2 }]} />
            <Text style={[s.tdCell, { flex: 1.2, textAlign: 'right' }]}>{fmt(vatAmount)}</Text>
          </View>
        </View>

        {/* Total */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total Received (OMR)</Text>
          <Text style={s.totalValue}>{fmt(totalAmount)}</Text>
        </View>

        <View style={s.divider} />

        {/* Disclaimer */}
        <Text style={s.disclaimer}>*** THE AMOUNT MENTIONED ABOVE IS NOT VALID FOR REFUND ***</Text>

        <View style={s.divider} />

        {/* Payment info */}
        <View style={s.payBlock}>
          <Text style={s.payRow}>
            <Text style={s.payKey}>Payment Method:   </Text>
            <Text style={s.payVal}>{PAY_LABEL[data.payment_method] ?? data.payment_method}</Text>
          </Text>
          {data.transaction_ref ? (
            <Text style={s.payRow}>
              <Text style={s.payKey}>Transaction Number:   </Text>
              <Text style={s.payVal}>{data.transaction_ref}</Text>
            </Text>
          ) : null}
          {data.notes ? (
            <Text style={s.payRow}>
              <Text style={s.payKey}>Notes:   </Text>
              <Text style={s.payVal}>{data.notes}</Text>
            </Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F5F5' },
  pageContent: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  errorText: { ...Typography.body, color: Colors.accent },

  actionBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', maxWidth: 720, marginBottom: 20,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtnText: { ...Typography.body, color: '#555' },
  printBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1a1a1a', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  printBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7, marginTop: 4,
  },
  generateBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  invoice: {
    backgroundColor: '#FFFFFF', borderRadius: 4,
    width: '100%', maxWidth: 720,
    padding: 40,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  companyBlock: { flex: 1 },
  companyName: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 4 },
  companyDetail: { fontSize: 12, color: '#555', lineHeight: 18 },

  invoiceMeta: { alignItems: 'flex-end', flex: 1 },
  invoiceTitle: { fontSize: 28, fontWeight: '900', color: '#111', letterSpacing: 2, marginBottom: 8 },
  invoiceNum: { fontSize: 12, color: '#555', marginBottom: 2 },
  invoiceDate: { fontSize: 12, color: '#555', marginBottom: 2 },
  invoiceTo: { fontSize: 13, fontWeight: '600', color: '#111', marginTop: 8 },

  divider: { height: 1, backgroundColor: '#DDD', marginVertical: 16 },

  table: { borderWidth: 1, borderColor: '#DDD', borderRadius: 4, overflow: 'hidden', marginBottom: 0 },
  tableHead: {
    flexDirection: 'row', backgroundColor: '#1a1a1a',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  thCell: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
  tableRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FAFAFA',
  },
  tdCell: { fontSize: 13, color: '#222' },

  totalRow: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    gap: 24, paddingTop: 12,
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#111' },
  totalValue: { fontSize: 16, fontWeight: '900', color: '#111', minWidth: 100, textAlign: 'right' },

  disclaimer: { fontSize: 11, color: '#555', textAlign: 'center', fontStyle: 'italic' },

  payBlock: {
    backgroundColor: '#F8F8F8', borderRadius: 4,
    borderWidth: 1, borderColor: '#DDD',
    padding: 16, gap: 6,
  },
  payRow: { fontSize: 13, lineHeight: 22 },
  payKey: { fontWeight: '700', color: '#333' },
  payVal: { color: '#111' },
});
