import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatINR } from '@/features/admin/billing/billingMath';
import type { OrderRow } from '@/features/admin/types';
import { A, EmptyNote, Pill, Segmented, numeric } from '@/features/admin/ui';
import { OrderDetail, statusTone } from './OrderDetail';
import { OrderStepper } from './OrderStepper';
import { nextOrderAction, orderStatusLabel } from './orderFlow';

type Filter = 'open' | 'delivered' | 'cancelled' | 'all';
const OPEN = ['pending', 'confirmed', 'processing', 'shipped'];
const matches = (filter: Filter, status: string) =>
  filter === 'all' || (filter === 'open' ? OPEN.includes(status) : status === filter);

type Props = {
  orders: OrderRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  busy: boolean;
  onChangeStatus: (order: OrderRow, status: string) => void;
};

export function OrdersPanel({ orders, selectedId, onSelect, busy, onChangeStatus }: Props) {
  const [filter, setFilter] = useState<Filter>('open');
  const selected = selectedId ? orders.find(order => order.id === selectedId) : undefined;
  if (selected) return <OrderDetail order={selected} busy={busy} onBack={() => onSelect(null)} onChangeStatus={status => onChangeStatus(selected, status)} />;

  const count = (value: Filter) => orders.filter(order => matches(value, order.status)).length;
  const visible = orders.filter(order => matches(filter, order.status));
  return (
    <View style={st.wrap}>
      <View>
        <Text style={st.title}>Customer orders</Text>
        <Text style={st.caption}>Open an order to see its items, customer details and the next step.</Text>
      </View>
      <Segmented
        options={[{ value: 'open', label: 'To fulfil', count: count('open') }, { value: 'delivered', label: 'Delivered', count: count('delivered') }, { value: 'cancelled', label: 'Cancelled', count: count('cancelled') }, { value: 'all', label: 'All', count: orders.length }]}
        value={filter}
        onChange={setFilter}
      />
      {visible.length ? visible.map(order => <OrderListRow key={order.id} order={order} onOpen={() => onSelect(order.id)} />)
        : <EmptyNote title={filter === 'open' ? 'Nothing to fulfil' : 'No orders here'} body={filter === 'open' ? 'New online orders will appear here as soon as customers place them.' : 'Orders in this state will be listed here.'} />}
    </View>
  );
}

export function OrderListRow({ order, onOpen }: { order: OrderRow; onOpen: () => void }) {
  const next = nextOrderAction(order.status);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open order ${order.order_number}`} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [st.row, (hovered || pressed) && st.rowActive]}>
      <View style={st.rowMain}>
        <View style={st.rowTop}>
          <Text style={st.number}>#{order.order_number}</Text>
          <Pill label={orderStatusLabel(order.status)} tone={statusTone(order.status)} />
        </View>
        <Text style={st.customer} numberOfLines={1}>{order.shipping_name} · {order.shipping_city}</Text>
        <View style={st.rowBottom}>
          <OrderStepper status={order.status} compact />
          <Text style={st.nextText} numberOfLines={1}>{next ? `Next: ${next.label}` : order.status === 'delivered' ? 'Completed' : 'Closed'}</Text>
        </View>
      </View>
      <View style={st.rowSide}>
        <Text style={[st.amount, numeric]}>{formatINR(order.total)}</Text>
        <Text style={st.date}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
        <Text style={st.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 12 },
  title: { color: A.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.2, fontFamily: A.font },
  caption: { color: A.muted, fontSize: 13, lineHeight: 19, marginTop: 2, fontFamily: A.font },
  row: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: A.line, backgroundColor: A.panel },
  rowActive: { borderColor: A.lineStrong, backgroundColor: A.sunken },
  rowMain: { flex: 1, minWidth: 0, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { color: A.ink, fontSize: 15, fontWeight: '800', fontFamily: A.font },
  customer: { color: A.body, fontSize: 14, fontFamily: A.font },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  nextText: { flex: 1, color: A.muted, fontSize: 12, fontWeight: '700', fontFamily: A.font },
  rowSide: { alignItems: 'flex-end', justifyContent: 'space-between' },
  amount: { color: A.ink, fontSize: 15, fontWeight: '800', fontFamily: A.font },
  date: { color: A.muted, fontSize: 12, fontFamily: A.font },
  chevron: { color: A.muted, fontSize: 22, lineHeight: 22, fontFamily: A.font },
});
