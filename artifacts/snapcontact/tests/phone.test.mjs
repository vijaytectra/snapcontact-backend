import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCandidates, validateNumber, normalizeDigits, countryOptions } from '../lib/phone.ts';

test('multiple international numbers remain independent and get a nearby editable business suggestion', () => {
  const results = extractCandidates('North Star Cafe\n+44 20 7946 0958\n+1 (415) 555-2671', 'US');
  assert.equal(results.length, 2);
  assert.ok(results.every(n => n.valid && n.selected && n.name === 'North Star Cafe'));
  assert.notEqual(results[0].id, results[1].id);
});
test('national trunk and country choice normalize to E.164', () => {
  assert.equal(validateNumber('020 7946 0958', 'GB').e164, '+442079460958');
  assert.equal(validateNumber('09876543210', 'IN').e164, '+919876543210');
  assert.equal(validateNumber('+44 20 7946 0958', 'JP').e164, '+442079460958');
});
test('international dialing prefixes use the actual selected numbering plan', () => {
  assert.equal(validateNumber('011 44 20 7946 0958', 'US').e164, '+442079460958');
  assert.equal(validateNumber('00 44 20 7946 0958', 'DE').e164, '+442079460958');
  assert.equal(validateNumber('0011 44 20 7946 0958', 'AU').e164, '+442079460958');
});
test('non-Latin numeral scripts are normalized without guessing letters', () => {
  assert.equal(normalizeDigits('+٩١ ۹۸۷۶۵۴۳۲۱۰'), '+91 9876543210');
  assert.equal(normalizeDigits('०९८७६५४३२१०'), '09876543210');
  assert.equal(normalizeDigits('０２０ ７９４６ ０９５８'), '020 7946 0958');
  assert.equal(normalizeDigits('O1I'), 'O1I');
  assert.equal(extractCandidates('दिल्ली कैफे\n०९८७६५४३२१०', 'IN')[0].formatted, '+91 98765 43210');
});
test('deduplication respects E.164 and extensions', () => {
  const rows = extractCandidates('Desk\n+1 415 555 2671\n+1 (415) 555-2671\n+1 415 555 2671 ext 42', 'US');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].extension, '42');
});
test('uncertain OCR digits stay visible but cannot be selected or saved as valid', () => {
  const row = extractCandidates('Store\n123456', 'US')[0];
  assert.ok(row);
  assert.equal(row.valid, false);
  assert.equal(row.selected, false);
  assert.ok(row.message.length);
  assert.equal(validateNumber('garbage +44 20 7946 0958', 'GB').valid, false);
  assert.equal(validateNumber('911', 'US').valid, false);
});
test('same-line labels are not invented as business names', () => {
  assert.equal(extractCandidates('Phone: +1 415 555 2671', 'US')[0].name, '');
});
test('empty, no-number, and non-string-like digit snippets do not crash or create results', () => {
  assert.deepEqual(extractCandidates('', 'US'), []);
  assert.deepEqual(extractCandidates('No phone number here', 'US'), []);
  assert.deepEqual(extractCandidates('123', 'US'), []);
});
test('all library countries are searchable with localized offline names and calling codes', () => {
  const countries = countryOptions('fr');
  assert.ok(countries.length > 240);
  assert.equal(countries.find(c => c.code === 'GB').callingCode, '+44');
  assert.equal(countries.find(c => c.code === 'DE').name, 'Allemagne');
});
