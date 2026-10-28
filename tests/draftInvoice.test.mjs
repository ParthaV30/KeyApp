import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDraftInvoice } from '../src/features/admin/billing/draftInvoice.ts';
import { buildInvoiceHtml } from '../src/features/admin/billing/invoiceDocument.ts';

const seller = { name: 'Giriraja', address: 'No. 12, S.P. Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560002', gstin: '29ABCDE1234F1Z5', gstEnabled: false };
const customer = { name: '', phone: '98450 11223', address: '', city: '', state: '', postal_code: '', gstin: '' };
const lines = [
  { product_id: 'p1', variant_id: null, name: 'Blank key', variant_name: '', quantity: 3, unit_price: 118 },
  { product_id: 'p2', variant_id: 'v1', name: 'Remote', variant_name: '3 button', quantity: 1, unit_price: 1650 },
];
const rates = { p1: 18, p2: 0 };

test('without GST the draft totals are the plain line totals', () => {
  const draft = buildDraftInvoice({ lines, customer, seller, gstRates: rates, amountReceived: 0, today: '2026-10-28' });
  assert.equal(draft.total, 2004);
  assert.equal(draft.subtotal, 2004);
  assert.equal(draft.seller_gstin, '');
  assert.equal(draft.buyer_name, 'Walk-in customer');
  assert.equal(draft.billing_invoice_items[0].line_total, 354);
  assert.equal(draft.billing_invoice_items[1].variant_name, '3 button');
});

test('with GST, inclusive prices split into taxable value and CGST + SGST the same way the database does', () => {
  const draft = buildDraftInvoice({ lines, customer, seller: { ...seller, gstEnabled: true }, gstRates: rates, amountReceived: 0, today: '2026-10-28' });
  const key = draft.billing_invoice_items[0];
  assert.equal(key.taxable_value, 300);
  assert.equal(draft.cgst_total, 27);
  assert.equal(draft.sgst_total, 27);
  assert.equal(draft.igst_total, 0);
  assert.equal(draft.subtotal, 1950);
  assert.equal(draft.total, 2004);
  assert.equal(draft.seller_gstin, '29ABCDE1234F1Z5');
});

test('a customer in another state gets IGST instead', () => {
  const draft = buildDraftInvoice({ lines, customer: { ...customer, state: 'Tamil Nadu' }, seller: { ...seller, gstEnabled: true }, gstRates: rates, amountReceived: 0, today: '2026-10-28' });
  assert.equal(draft.igst_total, 54);
  assert.equal(draft.cgst_total, 0);
});

test('odd tax amounts put the extra paisa in SGST', () => {
  const draft = buildDraftInvoice({ lines: [{ ...lines[0], quantity: 1, unit_price: 100 }], customer, seller: { ...seller, gstEnabled: true }, gstRates: { p1: 18 }, amountReceived: 0, today: '2026-10-28' });
  assert.equal(draft.subtotal, 84.75);
  assert.equal(draft.cgst_total + draft.sgst_total, 15.25);
  assert.equal(draft.cgst_total, 7.63);
  assert.equal(draft.sgst_total, 7.62);
});

test('the draft is marked so it cannot be mistaken for an issued bill', () => {
  const draft = buildDraftInvoice({ lines, customer, seller, gstRates: rates, amountReceived: 500, today: '2026-10-28' });
  assert.equal(draft.paid_total, 500);
  const html = buildInvoiceHtml(draft, {}, { draft: true });
  assert.match(html, /DRAFT/);
  assert.match(html, /Not a valid invoice/i);
  assert.doesNotMatch(buildInvoiceHtml(draft, {}), /Not a valid invoice/i);
});
