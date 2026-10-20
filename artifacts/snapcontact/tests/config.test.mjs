import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const config = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;

test('static native configuration registers local capabilities without contacts-reading permissions', () => {
  assert.ok(config.plugins.includes('./plugins/withSnapCapture.js'));
  assert.ok(config.android.blockedPermissions.includes('android.permission.READ_CONTACTS'));
  assert.ok(config.android.blockedPermissions.includes('android.permission.WRITE_CONTACTS'));
  assert.equal(config.android.allowBackup, false);
  const localModule = JSON.parse(fs.readFileSync(new URL('../modules/snap-capture/expo-module.config.json', import.meta.url)));
  assert.ok(localModule.apple.modules.includes('SnapCaptureModule'));
  assert.ok(localModule.android.modules.includes('com.snapcontact.capture.SnapCaptureModule'));
});
test('prebuild plugin can be loaded by Expo in the installed dependency tree', () => {
  assert.equal(typeof require('../plugins/withSnapCapture.js'), 'function');
});
test('share extension is ordered as a host build dependency even in a new Xcode project', () => {
  const { ensureTargetDependency } = require('../plugins/xcodeTargetDependency.js');
  const host = { dependencies: [] };
  const extension = {};
  const objects = {};
  const project = {
    hash: { project: { objects } },
    pbxNativeTargetSection: () => ({ host, extension }),
    addTargetDependency(hostUuid, dependencyUuids) {
      assert.ok(objects.PBXTargetDependency);
      assert.ok(objects.PBXContainerItemProxy);
      host.dependencies.push({ value: dependencyUuids[0] });
    },
  };
  ensureTargetDependency(project, 'host', 'extension');
  ensureTargetDependency(project, 'host', 'extension');
  assert.deepEqual(host.dependencies, [{ value: 'extension' }]);
});
test('OCR is bundled for offline-first use, not downloaded by Play Services', () => {
  const gradle = fs.readFileSync(new URL('../modules/snap-capture/android/build.gradle', import.meta.url), 'utf8');
  assert.ok(gradle.includes('com.google.mlkit:text-recognition:'));
  assert.ok(!gradle.includes('play-services-mlkit'));
});
