import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';

import type { Product } from '@/data/products';
import { A, Button, Chip, EmptyNote, Field, Panel, Segmented, numeric } from '@/features/admin/ui';
import type { AdminVariant } from '@/features/admin/types';
import {
  PAYMENT_METHODS,
  addBillLine,
  billTotal,
  formatINR,
  paymentMethodLabel,
  resolveAmountReceived,
  setBillLineQuantity,
  type BillLine,
  type PaymentMode,
} from './billingMath';
import { BillPreviewModal } from './BillPreviewModal';
import { buildDraftInvoice, type SellerDetails } from './draftInvoice';
import { buildInvoiceHtml, type InvoiceProfile } from './invoiceDocument';
import { loadInvoiceProfile, loadSellerDetails } from './invoiceProfile';

export type CounterCustomer = { name: string; phone: string; address: string; city: string; state: string; postal_code: string; gstin: string };
export type CounterBill = { customer: CounterCustomer; lines: BillLine[]; amountReceived: number; method: string; reference: string };

// Keeps the total and Create button in view while scrolling on web; native shows the running total in the Items header instead.
const stickyOnWeb = Platform.OS === 'web' ? ({ position: 'sticky', bottom: 12, zIndex: 2 } as unknown as ViewStyle) : null;

const emptyCustomer: CounterCustomer = { name:'', phone: '', address: '', city: '', state: '', postal_code: '', gstin: '' };
const paymentModes = [
  { value: 'full', label: 'Paid in full' },
  { value: 'part', label: 'Part paid' },
  { value: 'later', label: 'Pay later' },
] as const;

type Props = {
  products: Product[];
  variants: AdminVariant[];
  busy: boolean;
  onError: (message: string) => void;
  onCreate: (bill: CounterBill) => Promise<boolean>;
};

