import assert from 'node:assert/strict';
import test from 'node:test';

import { buildInvoiceHtml, formatBillDate, rupeesInWords } from '../src/features/admin/billing/invoiceDocument.ts';

const invoice = (overrides = {}) => ({
  invoice_code: 'GR-2026-0142',
  issue_date: '2026-10-27',
  status: 'issued',
  payment_status: 'unpaid',
  seller_name: 'Giriraja',
  seller_address: 'No. 12, SP Road',
  seller_city: 'Bengaluru',
  seller_state: 'Karnataka',
  seller_postal_code: '560002',
  seller_gstin: '',
  buyer_name: 'Sri Lakshmi Key Works',
  buyer_phone: '98450 11223',
  buyer_address: '',
  buyer_city: 'Mysuru',
  buyer_state: 'Karnataka',
  buyer_postal_code: '',
  buyer_gstin: '',
  subtotal: 1340,
  cgst_total: 0,
  sgst_total: 0,
  igst_total: 0,
  shipping_fee: 0,
  total: 1340,
  paid_total: 0,
  credited_total: 0,
  notes: '',
  billing_invoice_items: [
    { id: 'a', product_name: 'Tie rod end', variant_name: '', sku: '', hsn_sac: '', quantity: 2, unit_price: 445, gst_rate: 0, taxable_value: 890, cgst: 0, sgst: 0, igst: 0, line_total: 890 },
    { id: 'b', product_name: 'Flip key <shell>', variant_name: '3 button', sku: '', hsn_sac: '8301', quantity: 1, unit_price: 450, gst_rate: 0, taxable_value: 450, cgst: 0, sgst: 0, igst: 0, line_total: 450 },
  ],
  ...overrides,
});
const profile = { phone: '+91 70222 25055', email: 'sales@giriraja.in', bankAccountName: 'Giriraja', bankName: 'Canara Bank', bankAccountNumber: '1234567890', bankIfsc: 'CNRB0001234', bankBranch: 'SP Road', upiId: 'giriraja@upi', terms: 'Goods once sold will not be taken back.' };

test('amounts in words follow the Indian lakh and crore system', () => {
  assert.equal(rupeesInWords(0), 'Rupees Zero Only');
  assert.equal(rupeesInWords(113530), 'Rupees One Lakh Thirteen Thousand Five Hundred Thirty Only');
  assert.equal(rupeesInWords(21500000), 'Rupees Two Crore Fifteen Lakh Only');
  assert.equal(rupeesInWords(1340.5), 'Rupees One Thousand Three Hundred Forty and Fifty Paise Only');
});

test('bill dates print as day.month.year', () => {
  assert.equal(formatBillDate('2026-10-27'), '27.10.2026');
  assert.equal(formatBillDate('2026-01-05T10:00:00Z'), '05.01.2026');
});

test('bill lists every item with serial number, quantity, rate and amount', () => {
  const html = buildInvoiceHtml(invoice(), profile);
  assert.match(html, /<td class="sl">1<\/td>\s*<td class="particulars">Tie rod end/);
  assert.match(html, /<td class="sl">2<\/td>/);
  assert.match(html, /<td class="num">445<\/td>\s*<td class="num">890<\/td>/);
  assert.match(html, /Total[\s\S]*1,340/);
  assert.match(html, /Rupees One Thousand Three Hundred Forty Only/);
  assert.match(html, /GR-2026-0142/);
  assert.match(html, /27\.10\.2026/);
});

test('bill escapes customer-entered text', () => {
  const html = buildInvoiceHtml(invoice({ buyer_name: '<script>alert(1)</script>' }), profile);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Flip key &lt;shell&gt;/);
});

test('seller contact, bank details and signature block appear when configured', () => {
  const html = buildInvoiceHtml(invoice(), profile);
  assert.match(html, /Mobile : \+91 70222 25055/);
  assert.match(html, /E-mail : sales@giriraja\.in/);
  assert.match(html, /Canara Bank/);
  assert.match(html, /CNRB0001234/);
  assert.match(html, /For <b>Giriraja<\/b>/);
  const bare = buildInvoiceHtml(invoice(), {});
  assert.doesNotMatch(bare, /Bank Details/);
  assert.doesNotMatch(bare, /E-mail :/);
});

test('GST invoices are titled tax invoice and show the tax split', () => {
  const intra = buildInvoiceHtml(invoice({ seller_gstin: '29ABCDE1234F1Z5', subtotal: 1135.59, cgst_total: 102.2, sgst_total: 102.2 }), profile);
  assert.match(intra, /TAX INVOICE/);
  assert.match(intra, /GSTIN : 29ABCDE1234F1Z5/);
  assert.match(intra, /CGST[\s\S]*102\.20/);
  assert.match(intra, /SGST/);
  const inter = buildInvoiceHtml(invoice({ seller_gstin: '29ABCDE1234F1Z5', igst_total: 204.41 }), profile);
  assert.match(inter, /IGST[\s\S]*204\.41/);
  assert.doesNotMatch(inter, /CGST/);
  assert.match(buildInvoiceHtml(invoice(), profile), />INVOICE</);
});

test('part-paid bills show received amount and balance due', () => {
  const html = buildInvoiceHtml(invoice({ paid_total: 500 }), profile);
  assert.match(html, /Received[\s\S]*500/);
  assert.match(html, /Balance due[\s\S]*840/);
  assert.doesNotMatch(buildInvoiceHtml(invoice(), profile), /Balance due/);
});
