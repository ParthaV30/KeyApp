import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { decode } from 'base64-arraybuffer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '@/components/shop/ui';
import { A } from '@/features/admin/ui';
import { BusinessOperationsPanel } from '@/features/admin/BusinessOperationsPanel';
import { AdminNav, AdminTopBar } from '@/features/admin/AdminNav';
import { BillingPanel } from '@/features/admin/billing/BillingPanel';
import { InvoiceProfilePanel } from '@/features/admin/billing/InvoiceProfilePanel';
import { OrderListRow, OrdersPanel } from '@/features/admin/orders/OrdersPanel';
import { OptionsEditor } from '@/features/admin/products/OptionsEditor';
import { QuickStock } from '@/features/admin/products/QuickStock';
import { StockField } from '@/features/admin/products/StockField';
import { stockChange } from '@/features/admin/products/stockMath';
import { adminErrorMessage } from '@/features/admin/errors';
import type { AdminVariant, InvoiceRow, OrderRow } from '@/features/admin/types';
import { useAuth } from '@/features/auth/AuthContext';
import { useCatalog } from '@/features/shop/CatalogContext';
import { fetchAll } from '@/lib/fetchAll';
import { supabase } from '@/lib/supabase';
import { categories as localCategories, products as localProducts, type Product } from '@/data/products';

type Tab = 'Overview' | 'Products' | 'Categories' | 'Orders' | 'Billing' | 'Returns' | 'Customers' | 'Inventory' | 'Purchasing' | 'Expenses' | 'Reports' | 'Team' | 'Audit' | 'Settings';
type CategoryRow = { id: string; name: string; slug: string; image_url?: string | null; is_active: boolean; exists?: boolean };
type CustomerRow = { user_id: string; display_name: string; phone: string; created_at: string };
const tabs: Tab[] = ['Overview', 'Products', 'Categories', 'Orders', 'Billing', 'Returns', 'Inventory', 'Purchasing', 'Expenses', 'Reports', 'Customers', 'Team', 'Audit', 'Settings'];


