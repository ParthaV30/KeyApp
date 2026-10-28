import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatINR } from '@/features/admin/billing/billingMath';
import type { OrderItemRow, OrderRow } from '@/features/admin/types';
import { A, Button, Panel, Pill, numeric, type Tone } from '@/features/admin/ui';
import { supabase } from '@/lib/supabase';
import { OrderStepper } from './OrderStepper';
import { canCancelOrder, nextOrderAction, orderStatusLabel } from './orderFlow';

type Props = { order: OrderRow; busy: boolean; onBack: () => void; onChangeStatus: (status: string) => void };
type ItemsState = { orderId: string; rows: OrderItemRow[]; error: string | null } | null;

export const statusTone = (status: string): Tone =>
  status === 'delivered' ? 'good' : status === 'cancelled' ? 'bad' : status === 'pending' ? 'warn' : 'brand';

const when = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const paymentLabel = (order: OrderRow) => {
  const method = order.payment_method === 'cod' || !order.payment_method ? 'Cash on delivery' : order.payment_method;
  const state = order.payment_status === 'paid' ? 'Paid' : order.payment_status === 'refunded' ? 'Refunded' : 'To collect on delivery';
  return { method, state, tone: (order.payment_status === 'paid' ? 'good' : order.payment_status === 'refunded' ? 'neutral' : 'warn') as Tone };
};
// Indian numbers are usually saved without the country code; WhatsApp links need it.
const whatsappNumber = (phone: string) => { const digits = phone.replace(/\D/g, ''); return digits.length === 10 ? `91${digits}` : digits; };

function useOrderItems(orderId: string): ItemsState {
  const [state, setState] = useState<ItemsState>(null);
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.from('order_items').select('id,product_name,variant_name,sku,unit_price,quantity,line_total').eq('order_id', orderId)
      .then(({ data, error }) => {
        if (!cancelled) setState({ orderId, rows: (data ?? []) as OrderItemRow[], error: error ? 'Could not load the items in this order. Refresh and try again.' : null });
      });
    return () => { cancelled = true; };
  }, [orderId]);
  return state?.orderId === orderId ? state : null;
}

