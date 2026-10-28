import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, C, DispatchNotice, EmptyState, ProductGrid, contentFrame } from '@/components/shop/ui';
import { useShop } from '@/features/shop/ShopContext';
import { useCatalog } from '@/features/shop/CatalogContext';
import { browseAllCategories } from '@/features/shop/navigation';

export default function SavedScreen() {
  const { favorites } = useShop();
  const { products } = useCatalog();
  const items = products.filter(product => favorites.includes(product.id));
  return <SafeAreaView style={styles.safe} edges={['top']}><AppHeader /><DispatchNotice /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><Text style={styles.kicker}>YOUR SHORTLIST</Text><Text style={styles.title}>Saved items</Text><Text style={styles.caption}>Keep the products you come back to close at hand.</Text>{items.length ? <View style={styles.grid}><ProductGrid items={items} /></View> : <EmptyState icon="♡" title="No saved items yet" caption="Tap the heart on a product to add it to your shortlist." action="Find a product" onAction={browseAllCategories} />}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  content: { ...contentFrame, paddingBottom: 96 },
  kicker: { marginTop: 26, marginHorizontal: 20, color: C.orange, fontWeight: '800', fontSize: 11, letterSpacing: 1.4, fontFamily: 'Manrope' },
  title: { marginTop: 7, marginHorizontal: 20, color: C.ink, fontSize: 30, fontWeight: '800', fontFamily: 'Manrope' },
  caption: { marginTop: 6, marginHorizontal: 20, color: C.soft, fontSize: 14, lineHeight: 21, fontFamily: 'Manrope' },
  grid: { paddingHorizontal: 18, marginTop: 20 },
});