export default function AdminScreen() {
  const { session, role, businessPermissions, loading, backendConfigured, error: authError, refreshRole } = useAuth();
  const { refresh: refreshCatalog } = useCatalog();
  const [tab, setTab] = useState<Tab>('Overview');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const openOrder = (id: string) => { setSelectedOrderId(id); setTab('Orders'); };
  const { width } = useWindowDimensions();
  // The side menu fits from small tablets up; below this the menu becomes a swipeable strip.
  const wide = width >= 720;
  const [busy, setBusy] = useState(false);
  const [listLimit, setListLimit] = useState(100); // newest-first rows loaded for orders and invoices; "Load more" adds 100
  const actionLock = useRef(false);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [adminVariants, setAdminVariants] = useState<AdminVariant[]>([]);
  const [billingAvailable, setBillingAvailable] = useState(true);
  const [productCount, setProductCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [categoryImageUrl, setCategoryImageUrl] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [sku, setSku] = useState('');
  const [hsnSac, setHsnSac] = useState('');
  const [gstRate, setGstRate] = useState('0');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [variantLines, setVariantLines] = useState('');
  const [shippingFee, setShippingFee] = useState('0');
  const [freeThreshold, setFreeThreshold] = useState('');
  const [supportPhone, setSupportPhone] = useState('+917022225055');
  const [dispatchCutoff, setDispatchCutoff] = useState('18:00');
  const [businessName, setBusinessName] = useState('Giriraja');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCity, setBusinessCity] = useState('Bengaluru');
  const [businessState, setBusinessState] = useState('Karnataka');
  const [businessPostalCode, setBusinessPostalCode] = useState('');
  const [businessGstin, setBusinessGstin] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('GR');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [shippingGstRate, setShippingGstRate] = useState('0');
  const tabsForRole = useMemo(() => role === 'admin' ? tabs : role === 'staff' ? tabs.filter(item =>
    (item === 'Inventory' && businessPermissions.includes('inventory')) ||
    (item === 'Purchasing' && businessPermissions.includes('purchasing')) ||
    ((item === 'Billing' || item === 'Returns' || item === 'Expenses') && businessPermissions.includes('billing')) ||
    (item === 'Orders' && businessPermissions.includes('sales')) ||
    (item === 'Reports' && businessPermissions.includes('reports')) ||
    (item === 'Audit' && businessPermissions.includes('audit'))
  ) : [], [role, businessPermissions]);
  const activeTab = role === 'staff' && !tabsForRole.includes(tab) ? (tabsForRole[0] ?? 'Reports') : tab;

  const loadDashboard = useCallback(async () => {
    try {
      if (!supabase || role !== 'admin') return;
      const client = supabase;
    const [categoryResult, productResult, productRows, orderResult, orderList, customerList, variantRows, settingsResult, invoiceResult, billingSettingsResult] = await Promise.all([
      supabase.from('categories').select('id,name,slug,image_url,is_active').order('sort_order'),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      fetchAll((from, to) => client.from('products').select('id,slug,sku,name,description,brand,category_id,image_url,price,has_variants,stock_quantity,is_active,hsn_sac,gst_rate,categories(name)').order('created_at', { ascending: false }).order('id').range(from, to)),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id,order_number,status,created_at,updated_at,subtotal,shipping_fee,total,payment_method,payment_status,shipping_name,shipping_phone,shipping_address,shipping_city,shipping_state,shipping_postal_code,shipping_gstin,customer_note').order('created_at', { ascending: false }).limit(listLimit),
      supabase.from('profiles').select('user_id,display_name,phone,created_at').order('created_at', { ascending: false }).limit(250),
      fetchAll((from, to) => client.from('product_variants').select('id,product_id,name,price,stock_quantity,sku').eq('is_active', true).order('sort_order').order('id').range(from, to)),
      supabase.from('store_settings').select('support_phone,dispatch_cutoff,default_shipping_fee,free_delivery_threshold').eq('id', true).maybeSingle(),
      supabase.from('billing_invoices').select('id,order_id,invoice_code,issue_date,status,payment_status,total,paid_total,credited_total,buyer_name,buyer_phone').order('issue_date', { ascending: false }).order('created_at', { ascending: false }).limit(listLimit),
      supabase.from('billing_settings').select('business_name,business_address,business_city,business_state,business_postal_code,business_gstin,invoice_prefix,gst_enabled,shipping_gst_rate').eq('id', true).maybeSingle(),
    ]);
    let productData = productRows.data;
    let productError = productRows.error;
    if (productError && /hsn_sac|gst_rate|column/i.test(productError.message)) {
      const legacyProducts = await supabase.from('products').select('id,slug,sku,name,description,brand,category_id,image_url,price,has_variants,stock_quantity,is_active,categories(name)').order('created_at', { ascending: false });
      if (!legacyProducts.error) { productData = legacyProducts.data as typeof productData; productError = null; }
    }
    const failure = categoryResult.error || productResult.error || productError || orderResult.error || orderList.error || customerList.error || variantRows.error || settingsResult.error;
    setBillingAvailable(!invoiceResult.error && !billingSettingsResult.error);
    if (invoiceResult.error || billingSettingsResult.error) setMessage('Invoice tools need the billing migration applied to Supabase before use.');
    if (failure) setMessage(adminErrorMessage(failure, 'Could not load store data. Check your connection and retry.'));
    else {
      setCategories(categoryResult.data ?? []);
      setProductCount(productResult.count ?? 0);
      setOrderCount(orderResult.count ?? 0);
      setCategoryCount(localCategories.length + (categoryResult.data ?? []).filter(item => !localCategories.some(category => category.name.toLowerCase() === item.name.toLowerCase()) && item.is_active).length);
      setOrders(orderList.data ?? []);
      setCustomers(customerList.data ?? []);
      setInvoices(invoiceResult.data ?? []);
      setAdminVariants(variantRows.data ?? []);
      if (settingsResult.data) { setSupportPhone(settingsResult.data.support_phone); setDispatchCutoff(settingsResult.data.dispatch_cutoff); setShippingFee(String(settingsResult.data.default_shipping_fee)); setFreeThreshold(settingsResult.data.free_delivery_threshold == null ? '' : String(settingsResult.data.free_delivery_threshold)); }
      if (billingSettingsResult.data) { setBusinessName(billingSettingsResult.data.business_name); setBusinessAddress(billingSettingsResult.data.business_address); setBusinessCity(billingSettingsResult.data.business_city); setBusinessState(billingSettingsResult.data.business_state); setBusinessPostalCode(billingSettingsResult.data.business_postal_code); setBusinessGstin(billingSettingsResult.data.business_gstin); setInvoicePrefix(billingSettingsResult.data.invoice_prefix); setGstEnabled(billingSettingsResult.data.gst_enabled); setShippingGstRate(String(billingSettingsResult.data.shipping_gst_rate ?? 0)); }
      const variantsByProduct = new Map<string, string[]>();
      for (const row of variantRows.data ?? []) {
        const list = variantsByProduct.get(row.product_id) ?? [];
        list.push(`${row.name} | ${row.price} | ${row.stock_quantity} | ${row.sku ?? ''}`);
        variantsByProduct.set(row.product_id, list);
      }
      setAdminProducts((productData ?? []).map((row: any): Product => {
        const local = localProducts.find(item => item.slug === row.slug);
        const category = Array.isArray(row.categories) ? row.categories[0]?.name : row.categories?.name;
        const options = variantsByProduct.get(row.id) ?? [];
        const optionPrices = options.map(option => Number(option.split('|')[1]?.trim() ?? 0)).filter(Number.isFinite);
        const low = optionPrices.length ? Math.min(...optionPrices) : Number(row.price ?? local?.price ?? 0);
        const high = optionPrices.length ? Math.max(...optionPrices) : low;
        return { id: row.id, slug: row.slug, sku: row.sku, name: row.name, description: row.description, category: category ?? 'Other', brand: row.brand, price: low, priceLabel: row.has_variants ? optionPrices.length ? `₹${low.toLocaleString('en-IN')} – ₹${high.toLocaleString('en-IN')}` : 'Options missing' : `₹${Number(row.price).toLocaleString('en-IN')}`, image: row.image_url || local?.image || require('../../assets/images/catalog/key-ring.png'), imageUrl: row.image_url, stockQuantity: row.stock_quantity, hasVariants: row.has_variants, isActive: row.is_active, hsnSac: row.hsn_sac, gstRate: Number(row.gst_rate ?? 0) };
      }));
    }
    } catch {
      setMessage('Could not load store data. Check your connection and retry.');
    }
  }, [role, listLimit]);

  // The callback awaits all admin queries before updating the dashboard state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const clearProductForm = () => {
    setActiveProductId(null); setName(''); setSlug(''); setDescription(''); setBrand(''); setPrice(''); setStock('0'); setImageUrl(''); setSku(''); setHsnSac(''); setGstRate('0'); setVariantLines(''); setSelectedCategory(categories[0]?.name ?? '');
  };
  const runAdminAction = async (action: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await action();
    } catch {
      setMessage('The request could not be completed. Check your connection and try again.');
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const editProduct = (item: Product) => {
    setActiveProductId(item.id); setName(item.name); setSlug(item.slug); setDescription(item.description); setBrand(item.brand ?? ''); setPrice(item.hasVariants ? '' : String(item.price)); setStock(String(item.stockQuantity ?? 0)); setImageUrl(item.imageUrl ?? ''); setSku(item.sku ?? ''); setHsnSac(item.hsnSac ?? ''); setGstRate(String(item.gstRate ?? 0)); setVariantLines(''); setSelectedCategory(item.category); setTab('Products');
    if (supabase && item.hasVariants) void Promise.resolve(supabase.from('product_variants').select('name,price,stock_quantity,sku').eq('product_id', item.id).eq('is_active', true).order('sort_order').then(({ data, error }) => {
      if (error) throw error;
      setVariantLines((data ?? []).map(row => `${row.name} | ${row.price} | ${row.stock_quantity} | ${row.sku ?? ''}`).join('\n'));
    })).catch(() => setMessage('Could not load this product’s options. Check your connection and retry.'));
  };

  const saveProduct = async () => {
    if (!supabase) return;
    const parent = categories.find(item => item.name === selectedCategory);
    if (!parent) { setMessage('Choose a category first.'); return; }
    const parsedVariants = variantLines.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const [variantName, rawPrice, rawStock, variantSku] = line.split('|').map(part => part.trim());
      return { name: variantName ?? '', price: rawPrice ? Number(rawPrice) : Number.NaN, stock_quantity: rawStock ? Number(rawStock) : Number.NaN, sku: variantSku || null };
    });
    const hasVariants = parsedVariants.length > 0;
    const amount = Number(price);
    const quantity = Number(stock);
    const parsedGstRate = Number(gstRate);
    if (!name.trim() || !slug.trim() || (!hasVariants && (!price.trim() || !Number.isFinite(amount) || amount < 0)) || !Number.isInteger(quantity) || quantity < 0 || !Number.isFinite(parsedGstRate) || parsedGstRate < 0 || parsedGstRate > 100 || parsedVariants.some(row => !row.name || !Number.isFinite(row.price) || row.price < 0 || !Number.isInteger(row.stock_quantity) || row.stock_quantity < 0)) { setMessage('Check product fields and variant lines. GST rate must be 0–100%. Each option line must be: name | price | stock | SKU.'); return; }
    setBusy(true); setMessage('');
    const values = { name: name.trim(), slug: slug.trim().toLowerCase(), description: description.trim(), brand: brand.trim(), price: hasVariants ? null : amount, image_url: imageUrl.trim() || null, sku: sku.trim() || null, hsn_sac: hsnSac.trim(), gst_rate: parsedGstRate, category_id: parent.id, has_variants: hasVariants };
    // Stock is only set on creation; later changes go through adjust_inventory so a stale form never overwrites live sales.
    const existing = activeProductId ? adminProducts.find(item => item.id === activeProductId) : undefined;
    const result = activeProductId
      ? await supabase.from('products').update(values).eq('id', activeProductId).select('id').single()
      : await supabase.from('products').insert({ ...values, stock_quantity: hasVariants ? 0 : quantity, is_active: true }).select('id').single();
    if (result.error) setMessage(adminErrorMessage(result.error, 'Could not save this product. Review the fields and try again.'));
    else {
      const productId = result.data.id;
      let variantError: { message: string } | null = null;
      if (hasVariants) {
        const saved = await supabase.rpc('save_product_variants', { p_product_id: productId, p_variants: parsedVariants });
        variantError = saved.error;
      } else if (existing && !existing.hasVariants && quantity !== (existing.stockQuantity ?? 0)) {
        const adjusted = await supabase.rpc('adjust_inventory', { p_product_id: productId, p_variant_id: null, p_delta: quantity - (existing.stockQuantity ?? 0), p_reason: 'Stock count updated from product form', p_movement_type: 'adjustment' });
        variantError = adjusted.error;
      }
      if (variantError) setMessage(`Product saved, but options or stock need attention. ${adminErrorMessage(variantError, 'Retry saving the product.')}`);
      else { setMessage(activeProductId ? 'Product updated.' : 'Product added.'); clearProductForm(); }
      await refreshCatalog(); await loadDashboard();
    }
    setBusy(false);
  };

  // Staff type the count they have now; the difference is recorded as an inventory adjustment.
  const setStockCount = async (productId: string, variantId: string | null, current: number, input: string) => {
    const change = stockChange(current, input);
    if (change.error !== undefined) { setMessage(change.error); return false; }
    let saved = false;
    await runAdminAction(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc('adjust_inventory', { p_product_id: productId, p_variant_id: variantId, p_delta: change.delta, p_reason: 'Stock count updated from Products', p_movement_type: 'adjustment' });
      if (error) { setMessage(adminErrorMessage(error, 'Could not update stock. Refresh and try again.')); return; }
      saved = true;
      setMessage(`Stock updated to ${current + change.delta}.`);
      await refreshCatalog(); await loadDashboard();
    });
    return saved;
  };

  const toggleProduct = async (id: string, isActive: boolean) => {
    if (!supabase) return;
    const { error: updateError } = await supabase.from('products').update({ is_active: !isActive }).eq('id', id);
    if (updateError) setMessage(adminErrorMessage(updateError, 'Could not update product visibility. Retry in a moment.'));
    else { await refreshCatalog(); await loadDashboard(); }
  };

  const saveCategory = async () => {
    if (!supabase || !categoryName.trim() || !categorySlug.trim()) { setMessage('Enter a category name and slug.'); return; }
    setBusy(true);
    const values = { name: categoryName.trim(), slug: categorySlug.trim().toLowerCase(), image_url: categoryImageUrl.trim() || null };
    const { error: saveError } = activeCategoryId
      ? await supabase.from('categories').update(values).eq('id', activeCategoryId)
      : await supabase.from('categories').insert({ ...values, sort_order: categories.length + 1 });
    if (saveError) setMessage(adminErrorMessage(saveError, 'Could not add this category. Review the name and slug.'));
    else { setActiveCategoryId(null); setCategoryName(''); setCategorySlug(''); setCategoryImageUrl(''); setMessage(activeCategoryId ? 'Category updated.' : 'Category added.'); await refreshCatalog(); await loadDashboard(); }
    setBusy(false);
  };

  const editCategory = (item: CategoryRow) => {
    if (item.exists === false) return;
    setActiveCategoryId(item.id); setCategoryName(item.name); setCategorySlug(item.slug); setCategoryImageUrl(item.image_url ?? '');
  };

  const saveSettings = async () => {
    if (!supabase) return;
    const fee = Number(shippingFee);
    const threshold = freeThreshold.trim() ? Number(freeThreshold) : null;
    const deliveryGst = Number(shippingGstRate);
    if (!Number.isFinite(fee) || fee < 0 || (threshold !== null && (!Number.isFinite(threshold) || threshold < 0)) || !Number.isFinite(deliveryGst) || deliveryGst < 0 || deliveryGst > 100) { setMessage('Enter valid delivery fee, threshold, and GST rate values.'); return; }
    setBusy(true);
    if (gstEnabled && !businessGstin.trim()) { setMessage('Enter the GSTIN before enabling GST on invoices.'); setBusy(false); return; }
    const [{ error: settingsError }, { error: billingError }] = await Promise.all([
      supabase.from('store_settings').upsert({ id: true, default_shipping_fee: fee, free_delivery_threshold: threshold, support_phone: supportPhone.trim(), dispatch_cutoff: dispatchCutoff.trim() || '18:00' }),
      supabase.from('billing_settings').upsert({ id: true, business_name: businessName.trim(), business_address: businessAddress.trim(), business_city: businessCity.trim(), business_state: businessState.trim(), business_postal_code: businessPostalCode.trim(), business_gstin: businessGstin.trim(), invoice_prefix: invoicePrefix.trim() || 'GR', gst_enabled: gstEnabled, shipping_gst_rate: Number(shippingGstRate) }),
    ]);
    const failure = settingsError || billingError;
    setMessage(failure ? adminErrorMessage(failure, 'Could not save all settings. Check the connection and retry.') : 'Store and invoice settings saved.');
    setBusy(false);
  };

  const uploadProductImage = async () => {
    if (!supabase) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8, base64: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) { setMessage('Product images must be 5 MB or smaller.'); return; }
    if (!asset.base64) { setMessage('Could not read that image. Try another photo.'); return; }
    const contentType = asset.mimeType ?? 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || asset.base64.length * 0.75 > 5 * 1024 * 1024) { setMessage('Choose a JPG, PNG, or WebP image smaller than 5 MB.'); return; }
    setBusy(true); setMessage('Uploading product image…');
    const extension = contentType.split('/')[1].replace('jpeg', 'jpg');
    const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'products';
    const path = `${safeSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { data, error: uploadError } = await supabase.storage.from('product-images').upload(path, decode(asset.base64), { contentType, cacheControl: '3600', upsert: false });
    if (uploadError) setMessage(adminErrorMessage(uploadError, 'Could not upload that image. Check the connection and try again.'));
    else { setImageUrl(supabase.storage.from('product-images').getPublicUrl(data.path).data.publicUrl); setMessage('Image uploaded. Save the product to attach it to this item.'); }
    setBusy(false);
  };

  const uploadCategoryImage = async () => {
    if (!supabase) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8, base64: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) { setMessage('Category images must be 5 MB or smaller.'); return; }
    if (!asset.base64) { setMessage('Could not read that image. Try another photo.'); return; }
    const contentType = asset.mimeType ?? 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || asset.base64.length * 0.75 > 5 * 1024 * 1024) { setMessage('Choose a JPG, PNG, or WebP image smaller than 5 MB.'); return; }
    setBusy(true); setMessage('Uploading category image…');
    const extension = contentType.split('/')[1].replace('jpeg', 'jpg');
    const safeSlug = categorySlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'categories';
    const path = `categories/${safeSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { data, error: uploadError } = await supabase.storage.from('product-images').upload(path, decode(asset.base64), { contentType, cacheControl: '3600', upsert: false });
    if (uploadError) setMessage(adminErrorMessage(uploadError, 'Could not upload that image. Check the connection and try again.'));
    else { setCategoryImageUrl(supabase.storage.from('product-images').getPublicUrl(data.path).data.publicUrl); setMessage('Image uploaded. Save the category to attach it.'); }
    setBusy(false);
  };

  const toggleCategory = async (item: CategoryRow) => {
    if (!supabase) return;
    if (item.exists === false) {
      const local = localCategories.find(category => category.name === item.name);
      const { error: insertError } = await supabase.from('categories').insert({ name: item.name, slug: item.slug, description: local?.count ?? '', sort_order: localCategories.findIndex(category => category.name === item.name) + 1 });
      if (insertError) setMessage(adminErrorMessage(insertError, 'Could not add this category. Try again in a moment.'));
      else { setMessage(`${item.name} added to the store.`); await refreshCatalog(); await loadDashboard(); }
      return;
    }
    const { error: updateError } = await supabase.from('categories').update({ is_active: !item.is_active }).eq('id', item.id);
    if (updateError) setMessage(adminErrorMessage(updateError, 'Could not update this category. Try again in a moment.'));
    else { await refreshCatalog(); await loadDashboard(); }
  };

  const changeOrderStatus = async (item: OrderRow, nextStatus: string) => {
    if (!supabase) return;
    const { error: updateError } = await supabase.from('orders').update({ status: nextStatus }).eq('id', item.id);
    if (updateError) setMessage(adminErrorMessage(updateError, 'Could not update this order. Refresh and retry.'));
    else { setOrders(current => current.map(order => order.id === item.id ? { ...order, status: nextStatus } : order)); setMessage(`Order #${item.order_number} updated to ${nextStatus}.`); }
  };

  const displayedCategories: CategoryRow[] = [...localCategories.map(category => categories.find(item => item.name.toLowerCase() === category.name.toLowerCase()) ?? ({ id: `local:${category.slug}`, name: category.name, slug: category.slug ?? category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), is_active: true, exists: false })), ...categories.filter(item => !localCategories.some(category => category.name.toLowerCase() === item.name.toLowerCase()))];

  if (loading) return <AdminShell><Text style={styles.body}>Loading your account…</Text></AdminShell>;
  if (!backendConfigured) return <AdminShell><Gate title="Connect the backend" body="Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env, then apply the migrations to enable the admin dashboard." action="Back to shop" onPress={() => router.replace('/(tabs)')} /></AdminShell>;
  if (!session) return <AdminShell><Gate title="Admin sign in" body="Sign in with an account that has the admin role to manage Key Mitra." action="Sign in" onPress={() => router.push('/auth')} /></AdminShell>;
  if (role === 'unknown') return <AdminShell><Gate title={authError ? 'Could not verify access' : 'Checking admin access'} body={authError ?? 'Confirming your account permissions…'} action="Retry access check" onPress={() => void refreshRole()} /></AdminShell>;
  if (role !== 'admin' && role !== 'staff') return <AdminShell><Gate title="Business access required" body="This account does not have business permissions. Ask an administrator to grant a staff role." action="Go to account" onPress={() => router.replace('/account')} /></AdminShell>;

  return <SafeAreaView style={styles.safe} edges={['top']}><AdminTopBar section={activeTab} onViewShop={() => router.replace('/(tabs)')} />
    <View style={[styles.frame, wide && styles.frameWide]}>{tabsForRole.length > 1 ? <AdminNav items={tabsForRole} active={activeTab} onSelect={setTab} vertical={wide} /> : null}
    <ScrollView style={styles.mainContent} contentContainerStyle={styles.bodyContent}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {activeTab === 'Overview' && <><Text style={styles.sectionTitle}>Store overview</Text><View style={styles.stats}>{[[productCount, 'Products'], [categoryCount, 'Active categories'], [orderCount, 'Orders'], [orders.filter(item => item.status === 'pending').length, 'Pending orders']].map(([value, label]) => <View key={String(label)} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View><Text style={styles.sectionTitle}>Recent orders</Text>{orders.slice(0, 6).map(item => <OrderListRow key={item.id} order={item} onOpen={() => openOrder(item.id)} />)}{!orders.length && <Text style={styles.body}>Orders placed by customers will appear here.</Text>}</>}
      {activeTab === 'Products' && <><Text style={styles.sectionTitle}>{activeProductId ? 'Edit product' : 'Add a product'}</Text><Text style={styles.hint}>Maintain the product master, stock, pricing, and tax classification used on future invoices.</Text><View style={styles.form}><AdminField label="Product name" value={name} onChangeText={setName} /><AdminField label="URL slug" value={slug} onChangeText={setSlug} autoCapitalize="none" /><AdminField label="Description" value={description} onChangeText={setDescription} multiline /><AdminField label="Brand" value={brand} onChangeText={setBrand} /><AdminField label="SKU (optional)" value={sku} onChangeText={setSku} /><AdminField label="HSN / SAC code" value={hsnSac} onChangeText={setHsnSac} /><AdminField label="GST rate (%)" value={gstRate} onChangeText={setGstRate} keyboardType="decimal-pad" /><AdminField label="Fixed price in INR (leave blank if using options)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />{variantLines.trim() ? <Text style={styles.hint}>Stock is set for each option below.</Text> : <StockField value={stock} onChange={setStock} />}<Text style={styles.fieldLabel}>Product category</Text><Text style={styles.hint}>Choose where shoppers will find this product, for example, Alarm System.</Text><View style={styles.categoryOptions}>{categories.filter(item => item.is_active || item.name === selectedCategory).map(item => <Pressable key={item.id} onPress={() => setSelectedCategory(item.name)} style={[styles.methodChip, selectedCategory === item.name && styles.methodChipSelected]}><Text style={[styles.methodText, selectedCategory === item.name && styles.methodTextSelected]}>{item.name}</Text></Pressable>)}</View>{!categories.some(item => item.is_active) && <Text style={styles.rowSub}>Add and activate a category in the Categories tab first.</Text>}<AdminImageField label="Product image" imageUrl={imageUrl} onChoose={() => void runAdminAction(uploadProductImage)} onRemove={() => setImageUrl('')} /><OptionsEditor value={variantLines} onChange={setVariantLines} />
        <View style={styles.actions}><AdminButton label={busy ? 'Saving…' : activeProductId ? 'Save changes' : 'Add product'} onPress={() => void runAdminAction(saveProduct)} /><AdminButton label="Clear form" secondary onPress={clearProductForm} /></View></View>
        <Text style={styles.sectionTitle}>Catalog · {adminProducts.length}</Text>{adminProducts.map(item => <View key={item.id} style={styles.productRow}><Image source={item.image} style={styles.catalogThumb} contentFit="contain" /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowSub}>{item.category} · {item.priceLabel} · {item.isActive ? 'Visible in shop' : 'Hidden from shop'}</Text><QuickStock productId={item.id} productStock={item.stockQuantity ?? 0} hasVariants={Boolean(item.hasVariants)} variants={adminVariants.filter(variant => variant.product_id === item.id)} busy={busy} onSet={setStockCount} /></View><View style={styles.rowActions}><Pressable onPress={() => editProduct(item)}><Text style={styles.link}>Edit</Text></Pressable><Pressable onPress={() => void runAdminAction(() => toggleProduct(item.id, Boolean(item.isActive)))}><Text style={styles.link}>{item.isActive ? 'Hide' : 'Show'}</Text></Pressable></View></View>)}</>}
      {activeTab === 'Categories' && <><Text style={styles.sectionTitle}>Catalog categories · {displayedCategories.length}</Text><Text style={styles.hint}>Add or update category details and artwork. Category images appear in the shop’s category cards.</Text><View style={styles.form}><Text style={styles.fieldLabel}>{activeCategoryId ? 'Edit category' : 'Add a category'}</Text><AdminField label="Category name" value={categoryName} onChangeText={setCategoryName} /><AdminField label="URL slug" value={categorySlug} onChangeText={setCategorySlug} autoCapitalize="none" /><AdminImageField label="Category image" imageUrl={categoryImageUrl} onChoose={() => void runAdminAction(uploadCategoryImage)} onRemove={() => setCategoryImageUrl('')} /><View style={styles.actions}><AdminButton label={busy ? 'Saving…' : activeCategoryId ? 'Save category' : 'Add category'} onPress={() => void runAdminAction(saveCategory)} />{activeCategoryId && <AdminButton label="Cancel edit" secondary onPress={() => { setActiveCategoryId(null); setCategoryName(''); setCategorySlug(''); setCategoryImageUrl(''); }} />}</View></View>{displayedCategories.map(item => <View key={item.id} style={styles.productRow}>{item.image_url ? <Image source={{ uri: item.image_url }} style={styles.catalogThumb} contentFit="contain" /> : <View style={styles.catalogThumbPlaceholder}><Text style={styles.rowSub}>No image</Text></View>}<View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowSub}>{item.exists === false ? 'Ready to add to the store database' : `${item.slug} · ${item.is_active ? 'Active' : 'Hidden'}`}</Text></View><View style={styles.rowActions}>{item.exists !== false && <Pressable onPress={() => editCategory(item)}><Text style={styles.link}>Edit</Text></Pressable>}<Pressable onPress={() => void runAdminAction(() => toggleCategory(item))}><Text style={item.exists === false ? styles.link : item.is_active ? styles.cancelLink : styles.link}>{item.exists === false ? 'Add' : item.is_active ? 'Hide' : 'Show'}</Text></Pressable></View></View>)}</>}
      {activeTab === 'Orders' && (role === 'staff' ? <BusinessOperationsPanel section="Sales" /> : <OrdersPanel orders={orders} selectedId={selectedOrderId} onSelect={setSelectedOrderId} busy={busy} onChangeStatus={(item, status) => void runAdminAction(() => changeOrderStatus(item, status))} />)}
      {activeTab === 'Billing' && (role === 'staff' ? <BusinessOperationsPanel section="Billing" /> : <BillingPanel products={adminProducts} variants={adminVariants} invoices={invoices} orders={orders} available={billingAvailable} busy={busy} runAction={runAdminAction} setMessage={setMessage} reload={loadDashboard} />)}
      {role === 'admin' && ((activeTab === 'Orders' && orders.length < orderCount) || (activeTab === 'Billing' && invoices.length >= listLimit)) && <AdminButton label="Load older orders and invoices" secondary onPress={() => setListLimit(limit => limit + 100)} />}
      {activeTab === 'Returns' && <BusinessOperationsPanel section="CreditNotes" />}
      {activeTab === 'Customers' && <><Text style={styles.sectionTitle}>Customer accounts · {customers.length}</Text>{customers.map(item => <View key={item.user_id} style={styles.productRow}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.display_name || 'Customer'}</Text><Text style={styles.rowSub}>{item.phone || 'No phone number'} · Joined {new Date(item.created_at).toLocaleDateString()}</Text></View></View>)}</>}
      {activeTab === 'Inventory' && <BusinessOperationsPanel section="Inventory" />}
      {activeTab === 'Purchasing' && <BusinessOperationsPanel section="Purchasing" />}
      {activeTab === 'Expenses' && <BusinessOperationsPanel section="Expenses" />}
      {activeTab === 'Reports' && <BusinessOperationsPanel section="Reports" />}
      {activeTab === 'Team' && <BusinessOperationsPanel section="Team" />}
      {activeTab === 'Audit' && <BusinessOperationsPanel section="Audit" />}
      {activeTab === 'Settings' && <><Text style={styles.sectionTitle}>Business & invoice settings</Text><Text style={styles.hint}>GST is off until you configure the seller details and turn it on. Add HSN/SAC and GST rates to products before issuing tax invoices. Please have your accountant verify tax setup before use.</Text><View style={styles.form}><AdminField label="Legal business name" value={businessName} onChangeText={setBusinessName} /><AdminField label="Business address" value={businessAddress} onChangeText={setBusinessAddress} multiline /><AdminField label="Business city" value={businessCity} onChangeText={setBusinessCity} /><AdminField label="Business state" value={businessState} onChangeText={setBusinessState} /><AdminField label="Postal code" value={businessPostalCode} onChangeText={setBusinessPostalCode} keyboardType="number-pad" /><AdminField label="GSTIN (optional)" value={businessGstin} onChangeText={setBusinessGstin} autoCapitalize="characters" /><AdminField label="Invoice number prefix" value={invoicePrefix} onChangeText={setInvoicePrefix} autoCapitalize="characters" /><AdminButton label={`GST invoices: ${gstEnabled ? 'ON' : 'OFF'}`} secondary={!gstEnabled} onPress={() => setGstEnabled(!gstEnabled)} /><AdminField label="Shipping GST rate (%)" value={shippingGstRate} onChangeText={setShippingGstRate} keyboardType="decimal-pad" /><AdminField label="Default delivery fee (INR)" value={shippingFee} onChangeText={setShippingFee} keyboardType="decimal-pad" /><AdminField label="Free delivery above (INR, optional)" value={freeThreshold} onChangeText={setFreeThreshold} keyboardType="decimal-pad" /><AdminField label="Support phone in international format" value={supportPhone} onChangeText={setSupportPhone} keyboardType="phone-pad" /><AdminField label="Dispatch cutoff (24-hour time)" value={dispatchCutoff} onChangeText={setDispatchCutoff} /><AdminButton label={busy ? 'Saving…' : 'Save business settings'} onPress={() => void runAdminAction(saveSettings)} /></View><InvoiceProfilePanel busy={busy} runAction={runAdminAction} setMessage={setMessage} /></>}
      {busy && <Text style={styles.hint}>Updating the store…</Text>}
    </ScrollView></View>
  </SafeAreaView>;
}

