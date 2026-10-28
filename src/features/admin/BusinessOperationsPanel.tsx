import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '@/lib/supabase';

type Section = 'Inventory' | 'Purchasing' | 'Expenses' | 'Reports' | 'Team' | 'Audit' | 'Billing' | 'Sales' | 'CreditNotes';
type ProductRow = { id: string; name: string; stock_quantity: number; has_variants: boolean; reorder_level: number };
type VariantRow = { id: string; product_id: string; name: string; stock_quantity: number; reorder_level: number; sku: string | null };
type SupplierRow = { id: string; name: string; phone: string; gstin: string; is_active: boolean };
type PurchaseRow = { id: string; order_code: string; status: string; total: number; paid_total: number; payment_status: string; ordered_at: string; suppliers?: { name: string } | null; purchase_order_items?: { id: string; product_name: string; variant_name: string; quantity_ordered: number; quantity_received: number; unit_cost: number }[] };
type ExpenseRow = { id: string; expense_date: string; category: string; description: string; amount: number; gst_amount: number; payment_method: string; reference: string };
type MovementRow = { id: string; product_name: string; variant_name: string; movement_type: string; quantity_change: number; quantity_before: number; quantity_after: number; reason: string; created_at: string };
type TeamRow = { user_id: string; display_name: string; access_role: string; created_at: string };
type AuditRow = { id: number; actor_id: string | null; table_name: string; record_id: string; action: string; changed_columns: string[]; created_at: string };
type StaffInvoiceRow = { id: string; invoice_code: string; issue_date: string; due_date: string | null; payment_status: string; status: string; total: number; paid_total: number; credited_total: number; buyer_name: string; buyer_phone: string };
type StaffOrderRow = { id: string; order_number: number; status: string; total: number; shipping_name: string; shipping_phone: string; shipping_city: string; created_at: string };
type ReturnInvoiceItem = { id: string; product_id: string | null; variant_id: string | null; product_name: string; variant_name: string; sku: string; quantity: number; returned_quantity: number; unit_price: number; line_total: number };
type ReturnInvoice = { id: string; invoice_code: string; buyer_name: string; total: number; paid_total: number; credited_total: number; billing_invoice_items: ReturnInvoiceItem[] };
type CreditNoteRow = { id: string; credit_note_code: string; invoice_id: string; issue_date: string; reason: string; total: number; billing_credit_note_items: { id: string; product_name: string; variant_name: string; quantity: number; restocked: boolean }[]; billing_credit_note_refunds: { id: string; amount: number; payment_method: string; reference: string; refunded_at: string }[]; billing_invoices: { buyer_name: string; total: number; paid_total: number; credited_total: number } | null };

const roleChoices = ['manager', 'inventory', 'billing', 'sales', 'viewer'];
const paymentMethods = ['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other'];
const color = { ink: '#193438', muted: '#667772', gold: '#9B7841', canvas: '#F3F0E9', card: '#FCFBF8', line: '#E7E2D9', green: '#365A47', red: '#97564D' };

