import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { A, Button, Chip, EmptyNote, Field, Pill, Segmented, numeric } from '@/features/admin/ui';
import type { InvoiceRow, OrderRow } from '@/features/admin/types';
import { PAYMENT_METHODS, formatINR, invoiceDue, invoicePaymentState, paymentMethodLabel, type InvoicePaymentState } from './billingMath';

export type PaymentEntry = { amount: number; method: string; reference: string };
type Filter = 'unpaid' | 'all' | 'paid';

const stateLabel: Record<InvoicePaymentState, { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }> = {
  paid: { label: 'Paid', tone: 'good' },
  partial: { label: 'Part paid', tone: 'warn' },
  unpaid: { label: 'Unpaid', tone: 'bad' },
  void: { label: 'Cancelled', tone: 'neutral' },
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

type Props = {
  invoices: InvoiceRow[];
  orders: OrderRow[];
  busy: boolean;
  onOpen: (invoice: InvoiceRow) => void;
  onError: (message: string) => void;
  onRecordPayment: (invoice: InvoiceRow, payment: PaymentEntry) => Promise<boolean>;
};

export function InvoiceList({ invoices, orders, busy, onOpen, onError, onRecordPayment }: Props) {
  const [filter, setFilter] = useState<Filter>('unpaid');
  const [search, setSearch] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [reference, setReference] = useState('');

  const unpaidCount = invoices.filter(invoice => invoiceDue(invoice) > 0 && invoice.status === 'issued').length;
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter(invoice => {
      const state = invoicePaymentState(invoice);
      if (filter === 'unpaid' && state !== 'unpaid' && state !== 'partial') return false;
      if (filter === 'paid' && state !== 'paid') return false;
      return !query || `${invoice.invoice_code} ${invoice.buyer_name} ${invoice.buyer_phone}`.toLowerCase().includes(query);
    });
  }, [invoices, filter, search]);

  const startPayment = (invoice: InvoiceRow) => {
    if (payingId === invoice.id) { setPayingId(null); return; }
    setPayingId(invoice.id); setAmount(String(invoiceDue(invoice))); setMethod('cash'); setReference('');
  };

  const savePayment = async (invoice: InvoiceRow) => {
    const value = Number(amount);
    const due = invoiceDue(invoice);
    if (!Number.isFinite(value) || value <= 0) { onError('Enter the amount received.'); return; }
    if (value > due) { onError(`That is more than the ${formatINR(due)} still due on this invoice.`); return; }
    if (await onRecordPayment(invoice, { amount: value, method, reference: reference.trim() })) setPayingId(null);
  };

  const sourceLabel = (invoice: InvoiceRow) => {
    if (!invoice.order_id) return 'Counter sale';
    const order = orders.find(item => item.id === invoice.order_id);
    return order ? `Online order #${order.order_number}` : 'Online order';
  };

  return (
    <View style={st.wrap}>
      <View style={st.toolbar}>
        <Segmented<Filter> options={[{ value: 'unpaid', label: 'To collect', count: unpaidCount }, { value: 'all', label: 'All' }, { value: 'paid', label: 'Paid' }]} value={filter} onChange={setFilter} />
        <View style={st.search}><Field label="Search" value={search} onChangeText={setSearch} placeholder="Customer, phone or invoice no." /></View>
      </View>

      <View style={st.table}>
        {visible.map(invoice => {
          const state = stateLabel[invoicePaymentState(invoice)];
          const due = invoiceDue(invoice);
          return (
            <View key={invoice.id} style={st.row}>
              <View style={st.rowMain}>
                <View style={st.flex}>
                  <Text style={st.buyer} numberOfLines={1}>{invoice.buyer_name || 'Walk-in customer'}</Text>
                  <Text style={st.meta} numberOfLines={1}>{invoice.invoice_code} · {formatDate(invoice.issue_date)} · {sourceLabel(invoice)}</Text>
                </View>
                <View style={st.amounts}>
                  <Text style={[st.total, numeric]}>{formatINR(invoice.total)}</Text>
                  {state.label === 'Part paid' ? <Text style={[st.due, numeric]}>{formatINR(due)} due</Text> : null}
                </View>
              </View>
              <View style={st.rowFoot}>
                <Pill label={state.label} tone={state.tone} />
                <View style={st.actions}>
                  <Button variant="ghost" label="View / print" onPress={() => onOpen(invoice)} />
                  {due > 0 && invoice.status === 'issued' ? <Button variant={payingId === invoice.id ? 'secondary' : 'primary'} label={payingId === invoice.id ? 'Cancel' : 'Record payment'} onPress={() => startPayment(invoice)} /> : null}
                </View>
              </View>
              {payingId === invoice.id ? (
                <View style={st.payment}>
                  <View style={st.amountRow}>
                    <View style={st.flex}><Field label="Amount received" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /></View>
                    <Button variant="secondary" label={`Full ${formatINR(due)}`} onPress={() => setAmount(String(due))} />
                  </View>
                  <View style={st.chips}>{PAYMENT_METHODS.map(item => <Chip key={item} label={paymentMethodLabel(item)} selected={method === item} onPress={() => setMethod(item)} />)}</View>
                  {method !== 'cash' ? <Field label="Reference" value={reference} onChangeText={setReference} placeholder="Transaction ID or cheque no. (optional)" /> : null}
                  <Button label={busy ? 'Saving…' : 'Save payment'} onPress={() => void savePayment(invoice)} disabled={busy} />
                </View>
              ) : null}
            </View>
          );
        })}
        {!visible.length ? (
          <EmptyNote
            title={filter === 'unpaid' && !search ? 'Nothing to collect' : 'No invoices found'}
            body={filter === 'unpaid' && !search ? 'Every issued invoice is fully paid.' : 'Try a different search or filter.'}
          />
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 14 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  search: { flexGrow: 1, flexBasis: 240, maxWidth: 380 },
  table: { backgroundColor: A.panel, borderWidth: 1, borderColor: A.line, borderRadius: 12, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: A.line, gap: 10 },
  rowMain: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  buyer: { color: A.ink, fontSize: 15, fontWeight: '800', fontFamily: A.font },
  meta: { color: A.muted, fontSize: 12, marginTop: 3, fontFamily: A.font },
  amounts: { alignItems: 'flex-end' },
  total: { color: A.ink, fontSize: 15, fontWeight: '800', fontFamily: A.font },
  due: { color: A.warn, fontSize: 12, fontWeight: '700', marginTop: 3, fontFamily: A.font },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payment: { backgroundColor: A.sunken, borderWidth: 1, borderColor: A.line, borderRadius: 10, padding: 14, gap: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
