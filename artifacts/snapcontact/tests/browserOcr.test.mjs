import test from 'node:test';
import assert from 'node:assert/strict';
import { readWithOcrWorker } from '../lib/browserOcr.ts';

test('browser OCR passes local image to worker and releases it after success', async () => {
  let terminated = 0;
  const text = await readWithOcrWorker('local-image', async () => ({
    recognize: async image => { assert.equal(image, 'local-image'); return { data: { text: 'Shop +44 20 7946 0958' } }; },
    terminate: async () => { terminated++; },
  }));
  assert.match(text, /\+44/);
  assert.equal(terminated, 1);
});
test('browser OCR releases worker on recognition failure', async () => {
  let terminated = 0;
  await assert.rejects(readWithOcrWorker('local', async () => ({
    recognize: async () => { throw new Error('failed'); },
    terminate: async () => { terminated++; },
  })), /failed/);
  assert.equal(terminated, 1);
});
test('browser OCR times out and releases an active worker', async () => {
  let terminated = 0;
  await assert.rejects(readWithOcrWorker('local', async () => ({
    recognize: () => new Promise(() => {}),
    terminate: async () => { terminated++; },
  }), 15), /too long/);
  assert.equal(terminated, 1);
});
test('browser OCR releases initialization that finishes after timeout', async () => {
  let finish;
  let terminated = 0;
  const result = readWithOcrWorker('local', () => new Promise(resolve => { finish = resolve; }), 15);
  await assert.rejects(result, /too long/);
  finish({ recognize: async () => { throw new Error('must not recognize'); }, terminate: async () => { terminated++; } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(terminated, 1);
});
