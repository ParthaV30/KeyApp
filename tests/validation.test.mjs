import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isValidEmail,
  normalizeEmail,
  normalizeSlug,
  parseStoredCart,
  parseStoredFavorites,
  validateShipping,
  validateSignUp,
} from '../src/lib/validation.ts';

test('email validation normalizes case and whitespace', () => {
  assert.equal(normalizeEmail('  Customer@Example.com '), 'customer@example.com');
  assert.equal(isValidEmail('  Customer@Example.com '), true);
  assert.equal(isValidEmail('bad@@example'), false);
  assert.equal(isValidEmail('first..last@example.com'), false);
  assert.equal(isValidEmail('customer@example..com'), false);
});

test('signup validation rejects short credentials and accepts valid details', () => {
  assert.match(validateSignUp('A', 'customer@example.com', '9876543210', 'password123') ?? '', /name/i);
  assert.match(validateSignUp('Customer', 'not-an-email', '9876543210', 'password123') ?? '', /email/i);
  assert.match(validateSignUp('Customer', 'customer@example.com', '9876543210', 'short') ?? '', /password/i);
  assert.equal(validateSignUp('Customer Name', 'customer@example.com', '+91 98765 43210', 'strong-pass-123'), null);
});

test('slug generation is stable and bounded', () => {
  assert.equal(normalizeSlug('  Alarm System & Tools  '), 'alarm-system-tools');
  assert.equal(normalizeSlug('Crème brûlée'), 'creme-brulee');
  assert.equal(normalizeSlug('///'), '');
  assert.equal(normalizeSlug('x'.repeat(120)).length, 80);
});

test('shipping validation enforces required delivery fields and optional GSTIN', () => {
  const valid = { name: 'Customer Name', phone: '9876543210', address: '12 Example Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' };
  assert.equal(validateShipping(valid), null);
  assert.match(validateShipping({ ...valid, phone: '123' }) ?? '', /phone/i);
  assert.match(validateShipping({ ...valid, gstin: 'invalid' }) ?? '', /GSTIN/i);
  assert.match(validateShipping({ ...valid, note: 'x'.repeat(1001) }) ?? '', /notes/i);
});

test('stored cart parsing fails closed and rejects corrupt quantities', () => {
  assert.deepEqual(parseStoredCart('{"key-a":2,"bad":0,"float":1.5,"tooMuch":100,"__proto__":4}'), { 'key-a': 2 });
  assert.deepEqual(parseStoredCart('not json'), {});
  assert.deepEqual(parseStoredCart('null'), {});
  assert.deepEqual(parseStoredCart('x'.repeat(100_001)), {});
});

test('stored favorite parsing de-duplicates and ignores corrupt values', () => {
  assert.deepEqual(parseStoredFavorites('["a","a",2,"b"]'), ['a', 'b']);
  assert.deepEqual(parseStoredFavorites('{bad json'), []);
});