function AdminShell({ children }: React.PropsWithChildren) {
  return <SafeAreaView style={styles.safe} edges={['top']}><AdminTopBar /><View style={styles.gateWrap}>{children}</View></SafeAreaView>;
}

function Gate({ title, body, action, onPress }: { title: string; body: string; action: string; onPress: () => void }) {
  return <View style={styles.gate}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.body}>{body}</Text><AdminButton label={action} onPress={onPress} /></View>;
}

function AdminField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} placeholder={label} placeholderTextColor="#929CA2" style={[styles.input, props.multiline && styles.multiline]} /></View>;
}

function AdminImageField({ label, imageUrl, onChoose, onRemove }: { label: string; imageUrl: string; onChoose: () => void; onRemove: () => void }) {
  return <View style={styles.imageField}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.imagePreviewFrame}>{imageUrl ? <Image source={{ uri: imageUrl }} style={styles.imagePreview} contentFit="contain" /> : <Text style={styles.imagePlaceholder}>No image selected</Text>}</View><Text style={styles.rowSub}>JPG, PNG or WebP · up to 5 MB</Text><View style={styles.actions}><AdminButton label={imageUrl ? 'Replace image' : 'Choose image'} secondary onPress={onChoose} />{imageUrl ? <AdminButton label="Remove image" secondary onPress={onRemove} /> : null}</View></View>;
}

function AdminButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, pressed && styles.pressed]}><Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: A.canvas },
  frame: { flex: 1, width: '100%', maxWidth: 1360, alignSelf: 'center' },
  frameWide: { flexDirection: 'row', paddingHorizontal: 20 },
  mainContent: { flex: 1 },
  bodyContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 56, gap: 14 },
  sectionTitle: { color: '#193438', fontSize: 17, fontWeight: '800', marginTop: 13, marginBottom: 4, letterSpacing: -0.2, fontFamily: 'Manrope' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: 150, minHeight: 92, backgroundColor: A.panel, borderRadius: 12, borderWidth: 1, borderColor: A.line, padding: 17, justifyContent: 'center' },
  statValue: { color: A.ink, fontWeight: '800', fontSize: 25, letterSpacing: -0.5, fontFamily: 'Manrope' }, statLabel: { color: '#647571', fontWeight: '700', fontSize: 11, marginTop: 5, fontFamily: 'Manrope' },
  body: { color: '#526562', fontSize: 14, lineHeight: 22, fontFamily: 'Manrope' },
  message: { color: '#6B4F1F', backgroundColor: A.warnSoft, borderWidth: 1, borderColor: '#EED9AE', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, fontSize: 13, lineHeight: 19, fontFamily: 'Manrope' },
  form: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: A.line, backgroundColor: A.panel, gap: 13 },
  imageField: { gap: 8 }, imagePreviewFrame: { width: '100%', maxWidth: 260, height: 150, borderRadius: 12, borderWidth: 1, borderColor: A.line, backgroundColor: '#F4F2ED', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, imagePreview: { width: '100%', height: '100%' }, imagePlaceholder: { color: '#87938E', fontSize: 12, fontFamily: 'Manrope' }, catalogThumb: { width: 54, height: 54, borderRadius: 11, backgroundColor: '#F2F0EB' }, catalogThumbPlaceholder: { width: 54, height: 54, borderRadius: 11, backgroundColor: '#F2F0EB', alignItems: 'center', justifyContent: 'center' },
  field: { gap: 7 }, fieldLabel: { color: '#304A46', fontSize: 11, fontWeight: '800', letterSpacing: 0.2, fontFamily: 'Manrope' },
  split: { flexDirection: 'row', gap: 10 }, splitField: { flex: 1 },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 49, borderWidth: 1, borderColor: '#E1DED5', borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#FFFFFF', color: '#193438', fontSize: 14, fontFamily: 'Manrope' },
  multiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  button: { backgroundColor: '#17383C', borderRadius: 12, minHeight: 48, paddingVertical: 12, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#21474A' },
  buttonText: { color: '#F9F5EA', fontSize: 12, letterSpacing: 0.15, fontWeight: '800', fontFamily: 'Manrope' }, secondaryButton: { backgroundColor: '#EFEAE0', borderColor: '#E6DFD2' }, secondaryButtonText: { color: '#334B46' },
  productRow: { backgroundColor: A.panel, borderWidth: 1, borderColor: A.line, borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowCopy: { flex: 1 }, rowTitle: { color: '#193438', fontWeight: '800', fontSize: 13, fontFamily: 'Manrope' }, rowSub: { color: '#667772', fontSize: 11, marginTop: 5, lineHeight: 18, fontFamily: 'Manrope' },
  rowActions: { gap: 10 }, link: { color: '#547A67', fontWeight: '800', fontSize: 12, marginTop: 8, fontFamily: 'Manrope' }, cancelLink: { color: C.red, fontWeight: '800', fontSize: 12, marginTop: 8, fontFamily: 'Manrope' },
  paymentForm: { marginTop: 12, padding: 15, backgroundColor: '#F4F3EF', borderWidth: 1, borderColor: A.line, borderRadius: 12, gap: 10 },
  methodChip: { minHeight: 36, paddingHorizontal: 11, justifyContent: 'center', borderRadius: 10, backgroundColor: A.panel, borderWidth: 1, borderColor: A.line },
  methodChipSelected: { backgroundColor: '#17383C', borderColor: '#17383C' }, methodText: { color: '#5B6E69', fontSize: 11, textTransform: 'capitalize', fontWeight: '700', fontFamily: 'Manrope' }, methodTextSelected: { color: '#F9F5EA' },
  hint: { color: A.muted, fontSize: 12, lineHeight: 19, fontFamily: 'Manrope' },
  gateWrap: { flex: 1, justifyContent: 'center', padding: 20 }, gate: { gap: 13, backgroundColor: A.panel, borderRadius: 12, padding: 21, borderWidth: 1, borderColor: A.line },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
});