export function BusinessOperationsPanel({ section }: { section: Section }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [staffInvoices, setStaffInvoices] = useState<StaffInvoiceRow[]>([]);
  const [staffOrders, setStaffOrders] = useState<StaffOrderRow[]>([]);
  const [report, setReport] = useState<Record<string, number>>({});
  const [activePayment, setActivePayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [purchasePaymentId, setPurchasePaymentId] = useState<string | null>(null);
  const [purchasePaymentAmount, setPurchasePaymentAmount] = useState('');
  const [returnInvoices, setReturnInvoices] = useState<ReturnInvoice[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [returnInvoiceId, setReturnInvoiceId] = useState('');
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('1');
  const [returnReason, setReturnReason] = useState('');
  const [restockReturn, setRestockReturn] = useState(false);
  const [activeRefund, setActiveRefund] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('adjustment');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseProduct, setPurchaseProduct] = useState('');
  const [purchaseVariant, setPurchaseVariant] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState('1');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchaseGst, setPurchaseGst] = useState('0');
  const [expenseCategory, setExpenseCategory] = useState('Operating expenses');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseGst, setExpenseGst] = useState('0');
  const [expenseMethod, setExpenseMethod] = useState('cash');
  const [expenseReference, setExpenseReference] = useState('');
  const [memberId, setMemberId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('inventory');

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    try {
      const queries: [PromiseLike<{ data: any; error: any }>, (rows: any) => void][] = [];
      const catalog = () => {
        queries.push([client.from('products').select('id,name,stock_quantity,has_variants,reorder_level').order('name').limit(1000), setProducts]);
        queries.push([client.from('product_variants').select('id,product_id,name,stock_quantity,reorder_level,sku').eq('is_active', true).order('name').limit(2000), setVariants]);
      };
      if (section === 'Inventory' || section === 'Purchasing') catalog();
      if (section === 'Inventory') queries.push([client.from('inventory_movements').select('id,product_name,variant_name,movement_type,quantity_change,quantity_before,quantity_after,reason,created_at').order('created_at', { ascending: false }).limit(150), setMovements]);
      if (section === 'Purchasing') {
        queries.push([client.from('suppliers').select('id,name,phone,gstin,is_active').order('name').limit(500), setSuppliers]);
        queries.push([client.from('purchase_orders').select('id,order_code,status,total,paid_total,payment_status,ordered_at,suppliers(name),purchase_order_items(id,product_name,variant_name,quantity_ordered,quantity_received,unit_cost)').order('created_at', { ascending: false }).limit(100), setPurchases]);
      }
      if (section === 'Expenses') queries.push([client.from('business_expenses').select('id,expense_date,category,description,amount,gst_amount,payment_method,reference').order('expense_date', { ascending: false }).limit(250), setExpenses]);
      if (section === 'Billing') queries.push([client.from('billing_invoices').select('id,invoice_code,issue_date,due_date,payment_status,status,total,paid_total,credited_total,buyer_name,buyer_phone').order('issue_date', { ascending: false }).limit(250), setStaffInvoices]);
      if (section === 'CreditNotes') {
        queries.push([client.from('billing_invoices').select('id,invoice_code,buyer_name,total,paid_total,credited_total,billing_invoice_items(id,product_id,variant_id,product_name,variant_name,sku,quantity,returned_quantity,unit_price,line_total)').eq('status','issued').order('issue_date', { ascending: false }).limit(250), setReturnInvoices]);
        queries.push([client.from('billing_credit_notes').select('id,credit_note_code,invoice_id,issue_date,reason,total,billing_credit_note_items(id,product_name,variant_name,quantity,restocked),billing_credit_note_refunds(id,amount,payment_method,reference,refunded_at),billing_invoices(buyer_name,total,paid_total,credited_total)').order('issue_date', { ascending: false }).limit(250), setCreditNotes]);
      }
      if (section === 'Sales') queries.push([client.from('orders').select('id,order_number,status,total,shipping_name,shipping_phone,shipping_city,created_at').order('created_at', { ascending: false }).limit(250), setStaffOrders]);
      if (section === 'Reports') {
        const { data, error } = await client.rpc('get_business_report_summary');
        if (error) throw error;
        setReport((data ?? {}) as Record<string, number>);
      }
      if (section === 'Team') queries.push([client.from('business_team_members').select('user_id,display_name,access_role,created_at').order('created_at', { ascending: false }).limit(250), setTeam]);
      if (section === 'Audit') queries.push([client.from('business_audit_events').select('id,actor_id,table_name,record_id,action,changed_columns,created_at').order('created_at', { ascending: false }).limit(100), setAudit]);
      const results = await Promise.all(queries.map(([query]) => query));
      let failed = false;
      results.forEach((result, index) => {
        if (result.error) { failed = true; throw result.error; }
        queries[index][1](result.data ?? []);
      });
      if (!failed) setMessage('');
    } catch {
      setMessage('This section could not load. Check the business operations migration, role access, and connection, then refresh.');
    }
  }, [section]);

  // Load section data on mount and whenever the selected admin section changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); }
    catch { setMessage('Could not complete this action. Check the details and connection, then retry.'); }
    finally { setBusy(false); }
  };

  const selectedProductVariants = useMemo(() => variants.filter(item => item.product_id === selectedProduct), [variants, selectedProduct]);
  const purchaseProductVariants = useMemo(() => variants.filter(item => item.product_id === purchaseProduct), [variants, purchaseProduct]);
  const lowStock = [...products.filter(item => !item.has_variants && item.stock_quantity <= item.reorder_level).map(item => ({ id: item.id, name: item.name, stock: item.stock_quantity, threshold: item.reorder_level })), ...variants.filter(item => item.stock_quantity <= item.reorder_level).map(item => ({ id: item.id, name: `${products.find(product => product.id === item.product_id)?.name ?? 'Product'} · ${item.name}`, stock: item.stock_quantity, threshold: item.reorder_level }))];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyExpenses = expenses.filter(item => item.expense_date.startsWith(currentMonth)).reduce((sum, item) => sum + Number(item.amount), 0);
  const outstandingPurchases = purchases.reduce((sum, item) => sum + Math.max(0, Number(item.total) - Number(item.paid_total)), 0);
  const monthlySales = Number(report.monthly_sales ?? 0);
  const monthlyCollections = Number(report.monthly_collections ?? 0);
  const receivables = Number(report.receivables ?? 0);

  const addSupplier = async () => {
    if (!supabase || supplierName.trim().length < 2) { setMessage('Enter the supplier name.'); return; }
    const { error } = await supabase.from('suppliers').insert({ name: supplierName.trim(), phone: supplierPhone.trim(), gstin: supplierGstin.trim().toUpperCase() });
    if (error) throw error;
    setSupplierName(''); setSupplierPhone(''); setSupplierGstin(''); setMessage('Supplier saved.'); await load();
  };

  const adjustStock = async () => {
    if (!supabase) return;
    const delta = Number(adjustment);
    if (!selectedProduct || !Number.isInteger(delta) || delta === 0 || adjustmentReason.trim().length < 3) { setMessage('Choose an item, enter a non-zero whole-number change, and provide a reason.'); return; }
    const { error } = await supabase.rpc('adjust_inventory', { p_product_id: selectedProduct, p_variant_id: selectedVariant || null, p_delta: delta, p_reason: adjustmentReason.trim(), p_movement_type: adjustmentType });
    if (error) throw error;
    setAdjustment(''); setAdjustmentReason(''); setMessage('Stock adjusted and recorded in the inventory ledger.'); await load();
  };

  const saveReorderLevel = async () => {
    if (!supabase || !selectedProduct) { setMessage('Choose a product first.'); return; }
    const level = Number(reorderLevel);
    if (!Number.isInteger(level) || level < 0 || level > 100000) { setMessage('Reorder level must be a whole number from 0 to 100000.'); return; }
    if (products.find(item => item.id === selectedProduct)?.has_variants && !selectedVariant) { setMessage('Choose a variant to configure its reorder level.'); return; }
    const { error } = await supabase.rpc('set_inventory_reorder_level', { p_product_id: selectedProduct, p_variant_id: selectedVariant || null, p_level: level });
    if (error) throw error;
    setMessage('Reorder level saved. Low-stock watch uses this threshold.'); await load();
  };

  const createPurchase = async () => {
    if (!supabase) return;
    const quantity = Number(purchaseQuantity); const cost = Number(purchaseCost); const gst = Number(purchaseGst);
    if (!purchaseSupplier || !purchaseProduct || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(gst) || gst < 0 || gst > 100) { setMessage('Choose a supplier and product, then enter valid quantity, cost, and GST.'); return; }
    const product = products.find(item => item.id === purchaseProduct);
    if (product?.has_variants && !purchaseVariant) { setMessage('Choose a product option before creating this purchase.'); return; }
    const { error } = await supabase.rpc('create_purchase_order', { p_supplier_id: purchaseSupplier, p_items: [{ product_id: purchaseProduct, variant_id: purchaseVariant || null, quantity, unit_cost: cost, gst_rate: gst }] });
    if (error) throw error;
    setPurchaseQuantity('1'); setPurchaseCost(''); setPurchaseGst('0'); setMessage('Purchase order created. Receive stock when the goods arrive.'); await load();
  };

  const receivePurchase = async (purchase: PurchaseRow) => {
    if (!supabase) return;
    const lines = (purchase.purchase_order_items ?? []).filter(item => item.quantity_ordered > item.quantity_received).map(item => ({ line_id: item.id, quantity: item.quantity_ordered - item.quantity_received }));
    if (!lines.length) { setMessage('There is no remaining quantity to receive.'); return; }
    const { error } = await supabase.rpc('receive_purchase_order', { p_order_id: purchase.id, p_items: lines });
    if (error) throw error;
    setMessage(`${purchase.order_code} received. Stock and inventory history updated.`); await load();
  };

  const recordPurchasePayment = async (purchase: PurchaseRow) => {
    if (!supabase) return;
    const amount = Number(purchasePaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setMessage('Enter a supplier payment amount greater than zero.'); return; }
    const { error } = await supabase.rpc('record_purchase_payment', { p_order_id: purchase.id, p_amount: amount, p_method: expenseMethod, p_reference: expenseReference.trim() });
    if (error) throw error;
    setPurchasePaymentId(null); setPurchasePaymentAmount(''); setExpenseReference(''); setMessage(`Payment recorded for ${purchase.order_code}.`); await load();
  };

  const recordStaffPayment = async (invoice: StaffInvoiceRow) => {
    if (!supabase) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setMessage('Enter a payment amount greater than zero.'); return; }
    const { error } = await supabase.rpc('record_business_invoice_payment', { p_invoice_id: invoice.id, p_amount: amount, p_method: expenseMethod, p_reference: expenseReference.trim() });
    if (error) throw error;
    setActivePayment(null); setPaymentAmount(''); setExpenseReference(''); setMessage(`Payment recorded for ${invoice.invoice_code}.`); await load();
  };

  const createCreditNote = async () => {
    if (!supabase) return;
    const qty = Number(returnQuantity);
    const invoice = returnInvoices.find(item => item.id === returnInvoiceId);
    const line = invoice?.billing_invoice_items.find(item => item.id === returnItemId);
    if (!invoice || !line || !Number.isInteger(qty) || qty < 1 || qty > line.quantity-line.returned_quantity || returnReason.trim().length < 3) { setMessage('Choose an invoice and item, enter a valid remaining quantity, and provide a return reason.'); return; }
    const { error } = await supabase.rpc('issue_business_credit_note', { p_invoice_id: invoice.id, p_items: [{ invoice_item_id: line.id, quantity: qty, restock: restockReturn }], p_reason: returnReason.trim() });
    if (error) throw error;
    setReturnReason(''); setReturnQuantity('1'); setReturnItemId(''); setRestockReturn(false); setMessage('Credit note issued. Invoice balance and stock ledger updated.'); await load();
  };

  const recordCustomerRefund = async (note: CreditNoteRow) => {
    if (!supabase) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setMessage('Enter a refund amount greater than zero.'); return; }
    const { error } = await supabase.rpc('record_business_credit_note_refund', { p_credit_note_id: note.id, p_amount: amount, p_method: expenseMethod, p_reference: expenseReference.trim() });
    if (error) throw error;
    setActiveRefund(null); setRefundAmount(''); setExpenseReference(''); setMessage(`Refund recorded for ${note.credit_note_code}.`); await load();
  };

  const updateSalesStatus = async (order: StaffOrderRow, next: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id);
    if (error) throw error;
    setMessage(`Order #${order.order_number} updated to ${next}.`); await load();
  };

  const addExpense = async () => {
    if (!supabase) return;
    const amount = Number(expenseAmount); const gst = Number(expenseGst);
    if (expenseCategory.trim().length < 2 || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(gst) || gst < 0 || gst > amount) { setMessage('Enter a category, a positive amount, and GST between zero and the expense amount.'); return; }
    const { error } = await supabase.from('business_expenses').insert({ category: expenseCategory.trim(), description: expenseDescription.trim(), amount, gst_amount: gst, payment_method: expenseMethod, reference: expenseReference.trim() });
    if (error) throw error;
    setExpenseDescription(''); setExpenseAmount(''); setExpenseGst('0'); setExpenseReference(''); setMessage('Expense recorded.'); await load();
  };

  const saveMember = async () => {
    if (!supabase || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberId.trim())) { setMessage('Enter a valid user UUID from Supabase Authentication.'); return; }
    const { error } = await supabase.from('business_team_members').upsert({ user_id: memberId.trim(), display_name: memberName.trim(), access_role: memberRole, created_by: (await supabase.auth.getUser()).data.user?.id }, { onConflict: 'user_id' });
    if (error) throw error;
    setMemberId(''); setMemberName(''); setMessage('Team permissions updated. The member should sign in again to refresh access.'); await load();
  };

  const removeMember = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('business_team_members').delete().eq('user_id', id);
    if (error) throw error;
    setMessage('Business access removed.'); await load();
  };

  const exportCsv = async () => {
    const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csvRows = section === 'Inventory'
      ? [['Product','Variant','Movement','Change','Before','After','Reason','Date'], ...movements.map(row => [row.product_name,row.variant_name,row.movement_type,row.quantity_change,row.quantity_before,row.quantity_after,row.reason,row.created_at])]
      : section === 'Expenses'
        ? [['Date','Category','Description','Amount INR','GST INR','Method','Reference'], ...expenses.map(row => [row.expense_date,row.category,row.description,row.amount,row.gst_amount,row.payment_method,row.reference])]
        : section === 'Billing'
          ? [['Invoice','Issue date','Due date','Customer','Phone','Status','Total INR','Paid INR','Due INR'], ...staffInvoices.map(row => [row.invoice_code,row.issue_date,row.due_date,row.buyer_name,row.buyer_phone,row.payment_status,row.total,row.paid_total,Math.max(0,Number(row.total)-Number(row.paid_total))])]
          : section === 'CreditNotes'
            ? [['Credit note','Invoice','Date','Customer','Reason','Total INR','Returned items'], ...creditNotes.map(row => [row.credit_note_code,row.invoice_id,row.issue_date,row.billing_invoices?.buyer_name,row.reason,row.total,(row.billing_credit_note_items ?? []).map(item => `${item.product_name} x${item.quantity}`).join('; ')])]
          : section === 'Sales'
            ? [['Order','Date','Customer','Phone','City','Status','Total INR'], ...staffOrders.map(row => [row.order_number,row.created_at,row.shipping_name,row.shipping_phone,row.shipping_city,row.status,row.total])]
            : section === 'Reports'
              ? [['Metric','INR or count'], ...Object.entries(report).map(([key,value]) => [key,value])]
        : [['Purchase order','Supplier','Date','Status','Total INR','Paid INR','Due INR'], ...purchases.map(row => [row.order_code,row.suppliers?.name,row.ordered_at,row.status,row.total,row.paid_total,Number(row.total)-Number(row.paid_total)])];
    await Share.share({ title: `Giriraja ${section} export`, message: csvRows.map(row => row.map(csvCell).join(',')).join('\n') });
  };

  return <View style={styles.wrap}>
    <View style={styles.headingRow}><View style={styles.copy}><Text style={styles.title}>{section}</Text><Text style={styles.subtitle}>{sectionDescription[section]}</Text></View><Action label="Refresh" secondary onPress={() => void load()} /></View>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <ScrollView horizontal style={styles.exportRail} contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
      {['Inventory','Purchasing','Expenses','Reports','Billing','Sales','CreditNotes'].includes(section) ? <Action label={`Export ${section} CSV`} secondary onPress={() => void run(exportCsv)} /> : null}
    </ScrollView>
    {section === 'Inventory' && <>
      <View style={styles.stats}><Metric label="Tracked items" value={products.length} /><Metric label="Low stock alerts" value={lowStock.length} /><Metric label="Ledger entries" value={movements.length} /></View>
      <Text style={styles.sectionTitle}>Low stock watch</Text>{lowStock.length ? lowStock.slice(0, 30).map(item => <Row key={item.id} title={item.name} detail={`${item.stock} in stock · reorder at ${item.threshold}`} badge="Reorder" />) : <Text style={styles.empty}>No products or variants are below their reorder levels.</Text>}
      <Text style={styles.sectionTitle}>Adjust stock</Text><Card><Text style={styles.label}>Product</Text><ChoiceList items={products.map(item => ({ id: item.id, label: item.name }))} value={selectedProduct} onChange={id => { setSelectedProduct(id); setSelectedVariant(''); const row = products.find(item => item.id === id); if (row) setReorderLevel(String(row.reorder_level)); }} />
        {selectedProductVariants.length > 0 && <><Text style={styles.label}>Variant</Text><ChoiceList items={selectedProductVariants.map(item => ({ id: item.id, label: `${item.name} · ${item.stock_quantity} in stock` }))} value={selectedVariant} onChange={id => { setSelectedVariant(id); const row = selectedProductVariants.find(item => item.id === id); if (row) setReorderLevel(String(row.reorder_level)); }} /></>}
        {Boolean(selectedProduct) && <><Field label="Alert when stock reaches" value={reorderLevel} onChangeText={setReorderLevel} keyboardType="number-pad" /><Action label="Save reorder level" secondary onPress={() => void run(saveReorderLevel)} /></>}
        <Field label="Quantity change (use a negative number to reduce stock)" value={adjustment} onChangeText={setAdjustment} keyboardType="numbers-and-punctuation" />
        <Text style={styles.label}>Movement reason</Text><ChoiceList items={[{id:'adjustment',label:'Stock count / correction'},{id:'damage',label:'Damaged or written off'},{id:'return',label:'Customer return'}]} value={adjustmentType} onChange={setAdjustmentType} />
        <Field label="Reason / reference" value={adjustmentReason} onChangeText={setAdjustmentReason} />
        <Action label={busy ? 'Saving…' : 'Save stock movement'} onPress={() => void run(adjustStock)} />
      </Card>
      <Text style={styles.sectionTitle}>Stock movement ledger</Text>{movements.slice(0,60).map(item => <Row key={item.id} title={`${item.product_name}${item.variant_name ? ` · ${item.variant_name}` : ''}`} detail={`${new Date(item.created_at).toLocaleString()} · ${item.reason}`} badge={`${item.quantity_change > 0 ? '+' : ''}${item.quantity_change} · ${item.movement_type}`} />)}
    </>}
    {section === 'Purchasing' && <>
      <View style={styles.stats}><Metric label="Suppliers" value={suppliers.length} /><Metric label="Purchase orders" value={purchases.length} /><Metric label="Supplier balance" value={`₹${outstandingPurchases.toLocaleString('en-IN')}`} /></View>
      <Text style={styles.sectionTitle}>Supplier directory</Text><Card><Field label="Supplier name" value={supplierName} onChangeText={setSupplierName} /><Field label="Phone" value={supplierPhone} onChangeText={setSupplierPhone} keyboardType="phone-pad" /><Field label="GSTIN (optional)" value={supplierGstin} onChangeText={setSupplierGstin} autoCapitalize="characters" /><Action label="Add supplier" onPress={() => void run(addSupplier)} /></Card>{suppliers.map(item => <Row key={item.id} title={item.name} detail={`${item.phone || 'No phone'}${item.gstin ? ` · GSTIN ${item.gstin}` : ''}`} badge={item.is_active ? 'Active' : 'Inactive'} />)}
      <Text style={styles.sectionTitle}>Create purchase order</Text><Card><Text style={styles.label}>Supplier</Text><ChoiceList items={suppliers.filter(item => item.is_active).map(item => ({id:item.id,label:item.name}))} value={purchaseSupplier} onChange={setPurchaseSupplier} /><Text style={styles.label}>Product</Text><ChoiceList items={products.map(item => ({id:item.id,label:item.name}))} value={purchaseProduct} onChange={id => {setPurchaseProduct(id); setPurchaseVariant('');}} />{purchaseProductVariants.length > 0 && <><Text style={styles.label}>Variant</Text><ChoiceList items={purchaseProductVariants.map(item => ({id:item.id,label:item.name}))} value={purchaseVariant} onChange={setPurchaseVariant} /></>}<Field label="Quantity ordered" value={purchaseQuantity} onChangeText={setPurchaseQuantity} keyboardType="number-pad" /><Field label="Unit cost before GST (INR)" value={purchaseCost} onChangeText={setPurchaseCost} keyboardType="decimal-pad" /><Field label="GST rate (%)" value={purchaseGst} onChangeText={setPurchaseGst} keyboardType="decimal-pad" /><Action label="Create purchase order" onPress={() => void run(createPurchase)} /></Card>
      <Text style={styles.sectionTitle}>Purchase register</Text>{purchases.map(item => <Card key={item.id}><View style={styles.rowHead}><Text style={styles.rowTitle}>{item.order_code}</Text><Text style={styles.badge}>{item.status.replace('_',' ')}</Text></View><Text style={styles.detail}>{item.suppliers?.name ?? 'Supplier'} · {item.ordered_at}</Text>{(item.purchase_order_items ?? []).map(line => <Text key={line.id} style={styles.detail}>{line.product_name}{line.variant_name ? ` · ${line.variant_name}` : ''} · {line.quantity_received}/{line.quantity_ordered} received</Text>)}<Text style={styles.amount}>₹{Number(item.total).toLocaleString('en-IN')} · Due ₹{Math.max(0,Number(item.total)-Number(item.paid_total)).toLocaleString('en-IN')}</Text>{['ordered','partially_received'].includes(item.status) && <Action label="Receive all remaining items" onPress={() => void run(() => receivePurchase(item))} />}{Number(item.total) > Number(item.paid_total) && <Action label={purchasePaymentId === item.id ? "Close payment entry" : "Record supplier payment"} secondary onPress={() => { setPurchasePaymentId(purchasePaymentId === item.id ? null : item.id); setPurchasePaymentAmount(String(Number(item.total)-Number(item.paid_total))); }} />}{purchasePaymentId === item.id && <View style={styles.card}><Field label="Payment amount (INR)" value={purchasePaymentAmount} onChangeText={setPurchasePaymentAmount} keyboardType="decimal-pad" /><Text style={styles.label}>Payment method</Text><ChoiceList items={paymentMethods.map(method => ({id:method,label:method.replace("_"," ")}))} value={expenseMethod} onChange={setExpenseMethod} /><Field label="Reference" value={expenseReference} onChangeText={setExpenseReference} /><Action label="Save supplier payment" onPress={() => void run(() => recordPurchasePayment(item))} /></View>}</Card>)}{!purchases.length && <Text style={styles.empty}>Create a purchase order when you place an order with a supplier.</Text>}
    </>}
    {section === 'Expenses' && <>
      <View style={styles.stats}><Metric label="Expenses this month" value={`₹${monthlyExpenses.toLocaleString('en-IN')}`} /><Metric label="Entries loaded" value={expenses.length} /></View>
      <Text style={styles.sectionTitle}>Record business expense</Text><Card><Field label="Category" value={expenseCategory} onChangeText={setExpenseCategory} /><Field label="Description" value={expenseDescription} onChangeText={setExpenseDescription} /><Field label="Amount (INR)" value={expenseAmount} onChangeText={setExpenseAmount} keyboardType="decimal-pad" /><Field label="GST amount (optional)" value={expenseGst} onChangeText={setExpenseGst} keyboardType="decimal-pad" /><Text style={styles.label}>Payment method</Text><ChoiceList items={paymentMethods.map(item => ({id:item,label:item.replace('_',' ')}))} value={expenseMethod} onChange={setExpenseMethod} /><Field label="Reference / transaction ID" value={expenseReference} onChangeText={setExpenseReference} /><Action label="Save expense" onPress={() => void run(addExpense)} /></Card>
      <Text style={styles.sectionTitle}>Expense register</Text>{expenses.map(item => <Row key={item.id} title={`${item.category} · ₹${Number(item.amount).toLocaleString('en-IN')}`} detail={`${item.expense_date} · ${item.description || item.payment_method}${item.reference ? ` · ${item.reference}` : ''}`} badge={item.payment_method.replace('_',' ')} />)}{!expenses.length && <Text style={styles.empty}>No business expenses recorded yet.</Text>}
    </>}
    {section === 'Reports' && <>
      <View style={styles.stats}><Metric label="Sales this month" value={`₹${monthlySales.toLocaleString('en-IN')}`} /><Metric label="Collections this month" value={`₹${monthlyCollections.toLocaleString('en-IN')}`} /><Metric label="Receivables" value={`₹${receivables.toLocaleString('en-IN')}`} /><Metric label="Overdue receivables" value={`₹${Number(report.overdue_receivables ?? 0).toLocaleString('en-IN')}`} /><Metric label="Output GST this month" value={`₹${Number(report.monthly_output_gst ?? 0).toLocaleString('en-IN')}`} /><Metric label="Input GST this month" value={`₹${Number(report.monthly_input_gst ?? 0).toLocaleString('en-IN')}`} /><Metric label="Expenses this month" value={`₹${Number(report.monthly_expenses ?? 0).toLocaleString('en-IN')}`} /><Metric label="Purchases this month" value={`₹${Number(report.monthly_purchases ?? 0).toLocaleString('en-IN')}`} /><Metric label="Low-stock items" value={Number(report.low_stock_items ?? 0)} /></View>
      <Card><Text style={styles.rowTitle}>Accounting handoff</Text><Text style={styles.detail}>These operational totals support reconciliation. They are not a substitute for reviewed statutory books. Share detailed purchase, inventory, or expense CSVs from their respective sections.</Text></Card>
      <Text style={styles.sectionTitle}>Report exports</Text><Row title="Inventory valuation and movement history" detail="Available from Inventory · Export CSV" /><Row title="Supplier purchases and balances" detail="Available from Purchasing · Export CSV" /><Row title="Business expenses" detail="Available from Expenses · Export CSV" />
    </>}
    {section === 'Billing' && <>
      <View style={styles.stats}><Metric label="Invoices loaded" value={staffInvoices.length} /><Metric label="Open receivables" value={`₹${staffInvoices.filter(item => item.status === 'issued').reduce((sum,item) => sum + Math.max(0,Number(item.total)-Number(item.paid_total)-Number(item.credited_total)),0).toLocaleString('en-IN')}`} /></View>
      <Text style={styles.sectionTitle}>Invoice and receivables register</Text>{staffInvoices.map(invoice => { const due=Math.max(0,Number(invoice.total)-Number(invoice.paid_total)-Number(invoice.credited_total)); return <Card key={invoice.id}><View style={styles.rowHead}><Text style={styles.rowTitle}>{invoice.invoice_code}</Text><Text style={styles.badge}>{invoice.payment_status.replace('_',' ')}</Text></View><Text style={styles.detail}>{invoice.buyer_name} · {invoice.buyer_phone || 'No phone'} · Issued {invoice.issue_date}{invoice.due_date ? ` · Due ${invoice.due_date}` : ''}</Text><Text style={styles.amount}>₹{Number(invoice.total).toLocaleString('en-IN')} · Paid ₹{Number(invoice.paid_total).toLocaleString('en-IN')} · Credited ₹{Number(invoice.credited_total).toLocaleString('en-IN')} · Due ₹{due.toLocaleString('en-IN')}</Text>{invoice.status === 'issued' && due > 0 && <><Action label={activePayment === invoice.id ? 'Close payment entry' : 'Record payment'} secondary onPress={() => { setActivePayment(activePayment === invoice.id ? null : invoice.id); setPaymentAmount(String(due)); }} />{activePayment === invoice.id && <View style={styles.card}><Field label="Payment amount (INR)" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" /><Text style={styles.label}>Payment method</Text><ChoiceList items={paymentMethods.map(item => ({id:item,label:item.replace('_',' ')}))} value={expenseMethod} onChange={setExpenseMethod} /><Field label="Reference" value={expenseReference} onChangeText={setExpenseReference} /><Action label="Save payment" onPress={() => void run(() => recordStaffPayment(invoice))} /></View>}</>}</Card>; })}{!staffInvoices.length && <Text style={styles.empty}>No invoices found.</Text>}
    </>}
    {section === 'CreditNotes' && <>
      <View style={styles.stats}><Metric label="Credit notes" value={creditNotes.length} /><Metric label="Invoices available" value={returnInvoices.length} /><Metric label="Refunds recorded" value={`₹${creditNotes.reduce((sum,note) => sum + (note.billing_credit_note_refunds ?? []).reduce((subtotal,refund) => subtotal + Number(refund.amount),0),0).toLocaleString('en-IN')}`} /></View>
      <Text style={styles.sectionTitle}>Process a customer return</Text><Text style={styles.subtitle}>Returns preserve the original invoice. Issuing a credit note reduces the customer balance; record an outgoing refund separately when money is returned.</Text><Card><Text style={styles.label}>Issued invoice</Text><ChoiceList items={returnInvoices.map(item => ({id:item.id,label:`${item.invoice_code} · ${item.buyer_name}`}))} value={returnInvoiceId} onChange={id => {setReturnInvoiceId(id);setReturnItemId('');}} />
        <Text style={styles.label}>Invoice item with unreturned quantity</Text><ChoiceList items={(returnInvoices.find(item => item.id === returnInvoiceId)?.billing_invoice_items ?? []).filter(item => item.quantity > item.returned_quantity).map(item => ({id:item.id,label:`${item.product_name}${item.variant_name ? ` · ${item.variant_name}` : ''} · ${item.quantity-item.returned_quantity} available`}))} value={returnItemId} onChange={setReturnItemId} />
        <Field label="Return quantity" value={returnQuantity} onChangeText={setReturnQuantity} keyboardType="number-pad" /><Field label="Return reason" value={returnReason} onChangeText={setReturnReason} />
        <Text style={styles.label}>Returned item condition</Text><ChoiceList items={[{id:'no',label:'Do not add to sellable stock'},{id:'yes',label:'Restock as sellable'}]} value={restockReturn ? 'yes' : 'no'} onChange={value => setRestockReturn(value === 'yes')} />
        <Action label="Issue credit note" onPress={() => void run(createCreditNote)} />
      </Card>
      <Text style={styles.sectionTitle}>Credit note register</Text>{creditNotes.map(note => { const refunded=(note.billing_credit_note_refunds ?? []).reduce((sum,item) => sum+Number(item.amount),0); const invoiceRefunded=creditNotes.filter(other => other.invoice_id===note.invoice_id).reduce((sum,other) => sum+(other.billing_credit_note_refunds ?? []).reduce((subtotal,item) => subtotal+Number(item.amount),0),0); const refundDue=Math.max(0,Number(note.billing_invoices?.paid_total ?? 0)+Number(note.billing_invoices?.credited_total ?? 0)-Number(note.billing_invoices?.total ?? 0)-invoiceRefunded); return <Card key={note.id}><View style={styles.rowHead}><Text style={styles.rowTitle}>{note.credit_note_code}</Text><Text style={styles.badge}>{note.issue_date}</Text></View><Text style={styles.detail}>{note.billing_invoices?.buyer_name ?? 'Customer'} · {note.reason}</Text>{(note.billing_credit_note_items ?? []).map(item => <Text key={item.id} style={styles.detail}>{item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ''} · Qty {item.quantity} · {item.restocked ? 'Restocked' : 'Not restocked'}</Text>)}<Text style={styles.amount}>Credit ₹{Number(note.total).toLocaleString('en-IN')} · Refund issued ₹{refunded.toLocaleString('en-IN')}</Text>{refundDue > 0 && <><Action label={activeRefund === note.id ? 'Close refund entry' : `Record refund · ₹${refundDue.toLocaleString('en-IN')} due`} secondary onPress={() => {setActiveRefund(activeRefund === note.id ? null : note.id);setRefundAmount(String(refundDue));}} />{activeRefund === note.id && <View style={styles.card}><Field label="Refund amount (INR)" value={refundAmount} onChangeText={setRefundAmount} keyboardType="decimal-pad" /><Text style={styles.label}>Refund method</Text><ChoiceList items={paymentMethods.map(item => ({id:item,label:item.replace('_',' ')}))} value={expenseMethod} onChange={setExpenseMethod} /><Field label="Reference" value={expenseReference} onChangeText={setExpenseReference} /><Action label="Save refund" onPress={() => void run(() => recordCustomerRefund(note))} /></View>}</>}</Card>; })}{!creditNotes.length && <Text style={styles.empty}>No credit notes issued.</Text>}
    </>}
    {section === 'Sales' && <>
      <View style={styles.stats}><Metric label="Orders" value={staffOrders.length} /><Metric label="Awaiting confirmation" value={staffOrders.filter(item => item.status === 'pending').length} /></View><Text style={styles.sectionTitle}>Order processing</Text>
      {staffOrders.map(order => { const next: Record<string,string> = { pending:'confirmed', confirmed:'processing', processing:'shipped', shipped:'delivered' }; return <Card key={order.id}><View style={styles.rowHead}><Text style={styles.rowTitle}>Order #{order.order_number}</Text><Text style={styles.badge}>{order.status}</Text></View><Text style={styles.detail}>{order.shipping_name} · {order.shipping_phone} · {order.shipping_city} · {new Date(order.created_at).toLocaleDateString()}</Text><Text style={styles.amount}>₹{Number(order.total).toLocaleString('en-IN')}</Text>{next[order.status] && <Action label={`Mark ${next[order.status]}`} onPress={() => void run(() => updateSalesStatus(order,next[order.status]))} />}{['pending','confirmed','processing'].includes(order.status) && <Action label="Cancel order" secondary onPress={() => void run(() => updateSalesStatus(order,'cancelled'))} />}</Card>; })}{!staffOrders.length && <Text style={styles.empty}>No orders found.</Text>}
    </>}
    {section === 'Team' && <>
      <Text style={styles.sectionTitle}>Grant business access</Text><Text style={styles.subtitle}>Get the user UUID from Supabase Authentication. Team members sign in with their own account; permissions are enforced by database policies.</Text><Card><Field label="User UUID" value={memberId} onChangeText={setMemberId} autoCapitalize="none" /><Field label="Display name" value={memberName} onChangeText={setMemberName} /><Text style={styles.label}>Role</Text><ChoiceList items={roleChoices.map(item => ({id:item,label:item.replace('_',' ')}))} value={memberRole} onChange={setMemberRole} /><Action label="Save team access" onPress={() => void run(saveMember)} /></Card>
      <Text style={styles.sectionTitle}>Team members</Text>{team.map(item => <Row key={item.user_id} title={item.display_name || item.user_id} detail={`${item.user_id} · Added ${new Date(item.created_at).toLocaleDateString()}`} badge={item.access_role} action={<Pressable onPress={() => void run(() => removeMember(item.user_id))}><Text style={styles.remove}>Revoke</Text></Pressable>} />)}{!team.length && <Text style={styles.empty}>No additional team access has been granted.</Text>}
    </>}
    {section === 'Audit' && <>
      <Text style={styles.sectionTitle}>Recent changes · {audit.length}</Text><Text style={styles.subtitle}>The audit log stores actors, record IDs, actions, and changed column names. It does not copy customer field values.</Text>{audit.map(item => <Row key={item.id} title={`${item.action} · ${item.table_name}`} detail={`${new Date(item.created_at).toLocaleString()} · ${item.actor_id ?? 'System'} · ${item.changed_columns.join(', ')}`} badge={item.record_id} />)}{!audit.length && <Text style={styles.empty}>No changes recorded yet.</Text>}
    </>}
  </View>;
}

const sectionDescription: Record<Section, string> = {
  Inventory: 'Track on-hand stock, low-stock items, and every adjustment.',
  Purchasing: 'Manage suppliers, purchase orders, goods received, and supplier balances.',
  Expenses: 'Record operating costs and keep a searchable payment register.',
  Reports: 'Review business indicators and prepare accountant handoff exports.',
  Team: 'Grant scoped access to staff using their Supabase user UUID.',
  Audit: 'Review who changed business records and which fields changed.',
  Billing: 'Track issued invoices, payments, and outstanding customer balances.',
  Sales: 'Process customer orders through fulfillment and cancellation.',
  CreditNotes: 'Issue audited return credits, restock sellable returns, and record refunds.',
};

function Card({ children }: React.PropsWithChildren) { return <View style={styles.card}>{children}</View>; }
function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholder={label} placeholderTextColor="#929CA2" style={styles.input} /></View>; }
function Action({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) { return <Pressable onPress={onPress} style={[styles.action, secondary && styles.secondary]}><Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text></Pressable>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function ChoiceList({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) { return <ScrollView horizontal style={styles.choiceScroll} contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>{items.map(item => <Pressable key={item.id} onPress={() => onChange(item.id)} style={[styles.choice, value === item.id && styles.choiceSelected]}><Text style={[styles.choiceText, value === item.id && styles.choiceTextSelected]}>{item.label}</Text></Pressable>)}</ScrollView>; }
function Row({ title, detail, badge, action }: { title: string; detail?: string; badge?: string; action?: React.ReactNode }) { return <View style={styles.row}><View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</View>{badge ? <Text style={styles.badge}>{badge}</Text> : null}{action}</View>; }

const styles = StyleSheet.create({
  wrap: { gap: 13, paddingBottom: 30 }, headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, copy: { flex: 1 }, title: { color: color.ink, fontSize: 22, fontWeight: '800', fontFamily: 'Manrope' }, subtitle: { color: color.muted, fontSize: 12, lineHeight: 19, fontFamily: 'Manrope' },
  message: { color: '#72542A', backgroundColor: '#F5EBD7', borderColor: '#E8D8B7', borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18, fontFamily: 'Manrope' }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, metric: { flexGrow: 1, flexBasis: '44%', minHeight: 80, backgroundColor: color.card, borderColor: color.line, borderWidth: 1, borderRadius: 14, padding: 14, justifyContent: 'center' }, metricValue: { color: color.gold, fontSize: 19, fontWeight: '800', fontFamily: 'Manrope' }, metricLabel: { color: color.muted, fontSize: 11, fontWeight: '700', marginTop: 4, fontFamily: 'Manrope' },
  sectionTitle: { color: color.ink, fontSize: 16, fontWeight: '800', marginTop: 8, fontFamily: 'Manrope' }, card: { backgroundColor: color.card, borderColor: color.line, borderWidth: 1, borderRadius: 16, padding: 15, gap: 11 }, field: { gap: 6 }, label: { color: '#304A46', fontSize: 11, fontWeight: '800', fontFamily: 'Manrope' }, input: { minHeight: 45, borderWidth: 1, borderColor: '#E1DED5', borderRadius: 11, paddingHorizontal: 12, backgroundColor: '#FFF', color: color.ink, fontSize: 13, fontFamily: 'Manrope' },
  action: { alignSelf: 'flex-start', backgroundColor: '#17383C', borderColor: '#21474A', borderWidth: 1, borderRadius: 11, minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 }, actionText: { color: '#F9F5EA', fontSize: 11, fontWeight: '800', fontFamily: 'Manrope' }, secondary: { backgroundColor: '#EFEAE0', borderColor: color.line }, secondaryText: { color: '#334B46' }, exportRail: { flexGrow: 0 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choiceScroll: { flexGrow: 0 }, choice: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#F4F1EA', borderColor: color.line, borderWidth: 1 }, choiceSelected: { backgroundColor: '#17383C', borderColor: '#17383C' }, choiceText: { color: color.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize', fontFamily: 'Manrope' }, choiceTextSelected: { color: '#F9F5EA' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: color.card, borderColor: color.line, borderWidth: 1, borderRadius: 13, padding: 12 }, rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowTitle: { color: color.ink, fontSize: 12, fontWeight: '800', fontFamily: 'Manrope' }, detail: { color: color.muted, fontSize: 11, lineHeight: 16, marginTop: 4, fontFamily: 'Manrope' }, badge: { color: color.green, fontSize: 9, fontWeight: '800', textTransform: 'capitalize', paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#E7EFE8', borderRadius: 8, overflow: 'hidden', fontFamily: 'Manrope' }, amount: { color: color.gold, fontSize: 11, fontWeight: '800', marginTop: 7, fontFamily: 'Manrope' }, empty: { color: color.muted, fontSize: 12, lineHeight: 19, paddingVertical: 7, fontFamily: 'Manrope' }, remove: { color: color.red, fontSize: 11, fontWeight: '800', fontFamily: 'Manrope' },
});
