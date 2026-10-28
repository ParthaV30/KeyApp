import assert from 'node:assert/strict';
import test from 'node:test';

import { ORDER_STEPS, canCancelOrder, nextOrderAction, orderStatusLabel, orderStepStates } from '../src/features/admin/orders/orderFlow.ts';

test('steps run from placed to delivered', () => {
  assert.deepEqual(ORDER_STEPS.map(step => step.status), ['pending', 'confirmed', 'processing', 'shipped', 'delivered']);
});

test('each open status offers exactly one next action', () => {
  assert.equal(nextOrderAction('pending')?.status, 'confirmed');
  assert.equal(nextOrderAction('confirmed')?.status, 'processing');
  assert.equal(nextOrderAction('processing')?.status, 'shipped');
  assert.equal(nextOrderAction('shipped')?.status, 'delivered');
  assert.equal(nextOrderAction('delivered'), null);
  assert.equal(nextOrderAction('cancelled'), null);
  assert.equal(nextOrderAction('something-unknown'), null);
});

test('next actions read as plain instructions', () => {
  assert.equal(nextOrderAction('pending')?.label, 'Confirm order');
  assert.equal(nextOrderAction('shipped')?.label, 'Mark as delivered');
  assert.ok(nextOrderAction('processing')?.hint.length > 10);
});

test('step states mark finished, current and upcoming steps', () => {
  assert.deepEqual(orderStepStates('processing'), ['done', 'done', 'current', 'upcoming', 'upcoming']);
  assert.deepEqual(orderStepStates('pending'), ['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  assert.deepEqual(orderStepStates('delivered'), ['done', 'done', 'done', 'done', 'done']);
});

test('a cancelled order shows no progress', () => {
  assert.deepEqual(orderStepStates('cancelled'), ['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled']);
});

test('only orders that have not shipped can be cancelled', () => {
  assert.equal(canCancelOrder('pending'), true);
  assert.equal(canCancelOrder('processing'), true);
  assert.equal(canCancelOrder('shipped'), false);
  assert.equal(canCancelOrder('delivered'), false);
  assert.equal(canCancelOrder('cancelled'), false);
});

test('status labels are customer friendly', () => {
  assert.equal(orderStatusLabel('pending'), 'New');
  assert.equal(orderStatusLabel('processing'), 'Packing');
  assert.equal(orderStatusLabel('cancelled'), 'Cancelled');
  assert.equal(orderStatusLabel('mystery'), 'mystery');
});
