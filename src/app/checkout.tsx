import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '@/components/shop/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useCatalog } from '@/features/shop/CatalogContext';
import { useShop } from '@/features/shop/ShopContext';
import { supabase } from '@/lib/supabase';
import { safeBack } from '@/lib/safeBack';
import { validateShipping } from '@/lib/validation';

export default function CheckoutScreen() {
  const { session } = useAuth();
  const { products, variants, settings } = useCatalog();
  const { cart, setQuantity } = useShop();
  const [name, setName] = useState(String(session?.user.user_metadata?.display_name ?? ''));
  const [phone, setPhone] = useState(String(session?.user.phone ?? ''));
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const items = Object.entries(cart).map(([key, quantity]) => {
    const [productId, variantId] = key.split('::');
    return { key, product: products.find(item => item.id === productId), variant: variantId ? variants.find(item => item.id === variantId) : undefined, quantity };
  }).filter((item): item is { key: string; product: (typeof products)[number]; variant: (typeof variants)[number] | undefined; quantity: number } => Boolean(item.product));
  const unavailable = items.find(item => item.product.hasVariants ? !item.variant || item.variant.stockQuantity < item.quantity : !item.product.stockQuantity || item.product.stockQuantity < item.quantity);
  const subtotal = items.reduce((sum, item) => sum + (item.variant?.price ?? (item.product.hasVariants ? 0 : item.product.price)) * item.quantity, 0);
  const shippingFee = settings.freeDeliveryThreshold !== null && subtotal >= settings.freeDeliveryThreshold ? 0 : settings.shippingFee;
  const total = subtotal + shippingFee;

  const placeOrder = async () => {
    if (submitting.current) return;
    if (!session) { router.push('/auth'); return; }
    if (!supabase) { Alert.alert('Store setup needed', 'Connect this app to the store database before placing an order.'); return; }
    if (!items.length) { Alert.alert('Cart is empty', 'Add a product before checkout.'); return; }
    if (unavailable) { Alert.alert('Item needs attention', `${unavailable.product.name} needs an option selected or is out of stock. Remove it or contact the store.`); return; }
    const validationError = validateShipping({ name, phone, address, city, state, postalCode, gstin: buyerGstin, note });
    if (validationError) { Alert.alert('Check delivery details', validationError); return; }
    submitting.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('place_cod_order', {
        p_items: items.map(({ product, variant, quantity }) => ({ product_id: product.id, variant_id: variant?.id, quantity })),
        p_shipping: { name: name.trim(), phone: phone.trim(), address: address.trim(), city: city.trim(), state: state.trim(), postal_code: postalCode.trim(), gstin: buyerGstin.trim().toUpperCase() },
        p_note: note.trim(),
      });
      if (error) {
        // P0001 = a deliberate message raised by place_cod_order (bad state, too many pending orders, stock).
        Alert.alert('Order could not be placed', `${error.code === 'P0001' && error.message ? `${error.message}. ` : 'Please check your delivery details and stock, then try again. '}Your order was not submitted.`);
        if (__DEV__) console.warn('Order placement failed.', error.code ?? 'unknown');
        return;
      }
      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.order_id || !created.order_number) {
        Alert.alert('Order status is unclear', 'Check My Orders before trying again so you do not accidentally submit a duplicate.');
        return;
      }
      for (const productId of Object.keys(cart)) setQuantity(productId, 0);
      Alert.alert('Order placed', `Order #${created.order_number} is confirmed for cash on delivery.`);
      router.replace('/orders');
    } catch {
      Alert.alert('Connection problem', 'We could not confirm the order. Check My Orders before trying again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  if (!session) return <SafeAreaView style={styles.safe}><View style={styles.gate}><Text style={styles.title}>Sign in to check out</Text><Text style={styles.caption}>Your order history will be saved to your account.</Text><Pressable style={styles.submit} onPress={() => router.push('/auth')}><Text style={styles.submitText}>Sign in or create an account</Text></Pressable></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => safeBack('/(tabs)/cart')} style={styles.back}><Text style={styles.backText}>←  Cart</Text></Pressable><Text style={styles.kicker}>CHECKOUT</Text><Text style={styles.title}>Delivery details</Text><Text style={styles.caption}>Your order will be paid in cash when it arrives.</Text>
    {unavailable && <Text style={styles.warning}>{unavailable.product.hasVariants ? `${unavailable.product.name} has options that are not configured yet.` : `${unavailable.product.name} is currently out of stock.`} Remove it from your cart or contact the store before checkout.</Text>}
    <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" /><Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><Field label="Address" value={address} onChangeText={setAddress} multiline /><Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" /><View style={styles.split}><View style={styles.splitField}><Field label="State" value={state} onChangeText={setState} autoCapitalize="words" /></View><View style={styles.splitField}><Field label="Postal code" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" /></View></View><Field label="Buyer GSTIN (optional)" value={buyerGstin} onChangeText={setBuyerGstin} autoCapitalize="characters" /><Field label="Order note (optional)" value={note} onChangeText={setNote} multiline />
    <View style={styles.summary}><View style={styles.summaryLine}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>₹{subtotal.toLocaleString('en-IN')}</Text></View><View style={styles.summaryLine}><Text style={styles.summaryLabel}>Delivery</Text><Text style={styles.summaryValue}>{shippingFee ? `₹${shippingFee.toLocaleString('en-IN')}` : 'Free'}</Text></View><View style={styles.summaryLine}><Text style={styles.totalLabel}>Order total</Text><Text style={styles.totalValue}>₹{total.toLocaleString('en-IN')}</Text></View><Text style={styles.summaryNote}>Final price and availability are recalculated by the store when you submit.</Text></View>
    <View style={styles.cod}><Text style={styles.codTitle}>Cash on delivery</Text><Text style={styles.codCopy}>Pay the delivery person in cash when your order arrives.</Text></View>
    <Pressable disabled={busy || Boolean(unavailable) || !items.length} style={[styles.submit, (busy || Boolean(unavailable) || !items.length) && styles.disabled]} onPress={() => void placeOrder()}><Text style={styles.submitText}>{busy ? 'Placing order…' : 'Place COD order'}</Text></Pressable>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} style={[styles.input, props.multiline && styles.multiline]} placeholder={label} placeholderTextColor="#9BA3A6" autoCorrect={false} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper }, flex: { flex: 1 }, content: { padding: 22, paddingBottom: 36 },
  gate: { flex: 1, justifyContent: 'center', padding: 26, gap: 12 }, back: { minHeight: 48, justifyContent: 'center' }, backText: { color: C.soft, fontSize: 13, fontWeight: '800', fontFamily: 'Manrope' },
  kicker: { color: C.orange, fontSize: 11, fontWeight: '900', letterSpacing: 1.3, marginTop: 14, fontFamily: 'Manrope' }, title: { color: C.ink, fontSize: 30, fontWeight: '900', marginTop: 6, fontFamily: 'Manrope' },
  caption: { color: C.soft, fontSize: 14, lineHeight: 21, marginBottom: 14, fontFamily: 'Manrope' }, warning: { color: '#714F2C', backgroundColor: '#F8EBDD', padding: 14, borderRadius: 13, fontSize: 13, lineHeight: 19, marginBottom: 10, fontFamily: 'Manrope' },
  field: { marginTop: 13, gap: 7 }, label: { color: C.ink, fontSize: 13, fontWeight: '800', fontFamily: 'Manrope' }, input: { borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 13, paddingHorizontal: 13, minHeight: 50, color: C.ink, fontSize: 15, fontFamily: 'Manrope' },
  multiline: { minHeight: 74, textAlignVertical: 'top', paddingTop: 12 }, split: { flexDirection: 'row', gap: 10 }, splitField: { flex: 1 },
  summary: { marginTop: 18, padding: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 15, gap: 10 }, summaryLine: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: C.soft, fontSize: 13, fontFamily: 'Manrope' }, summaryValue: { color: C.ink, fontSize: 13, fontWeight: '800', fontFamily: 'Manrope' }, totalLabel: { color: C.ink, fontSize: 14, fontWeight: '900', fontFamily: 'Manrope' }, totalValue: { color: C.ink, fontSize: 16, fontWeight: '900', fontFamily: 'Manrope' },
  summaryNote: { color: C.soft, fontSize: 11, lineHeight: 17, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 9, fontFamily: 'Manrope' },
  cod: { marginTop: 12, padding: 15, backgroundColor: '#EAF3ED', borderRadius: 13 }, codTitle: { color: '#285540', fontSize: 14, fontWeight: '900', fontFamily: 'Manrope' }, codCopy: { color: '#436E56', fontSize: 12, lineHeight: 18, marginTop: 5, fontFamily: 'Manrope' },
  submit: { marginTop: 20, minHeight: 52, backgroundColor: C.teal, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, submitText: { color: C.white, fontSize: 14, fontWeight: '900', fontFamily: 'Manrope' }, disabled: { opacity: 0.45 },
});
