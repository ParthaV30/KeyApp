import assert from 'node:assert/strict';
import test from 'node:test';

import { parseOptionLines, serializeOptionLines, stockChange, stockStatus } from '../src/features/admin/products/stockMath.ts';

test('option lines round-trip between the saved text format and editable rows', () => {
  const rows = parseOptionLines('3 button | 1650 | 6 | XH-3B\n4 button | 1950 | 0 |');
  assert.deepEqual(rows, [
    { name: '3 button', price: '1650', stock: '6', sku: 'XH-3B' },
    { name: '4 button', price: '1950', stock: '0', sku: '' },
  ]);
  assert.equal(serializeOptionLines(rows), '3 button | 1650 | 6 | XH-3B\n4 button | 1950 | 0 | ');
  assert.deepEqual(parseOptionLines(''), []);
});

test('blank option rows are skipped and pipe characters cannot corrupt the format', () => {
  const text = serializeOptionLines([
    { name: 'Red | Blue', price: '10', stock: '2', sku: 'A|B' },
    { name: '', price: '', stock: '', sku: '' },
  ]);
  assert.equal(text, 'Red / Blue | 10 | 2 | A/B');
});

test('stock status reads as in stock, low stock or out of stock', () => {
  assert.deepEqual(stockStatus(24), { label: 'In stock · 24', tone: 'good' });
  assert.deepEqual(stockStatus(3), { label: 'Low stock · 3', tone: 'warn' });
  assert.deepEqual(stockStatus(0), { label: 'Out of stock', tone: 'bad' });
  assert.deepEqual(stockStatus(8, 10), { label: 'Low stock · 8', tone: 'warn' });
});

test('setting a new stock count works out the change to record', () => {
  assert.deepEqual(stockChange(10, '24'), { delta: 14 });
  assert.deepEqual(stockChange(10, ' 7 '), { delta: -3 });
  assert.match(stockChange(10, '10').error ?? '', /already/i);
  assert.match(stockChange(10, '-1').error ?? '', /whole number/i);
  assert.match(stockChange(10, '2.5').error ?? '', /whole number/i);
  assert.match(stockChange(10, '').error ?? '', /whole number/i);
});
