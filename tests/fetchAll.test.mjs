import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAll } from '../src/lib/fetchAll.ts';

test('fetchAll walks pages until a short page', async () => {
  const calls = [];
  const { data, error } = await fetchAll(async (from, to) => {
    calls.push([from, to]);
    return { data: Array.from({ length: from === 0 ? 1000 : 5 }, (_, i) => from + i), error: null };
  });
  assert.equal(error, null);
  assert.equal(data.length, 1005);
  assert.deepEqual(calls, [[0, 999], [1000, 1999]]);
});

test('fetchAll surfaces the first error', async () => {
  const { data, error } = await fetchAll(async () => ({ data: null, error: { message: 'boom' } }));
  assert.equal(data, null);
  assert.equal(error.message, 'boom');
});