export function NewBillForm({ products, variants, busy, onError, onCreate }: Props) {
  const { width } = useWindowDimensions();
  const twoColumn = width >= 960;
  const [lines, setLines] = useState<BillLine[]>([]);
  const [search, setSearch] = useState('');
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CounterCustomer>(emptyCustomer);
  const [showDetails, setShowDetails] = useState(false);
  const [mode, setMode] = useState<PaymentMode>('full');
  const [partAmount, setPartAmount] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [reference, setReference] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<{ seller: SellerDetails; profile: InvoiceProfile } | null>(null);

  const total = billTotal(lines);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return products.filter(item => item.isActive !== false && `${item.name} ${item.sku ?? ''} ${item.brand ?? ''}`.toLowerCase().includes(query)).slice(0, 8);
  }, [products, search]);

  const stockFor = (line: BillLine) => line.variant_id
    ? variants.find(item => item.id === line.variant_id)?.stock_quantity ?? 0
    : products.find(item => item.id === line.product_id)?.stockQuantity ?? 0;

  const applyLines = (result: { lines: BillLine[]; error?: string }) => {
    if (result.error) onError(result.error);
    else setLines(result.lines);
  };

  const addProduct = (product: Product, variant?: AdminVariant) => {
    if (product.hasVariants && !variant) { setOpenProductId(openProductId === product.id ? null : product.id); return; }
    const line: BillLine = { product_id: product.id, variant_id: variant?.id ?? null, name: product.name, variant_name: variant?.name ?? '', quantity: 1, unit_price: Number(variant?.price ?? product.price) };
    applyLines(addBillLine(lines, line, variant?.stock_quantity ?? product.stockQuantity ?? 0));
    setOpenProductId(null);
  };

  const updateCustomer = (key: keyof CounterCustomer) => (value: string) => setCustomer(current => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!lines.length) { onError('Add at least one item to the bill.'); return; }
    const received = resolveAmountReceived(mode, total, partAmount);
    if (received.error !== undefined) { onError(received.error); return; }
    const created = await onCreate({
      customer: { ...customer, name: customer.name.trim() || 'Walk-in customer', gstin: customer.gstin.trim().toUpperCase() },
      lines,
      amountReceived: received.amount,
      method: received.amount > 0 ? method : 'cash',
      reference: received.amount > 0 ? reference.trim() : '',
    });
    if (created) { setPreviewOpen(false); setLines([]); setCustomer(emptyCustomer); setShowDetails(false); setMode('full'); setPartAmount(''); setReference(''); setSearch(''); }
  };

  const openPreview = () => {
    if (!lines.length) { onError('Add at least one item to preview the bill.'); return; }
    setPreviewOpen(true);
    // Seller and bank details rarely change, so they are fetched once per form.
    if (!previewSource) {
      void Promise.all([loadSellerDetails(), loadInvoiceProfile()])
        .then(([seller, result]) => setPreviewSource({ seller, profile: result.profile }))
        .catch(() => { setPreviewOpen(false); onError('Could not load your business details for the preview. Check the connection and retry.'); });
    }
  };

  const received = resolveAmountReceived(mode, total, partAmount);
  // The React Compiler memoizes this; it only builds HTML while the preview is open.
  const previewHtml = previewOpen && previewSource
    ? buildInvoiceHtml(buildDraftInvoice({
      lines,
      customer,
      seller: previewSource.seller,
      gstRates: Object.fromEntries(products.map(product => [product.id, Number(product.gstRate ?? 0)])),
      amountReceived: received.amount ?? 0,
      today: new Date().toISOString().slice(0, 10),
    }), previewSource.profile, { draft: true })
    : '';

  const previewWarnings = [
    previewSource?.seller.gstEnabled && !customer.state.trim() ? 'GST is on, so this bill needs the customer’s state. Go back, tap “+ Add GST & address” and enter it.' : '',
    received.error ?? '',
  ].filter(Boolean);

  const itemsPanel = (
    <Panel
      title="Items"
      caption="Search by product name, SKU or brand, then tap to add."
      action={lines.length ? <Text style={[st.runningTotal, numeric]}>{itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatINR(total)}</Text> : null}
    >
      <Field label="Find a product" value={search} onChangeText={setSearch} placeholder="e.g. Toyota flip key" autoCorrect={false} />
      {results.length ? (
        <View style={st.results}>
          {results.map(product => (
            <View key={product.id}>
              <Pressable onPress={() => addProduct(product)} style={({ pressed }) => [st.result, pressed && st.resultPressed]}>
                <View style={st.flex}>
                  <Text style={st.resultName} numberOfLines={1}>{product.name}</Text>
                  <Text style={st.resultMeta}>{product.hasVariants ? 'Choose an option' : `${product.stockQuantity ?? 0} in stock`}</Text>
                </View>
                <Text style={[st.resultPrice, numeric]}>{product.hasVariants ? product.priceLabel : formatINR(product.price)}</Text>
                <Text style={st.addMark}>{product.hasVariants ? (openProductId === product.id ? '–' : '›') : '+'}</Text>
              </Pressable>
              {openProductId === product.id ? (
                <View style={st.options}>
                  {variants.filter(item => item.product_id === product.id).map(variant => (
                    <Pressable key={variant.id} disabled={variant.stock_quantity <= 0} onPress={() => addProduct(product, variant)} style={[st.option, variant.stock_quantity <= 0 && st.optionOut]}>
                      <Text style={st.optionName}>{variant.name}</Text>
                      <Text style={[st.optionMeta, numeric]}>{formatINR(variant.price)} · {variant.stock_quantity > 0 ? `${variant.stock_quantity} in stock` : 'Out of stock'}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : search.trim() ? <Text style={st.noMatch}>No active product matches “{search.trim()}”.</Text> : null}

      {lines.length ? (
        <View style={st.lines}>
          {lines.map((line, index) => (
            <View key={`${line.product_id}:${line.variant_id ?? ''}`} style={st.line}>
              <View style={st.flex}>
                <Text style={st.lineName} numberOfLines={2}>{line.name}</Text>
                <Text style={[st.lineMeta, numeric]}>{line.variant_name ? `${line.variant_name} · ` : ''}{formatINR(line.unit_price)} each</Text>
              </View>
              <View style={st.stepper}>
                <Pressable accessibilityLabel={`Decrease ${line.name}`} onPress={() => applyLines(setBillLineQuantity(lines, index, line.quantity - 1, stockFor(line)))} style={st.stepButton}><Text style={st.stepGlyph}>−</Text></Pressable>
                <Text style={[st.stepValue, numeric]}>{line.quantity}</Text>
                <Pressable accessibilityLabel={`Increase ${line.name}`} onPress={() => applyLines(setBillLineQuantity(lines, index, line.quantity + 1, stockFor(line)))} style={st.stepButton}><Text style={st.stepGlyph}>+</Text></Pressable>
              </View>
              <Text style={[st.lineTotal, numeric]}>{formatINR(line.quantity * line.unit_price)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyNote title="No items yet" body="Search above and tap a product to add it to this bill." />
      )}
    </Panel>
  );

  const checkoutPanel = (
    <View style={st.checkout}>
      <Panel title="Customer" caption="Optional for walk-in sales.">
        <Field label="Name" value={customer.name} onChangeText={updateCustomer('name')} placeholder="Walk-in customer" />
        <Field label="Phone" value={customer.phone} onChangeText={updateCustomer('phone')} keyboardType="phone-pad" placeholder="For the invoice and reminders" />
        <Pressable onPress={() => setShowDetails(open => !open)} accessibilityRole="button" accessibilityState={{ expanded: showDetails }}>
          <Text style={st.disclosure}>{showDetails ? '− Hide GST & address' : '+ Add GST & address'}</Text>
        </Pressable>
        {showDetails ? (
          <View style={st.details}>
            <Field label="GSTIN" value={customer.gstin} onChangeText={updateCustomer('gstin')} autoCapitalize="characters" hint="Only for business buyers who need a tax invoice." />
            <Field label="Address" value={customer.address} onChangeText={updateCustomer('address')} />
            <View style={st.split}>
              <View style={st.flex}><Field label="City" value={customer.city} onChangeText={updateCustomer('city')} /></View>
              <View style={st.flex}><Field label="PIN code" value={customer.postal_code} onChangeText={updateCustomer('postal_code')} keyboardType="number-pad" /></View>
            </View>
            <Field label="State" value={customer.state} onChangeText={updateCustomer('state')} hint="Decides CGST + SGST or IGST on the invoice." />
          </View>
        ) : null}
      </Panel>

      <Panel title="Payment">
        <Segmented options={paymentModes} value={mode} onChange={setMode} />
        {mode === 'part' ? <Field label="Amount received now" value={partAmount} onChangeText={setPartAmount} keyboardType="decimal-pad" placeholder="₹0" /> : null}
        {mode !== 'later' ? (
          <>
            <View style={st.chips}>{PAYMENT_METHODS.map(item => <Chip key={item} label={paymentMethodLabel(item)} selected={method === item} onPress={() => setMethod(item)} />)}</View>
            {method !== 'cash' ? <Field label={method === 'upi' ? 'UPI reference' : 'Reference'} value={reference} onChangeText={setReference} placeholder="Optional" /> : null}
          </>
        ) : <Text style={st.laterNote}>The full amount will show as due. Record payments later from Invoices.</Text>}
      </Panel>

      <View style={[st.summary, lines.length ? stickyOnWeb : null]}>
        <View style={st.summaryRow}>
          <Text style={st.summaryLabel}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
          <Text style={[st.summaryTotal, numeric]}>{formatINR(total)}</Text>
        </View>
        <View style={st.summaryActions}>
          <View style={st.previewAction}><Button wide variant="secondary" label="Preview bill" onPress={openPreview} disabled={!lines.length} /></View>
          <View style={st.createAction}><Button wide label={busy ? 'Creating bill…' : 'Create bill'} onPress={() => void submit()} disabled={busy || !lines.length} /></View>
        </View>
      </View>
    </View>
  );

  const preview = (
    <BillPreviewModal
      visible={previewOpen}
      html={previewHtml}
      loading={!previewSource}
      warnings={previewWarnings}
      busy={busy}
      onClose={() => setPreviewOpen(false)}
      onCreate={() => void submit()}
    />
  );

  return twoColumn
    ? <View style={st.columns}><View style={st.mainColumn}>{itemsPanel}</View><View style={st.sideColumn}>{checkoutPanel}</View>{preview}</View>
    : <View style={st.stack}>{itemsPanel}{checkoutPanel}{preview}</View>;
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  columns: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  mainColumn: { flex: 3 },
  sideColumn: { flex: 2, minWidth: 320 },
  stack: { gap: 14 },
  checkout: { gap: 14 },
  results: { borderWidth: 1, borderColor: A.line, borderRadius: 10, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: A.panel, borderBottomWidth: 1, borderBottomColor: A.line },
  resultPressed: { backgroundColor: A.sunken },
  resultName: { color: A.ink, fontSize: 14, fontWeight: '700', fontFamily: A.font },
  resultMeta: { color: A.muted, fontSize: 12, marginTop: 2, fontFamily: A.font },
  resultPrice: { color: A.ink, fontSize: 13, fontWeight: '700', fontFamily: A.font },
  addMark: { width: 22, textAlign: 'center', color: A.brand, fontSize: 18, fontWeight: '700', fontFamily: A.font },
  options: { backgroundColor: A.sunken, paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: A.line },
  option: { backgroundColor: A.panel, borderWidth: 1, borderColor: A.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  optionOut: { opacity: 0.5 },
  optionName: { color: A.ink, fontSize: 13, fontWeight: '700', fontFamily: A.font },
  optionMeta: { color: A.muted, fontSize: 12, marginTop: 2, fontFamily: A.font },
  noMatch: { color: A.muted, fontSize: 13, fontFamily: A.font },
  lines: { borderTopWidth: 1, borderTopColor: A.line },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: A.line },
  lineName: { color: A.ink, fontSize: 14, fontWeight: '700', fontFamily: A.font },
  lineMeta: { color: A.muted, fontSize: 12, marginTop: 2, fontFamily: A.font },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: A.lineStrong, borderRadius: 9 },
  stepButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { color: A.brand, fontSize: 17, fontWeight: '700', fontFamily: A.font },
  stepValue: { minWidth: 26, textAlign: 'center', color: A.ink, fontSize: 14, fontWeight: '800', fontFamily: A.font },
  lineTotal: { minWidth: 76, textAlign: 'right', color: A.ink, fontSize: 14, fontWeight: '800', fontFamily: A.font },
  disclosure: { color: A.brand, fontSize: 13, fontWeight: '700', fontFamily: A.font },
  details: { gap: 12, paddingTop: 4 },
  split: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  laterNote: { color: A.body, fontSize: 13, lineHeight: 19, fontFamily: A.font },
  summaryActions: { flexDirection: 'row', gap: 10 },
  previewAction: { flex: 1 },
  createAction: { flex: 1.4 },
  runningTotal: { color: A.ink, fontSize: 13, fontWeight: '800', fontFamily: A.font },
  summary: { backgroundColor: A.panel, borderWidth: 1, borderColor: A.lineStrong, borderRadius: 12, padding: 16, gap: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  summaryLabel: { color: A.muted, fontSize: 13, fontWeight: '700', fontFamily: A.font },
  summaryTotal: { color: A.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, fontFamily: A.font },
});
