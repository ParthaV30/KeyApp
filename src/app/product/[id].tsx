import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { C } from '@/components/shop/ui';
import { useShop } from '@/features/shop/ShopContext';
import { useCatalog } from '@/features/shop/CatalogContext';
import { safeBack } from '@/lib/safeBack';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, variants } = useCatalog();
  const product = products.find(item => item.id === String(id));
  const { favorites, addToCart, toggleFavorite } = useShop();
  const [quantity, setQuantity] = useState(1);
  const productVariants = variants.filter(item => item.productId === product?.id);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const selectedVariant = productVariants.find(item => item.id === selectedVariantId);
  if (!product) return <SafeAreaView style={styles.safe}><View style={styles.notFound}><Text style={styles.notFoundTitle}>Product not found</Text><Pressable onPress={() => safeBack('/(tabs)')}><Text style={styles.backText}>Go back</Text></Pressable></View></SafeAreaView>;
  const saved = favorites.includes(product.id);
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View style={styles.topRow}><Pressable onPress={() => safeBack('/(tabs)')} style={styles.backButton}><Text style={styles.backIcon}>←</Text><Text style={styles.backLabel}>Back to products</Text></Pressable><Pressable onPress={() => toggleFavorite(product.id)} style={styles.heart}><Text style={[styles.heartText, saved && styles.heartSaved]}>{saved ? '♥' : '♡'}</Text></Pressable></View>
    <View style={styles.imageFrame}><View style={styles.tag}><Text style={styles.tagText}>{product.tag ?? 'KEY MITRA PICK'}</Text></View><Image source={product.image} accessibilityLabel={product.name} style={styles.productImage} contentFit="contain" transition={180} /></View>
    <View style={styles.details}><Text style={styles.category}>{product.category}</Text><Text style={styles.title}>{product.name}</Text><Text style={styles.price}>{selectedVariant ? `₹${selectedVariant.price.toLocaleString('en-IN')}` : product.priceLabel}</Text><Text style={styles.tax}>Inclusive of applicable taxes</Text><View style={styles.rule} /><Text style={styles.sectionTitle}>Product details</Text><Text style={styles.description}>{product.description}</Text><View style={styles.bullet}><Text style={styles.bulletDot}>•</Text><Text style={styles.bulletText}>Quality checked by our team</Text></View><View style={styles.bullet}><Text style={styles.bulletDot}>•</Text><Text style={styles.bulletText}>Ready for dispatch from Bengaluru</Text></View>
      {product.hasVariants && productVariants.length > 0 && <View style={styles.variants}><Text style={styles.sectionTitle}>Choose an option</Text>{productVariants.map(variant => <Pressable key={variant.id} onPress={() => setSelectedVariantId(variant.id)} style={[styles.variantOption, selectedVariantId === variant.id && styles.variantSelected]}><View style={styles.variantCopy}><Text style={styles.variantName}>{variant.name}</Text><Text style={styles.variantPrice}>₹{variant.price.toLocaleString('en-IN')} · {variant.stockQuantity > 0 ? `${variant.stockQuantity} available` : 'Out of stock'}</Text></View><Text style={styles.variantRadio}>{selectedVariantId === variant.id ? '●' : '○'}</Text></Pressable>)}</View>}
      {product.hasVariants && productVariants.length === 0 && <Text style={styles.rangeNote}>Options and pricing are being updated. Contact the store for availability.</Text>}
      {product.hasVariants && productVariants.length === 0 ? <Pressable style={styles.addButton} onPress={() => Linking.openURL(`https://wa.me/917022225055?text=${encodeURIComponent(`Hi, I need price and option details for ${product.name}.`)}`)}><Text style={styles.addText}>Ask on WhatsApp</Text></Pressable> : <View style={styles.purchase}><View style={styles.stepper}><Pressable onPress={() => setQuantity(Math.max(1, quantity - 1))} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.quantity}>{quantity}</Text><Pressable onPress={() => setQuantity(quantity + 1)} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View><Pressable disabled={(product.hasVariants && (!selectedVariant || selectedVariant.stockQuantity < quantity)) || (!product.hasVariants && product.stockQuantity !== undefined && product.stockQuantity < quantity)} onPress={() => { addToCart(product.hasVariants && selectedVariant ? `${product.id}::${selectedVariant.id}` : product.id, quantity); Alert.alert('Added to cart', `${product.name} is in your cart.`); }} style={[styles.addButton, ((product.hasVariants && (!selectedVariant || selectedVariant.stockQuantity < quantity)) || (!product.hasVariants && product.stockQuantity !== undefined && product.stockQuantity < quantity)) && { opacity: 0.45 }]}><Text style={styles.addText}>{product.hasVariants && selectedVariant ? selectedVariant.stockQuantity === 0 ? 'Out of stock' : 'Add selected option' : product.stockQuantity === 0 ? 'Out of stock' : 'Add to cart  →'}</Text></Pressable></View>}
    </View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper }, content: { paddingBottom: 32 },
  topRow: { paddingHorizontal: 20, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9 }, backIcon: { color: C.orange, fontSize: 19, fontWeight: '700', fontFamily: 'Manrope' }, backLabel: { color: C.soft, fontSize: 13, fontWeight: '700', fontFamily: 'Manrope' },
  heart: { width: 48, height: 48, backgroundColor: C.white, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, heartText: { fontSize: 21, color: C.soft, fontFamily: 'Manrope' }, heartSaved: { color: C.red },
  imageFrame: { height: 300, marginHorizontal: 18, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, productImage: { width: '88%', height: '88%' },
  tag: { position: 'absolute', zIndex: 1, top: 14, left: 14, backgroundColor: '#F4E8D2', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 }, tagText: { color: C.ink, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, fontFamily: 'Manrope' },
  details: { paddingHorizontal: 20, paddingTop: 21 }, category: { color: C.soft, fontSize: 12, fontFamily: 'Manrope' },
  title: { color: C.ink, fontSize: 24, fontWeight: '900', lineHeight: 31, letterSpacing: -0.4, marginTop: 10, fontFamily: 'Manrope' }, price: { color: C.ink, fontSize: 23, fontWeight: '900', marginTop: 12, fontFamily: 'Manrope' }, tax: { color: C.muted, fontSize: 12, marginTop: 4, fontFamily: 'Manrope' }, rule: { height: 1, backgroundColor: C.line, marginVertical: 19 }, sectionTitle: { color: C.ink, fontSize: 16, fontWeight: '800', fontFamily: 'Manrope' }, description: { color: C.soft, fontSize: 14, lineHeight: 21, marginTop: 7, fontFamily: 'Manrope' },
  bullet: { flexDirection: 'row', gap: 8, marginTop: 9, alignItems: 'center' }, bulletDot: { color: C.green, fontSize: 15, fontFamily: 'Manrope' }, bulletText: { color: C.soft, fontSize: 13, fontFamily: 'Manrope' },
  rangeNote: { color: '#714F2C', fontSize: 13, lineHeight: 19, backgroundColor: '#F8EBDD', borderRadius: 13, padding: 13, marginTop: 14, fontFamily: 'Manrope' }, variants: { gap: 9, marginTop: 18 },
  variantOption: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 }, variantSelected: { borderColor: C.teal, backgroundColor: '#EEF3F3' }, variantCopy: { gap: 5 }, variantName: { color: C.ink, fontSize: 14, fontWeight: '800', fontFamily: 'Manrope' }, variantPrice: { color: C.soft, fontSize: 12, fontFamily: 'Manrope' }, variantRadio: { color: C.teal, fontSize: 17, fontFamily: 'Manrope' },
  purchase: { flexDirection: 'row', gap: 10, marginTop: 19, alignItems: 'center' }, stepper: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 7 }, stepButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }, stepText: { fontSize: 20, color: C.ink, fontFamily: 'Manrope' }, quantity: { minWidth: 22, textAlign: 'center', color: C.ink, fontSize: 14, fontWeight: '800', fontFamily: 'Manrope' },
  addButton: { flex: 1, height: 52, backgroundColor: C.teal, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 2 }, addText: { color: C.white, fontSize: 14, fontWeight: '800', fontFamily: 'Manrope' }, notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, notFoundTitle: { color: C.ink, fontSize: 20, fontWeight: '800', fontFamily: 'Manrope' }, backText: { color: C.teal, fontSize: 14, fontWeight: '700', fontFamily: 'Manrope' },
});
