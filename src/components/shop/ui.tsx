import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Linking, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import type { Product, ProductCategory } from '@/data/products';
import { storeContact } from '@/data/products';
import { useCatalog } from '@/features/shop/CatalogContext';
import { useShop } from '@/features/shop/ShopContext';

export const C = {
  paper: '#F6F4EF',
  white: '#FFFFFF',
  ink: '#183344',
  soft: '#52636E',
  muted: '#5F6C72',
  red: '#B63B32',
  crimson: '#9F302B',
  orange: '#835C1E',
  flame: '#C66B42',
  amber: '#B98635',
  line: '#E7E2D9',
  teal: '#183B4B',
  green: '#1B7A51',
  gold: '#D8B66F',
  stone: '#F1EEE7',
};

// Caps content on wide (desktop web) screens so rows don't stretch edge to edge.
export const CONTENT_MAX_WIDTH = 1120;
export const contentFrame = { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' } as const;

// Fits as many columns as possible at `minTile` width inside the capped content area; 3 is the phone minimum.
export function useTileGrid(minTile = 112, gap = 10, horizontalPadding = 36) {
  const { width } = useWindowDimensions();
  const available = Math.min(width, CONTENT_MAX_WIDTH) - horizontalPadding;
  const columns = Math.max(3, Math.floor((available + gap) / (minTile + gap)));
  return { columns, tileWidth: Math.floor((available - gap * (columns - 1)) / columns) };
}

const emptySymbols: Record<string, React.ComponentProps<typeof SymbolView>['name']> = {
  '▱': { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  '⌕': { ios: 'magnifyingglass', android: 'search', web: 'search' },
  '♡': { ios: 'heart', android: 'favorite', web: 'favorite' },
  '◷': { ios: 'clock', android: 'schedule', web: 'schedule' },
};

const categorySymbols: Record<string, React.ComponentProps<typeof SymbolView>['name']> = {
  '🗡️': { ios: 'key.horizontal.fill', android: 'vpn_key', web: 'vpn_key' },
  '✂️': { ios: 'scissors', android: 'content_cut', web: 'content_cut' },
  '🚗': { ios: 'car.fill', android: 'directions_car', web: 'directions_car' },
  '📱': { ios: 'iphone', android: 'smartphone', web: 'smartphone' },
  '🏷️': { ios: 'tag.fill', android: 'sell', web: 'sell' },
  '📻': { ios: 'antenna.radiowaves.left.and.right', android: 'radio', web: 'radio' },
  '🔑': { ios: 'key.fill', android: 'key', web: 'key' },
  '⚙️': { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  '📟': { ios: 'keyboard.fill', android: 'devices', web: 'devices' },
  '💾': { ios: 'memorychip', android: 'memory', web: 'memory' },
  '🏍️': { ios: 'bicycle', android: 'two_wheeler', web: 'two_wheeler' },
  '💻': { ios: 'laptopcomputer', android: 'computer', web: 'computer' },
  '⚡': { ios: 'bolt.fill', android: 'flash_on', web: 'flash_on' },
  '🔧': { ios: 'wrench.and.screwdriver.fill', android: 'build', web: 'build' },
  '🔓': { ios: 'lock.open.fill', android: 'lock_open', web: 'lock_open' },
  '💎': { ios: 'diamond.fill', android: 'diamond', web: 'diamond' },
  '🔌': { ios: 'cable.connector', android: 'cable', web: 'cable' },
  '🔘': { ios: 'circle.inset.filled', android: 'radio_button_checked', web: 'radio_button_checked' },
  '🔋': { ios: 'battery.100percent', android: 'battery_full', web: 'battery_full' },
  '⌨️': { ios: 'keyboard', android: 'keyboard', web: 'keyboard' },
  '🛡️': { ios: 'shield.fill', android: 'shield', web: 'shield' },
  '✨': { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
};

export function Page({ children, padded = true }: React.PropsWithChildren<{ padded?: boolean }>) {
  return <View style={[styles.page, padded && styles.padded]}>{children}</View>;
}

export function AppHeader() {
  const { cartCount } = useShop();

  const handleWhatsApp = () => {
    Linking.openURL(storeContact.whatsappUrl).catch(() => {});
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <View style={styles.headerSide}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open account"
            onPress={() => router.navigate('/account')}
            style={({ pressed }) => [styles.headerIcon, pressed && styles.pressedControl]}
          >
            <SymbolView name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }} tintColor={C.ink} size={23} />
          </Pressable>
        </View>

        <Image
          source={require('../../../assets/images/giriraja-logo.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Giriraja"
        />

        <View style={[styles.headerSide, styles.headerRight]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chat on WhatsApp"
            onPress={handleWhatsApp}
            style={({ pressed }) => [styles.headerIcon, pressed && styles.pressedControl]}
          >
            <SymbolView name={{ ios: 'message', android: 'chat', web: 'chat' }} tintColor={C.green} size={21} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open cart, ${cartCount} items`}
            onPress={() => router.navigate('/cart')}
            style={({ pressed }) => [styles.headerIcon, pressed && styles.pressedControl]}
          >
            <SymbolView name={{ ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' }} tintColor={C.ink} size={21} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function DispatchNotice() {
  const { settings } = useCatalog();
  const [hour, minute] = settings.dispatchCutoff.split(':').map(Number);
  const cutoff = Number.isFinite(hour)
    ? `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour >= 12 ? 'PM' : 'AM'}`
    : '6 PM';

  return (
    <View style={styles.noticeMarquee}>
      <View style={styles.livePulse} />
      <Text style={styles.noticeMarqueeText} numberOfLines={1}>
        Order before <Text style={styles.noticeMarqueeBold}>{cutoff}</Text> for same-day dispatch
      </Text>
    </View>
  );
}

export function SearchBox({
  value,
  onChangeText,
  placeholder = 'Search 5000+ blank keys, remotes, machines...',
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.searchBox}>
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={C.muted} size={19} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        accessibilityLabel="Search products"
        placeholderTextColor="#8E9CAE"
        style={styles.searchInput}
        returnKeyType="search"
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action} →</Text>
        </Pressable>
      )}
    </View>
  );
}

export function CategoryCard({
  category,
  onPress,
  compact = false,
  width,
}: {
  category: ProductCategory;
  onPress: () => void;
  compact?: boolean;
  width?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.categoryCard, compact && styles.categoryCardCompact, width ? { width } : null, pressed && styles.pressedCard]}
      accessibilityRole="button"
      accessibilityLabel={`Category ${category.name}`}
    >
      <View style={[styles.categoryArt, compact ? styles.categoryArtCompact : styles.categoryArtStandard]}>
        {category.imageUrl || category.image ? (
          <Image source={category.imageUrl || category.image} style={styles.categoryImage} contentFit="cover" transition={180} accessibilityLabel={`${category.name} category`} />
        ) : (
          <SymbolView
            name={categorySymbols[category.icon] ?? { ios: 'key.fill', android: 'key', web: 'key' }}
            tintColor={C.teal}
            size={compact ? 28 : 25}
          />
        )}
      </View>
      <Text style={styles.categoryName} numberOfLines={2}>
        {category.name}
      </Text>
      {/* "0 products" reads as a broken store, so empty counts are hidden. */}
      {category.count && !category.count.startsWith('0 ') ? (
        <Text style={styles.categoryCaption} numberOfLines={1}>
          {category.count}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ProductCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const { favorites, addToCart, toggleFavorite } = useShop();
  const saved = favorites.includes(product.id);
  const hasRange = product.hasVariants || product.priceLabel.includes('–');
  const canAdd = !product.hasVariants && (product.stockQuantity === undefined || product.stockQuantity > 0);

  return (
    <View style={[styles.productCard, compact && styles.productCardCompact]}>
      <Pressable
        onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
        style={({ pressed }) => [styles.productOpen, pressed && styles.pressedProduct]}
        accessibilityRole="button"
        accessibilityLabel={`View ${product.name}`}
      >
        <View style={styles.productPicture}>
          <Image source={product.image} accessibilityLabel={product.name} style={styles.productImage} contentFit="contain" transition={220} />
          {product.tag ? (
            <View style={styles.productTag}>
              <Text style={styles.productTagText}>{product.tag}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
      </Pressable>

      <View style={styles.productMeta}>
        <Text style={styles.productCategory} numberOfLines={1}>
          {product.brand || product.category}
        </Text>
      </View>

      <View style={styles.productBottom}>
        <Text style={styles.productPrice} numberOfLines={1}>
          {product.priceLabel}
        </Text>
        <Pressable
          disabled={!canAdd}
          onPress={() => {
            addToCart(product.id);
          }}
          style={({ pressed }) => [styles.addButton, !canAdd && styles.addButtonDisabled, pressed && canAdd && styles.pressedControl]}
          accessibilityRole="button"
          accessibilityLabel={
            canAdd
              ? `Add ${product.name} to cart`
              : product.hasVariants
              ? 'Choose a product option'
              : 'Out of stock'
          }
        >
          <Text style={[styles.addGlyph, !canAdd && styles.addGlyphDisabled]}>
            {canAdd ? '+' : product.hasVariants ? '⋯' : '−'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => toggleFavorite(product.id)}
        style={({ pressed }) => [styles.favoriteButton, saved && styles.favoriteButtonSaved, pressed && styles.pressedControl]}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved items' : 'Save item'}
      >
        <Text style={[styles.favoriteGlyph, saved && styles.favoriteGlyphSaved]}>
          {saved ? '♥' : '♡'}
        </Text>
      </Pressable>

      {hasRange && <Text style={styles.rangeFootnote}>Option selects price</Text>}
    </View>
  );
}

export function ProductGrid({ items }: { items: Product[] }) {
  return (
    <View style={styles.productGrid}>
      {items.map((product) => (
        <ProductCard key={product.id} product={product} compact />
      ))}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  caption,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  caption: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        {emptySymbols[icon] ? (
          <SymbolView name={emptySymbols[icon]} tintColor={C.teal} size={26} />
        ) : (
          <Text style={styles.emptyIconText}>{icon}</Text>
        )}
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCaption}>{caption}</Text>
      {action && (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressedControl]}>
          <Text style={styles.emptyButtonText}>{action} →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.paper },
  padded: { paddingHorizontal: 18 },
  header: {
    height: 64,
    paddingHorizontal: 10,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerInner: {
    ...contentFrame,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerRight: { justifyContent: 'flex-end', gap: 2 },
  logo: { width: 140, height: 44 },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.red,
    borderWidth: 2,
    borderColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 9, color: C.white, fontWeight: '900', fontFamily: 'Manrope' },
  noticeMarquee: {
    minHeight: 32,
    backgroundColor: C.teal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  livePulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.gold,
  },
  noticeMarqueeText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: 'Manrope',
  },
  noticeMarqueeBold: {
    fontWeight: '900',
    color: C.gold,
    fontFamily: 'Manrope',
  },
  searchBox: {
    height: 50,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#DCD6CB',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, alignSelf: 'stretch', padding: 0, fontSize: 15, color: C.ink, fontFamily: 'Manrope' },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleText: {
    color: C.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontFamily: 'Manrope',
  },
  sectionAction: { color: C.orange, fontSize: 13, fontWeight: '700', fontFamily: 'Manrope' },
  categoryCard: {
    width: 120,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 6,
    paddingBottom: 10,
    marginRight: 9,
    borderWidth: 1,
    borderColor: C.line,
  },
  categoryCardCompact: {
    width: '31.5%',
    marginRight: 0,
  },
  categoryArt: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: C.stone,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  categoryArtStandard: { height: 64 },
  // Category artwork ships as 3:4 photos on a baked-in backdrop, so the tile matches that ratio and fills edge to edge.
  categoryArtCompact: { aspectRatio: 0.75 },
  categoryImage: { width: '100%', height: '100%' },
  categoryName: {
    color: C.ink,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    maxWidth: '100%',
    paddingHorizontal: 4,
    fontFamily: 'Manrope',
  },
  categoryCaption: { color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 2, paddingHorizontal: 4, fontFamily: 'Manrope' },
  productCard: {
    width: 188,
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    marginRight: 12,
    position: 'relative',
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 10,
    elevation: 2,
  },
  productCardCompact: { width: '48.5%', marginRight: 0, marginBottom: 10 },
  productOpen: { width: '100%' },
  productPicture: {
    height: 142,
    borderRadius: 13,
    backgroundColor: C.paper,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: { width: '92%', height: '92%' },
  productTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: C.teal,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  productTagText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: 'Manrope',
  },
  productName: {
    color: C.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    minHeight: 36,
    marginTop: 10,
    paddingRight: 18,
    fontFamily: 'Manrope',
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  productCategory: { color: C.soft, fontSize: 12, flex: 1, paddingRight: 4, fontWeight: '600', fontFamily: 'Manrope' },
  productBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    color: C.ink,
    fontSize: 14,
    fontWeight: '900',
    flexShrink: 1,
    paddingRight: 4,
    fontFamily: 'Manrope',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: { backgroundColor: '#E4E1DA' },
  addGlyph: { color: C.white, fontSize: 20, lineHeight: 22, fontWeight: '700', fontFamily: 'Manrope' },
  addGlyphDisabled: { color: '#9CA3AF' },
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    borderWidth: 1,
    borderColor: C.line,
  },
  favoriteButtonSaved: { backgroundColor: '#F9E9E4', borderColor: C.red },
  favoriteGlyph: { color: C.soft, fontSize: 19, lineHeight: 22, fontFamily: 'Manrope' },
  favoriteGlyphSaved: { color: C.red },
  rangeFootnote: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 6, fontFamily: 'Manrope' },
  pressedControl: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  pressedCard: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  pressedProduct: { opacity: 0.88 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 35,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.stone,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyIconText: { fontSize: 26, color: C.teal, fontFamily: 'Manrope' },
  emptyTitle: {
    fontSize: 20,
    color: C.ink,
    fontWeight: '800',
    marginBottom: 6,
    fontFamily: 'Manrope',
  },
  emptyCaption: {
    fontSize: 14,
    lineHeight: 21,
    color: C.soft,
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: 'Manrope',
  },
  emptyButton: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: C.teal,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  emptyButtonText: { color: C.white, fontSize: 14, fontWeight: '800', fontFamily: 'Manrope' },
});
