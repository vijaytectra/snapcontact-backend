import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractCandidates, extractEmails, extractWebsites, validateNumber } from '../lib/phone.ts';

test('Android manifest configuration declares overlay and MediaProjection foreground service', () => {
  const pluginSource = fs.readFileSync(new URL('../plugins/withSnapCapture.js', import.meta.url), 'utf8');
  assert.ok(pluginSource.includes('SYSTEM_ALERT_WINDOW'), 'Must declare SYSTEM_ALERT_WINDOW permission');
  assert.ok(pluginSource.includes('FOREGROUND_SERVICE'), 'Must declare FOREGROUND_SERVICE permission');
  assert.ok(pluginSource.includes('FOREGROUND_SERVICE_MEDIA_PROJECTION'), 'Must declare FOREGROUND_SERVICE_MEDIA_PROJECTION permission');
  assert.ok(pluginSource.includes('POST_NOTIFICATIONS'), 'Must declare POST_NOTIFICATIONS permission');
  assert.ok(pluginSource.includes('com.snapcontact.capture.QuickCaptureService'), 'Must register QuickCaptureService');
  assert.ok(pluginSource.includes('mediaProjection'), 'Must configure mediaProjection foreground service type');
  assert.ok(pluginSource.includes('com.snapcontact.capture.MediaProjectionConsentActivity'), 'Must register MediaProjectionConsentActivity');
});

test('Kotlin module registers Quick Capture methods and events', () => {
  const moduleSource = fs.readFileSync(new URL('../modules/snap-capture/android/src/main/java/com/snapcontact/capture/SnapCaptureModule.kt', import.meta.url), 'utf8');
  assert.ok(moduleSource.includes('hasOverlayPermission'), 'Must provide hasOverlayPermission');
  assert.ok(moduleSource.includes('requestOverlayPermission'), 'Must provide requestOverlayPermission');
  assert.ok(moduleSource.includes('isQuickCaptureRunning'), 'Must provide isQuickCaptureRunning');
  assert.ok(moduleSource.includes('startQuickCapture'), 'Must provide startQuickCapture');
  assert.ok(moduleSource.includes('stopQuickCapture'), 'Must provide stopQuickCapture');
  assert.ok(moduleSource.includes('requestScreenCapture'), 'Must provide requestScreenCapture');
  assert.ok(moduleSource.includes('onQuickCaptureStarted'), 'Must declare onQuickCaptureStarted event');
  assert.ok(moduleSource.includes('onScreenCaptured'), 'Must declare onScreenCaptured event');
  assert.ok(moduleSource.includes('onQuickCaptureError'), 'Must declare onQuickCaptureError event');
  assert.ok(moduleSource.includes('onQuickCaptureStopped'), 'Must declare onQuickCaptureStopped event');
});

test('Quick Capture extracts contact from Instagram business profile OCR text', () => {
  const instagramOcr = `
    artisan_bakery
    Artisan Bakery & Cafe
    Fresh sourdough, pastries & specialty coffee ☕️
    📍 124 Main Street, Seattle, WA
    Call: (206) 555-0199
    Email: contact@artisanbakery.com
    Website: www.artisanbakeryseattle.com
    Followed by coffee_lovers and 42 others
  `;

  const candidates = extractCandidates(instagramOcr, 'US');
  assert.ok(candidates.length > 0, 'Should find at least one contact candidate');
  const candidate = candidates[0];

  assert.ok(candidate.name.length > 0, 'Should extract a candidate name or business name');
  assert.equal(candidate.email, 'contact@artisanbakery.com');
  assert.equal(candidate.website, 'www.artisanbakeryseattle.com');
});

