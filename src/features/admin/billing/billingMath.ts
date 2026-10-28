// Pure billing rules shared by the admin billing screens. No React or Supabase here so it stays unit-testable.

type Amount = number | string | null | undefined;

export type InvoiceAmounts = {
  status: string;
  total: Amount;
  paid_total: Amount;
  credited_total: Amount;
};

export type BillLine = {
  product_id: string;
  variant_id: string | null;
  name: string;
  variant_name: string;
  quantity: number;
  unit_price: number;
};

export type InvoicePaymentState = 'paid' | 'partial' | 'unpaid' | 'void';
export type PaymentMode = 'full' | 'part' | 'later';
type LinesResult = { lines: BillLine[]; error?: string };

const toPaise = (value: Amount) => Math.round(Number(value ?? 0) * 100);
const fromPaise = (paise: number) => paise / 100;

export function invoiceDue(invoice: InvoiceAmounts): number {
  return fromPaise(Math.max(0, toPaise(invoice.total) - toPaise(invoice.paid_total) - toPaise(invoice.credited_total)));
}

export function invoicePaymentState(invoice: InvoiceAmounts): InvoicePaymentState {
  if (invoice.status !== 'issued') return 'void';
  if (invoiceDue(invoice) === 0) return 'paid';
  return toPaise(invoice.paid_total) + toPaise(invoice.credited_total) > 0 ? 'partial' : 'unpaid';
}

export function summarizeInvoices(invoices: readonly InvoiceAmounts[]) {
  const issued = invoices.filter(invoice => invoice.status === 'issued');
  const open = issued.filter(invoice => invoiceDue(invoice) > 0);
  return {
    issuedCount: issued.length,
    openCount: open.length,
    outstanding: fromPaise(open.reduce((sum, invoice) => sum + toPaise(invoiceDue(invoice)), 0)),
  };
}

const sameItem = (a: BillLine, b: BillLine) => a.product_id === b.product_id && a.variant_id === b.variant_id;
const stockError = (stockAvailable: number) => `Only ${stockAvailable} in stock for this item.`;

export function addBillLine(lines: BillLine[], next: BillLine, stockAvailable: number): LinesResult {
  const index = lines.findIndex(existing => sameItem(existing, next));
  const quantity = (index >= 0 ? lines[index].quantity : 0) + next.quantity;
  if (quantity > stockAvailable) return { lines, error: stockError(stockAvailable) };
  if (index < 0) return { lines: [...lines, next] };
  return { lines: lines.map((existing, i) => (i === index ? { ...existing, quantity } : existing)) };
}

export function setBillLineQuantity(lines: BillLine[], index: number, quantity: number, stockAvailable: number): LinesResult {
  if (quantity <= 0) return { lines: lines.filter((_, i) => i !== index) };
  if (quantity > stockAvailable) return { lines, error: stockError(stockAvailable) };
  return { lines: lines.map((existing, i) => (i === index ? { ...existing, quantity } : existing)) };
}

export function billTotal(lines: readonly BillLine[]): number {
  return fromPaise(lines.reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price * 100), 0));
}

export function resolveAmountReceived(mode: PaymentMode, total: number, partInput: string): { amount: number; error?: undefined } | { error: string; amount?: undefined } {
  if (mode === 'full') return { amount: total };
  if (mode === 'later') return { amount: 0 };
  const trimmed = partInput.trim();
  const amount = Number(trimmed);
  if (!trimmed || !Number.isFinite(amount) || amount <= 0) return { error: 'Enter the amount received so far.' };
  if (amount >= total) return { error: 'A part payment must be less than the bill total. Choose “Paid in full” instead.' };
  return { amount };
}

export function formatINR(value: Amount): string {
  const amount = Number(value ?? 0);
  const hasPaise = Math.round(amount * 100) % 100 !== 0;
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 })}`;
}

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  other: 'Other',
};

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other'] as const;

export function paymentMethodLabel(method: string): string {
  if (methodLabels[method]) return methodLabels[method];
  const words = method.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
