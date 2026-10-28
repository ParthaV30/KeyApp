import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, C, CategoryCard, DispatchNotice, EmptyState, ProductGrid, SearchBox, SectionTitle, contentFrame, useTileGrid } from '@/components/shop/ui';
import { useCatalog } from '@/features/shop/CatalogContext';

export default function CategoriesScreen() {
  const params = useLocalSearchParams<{ category?: string; query?: string }>();
  // The selected category lives in the URL, not local state: the tab screen stays mounted, so a plain
  // link to /categories (e.g. "Find a product") must be able to reset it back to all categories.
  return (
    <CategoriesContent
      key={params.query ?? ''}
      activeCategory={params.category ?? ''}
      initialQuery={params.query ?? ''}
    />
  );
}

const setActiveCategory = (category: string) => router.setParams({ category: category || undefined });

function CategoriesContent({
  activeCategory,
  initialQuery = '',
}: {
  activeCategory: string;
  initialQuery?: string;
}) {
  const { categories, products } = useCatalog();
  const [query, setQuery] = useState(initialQuery);
  const { tileWidth } = useTileGrid();
  const filtered = useMemo(() => products.filter(product => (!activeCategory || product.category === activeCategory) && (!query || `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase()))), [activeCategory, query, products]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader /><DispatchNotice />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>FIND YOUR AISLE</Text><Text style={styles.title}>{activeCategory || 'Categories'}</Text><Text style={styles.caption}>{activeCategory ? 'Explore products in this collection.' : 'Browse the essentials by what you’re looking for.'}</Text>
        <View style={styles.search}><SearchBox value={query} onChangeText={setQuery} /></View>
        {!activeCategory && <View style={styles.categoryArea}><SectionTitle title="Browse categories" /><View style={styles.categoryGrid}>{categories.map(category => <CategoryCard key={category.name} category={category} compact width={tileWidth} onPress={() => setActiveCategory(category.name)} />)}</View></View>}
        <View style={styles.resultHead}><SectionTitle title={activeCategory ? 'In this collection' : 'Popular products'} action={activeCategory ? 'Clear' : undefined} onAction={() => setActiveCategory('')} /></View>
        {filtered.length ? <View style={styles.grid}><ProductGrid items={filtered} /></View> : <EmptyState icon="⌕" title="No matching products" caption="Try another search or choose a different category." action="Clear filters" onAction={() => { setActiveCategory(''); setQuery(''); }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  content: { ...contentFrame, paddingBottom: 96 },
  kicker: { marginTop: 26, marginHorizontal: 20, color: C.orange, fontWeight: '800', fontSize: 11, letterSpacing: 1.4, fontFamily: 'Manrope' },
  title: { marginTop: 7, marginHorizontal: 20, color: C.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, fontFamily: 'Manrope' },
  caption: { marginTop: 6, marginHorizontal: 20, color: C.soft, fontSize: 14, lineHeight: 21, fontFamily: 'Manrope' },
  search: { marginHorizontal: 18, marginTop: 18 },
  categoryArea: { marginTop: 26, paddingHorizontal: 18 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  resultHead: { marginTop: 24, paddingHorizontal: 18 },
  grid: { paddingHorizontal: 18 },
});
