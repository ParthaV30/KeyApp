import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addBillLine,
  billTotal,
  formatINR,
  invoiceDue,
  invoicePaymentState,
  paymentMethodLabel,
  resolveAmountReceived,
  setBillLineQuantity,
  summarizeInvoices,
} from '../src/features/admin/billing/billingMath.ts';

const invoice = (overrides = {}) => ({ status: 'issued', total: 1000, paid_total: 0, credited_total: 0, ...overrides });
const line = (overrides = {}) => ({ product_id: 'p1', variant_id: null, name: 'Blank key', variant_name: '', quantity: 1, unit_price: 250, ...overrides });

test('invoice due subtracts payments and credit notes and never goes negative', () => {
  assert.equal(invoiceDue(invoice()), 1000);
  assert.equal(invoiceDue(invoice({ paid_total: 400, credited_total: 100 })), 500);
  assert.equal(invoiceDue(invoice({ paid_total: 1200 })), 0);
  assert.equal(invoiceDue(invoice({ total: '99.9', paid_total: '0.3' })), 99.6);
});

test('invoice payment state reads as paid, part paid, unpaid or void', () => {
  assert.equal(invoicePaymentState(invoice()), 'unpaid');
  assert.equal(invoicePaymentState(invoice({ paid_total: 300 })), 'partial');
  assert.equal(invoicePaymentState(invoice({ credited_total: 1000 })), 'paid');
  assert.equal(invoicePaymentState(invoice({ status: 'cancelled', paid_total: 0 })), 'void');
});

test('summary counts only issued invoices with money still owed', () => {
  const summary = summarizeInvoices([
    invoice(),
    invoice({ paid_total: 1000 }),
    invoice({ paid_total: 250 }),
    invoice({ status: 'cancelled' }),
  ]);
  assert.deepEqual(summary, { issuedCount: 3, openCount: 2, outstanding: 1750 });
});

test('adding the same product option twice merges into one line', () => {
  const first = addBillLine([], line({ quantity: 2 }), 10);
  assert.equal(first.error, undefined);
  const merged = addBillLine(first.lines, line({ quantity: 3 }), 10);
  assert.equal(merged.lines.length, 1);
  assert.equal(merged.lines[0].quantity, 5);
  const otherOption = addBillLine(merged.lines, line({ variant_id: 'v2', variant_name: 'Red' }), 10);
  assert.equal(otherOption.lines.length, 2);
});

test('adding beyond available stock is refused without changing the bill', () => {
  const start = [line({ quantity: 4 })];
  const result = addBillLine(start, line({ quantity: 2 }), 5);
  assert.match(result.error ?? '', /only 5 in stock/i);
  assert.equal(result.lines, start);
  assert.equal(start[0].quantity, 4);
});

test('setting a line quantity is bounded by stock and zero removes the line', () => {
  const start = [line({ quantity: 2 }), line({ product_id: 'p2', quantity: 1 })];
  assert.equal(setBillLineQuantity(start, 0, 3, 5).lines[0].quantity, 3);
  assert.match(setBillLineQuantity(start, 0, 9, 5).error ?? '', /only 5 in stock/i);
  assert.equal(setBillLineQuantity(start, 0, 0, 5).lines.length, 1);
  assert.equal(start[0].quantity, 2);
});

test('bill total multiplies quantity by unit price and rounds to paise', () => {
  assert.equal(billTotal([]), 0);
  assert.equal(billTotal([line({ quantity: 3, unit_price: 33.335 }), line({ quantity: 1, unit_price: 0.1 })]), 100.11);
});

test('amount received follows the chosen payment mode', () => {
  assert.deepEqual(resolveAmountReceived('full', 1500, ''), { amount: 1500 });
  assert.deepEqual(resolveAmountReceived('later', 1500, '200'), { amount: 0 });
  assert.deepEqual(resolveAmountReceived('part', 1500, ' 600 '), { amount: 600 });
  assert.match(resolveAmountReceived('part', 1500, '').error ?? '', /amount received/i);
  assert.match(resolveAmountReceived('part', 1500, '1500').error ?? '', /less than the bill total/i);
  assert.match(resolveAmountReceived('part', 1500, '-5').error ?? '', /amount received/i);
});

test('rupee formatting uses Indian grouping and only shows paise when present', () => {
  assert.equal(formatINR(1234567), '₹12,34,567');
  assert.equal(formatINR(99.5), '₹99.50');
  assert.equal(formatINR(0), '₹0');
});

test('payment methods have shop-counter friendly labels', () => {
  assert.equal(paymentMethodLabel('upi'), 'UPI');
  assert.equal(paymentMethodLabel('bank_transfer'), 'Bank transfer');
  assert.equal(paymentMethodLabel('cash'), 'Cash');
  assert.equal(paymentMethodLabel('something_new'), 'Something new');
});
