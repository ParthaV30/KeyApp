import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { categories as localCategories, products as localProducts, type Product, type ProductCategory, type ProductVariant } from '@/data/products';
import { fetchAll } from '@/lib/fetchAll';
import { backendConfigured, supabase } from '@/lib/supabase';

type CatalogValue = {
  products: Product[];
  categories: ProductCategory[];
  variants: ProductVariant[];
  settings: StoreSettings;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export type StoreSettings = { supportPhone: string; dispatchCutoff: string; shippingFee: number; freeDeliveryThreshold: number | null };
const defaultSettings: StoreSettings = { supportPhone: '+917022225055', dispatchCutoff: '18:00', shippingFee: 0, freeDeliveryThreshold: null };

const CatalogContext = createContext<CatalogValue | null>(null);
const localBySlug = new Map(localProducts.map(product => [product.slug, product]));

export function CatalogProvider({ children }: React.PropsWithChildren) {
  const [products, setProducts] = useState(localProducts);
  const [categories, setCategories] = useState(localCategories);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(backendConfigured);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    try {
      const [{ data: categoryRows, error: categoryError }, { data: productRows, error: productError }, { data: variantRows, error: variantError }, { data: settingsRow, error: settingsError }] = await Promise.all([
        client.from('categories').select('id,name,slug,description,image_url,sort_order').eq('is_active', true).order('sort_order'),
        fetchAll((from, to) => client.from('products').select('id,slug,sku,name,description,brand,image_url,price,has_variants,stock_quantity,is_featured,is_active,categories(name)').eq('is_active', true).order('created_at', { ascending: false }).order('id').range(from, to)),
        fetchAll((from, to) => client.from('product_variants').select('id,product_id,name,price,stock_quantity,sku').eq('is_active', true).order('sort_order').order('id').range(from, to)),
        client.from('store_settings').select('support_phone,dispatch_cutoff,default_shipping_fee,free_delivery_threshold').eq('id', true).maybeSingle(),
      ]);
      if (categoryError) throw categoryError;
      if (productError) throw productError;
      if (variantError) throw variantError;
      if (settingsError) throw settingsError;
      if (settingsRow) setSettings({ supportPhone: settingsRow.support_phone, dispatchCutoff: settingsRow.dispatch_cutoff, shippingFee: Number(settingsRow.default_shipping_fee), freeDeliveryThreshold: settingsRow.free_delivery_threshold == null ? null : Number(settingsRow.free_delivery_threshold) });
      const variantData: ProductVariant[] = (variantRows ?? []).map((row: any) => ({ id: row.id, productId: row.product_id, name: row.name, price: Number(row.price), stockQuantity: Number(row.stock_quantity), sku: row.sku }));
      setVariants(variantData);

      const productsFromDb = (productRows ?? []).map((row: any): Product => {
        const local = localBySlug.get(row.slug);
        const category = Array.isArray(row.categories) ? row.categories[0]?.name : row.categories?.name;
        const ownVariants = variantData.filter(item => item.productId === row.id);
        const price = Number(row.price ?? (ownVariants.length ? Math.min(...ownVariants.map(item => item.price)) : local?.price ?? 0));
        const maxVariantPrice = ownVariants.length ? Math.max(...ownVariants.map(item => item.price)) : price;
        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          category: category ?? local?.category ?? 'Other',
          price,
          priceLabel: row.has_variants ? ownVariants.length ? `₹${price.toLocaleString('en-IN')} – ₹${maxVariantPrice.toLocaleString('en-IN')}` : 'Options coming soon' : `₹${price.toLocaleString('en-IN')}`,
          image: row.image_url || local?.image || require('../../../assets/images/catalog/key-ring.png'),
          imageUrl: row.image_url,
          sku: row.sku ?? null,
          brand: row.brand ?? '',
          isActive: Boolean(row.is_active),
          tag: row.is_featured ? 'FEATURED' : local?.tag,
          stockQuantity: Number(row.stock_quantity ?? 0),
          hasVariants: Boolean(row.has_variants),
        };
      });
      setProducts(productsFromDb);
      const counts = new Map<string, number>();
      for (const product of productsFromDb) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
      const categoryFromDb = (categoryRows ?? []).map((row: any): ProductCategory => {
        const local = localCategories.find(item => item.name === row.name);
        return {
          name: row.name,
          slug: row.slug ?? local?.slug ?? String(row.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          icon: local?.icon ?? '⌘',
          color: local?.color ?? '#E8ECEE',
          image: local?.image,
          imageUrl: row.image_url ?? null,
          count: `${counts.get(row.name) ?? 0} ${counts.get(row.name) === 1 ? 'product' : 'products'}`,
        };
      });
      const databaseCategories = new Map(categoryFromDb.map(category => [category.name.toLowerCase(), category]));
      const localNames = new Set(localCategories.map(category => category.name.toLowerCase()));
      const mergedCategories = localCategories.map(category => {
        const databaseCategory = databaseCategories.get(category.name.toLowerCase());
        return databaseCategory
          ? { ...category, slug: databaseCategory.slug ?? category.slug, imageUrl: databaseCategory.imageUrl, count: databaseCategory.count }
          : category;
      });
      setCategories([
        ...mergedCategories,
        ...categoryFromDb.filter(category => !localNames.has(category.name.toLowerCase())),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the store catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  // The callback updates catalog state only after the Supabase request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (supabase) void refresh(); }, [refresh]);

  const value = useMemo(() => ({ products, categories, variants, settings, loading, error, refresh }), [products, categories, variants, settings, loading, error, refresh]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog must be used within CatalogProvider');
  return value;
}
