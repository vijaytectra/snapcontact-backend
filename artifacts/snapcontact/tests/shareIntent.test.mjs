import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { addOnNewIntent } = require('../plugins/mainActivityIntent.js');

const generated = `package app.snapcontact.capture

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }
}
`;

test('MainActivity gets an onNewIntent override so a share during a running session is read', () => {
  const out = addOnNewIntent(generated);
  assert.match(out, /override fun onNewIntent\(intent: Intent\) \{\n\s+super\.onNewIntent\(intent\)\n\s+setIntent\(intent\)\n\s+\}/);
  assert.match(out, /^import android\.content\.Intent$/m);
  // The import goes after the package line, and the override sits inside the class.
  assert.ok(out.indexOf('import android.content.Intent') < out.indexOf('import android.os.Build'));
  assert.ok(out.indexOf('override fun onNewIntent') < out.indexOf('override fun onCreate'));
});

test('adding onNewIntent is idempotent', () => {
  const once = addOnNewIntent(generated);
  assert.equal(addOnNewIntent(once), once);
  assert.equal((addOnNewIntent(once).match(/override fun onNewIntent/g) ?? []).length, 1);
});

test('an unexpected MainActivity shape fails the prebuild instead of shipping without the fix', () => {
  assert.throws(() => addOnNewIntent('package x\nclass Other {}\n'), /unexpected shape/);
});
