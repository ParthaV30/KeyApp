// Turns an unsaved counter bill into invoice data for preview. Mirrors the GST maths in the
// create_counter_invoice database function (GST-inclusive prices, CGST rounded, remainder to SGST).

import type { BillLine } from './billingMath';
import type { InvoiceDocumentData } from './invoiceDocument';

export type SellerDetails = { name: string; address: string; city: string; state: string; postalCode: string; gstin: string; gstEnabled: boolean };
type DraftCustomer = { name: string; phone: string; address: string; city: string; state: string; postal_code: string; gstin: string };

type DraftInput = {
  lines: BillLine[];
  customer: DraftCustomer;
  seller: SellerDetails;
  gstRates: Record<string, number>;
  amountReceived: number;
  today: string;
};

const paise = (rupees: number) => Math.round(rupees * 100);
const rupees = (value: number) => value / 100;
const normalise = (value: string) => value.trim().toLowerCase();

function isIntraState(seller: SellerDetails, customer: DraftCustomer) {
  const state = normalise(customer.state);
  if (!state) return true;
  return state === normalise(seller.state) || state === seller.gstin.slice(0, 2);
}

export function buildDraftInvoice({ lines, customer, seller, gstRates, amountReceived, today }: DraftInput): InvoiceDocumentData {
  const intra = isIntraState(seller, customer);
  let subtotal = 0; let cgstTotal = 0; let sgstTotal = 0; let igstTotal = 0; let total = 0;

  const items = lines.map((line, index) => {
    const rate = seller.gstEnabled ? gstRates[line.product_id] ?? 0 : 0;
    const gross = paise(line.unit_price * line.quantity);
    const taxable = rate > 0 ? Math.round(gross / (1 + rate / 100)) : gross;
    const tax = gross - taxable;
    const cgst = intra ? Math.round(tax / 2) : 0;
    const sgst = intra ? tax - cgst : 0;
    const igst = intra ? 0 : tax;
    subtotal += taxable; cgstTotal += cgst; sgstTotal += sgst; igstTotal += igst; total += gross;
    return { id: `draft-${index}`, product_name: line.name, variant_name: line.variant_name, hsn_sac: '', quantity: line.quantity, unit_price: line.unit_price, taxable_value: rupees(taxable), line_total: rupees(gross) };
  });

  return {
    invoice_code: 'DRAFT',
    issue_date: today,
    status: 'issued',
    seller_name: seller.name,
    seller_address: seller.address,
    seller_city: seller.city,
    seller_state: seller.state,
    seller_postal_code: seller.postalCode,
    seller_gstin: seller.gstEnabled ? seller.gstin : '',
    buyer_name: customer.name.trim() || 'Walk-in customer',
    buyer_phone: customer.phone,
    buyer_address: customer.address,
    buyer_city: customer.city,
    buyer_state: customer.state,
    buyer_postal_code: customer.postal_code,
    buyer_gstin: customer.gstin.trim().toUpperCase(),
    subtotal: rupees(subtotal),
    cgst_total: rupees(cgstTotal),
    sgst_total: rupees(sgstTotal),
    igst_total: rupees(igstTotal),
    shipping_fee: 0,
    total: rupees(total),
    paid_total: amountReceived,
    credited_total: 0,
    notes: '',
    billing_invoice_items: items,
  };
}