export function OrderDetail({ order, busy, onBack, onChangeStatus }: Props) {
  const items = useOrderItems(order.id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const next = nextOrderAction(order.status);
  const payment = paymentLabel(order);
  const address = [order.shipping_address, order.shipping_city, order.shipping_state, order.shipping_postal_code].filter(Boolean).join(', ');
  const units = items?.rows.reduce((sum, row) => sum + row.quantity, 0) ?? 0;

  return (
    <View style={st.wrap}>
      <Pressable onPress={onBack} accessibilityRole="button" style={st.back}><Text style={st.backText}>← All orders</Text></Pressable>

      <View style={st.head}>
        <View style={st.flex}>
          <Text style={st.title}>Order #{order.order_number}</Text>
          <Text style={st.meta}>Placed {when(order.created_at)}{order.updated_at && order.updated_at !== order.created_at ? ` · Last updated ${when(order.updated_at)}` : ''}</Text>
        </View>
        <Pill label={orderStatusLabel(order.status)} tone={statusTone(order.status)} />
      </View>

      <Panel title="Progress">
        {order.status === 'cancelled'
          ? <Text style={st.cancelledNote}>This order was cancelled. Its reserved stock has been released back to inventory.</Text>
          : <OrderStepper status={order.status} />}
        {next ? (
          <View style={st.nextBox}>
            <View style={st.nextCopy}><Text style={st.nextTitle}>Next step: {next.label}</Text><Text style={st.nextHint}>{next.hint}</Text></View>
            <Button label={busy ? 'Saving…' : next.label} onPress={() => onChangeStatus(next.status)} disabled={busy} />
          </View>
        ) : null}
        {order.status === 'delivered' ? <Text style={st.doneNote}>Delivered. Nothing more to do for this order.</Text> : null}
      </Panel>

      <View style={st.columns}>
        <Panel title="Customer" style={st.column}>
          <Text style={st.strong}>{order.shipping_name}</Text>
          <Text style={st.body}>{order.shipping_phone}</Text>
          <View style={st.contactRow}>
            <Button variant="secondary" label="Call" onPress={() => void Linking.openURL(`tel:${order.shipping_phone.replace(/[^\d+]/g, '')}`)} />
            <Button variant="secondary" label="WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${whatsappNumber(order.shipping_phone)}?text=${encodeURIComponent(`Hello ${order.shipping_name}, about your Key Mitra order #${order.order_number}:`)}`)} />
          </View>
          <Text style={st.label}>Deliver to</Text>
          <Text style={st.body}>{address}</Text>
          {order.shipping_gstin ? <><Text style={st.label}>GSTIN</Text><Text style={[st.body, st.mono]}>{order.shipping_gstin}</Text></> : null}
        </Panel>

        <Panel title="Payment" style={st.column}>
          <View style={st.lineRow}><Text style={st.body}>Method</Text><Text style={st.strong}>{payment.method}</Text></View>
          <View style={st.lineRow}><Text style={st.body}>Status</Text><Pill label={payment.state} tone={payment.tone} /></View>
          <View style={st.divider} />
          {order.subtotal !== undefined ? <View style={st.lineRow}><Text style={st.body}>Items</Text><Text style={[st.body, numeric]}>{formatINR(order.subtotal)}</Text></View> : null}
          <View style={st.lineRow}><Text style={st.body}>Delivery</Text><Text style={[st.body, numeric]}>{order.shipping_fee ? formatINR(order.shipping_fee) : 'Free'}</Text></View>
          <View style={st.lineRow}><Text style={st.totalLabel}>Total</Text><Text style={[st.total, numeric]}>{formatINR(order.total)}</Text></View>
        </Panel>
      </View>

      <Panel title="Items" caption={items && !items.error ? `${items.rows.length} ${items.rows.length === 1 ? 'product' : 'products'} · ${units} ${units === 1 ? 'unit' : 'units'}` : undefined}>
        {!items ? <Text style={st.body}>Loading items…</Text> : items.error ? <Text style={st.error}>{items.error}</Text> : items.rows.length === 0 ? <Text style={st.body}>No items were recorded for this order.</Text> : (
          <View>
            <View style={[st.itemRow, st.itemHead]}><Text style={[st.th, st.itemName]}>Product</Text><Text style={[st.th, st.qty]}>Qty</Text><Text style={[st.th, st.money]}>Price</Text><Text style={[st.th, st.money]}>Amount</Text></View>
            {items.rows.map(row => (
              <View key={row.id} style={st.itemRow}>
                <View style={st.itemName}>
                  <Text style={st.strong}>{row.product_name}</Text>
                  {row.variant_name || row.sku ? <Text style={st.meta}>{[row.variant_name, row.sku && `SKU ${row.sku}`].filter(Boolean).join(' · ')}</Text> : null}
                </View>
                <Text style={[st.body, st.qty, numeric]}>{row.quantity}</Text>
                <Text style={[st.body, st.money, numeric]}>{formatINR(row.unit_price)}</Text>
                <Text style={[st.strong, st.money, numeric]}>{formatINR(row.line_total)}</Text>
              </View>
            ))}
          </View>
        )}
      </Panel>

      {order.customer_note ? <Panel title="Customer note"><Text style={st.body}>{order.customer_note}</Text></Panel> : null}

      {canCancelOrder(order.status) ? (
        <Panel>
          {confirmCancel ? (
            <View style={st.cancelBox}>
              <Text style={st.strong}>Cancel order #{order.order_number}?</Text>
              <Text style={st.body}>The customer’s reserved stock goes back to inventory. This cannot be undone.</Text>
              <View style={st.contactRow}>
                <Button variant="danger" label={busy ? 'Cancelling…' : 'Yes, cancel order'} onPress={() => { setConfirmCancel(false); onChangeStatus('cancelled'); }} disabled={busy} />
                <Button variant="ghost" label="Keep order" onPress={() => setConfirmCancel(false)} />
              </View>
            </View>
          ) : (
            <View style={st.lineRow}>
              <Text style={st.body}>Customer changed their mind or items are unavailable?</Text>
              <Button variant="ghost" label="Cancel order" onPress={() => setConfirmCancel(true)} />
            </View>
          )}
        </Panel>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 14 },
  flex: { flex: 1 },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  backText: { color: A.brand, fontSize: 14, fontWeight: '800', fontFamily: A.font },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  title: { color: A.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.3, fontFamily: A.font },
  meta: { color: A.muted, fontSize: 12, lineHeight: 18, marginTop: 2, fontFamily: A.font },
  nextBox: { marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: A.brandSoft, flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  nextCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  nextTitle: { color: A.ink, fontSize: 14, fontWeight: '800', fontFamily: A.font },
  nextHint: { color: A.body, fontSize: 13, lineHeight: 19, marginTop: 2, fontFamily: A.font },
  doneNote: { color: A.good, fontSize: 13, fontWeight: '700', marginTop: 14, fontFamily: A.font },
  cancelledNote: { color: A.bad, fontSize: 13, lineHeight: 19, fontFamily: A.font },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  column: { flexGrow: 1, flexBasis: 300 },
  strong: { color: A.ink, fontSize: 14, fontWeight: '700', fontFamily: A.font },
  body: { color: A.body, fontSize: 14, lineHeight: 20, fontFamily: A.font },
  mono: { letterSpacing: 0.6 },
  label: { color: A.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 2, fontFamily: A.font },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4, flexWrap: 'wrap' },
  divider: { height: 1, backgroundColor: A.line, marginVertical: 8 },
  totalLabel: { color: A.ink, fontSize: 15, fontWeight: '800', fontFamily: A.font },
  total: { color: A.ink, fontSize: 18, fontWeight: '800', fontFamily: A.font },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: A.line },
  itemHead: { borderTopWidth: 0, paddingTop: 0 },
  th: { color: A.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: A.font },
  itemName: { flex: 1, minWidth: 0 },
  qty: { width: 40, textAlign: 'right' },
  money: { width: 84, textAlign: 'right' },
  error: { color: A.bad, fontSize: 13, fontFamily: A.font },
  cancelBox: { gap: 4 },
});
