import test from 'node:test';
import assert from 'node:assert/strict';
import { runContactQueue } from '../lib/contactQueue.ts';

const requests = [1, 2, 3].map(n => ({ id: String(n), name: `Business ${n}`, number: `+1415555267${n}` }));

test('editors open sequentially and only report saved from native confirmation', async () => {
  let open = 0;
  const results = [];
  await runContactQueue(requests, async () => {
    assert.equal(open++, 0);
    await Promise.resolve();
    open--;
    return { status: 'saved' };
  }, r => results.push(r));
  assert.deepEqual(results.map(r => r.status), ['saved', 'saved', 'saved']);
});
test('cancel stops the batch immediately and does not claim pending contacts were saved', async () => {
  let calls = 0;
  const results = [];
  await runContactQueue(requests, async () => ({ status: ++calls === 1 ? 'saved' : 'cancelled' }), r => results.push(r));
  assert.equal(calls, 2);
  assert.deepEqual(results.map(r => r.status), ['saved', 'cancelled']);
});
test('missing or failing native editor stops the batch with an actionable error', async () => {
  const results = [];
  await runContactQueue(requests, async () => { throw new Error('No contacts app'); }, r => results.push(r));
  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'error');
  assert.equal(results[0].message, 'No contacts app');
});
test('empty queue does not open any UI', async () => {
  await runContactQueue([], () => { assert.fail('must not open editor'); }, () => assert.fail('no outcomes'));
});
