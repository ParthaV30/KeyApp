import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppHeader,
  C,
  CONTENT_MAX_WIDTH,
  CategoryCard,
  DispatchNotice,
  EmptyState,
  ProductCard,
  SearchBox,
  SectionTitle,
  contentFrame,
  useTileGrid,
} from '@/components/shop/ui';
import {
  brands,
  storeContact,
} from '@/data/products';
import { useCatalog } from '@/features/shop/CatalogContext';
import { browseAllCategories } from '@/features/shop/navigation';

const HERO_SLIDES = [
  {
    id: '1',
    kicker: 'THE HOUSE OF BLANK KEYS',
    title: '5,000+ Blank Keys,\nRemotes & Cutters',
    subtitle: 'Authorised distributors for 15+ premier locksmith brands.',
    cta: 'Browse catalog',
    image: require('../../../assets/images/catalog/max-pro.jpg'),
    bgColor: '#173B4B',
  },
  {
    id: '2',
    kicker: 'PROFESSIONAL MACHINES',
    title: 'Xhorse & Automatic\nKey Cutting Tools',
    subtitle: 'High precision cutters, clamps, and diagnostic tablets.',
    cta: 'Explore pro tools',
    image: require('../../../assets/images/catalog/keytool-plus.jpg'),
    bgColor: '#2C4652',
  },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const slideWidth = Math.min(width, CONTENT_MAX_WIDTH) - 36;
  const wideHero = slideWidth >= 640;
  const heroArtSize = wideHero ? Math.min(300, slideWidth * 0.36) : Math.round(slideWidth * 0.36);
  const { categories, products, error, loading } = useCatalog();
  const categoryGrid = useTileGrid();
  const brandGrid = useTileGrid(150);
  const [activeSlide, setActiveSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenWhatsApp = () => {
    Linking.openURL(storeContact.whatsappUrl).catch(() => {});
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      router.push({ pathname: '/categories', params: { query: searchQuery } });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <DispatchNotice />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[contentFrame, styles.scroll]}>
        {error ? (
          <Text style={styles.backendNotice}>Store connection notice: {error}</Text>
        ) : null}

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <SearchBox
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Search 5000+ blank keys, remotes, chips..."
          />
        </View>

        {/* Hero Slider */}
        <View style={styles.heroContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: slideWidth }}
            scrollEventThrottle={32}
            onScroll={(e) => {
              setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
            }}
          >
            {HERO_SLIDES.map((slide) => (
              <Pressable
                key={slide.id}
                onPress={browseAllCategories}
                style={({ pressed }) => [styles.heroCard, wideHero && styles.heroCardWide, { width: slideWidth, backgroundColor: slide.bgColor }, pressed && styles.pressedHero]}
                accessibilityRole="button"
                accessibilityLabel={`${slide.title.replace('\n', ' ')}. ${slide.cta}`}
              >
                <View style={[styles.heroContent, wideHero && { paddingRight: heroArtSize + 24 }]}>
                  <Text style={styles.heroKicker}>{slide.kicker}</Text>
                  <Text style={[styles.heroTitle, wideHero ? styles.heroTitleWide : width < 420 && styles.heroTitleSmall]}>{slide.title}</Text>
                  <Text style={[styles.heroSubtitle, !wideHero && { maxWidth: slideWidth - heroArtSize - 56 }]}>{slide.subtitle}</Text>
                  <View style={styles.heroActionBtn}>
                    <Text style={styles.heroActionText}>{slide.cta}</Text>
                    <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={C.ink} size={16} />
                  </View>
                </View>
                {/* Catalog photos have white backgrounds, so they sit on a white plate rather than floating on teal. */}
                <View style={[styles.heroPlate, { width: heroArtSize, height: heroArtSize }]}>
                  <Image source={slide.image} accessibilityLabel={slide.title.replace('\n', ' ')} style={styles.heroImage} contentFit="contain" />
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* Dots Indicator */}
          <View style={styles.dotsWrap}>
            {HERO_SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, activeSlide === i && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* Authorized Brands */}
        <View style={styles.brandsSection}>
          <View style={styles.brandHead}>
            <Text style={styles.brandKicker}>AUTHORISED DISTRIBUTOR FOR</Text>
          </View>
          <View style={styles.brandRail}>
            {brands.map((brand) => (
              <View key={brand.name} style={[styles.brandCard, { width: brandGrid.tileWidth }]}>
                <Image source={brand.image} style={styles.brandLogo} contentFit="contain" accessibilityLabel={`${brand.name} logo`} />
                <Text style={styles.brandPillText} numberOfLines={1}>{brand.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <SectionTitle
            title="Shop by category"
            action={`All ${categories.length}`}
            onAction={browseAllCategories}
          />
          <View style={styles.categoryGrid}>
            {categories.slice(0, categoryGrid.columns * 3).map((category) => (
              <CategoryCard
                key={category.name}
                category={category}
                compact
                width={categoryGrid.tileWidth}
                onPress={() =>
                  router.push({
                    pathname: '/categories',
                    params: { category: category.name },
                  })
                }
              />
            ))}
          </View>
        </View>

        {/* WhatsApp Direct Consult Banner */}
        <Pressable onPress={handleOpenWhatsApp} style={({ pressed }) => [styles.waCtaBanner, pressed && styles.pressedCard]} accessibilityRole="button">
          <View style={styles.waCtaLeft}>
            <View style={styles.waCtaIconWrap}>
              <SymbolView name={{ ios: 'message.fill', android: 'chat', web: 'chat' }} tintColor={C.white} size={19} />
            </View>
            <View style={styles.waCtaText}>
              <Text style={styles.waCtaTitle}>Need help finding a key or remote?</Text>
              <Text style={styles.waCtaSub}>Send key photos or part numbers on WhatsApp</Text>
            </View>
          </View>
          <View style={styles.waCtaBtn}>
            <Text style={styles.waCtaBtnText}>Chat Now</Text>
          </View>
        </Pressable>

        <View style={styles.trustStrip}>
          <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} tintColor={C.orange} size={21} />
          <Text style={styles.trustStripText}>Trusted by locksmiths across India</Text>
          <View style={styles.trustDivider} />
          <Text style={styles.trustYears}>9+ years</Text>
        </View>

        {/* Featured Products Rail (Top Selling) */}
        <View style={styles.section}>
          <SectionTitle
            title="Top Selling Hardware"
            action="See all"
            onAction={browseAllCategories}
          />
          {products.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productRail}
            >
              {products.slice(0, 6).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ScrollView>
          ) : (
            <EmptyState
              icon="⌕"
              title={loading ? 'Loading products' : 'New stock is being listed'}
              caption={loading ? 'Fetching the latest catalog.' : 'Message us on WhatsApp for prices and availability in the meantime.'}
              action={loading ? undefined : 'Ask on WhatsApp'}
              onAction={handleOpenWhatsApp}
            />
          )}
        </View>

        {/* New Arrival Highlight Banner */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/categories',
              params: { category: 'Remote Shell (Case)' },
            })
          }
          style={styles.promoBanner}
        >
          <View style={styles.promoTextWrap}>
            <Text style={styles.promoKicker}>NEW IN STOCK</Text>
            <Text style={styles.promoTitle}>Crosslink Wheels flip remotes & shells</Text>
            <Text style={styles.promoAction}>Shop New Arrivals →</Text>
          </View>
          <View style={styles.promoPlate}>
            <Image
              source={require('../../../assets/images/catalog/crosslink.jpg')}
              accessibilityLabel="Crosslink Wheels flip remote"
              style={styles.promoImage}
              contentFit="contain"
            />
          </View>
        </Pressable>

        {/* New Arrivals Rail */}
        {products.length > 6 ? (
          <View style={styles.section}>
            <SectionTitle
              title="New Arrivals"
              action="See all"
              onAction={browseAllCategories}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productRail}
            >
              {products.slice(6, 12).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerBrand}>Giriraja · Key Mitra</Text>
          <Text style={styles.footerText}>
            Wholesale & Retail Blank Keys, Flip Remotes, Chips & Machines
          </Text>
          <Text style={styles.footerText}>
            Phone: {storeContact.displayPhone} · Bengaluru, India
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  scroll: { paddingBottom: 112 },
  backendNotice: {
    color: '#9A521E',
    backgroundColor: '#FFF0E5',
    margin: 12,
    padding: 10,
    fontSize: 11,
    borderRadius: 8,
    fontFamily: 'Manrope',
  },
  searchSection: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 2,
  },
  heroContainer: {
    marginTop: 14,
    paddingHorizontal: 18,
  },
  heroCard: {
    minHeight: 268,
    borderRadius: 16,
    padding: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCardWide: { minHeight: 340, padding: 40, justifyContent: 'center' },
  heroContent: {
    zIndex: 1,
  },
  heroKicker: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontFamily: 'Manrope',
  },
  heroTitle: {
    color: C.white,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
    fontFamily: 'Manrope',
  },
  heroTitleSmall: { fontSize: 23, lineHeight: 28 },
  heroTitleWide: { fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 360,
    fontFamily: 'Manrope',
  },
  heroActionBtn: {
    backgroundColor: C.white,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 18,
  },
  heroActionText: {
    color: C.ink,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Manrope',
  },
  heroPlate: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    backgroundColor: C.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: { width: '88%', height: '88%' },
  pressedHero: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  pressedCard: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  dotsWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 18,
    backgroundColor: C.teal,
  },
  waCtaBanner: {
    marginHorizontal: 18,
    marginTop: 18,
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  waCtaIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waCtaText: { flex: 1 },
  waCtaTitle: {
    color: C.ink,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Manrope',
  },
  waCtaSub: {
    color: C.soft,
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'Manrope',
  },
  waCtaBtn: {
    minHeight: 44,
    backgroundColor: C.green,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  waCtaBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'Manrope',
  },
  trustStrip: {
    marginTop: 12,
    marginHorizontal: 20,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#EEE8DB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  trustStripText: { color: C.ink, fontSize: 12, fontWeight: '700', flex: 1, fontFamily: 'Manrope' },
  trustDivider: { width: 1, height: 20, backgroundColor: '#D2C8B7' },
  trustYears: { color: C.teal, fontSize: 12, fontWeight: '800', fontFamily: 'Manrope' },
  section: {
    marginTop: 26,
    paddingHorizontal: 18,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  promoBanner: {
    minHeight: 164,
    marginHorizontal: 18,
    marginTop: 24,
    borderRadius: 16,
    padding: 20,
    gap: 14,
    backgroundColor: '#ECE5D8',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoTextWrap: { flex: 1 },
  promoKicker: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: 'Manrope',
  },
  promoTitle: {
    color: C.ink,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
    marginTop: 4,
    fontFamily: 'Manrope',
  },
  promoAction: {
    color: C.teal,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
    fontFamily: 'Manrope',
  },
  promoPlate: {
    width: 124,
    height: 124,
    borderRadius: 12,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  promoImage: { width: '90%', height: '90%' },
  productRail: { paddingRight: 16 },
  brandsSection: {
    marginTop: 26,
    paddingHorizontal: 18,
  },
  brandHead: {
    marginBottom: 10,
  },
  brandKicker: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: 'Manrope',
  },
  brandRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  brandCard: {
    height: 84,
    backgroundColor: C.white,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: { width: '86%', height: 46, marginBottom: 4 },
  brandPillText: {
    color: C.soft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontFamily: 'Manrope',
  },
  footerWrap: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
    gap: 3,
  },
  footerBrand: {
    color: C.ink,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Manrope',
  },
  footerText: {
    color: C.soft,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Manrope',
  },
});
