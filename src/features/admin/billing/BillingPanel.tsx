import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/data/products';
import { adminErrorMessage } from '@/features/admin/errors';
import type { AdminVariant, InvoiceRow, OrderRow } from '@/features/admin/types';
import { A, Button, EmptyNote, Panel, Pill, Segmented, Stat, numeric } from '@/features/admin/ui';
import { supabase } from '@/lib/supabase';
import { formatINR, summarizeInvoices } from './billingMath';
import { InvoiceList, type PaymentEntry } from './InvoiceList';
import { NewBillForm, type CounterBill } from './NewBillForm';

type BillingView = 'new' | 'invoices' | 'orders';

type Props = {
  products: Product[];
  variants: AdminVariant[];
  invoices: InvoiceRow[];
  orders: OrderRow[];
  available: boolean;
  busy: boolean;
  runAction: (action: () => Promise<void>) => Promise<void>;
  setMessage: (message: string) => void;
  reload: () => Promise<void>;
};

export function BillingPanel({ products, variants, invoices, orders, available, busy, runAction, setMessage, reload }: Props) {
  const [view, setView] = useState<BillingView>('new');
  const summary = summarizeInvoices(invoices);
  const today = new Date().toISOString().slice(0, 10);
  const billedToday = invoices.filter(invoice => invoice.status === 'issued' && invoice.issue_date.slice(0, 10) === today);
  const uninvoiced = orders.filter(order => order.status !== 'cancelled' && !invoices.some(invoice => invoice.order_id === order.id));

  // Children report success so they can reset their own form state.
  const attempt = async (action: () => Promise<boolean>) => {
    let succeeded = false;
    await runAction(async () => { succeeded = await action(); });
    return succeeded;
  };

  const createBill = (bill: CounterBill) => attempt(async () => {
    if (!supabase) return false;
    setMessage('');
    const { data, error } = await supabase.rpc('create_counter_invoice', {
      p_customer: bill.customer,
      p_items: bill.lines.map(({ product_id, variant_id, quantity }) => ({ product_id, variant_id, quantity })),
      p_notes: '',
      p_initial_payment: bill.amountReceived,
      p_payment_method: bill.method,
      p_reference: bill.reference,
    });
    if (error) { setMessage(adminErrorMessage(error, 'Could not create the bill. Check stock for each item and try again.')); return false; }
    setMessage('Bill created.');
    await reload();
    router.push({ pathname: '/invoice', params: { id: data } });
    return true;
  });

  const recordPayment = (invoice: InvoiceRow, payment: PaymentEntry) => attempt(async () => {
    if (!supabase) return false;
    const { error } = await supabase.rpc('record_business_invoice_payment', { p_invoice_id: invoice.id, p_amount: payment.amount, p_payment_method: payment.method, p_reference: payment.reference });
    if (error) { setMessage(adminErrorMessage(error, 'Could not save the payment. Check the amount and try again.')); return false; }
    setMessage(`${formatINR(payment.amount)} recorded against ${invoice.invoice_code}.`);
    await reload();
    return true;
  });

  const invoiceOrder = (order: OrderRow) => void attempt(async () => {
    if (!supabase) return false;
    const { data, error } = await supabase.rpc('issue_order_invoice', { p_order_id: order.id });
    if (error) { setMessage(adminErrorMessage(error, 'Could not create the invoice. Refresh and try again.')); return false; }
    setMessage(`Invoice created for order #${order.order_number}.`);
    await reload();
    router.push({ pathname: '/invoice', params: { id: data } });
    return true;
  });

  if (!available) {
    return (
      <Panel title="Billing isn’t switched on yet" caption="The invoice register needs the billing database update. Ask your developer to apply the latest Supabase migration, then refresh this page.">
        <Button variant="secondary" label="Refresh" onPress={() => void reload()} />
      </Panel>
    );
  }

  return (
    <View style={st.wrap}>
      <View style={st.stats}>
        <Stat label="To collect" value={formatINR(summary.outstanding)} caption={`${summary.openCount} open ${summary.openCount === 1 ? 'invoice' : 'invoices'}`} tone={summary.outstanding > 0 ? 'warn' : undefined} />
        <Stat label="Billed today" value={formatINR(billedToday.reduce((sum, invoice) => sum + Number(invoice.total), 0))} caption={`${billedToday.length} ${billedToday.length === 1 ? 'bill' : 'bills'}`} />
      </View>

      <Segmented<BillingView>
        options={[{ value: 'new', label: 'New bill' }, { value: 'invoices', label: 'Invoices', count: summary.openCount }, { value: 'orders', label: 'Online orders', count: uninvoiced.length }]}
        value={view}
        onChange={setView}
      />

      {view === 'new' ? <NewBillForm products={products} variants={variants} busy={busy} onError={setMessage} onCreate={createBill} /> : null}
      {view === 'invoices' ? <InvoiceList invoices={invoices} orders={orders} busy={busy} onError={setMessage} onRecordPayment={recordPayment} onOpen={invoice => router.push({ pathname: '/invoice', params: { id: invoice.id } })} /> : null}
      {view === 'orders' ? (
        <View style={st.table}>
          {uninvoiced.map(order => (
            <View key={order.id} style={st.row}>
              <View style={st.flex}>
                <Text style={st.title}>{order.shipping_name || 'Customer'} · #{order.order_number}</Text>
                <Text style={st.meta}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {order.shipping_city}</Text>
              </View>
              <Pill label={order.status.charAt(0).toUpperCase() + order.status.slice(1)} tone="brand" />
              <Text style={[st.amount, numeric]}>{formatINR(order.total)}</Text>
              <Button variant="secondary" label="Create invoice" onPress={() => invoiceOrder(order)} disabled={busy} />
            </View>
          ))}
          {!uninvoiced.length ? <EmptyNote title="All caught up" body="Every active online order already has an invoice." /> : null}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1, minWidth: 160 },
  wrap: { gap: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  table: { backgroundColor: A.panel, borderWidth: 1, borderColor: A.line, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: A.line },
  title: { color: A.ink, fontSize: 14, fontWeight: '800', fontFamily: A.font },
  meta: { color: A.muted, fontSize: 12, marginTop: 3, fontFamily: A.font },
  amount: { minWidth: 80, textAlign: 'right', color: A.ink, fontSize: 14, fontWeight: '800', fontFamily: A.font },
});