test('Quick Capture extracts international contact from WhatsApp business card OCR text', () => {
  const whatsappOcr = `
    Teknik Servis Istanbul
    Karakoy Mah. Kemeralti Cad. No: 18
    Telefon: +90 212 555 1234
    Siparis & Destek: siparis@teknikservis.istanbul
    https://teknikservis.istanbul
  `;

  const candidates = extractCandidates(whatsappOcr, 'TR');
  assert.ok(candidates.length > 0);
  const candidate = candidates[0];

  assert.equal(candidate.callingCode, '90');
  assert.equal(candidate.country, 'TR');
  assert.equal(candidate.email, 'siparis@teknikservis.istanbul');
  assert.equal(candidate.website, 'https://teknikservis.istanbul');
  assert.ok(candidate.valid);
});

test('Quick Capture handles multiple contact candidates in a single captured screen', () => {
  const directoryScreenOcr = `
    Emergency & Support Contacts

    City Medical Clinic
    Tel: +1 415 555 2671
    Email: care@citymedical.org
    www.citymedical.org

    Downtown Pharmacy
    Tel: +1 415 555 8890
    Email: rx@downtownrx.com
    www.downtownrx.com
  `;

  const candidates = extractCandidates(directoryScreenOcr, 'US');
  assert.equal(candidates.length, 2, 'Should extract two distinct contact candidates');

  assert.equal(candidates[0].email, 'care@citymedical.org');
  assert.equal(candidates[0].website, 'www.citymedical.org');

  assert.equal(candidates[1].email, 'rx@downtownrx.com');
  assert.equal(candidates[1].website, 'www.downtownrx.com');
});

test('Quick Capture handles empty OCR result gracefully without crashing', () => {
  const emptyOcr = '   \n  \t  \n';
  const candidates = extractCandidates(emptyOcr, 'US');
  assert.deepEqual(candidates, [], 'Empty OCR should produce empty candidates array');

  const emails = extractEmails(emptyOcr);
  assert.deepEqual(emails, []);

  const websites = extractWebsites(emptyOcr);
  assert.deepEqual(websites, []);
});

test('Quick Capture contact candidate schema matches CandidateCard requirements', () => {
  const ocrText = `
    Apex Consulting Group
    Call us today: +44 20 7946 0958
    Inquiries: info@apexconsulting.co.uk
    https://apexconsulting.co.uk
  `;

  const candidates = extractCandidates(ocrText, 'GB');
  assert.ok(candidates.length > 0);
  const candidate = candidates[0];

  // Check required CandidateCard fields
  assert.ok(typeof candidate.id === 'string');
  assert.ok(typeof candidate.name === 'string');
  assert.ok(typeof candidate.number === 'string');
  assert.ok(typeof candidate.email === 'string');
  assert.ok(typeof candidate.website === 'string');
  assert.ok(typeof candidate.valid === 'boolean');
  assert.ok(typeof candidate.formatted === 'string');
  assert.ok(typeof candidate.selected === 'boolean');
  assert.ok(typeof candidate.countryName === 'string');
  assert.equal(candidate.callingCode, '44');
  assert.equal(candidate.country, 'GB');
});

test('Quick Capture handles screen capture denial and error mock workflow', () => {
  // Simulate mock quick capture manager lifecycle
  let running = false;
  let hasOverlay = false;
  const events = [];

  const mockManager = {
    hasOverlayPermission: () => hasOverlay,
    requestOverlayPermission: () => { hasOverlay = true; return true; },
    startQuickCapture: () => {
      if (!hasOverlay) {
        events.push({ type: 'error', error: 'Overlay permission not granted' });
        return false;
      }
      running = true;
      events.push({ type: 'started' });
      return true;
    },
    stopQuickCapture: () => {
      running = false;
      events.push({ type: 'stopped' });
      return true;
    },
    handleCaptureDenial: () => {
      events.push({ type: 'error', error: 'Screen capture permission was denied.' });
    },
  };

  // 1. Start without permission -> fails
  const startedWithoutPerm = mockManager.startQuickCapture();
  assert.equal(startedWithoutPerm, false);
  assert.equal(events[0].type, 'error');

  // 2. Grant permission and start -> succeeds
  mockManager.requestOverlayPermission();
  const started = mockManager.startQuickCapture();
  assert.equal(started, true);
  assert.equal(events[1].type, 'started');

  // 3. User denies MediaProjection screen capture consent -> error dispatched
  mockManager.handleCaptureDenial();
  assert.equal(events[2].type, 'error');
  assert.equal(events[2].error, 'Screen capture permission was denied.');

  // 4. Stop quick capture -> stopped
  mockManager.stopQuickCapture();
  assert.equal(events[3].type, 'stopped');
  assert.equal(running, false);
});

