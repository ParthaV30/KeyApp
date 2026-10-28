import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, EmptyState } from '@/components/shop/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { browseAllCategories } from '@/features/shop/navigation';
import { safeBack } from '@/lib/safeBack';

type Order = { id: string; order_number: number; status: string; total: number; payment_status: string; created_at: string; order_items: { product_name: string; variant_name: string; quantity: number; unit_price: number }[] };

export default function OrdersScreen() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase || !session) return;
    let cancelled = false;
    supabase.from('orders').select('id,order_number,status,total,payment_status,created_at,order_items(product_name,variant_name,quantity,unit_price)').order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) setError(queryError.message);
        else setOrders((data ?? []) as Order[]);
        setLoading(false);
      }, (cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load orders.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session]);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Pressable onPress={() => safeBack('/(tabs)/account')} style={styles.back}><Text style={styles.backIcon}>←</Text><Text style={styles.backLabel}>Account</Text></Pressable><Text style={styles.kicker}>ORDER HISTORY</Text><Text style={styles.title}>My orders</Text><Text style={styles.caption}>Orders placed with your Key Mitra account.</Text>
    {!session ? <View style={styles.gate}><Text style={styles.gateTitle}>Sign in to view your orders</Text><Text style={styles.caption}>Your order history is private to your account.</Text><Pressable onPress={() => router.push('/auth')} style={styles.button}><Text style={styles.buttonText}>Sign in</Text></Pressable></View> : loading ? <Text style={styles.loading}>Loading your orders…</Text> : error ? <Text style={styles.error}>{error}</Text> : orders.length ? orders.map(order => <View key={order.id} style={styles.order}><View style={styles.orderHead}><Text style={styles.orderNumber}>Order #{order.order_number}</Text><Text style={styles.status}>{order.status.toUpperCase()}</Text></View><Text style={styles.date}>{new Date(order.created_at).toLocaleString()}</Text>{order.order_items.map((item, index) => <Text key={`${order.id}-${index}`} style={styles.item}>{item.quantity} × {item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ''}</Text>)}<View style={styles.totalRow}><Text style={styles.payment}>Cash on delivery · {order.payment_status.replaceAll('_', ' ')}</Text><Text style={styles.total}>₹{Number(order.total).toLocaleString('en-IN')}</Text></View></View>) : <EmptyState icon="◷" title="No orders yet" caption="Once you place an order, you can follow its progress here." action="Explore products" onAction={browseAllCategories} />}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper }, content: { paddingBottom: 32 },
  back: { minHeight: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }, backIcon: { color: C.orange, fontSize: 19, fontFamily: 'Manrope' }, backLabel: { color: C.soft, fontSize: 13, fontWeight: '700', fontFamily: 'Manrope' },
  kicker: { marginTop: 22, marginHorizontal: 20, color: C.orange, fontWeight: '800', fontSize: 11, letterSpacing: 1.4, fontFamily: 'Manrope' }, title: { marginTop: 7, marginHorizontal: 20, color: C.ink, fontSize: 30, fontWeight: '800', fontFamily: 'Manrope' },
  caption: { marginTop: 6, marginHorizontal: 20, color: C.soft, fontSize: 14, lineHeight: 21, fontFamily: 'Manrope' }, loading: { margin: 22, color: C.soft, fontSize: 14, fontFamily: 'Manrope' }, error: { margin: 20, color: '#9A342E', fontSize: 13, fontFamily: 'Manrope' },
  order: { marginHorizontal: 18, marginTop: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16 }, orderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { color: C.ink, fontSize: 14, fontWeight: '900', fontFamily: 'Manrope' }, status: { backgroundColor: '#EAF3ED', color: '#285540', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, fontSize: 11, fontWeight: '900', overflow: 'hidden', fontFamily: 'Manrope' },
  date: { color: C.muted, fontSize: 12, marginTop: 6, fontFamily: 'Manrope' }, item: { color: C.soft, fontSize: 13, marginTop: 9, fontFamily: 'Manrope' }, totalRow: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 12, paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payment: { color: C.muted, fontSize: 11, flex: 1, fontFamily: 'Manrope' }, total: { color: C.ink, fontSize: 14, fontWeight: '900', fontFamily: 'Manrope' }, gate: { margin: 20, marginTop: 24, padding: 18, borderRadius: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, gap: 8 },
  gateTitle: { color: C.ink, fontWeight: '900', fontSize: 16, fontFamily: 'Manrope' }, button: { minHeight: 48, marginTop: 10, borderRadius: 13, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: C.white, fontWeight: '800', fontSize: 13, fontFamily: 'Manrope' },
});
