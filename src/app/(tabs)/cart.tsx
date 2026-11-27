import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, C, DispatchNotice, EmptyState, contentFrame } from '@/components/shop/ui';
import { useShop } from '@/features/shop/ShopContext';
import { useCatalog } from '@/features/shop/CatalogContext';
import { browseAllCategories } from '@/features/shop/navigation';

const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export default function CartScreen() {
  const { cart, setQuantity } = useShop();
  const { products, variants } = useCatalog();
  const items = Object.entries(cart).map(([key, quantity]) => {
    const [id, variantId] = key.split('::');
    return { key, product: products.find(item => item.id === id), variant: variantId ? variants.find(item => item.id === variantId) : undefined, quantity };
  }).filter((item): item is { key: string; product: (typeof products)[number]; variant: (typeof variants)[number] | undefined; quantity: number } => Boolean(item.product));
  const subtotal = items.reduce((sum, item) => sum + (item.variant?.price ?? (item.product.hasVariants ? 0 : item.product.price)) * item.quantity, 0);
  const hasVariablePrice = items.some(item => item.product.hasVariants && !item.variant);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader /><DispatchNotice />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>YOUR SELECTION</Text><Text style={styles.title}>Your cart <Text style={styles.count}>{items.length}</Text></Text><Text style={styles.caption}>Check your items before placing an order.</Text>
        {items.length ? <>
          <View style={styles.items}>{items.map(({ key, product, variant, quantity }) => <View key={key} style={styles.item}>
            <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })} style={styles.imageBox}><Image source={product.image} accessibilityLabel={product.name} style={styles.image} contentFit="contain" transition={180} /></Pressable>
            <View style={styles.itemDetails}><Text style={styles.itemName} numberOfLines={2}>{product.name}{variant ? ` · ${variant.name}` : ''}</Text><Text style={styles.itemCategory}>{product.category}</Text><Text style={styles.itemPrice}>{variant ? money(variant.price) : product.priceLabel}</Text><View style={styles.stepper}><Pressable accessibilityLabel="Decrease quantity" onPress={() => setQuantity(key, quantity - 1)} style={styles.stepperButton}><Text style={styles.stepperGlyph}>−</Text></Pressable><Text style={styles.quantity}>{quantity}</Text><Pressable accessibilityLabel="Increase quantity" onPress={() => setQuantity(key, quantity + 1)} style={styles.stepperButton}><Text style={styles.stepperGlyph}>+</Text></Pressable></View></View>
            <Pressable accessibilityLabel={`Remove ${product.name}`} onPress={() => setQuantity(key, 0)} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable>
          </View>)}</View>
          <View style={styles.summary}><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>{money(subtotal)}</Text></View><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery</Text><Text style={styles.deliveryValue}>Confirmed by the store</Text></View><Text style={styles.summaryNote}>{hasVariablePrice ? 'Items with variable pricing need a product option before they can be ordered. ' : ''}Cash on delivery · Taxes and delivery charges will be confirmed with your order.</Text><Pressable onPress={() => router.push('/checkout')} style={styles.checkout}><Text style={styles.checkoutText}>Continue to checkout  →</Text></Pressable><Pressable onPress={browseAllCategories} style={styles.continue}><Text style={styles.continueText}>←  Continue shopping</Text></Pressable></View>
        </> : <EmptyState icon="▱" title="Your cart is waiting" caption="Explore the catalog and add the essentials you need." action="Browse catalog" onAction={browseAllCategories} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  content: { ...contentFrame, paddingBottom: 96 },
  kicker: { marginTop: 26, marginHorizontal: 20, color: C.orange, fontWeight: '800', fontSize: 11, letterSpacing: 1.4, fontFamily: 'Manrope' },
  title: { marginTop: 7, marginHorizontal: 20, color: C.ink, fontSize: 30, fontWeight: '800', fontFamily: 'Manrope' },
  count: { fontSize: 13, color: C.orange, backgroundColor: '#EEE8DB', overflow: 'hidden', paddingHorizontal: 9, borderRadius: 12, fontFamily: 'Manrope' },
  caption: { marginTop: 6, marginHorizontal: 20, color: C.soft, fontSize: 14, lineHeight: 21, fontFamily: 'Manrope' },
  items: { marginHorizontal: 18, marginTop: 20, gap: 10 },
  item: { flexDirection: 'row', padding: 12, borderRadius: 17, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, gap: 12, position: 'relative', minHeight: 120 },
  imageBox: { width: 90, height: 96, backgroundColor: C.paper, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  itemDetails: { flex: 1, paddingRight: 28, alignItems: 'flex-start' },
  itemName: { fontSize: 13, color: C.ink, fontWeight: '800', lineHeight: 18, marginTop: 1, fontFamily: 'Manrope' },
  itemCategory: { color: C.muted, fontSize: 11, marginTop: 4, fontFamily: 'Manrope' },
  itemPrice: { color: C.ink, fontSize: 13, fontWeight: '800', marginTop: 8, fontFamily: 'Manrope' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, borderColor: C.line, borderWidth: 1, borderRadius: 11, padding: 4, marginTop: 8 },
  stepperButton: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center' },
  stepperGlyph: { color: C.teal, fontSize: 19, fontFamily: 'Manrope' },
  quantity: { minWidth: 16, textAlign: 'center', color: C.ink, fontSize: 13, fontWeight: '700', fontFamily: 'Manrope' },
  remove: { position: 'absolute', right: 8, top: 5, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: C.muted, fontSize: 21, fontFamily: 'Manrope' },
  summary: { marginHorizontal: 18, marginTop: 16, borderRadius: 17, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, padding: 18 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 },
  summaryLabel: { color: C.soft, fontSize: 13, fontFamily: 'Manrope' },
  summaryValue: { color: C.ink, fontSize: 14, fontWeight: '900', fontFamily: 'Manrope' },
  deliveryValue: { color: C.muted, fontSize: 12, fontFamily: 'Manrope' },
  summaryNote: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, marginTop: 10, marginBottom: 14, color: C.soft, fontSize: 11, lineHeight: 17, fontFamily: 'Manrope' },
  checkout: { minHeight: 52, backgroundColor: C.teal, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  checkoutText: { color: C.white, fontSize: 14, fontWeight: '800', fontFamily: 'Manrope' },
  continue: { alignItems: 'center', paddingTop: 14, minHeight: 48, justifyContent: 'center' },
  continueText: { color: C.soft, fontSize: 12, fontWeight: '700', fontFamily: 'Manrope' },
});
