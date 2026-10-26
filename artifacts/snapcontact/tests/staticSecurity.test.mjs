import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStaticReader } = require('../server/safe-static.js');

test('static server permits assets but rejects traversal, malformed URLs and symlink escapes', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-static-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'static');
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'asset.js'), 'asset');
  fs.writeFileSync(path.join(dir, 'secret'), 'private');
  fs.symlinkSync(path.join(dir, 'secret'), path.join(root, 'leak'));
  fs.symlinkSync(dir, path.join(root, 'outside'));
  fs.writeFileSync(path.join(root, '.env'), 'private');
  const read = createStaticReader(root);
  assert.equal(read('/asset.js').toString(), 'asset');
  for (const input of ['../secret', '/%2e%2e/secret', '/..\\secret', '/%00', '/%zz']) {
    assert.throws(() => read(input), { code: 'FORBIDDEN' }, input);
  }
  for (const input of ['/missing', '/', '/leak', '/outside/secret', '/.env']) {
    assert.throws(() => read(input), { code: 'ENOENT' }, input);
  }
  fs.unlinkSync(path.join(root, 'asset.js'));
  fs.symlinkSync(path.join(dir, 'secret'), path.join(root, 'asset.js'));
  assert.throws(() => read('/asset.js'), { code: 'FORBIDDEN' });
});
