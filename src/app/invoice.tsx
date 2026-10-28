import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthContext';
import { InvoicePreview } from '@/features/admin/billing/InvoicePreview';
import { formatINR, invoiceDue, invoicePaymentState, paymentMethodLabel } from '@/features/admin/billing/billingMath';
import { buildInvoiceHtml, formatBillDate, type InvoiceDocumentData, type InvoiceProfile } from '@/features/admin/billing/invoiceDocument';
import { loadInvoiceProfile } from '@/features/admin/billing/invoiceProfile';
import { printInvoice } from '@/features/admin/billing/printInvoice';
import { A, Button, Pill, numeric } from '@/features/admin/ui';
import { supabase } from '@/lib/supabase';
import { safeBack } from '@/lib/safeBack';

type InvoiceData = InvoiceDocumentData & {
  id: string;
  payment_status: string;
  billing_invoice_payments: { id: string; amount: number; payment_method: string; reference: string; paid_at: string }[];
};

const stateLabel = {
  paid: { label: 'Paid', tone: 'good' },
  partial: { label: 'Part paid', tone: 'warn' },
  unpaid: { label: 'Unpaid', tone: 'bad' },
  void: { label: 'Cancelled', tone: 'neutral' },
} as const;

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [profile, setProfile] = useState<InvoiceProfile>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || role !== 'admin' || typeof id !== 'string') return;
    setLoading(true);
    const [{ data, error: loadError }, profileResult] = await Promise.all([
      supabase.from('billing_invoices').select('*,billing_invoice_items(*),billing_invoice_payments(*)').eq('id', id).single(),
      loadInvoiceProfile(),
    ]);
    if (loadError) setError('This invoice could not be loaded. Go back to Billing and open it again.');
    else setInvoice(data as unknown as InvoiceData);
    setProfile(profileResult.profile);
    setLoading(false);
  }, [id, role]);

  // Loading the invoice synchronizes this screen with Supabase.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const html = useMemo(() => (invoice ? buildInvoiceHtml(invoice, profile) : ''), [invoice, profile]);

  const print = async () => {
    setPrinting(true);
    try { await printInvoice(html); } finally { setPrinting(false); }
  };

  if (role !== 'admin') return <Message text="Administrator access required." />;
  if (loading) return <Message text="Loading invoice…" />;
  if (error || !invoice) return <Message text={error || 'Invoice not found.'} back />;

  const state = stateLabel[invoicePaymentState(invoice)];
  const due = invoiceDue(invoice);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.toolbar}>
        <View style={st.toolbarInner}>
          <Button variant="ghost" label="← Billing" onPress={() => safeBack('/admin')} />
          <View style={st.title}>
            <Text style={st.code} numberOfLines={1}>{invoice.invoice_code}</Text>
            <Text style={st.sub} numberOfLines={1}>{invoice.buyer_name || 'Walk-in customer'} · {formatBillDate(invoice.issue_date)}</Text>
          </View>
          <Button label={printing ? 'Opening…' : Platform.OS === 'web' ? 'Print / Save PDF' : 'Print or share PDF'} onPress={() => void print()} disabled={printing} />
        </View>
      </View>

      <ScrollView style={st.flex} contentContainerStyle={[st.body, Platform.OS !== 'web' && st.bodyNative]}>
        <View style={st.summary}>
          <Pill label={state.label} tone={state.tone} />
          <Text style={[st.summaryText, numeric]}>Total {formatINR(invoice.total)}</Text>
          {due > 0 && state.label !== 'Cancelled' ? <Text style={[st.summaryDue, numeric]}>{formatINR(due)} due</Text> : null}
        </View>

        <View style={Platform.OS === 'web' ? undefined : st.nativePreview}>
          <InvoicePreview html={html} />
        </View>

        {invoice.billing_invoice_payments.length ? (
          <View style={st.payments}>
            <Text style={st.paymentsTitle}>Payments received</Text>
            {invoice.billing_invoice_payments.map(payment => (
              <View key={payment.id} style={st.paymentRow}>
                <Text style={st.paymentMeta}>{formatBillDate(payment.paid_at)} · {paymentMethodLabel(payment.payment_method)}{payment.reference ? ` · ${payment.reference}` : ''}</Text>
                <Text style={[st.paymentAmount, numeric]}>{formatINR(payment.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Message({ text, back = false }: { text: string; back?: boolean }) {
  return (
    <SafeAreaView style={[st.safe, st.center]}>
      <Text style={st.message}>{text}</Text>
      {back ? <Button variant="secondary" label="Back to Billing" onPress={() => safeBack('/admin')} /> : null}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: A.canvas },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  message: { color: A.body, fontSize: 14, fontFamily: A.font, textAlign: 'center' },
  toolbar: { backgroundColor: A.panel, borderBottomWidth: 1, borderBottomColor: A.line },
  toolbarInner: { width: '100%', maxWidth: 860, alignSelf: 'center', minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, minWidth: 0 },
  code: { color: A.ink, fontSize: 15, fontWeight: '800', fontFamily: A.font },
  sub: { color: A.muted, fontSize: 12, marginTop: 1, fontFamily: A.font },
  body: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 16, gap: 14, paddingBottom: 40 },
  bodyNative: { flexGrow: 1 },
  nativePreview: { height: 620 },
  summary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  summaryText: { color: A.ink, fontSize: 14, fontWeight: '800', fontFamily: A.font },
  summaryDue: { color: A.warn, fontSize: 14, fontWeight: '800', fontFamily: A.font },
  payments: { backgroundColor: A.panel, borderWidth: 1, borderColor: A.line, borderRadius: 12, padding: 16, gap: 10 },
  paymentsTitle: { color: A.ink, fontSize: 14, fontWeight: '800', fontFamily: A.font },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  paymentMeta: { flex: 1, color: A.body, fontSize: 13, fontFamily: A.font },
  paymentAmount: { color: A.ink, fontSize: 13, fontWeight: '800', fontFamily: A.font },
});