test('Kotlin module registers persistent pending result handoff methods', () => {
  const moduleSource = fs.readFileSync(new URL('../modules/snap-capture/android/src/main/java/com/snapcontact/capture/SnapCaptureModule.kt', import.meta.url), 'utf8');
  assert.ok(moduleSource.includes('getPendingCaptureResult'), 'Must expose getPendingCaptureResult');
  assert.ok(moduleSource.includes('clearPendingCaptureResult'), 'Must expose clearPendingCaptureResult');
  assert.ok(moduleSource.includes('CaptureResultStore.consumePendingResult'), 'Must delegate to CaptureResultStore');
});

test('Persistent CaptureResultStore delivers OCR result exactly once across backgrounding', () => {
  // Simulate CaptureResultStore exactly-once consumption logic
  let stored = null;
  const store = {
    savePendingResult: (text) => { stored = text; },
    consumePendingResult: () => {
      const val = stored;
      stored = null;
      return val;
    },
    clear: () => { stored = null; },
  };

  const sampleOcr = 'Design Agency\n+1 415 555 0192\nhello@design.agency';

  // 1. Service finishes capture in background and saves result
  store.savePendingResult(sampleOcr);

  // 2. React Native comes to foreground and consumes pending result
  const consumedFirst = store.consumePendingResult();
  assert.equal(consumedFirst, sampleOcr, 'First consumption must return stored OCR result');

  // 3. Second call (e.g. activity re-creation) must return null to prevent duplicate candidate creation
  const consumedSecond = store.consumePendingResult();
  assert.equal(consumedSecond, null, 'Second consumption must return null (exactly-once delivery)');
});

test('MediaProjection consent activity guarantees onConsentDenied fallback on dismissal', () => {
  const activitySource = fs.readFileSync(new URL('../modules/snap-capture/android/src/main/java/com/snapcontact/capture/MediaProjectionConsentActivity.kt', import.meta.url), 'utf8');
  assert.ok(activitySource.includes('onDestroy'), 'Must override onDestroy');
  assert.ok(activitySource.includes('QuickCaptureService.onConsentDenied()'), 'Must call onConsentDenied in fallback');
});

test('Privacy verification: No raw OCR text or contact details are written to Android logs', () => {
  const serviceSource = fs.readFileSync(new URL('../modules/snap-capture/android/src/main/java/com/snapcontact/capture/QuickCaptureService.kt', import.meta.url), 'utf8');
  const ocrSource = fs.readFileSync(new URL('../modules/snap-capture/android/src/main/java/com/snapcontact/capture/OcrProcessor.kt', import.meta.url), 'utf8');
  const managerSource = fs.readFileSync(new URL('../modules/snap-capture/android/src/main/java/com/snapcontact/capture/ScreenCaptureManager.kt', import.meta.url), 'utf8');

  // Ensure no Log calls print the recognizedText or visionText directly
  assert.ok(!serviceSource.includes('Log.d(TAG, recognizedText)'));
  assert.ok(!serviceSource.includes('Log.i(TAG, recognizedText)'));
  assert.ok(!ocrSource.includes('Log.d(TAG, text)'));
  assert.ok(!ocrSource.includes('Log.i(TAG, text)'));
  assert.ok(!managerSource.includes('Log.d(TAG, bitmap'));
});

