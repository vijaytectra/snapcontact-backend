import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCandidates, validateNumber, normalizeDigits, countryOptions, prepareNumberCopy, extractEmails, extractWebsites } from '../lib/phone.ts';


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

test('international numbers detect their own countries regardless of selected default', () => {
  const rows = extractCandidates('Cafe\n+44 20 7946 0958\n+91 98765 43210\n+1 415 555 2671', 'JP');
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.valid));
  assert.match(rows[0].countryLabel, /United Kingdom.*\+44/);
  assert.match(rows[1].countryLabel, /India.*\+91/);
  assert.match(rows[2].countryLabel, /United States.*\+1/);
});
test('the screenshot examples detect shared +1 but never validate the unassigned 555 area code', () => {
  for (const defaultCountry of ['US', 'IN', 'GB']) {
    const rows = extractCandidates('Support\n+1 555 1234567\n+1 (555) 987-6543', defaultCountry);
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.valid, false);
      assert.equal(row.selected, false);
      assert.match(row.countryLabel, /shared country code.*\+1/);
      assert.match(row.message, /555 is not an assigned/);
    }
  }
});
test('local numbers disclose fallback country instead of claiming country detection', () => {
  const result = validateNumber('09876543210', 'IN');
  assert.equal(result.valid, true);
  assert.match(result.countryLabel, /Using default country: India.*\+91/);
  assert.equal(validateNumber('011 44 20 7946 0958', 'US').countryLabel.includes('United Kingdom'), true);
});

test('copying invalid/example numbers preserves the entered digits and leaves validation blocked', () => {
  const raw = '+1 (555) 123-4567';
  assert.deepEqual(prepareNumberCopy(raw, 'IN'), { text: raw, valid: false });
  const uncertain = '+44 2O 7946 O958';
  assert.deepEqual(prepareNumberCopy(uncertain, 'GB'), { text: uncertain, valid: false });
  const row = extractCandidates(raw, 'IN')[0];
  assert.equal(row.valid, false);
  assert.equal(row.selected, false);
  assert.equal(prepareNumberCopy('   ', 'US').text, '');
});
test('copying valid numbers retains international normalization and extensions', () => {
  assert.deepEqual(prepareNumberCopy('020 7946 0958 ext 42', 'GB'), {
    text: '+442079460958 ext. 42', valid: true,
  });
});

test('one image can contain six countries, including distinct US and Canadian +1 numbers', () => {
  const text = '+1 (415) 366-1222\n+49 157 35994222\n+48 71 722 11 11\n+44 20 8089 0200\n+55 21 3812 8522\n+1 647 558 6333';
  for (const defaultCountry of ['IN', 'AI', 'JP']) {
    const rows = extractCandidates(text, defaultCountry);
    assert.equal(rows.length, 6);
    assert.deepEqual(rows.map(row => row.country), ['US', 'DE', 'PL', 'GB', 'BR', 'CA']);
    assert.deepEqual(rows.map(row => row.callingCode), ['1', '49', '48', '44', '55', '1']);
    assert.ok(rows.every(row => row.valid && row.international));
  }
});
test('a detected country remains visible when small-image OCR leaves uncertain digits', () => {
  const rows = extractCandidates('+1 (415) 366-1222\n+49 157 35994222\n+48 7172211 M\n+44 20 8089 0200\n+55 213812 8522\n+1 647 558 6333', 'AI');
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(row => row.country), ['US', 'DE', 'PL', 'GB', 'BR', 'CA']);
  assert.equal(rows[2].valid, false);
  assert.equal(rows[2].selected, false);
  assert.ok(rows.filter((_, i) => i !== 2).every(row => row.valid));
});

test('extractEmails detects emails across all domain types including OCR spacing and labels', () => {
  const sample = `
    Standard: user@example.com
    Subdomain: support@mail.corp.co.uk.
    ccTLD: kontakt@firma.pl
    gTLD: founder@startup.io
    Modern: hello@creative.design
    AI: team@agentic.ai
    OCR spaces: info @ company.org
    OCR at: sales(at)acme.tech
    Label: Email: dev@platform.app
  `;
  const emails = extractEmails(sample).map(e => e.email);
  assert.ok(emails.includes('user@example.com'));
  assert.ok(emails.includes('support@mail.corp.co.uk'));
  assert.ok(emails.includes('kontakt@firma.pl'));
  assert.ok(emails.includes('founder@startup.io'));
  assert.ok(emails.includes('hello@creative.design'));
  assert.ok(emails.includes('team@agentic.ai'));
  assert.ok(emails.includes('info@company.org'));
  assert.ok(emails.includes('sales@acme.tech'));
  assert.ok(emails.includes('dev@platform.app'));
});

test('extractWebsites detects websites across all domain types including standalone domains and protocols', () => {
  const sample = `
    Visit https://example.com/about.
    Check out www.company.co.uk
    Our shop is at store.ai
    Visit firma.pl for details
    Design portfolio at creative.design
    Web: techcorp.io
    App: https://download.platform.app:8080/get
  `;
  const sites = extractWebsites(sample).map(s => s.website);
  assert.ok(sites.includes('https://example.com/about'));
  assert.ok(sites.includes('www.company.co.uk'));
  assert.ok(sites.includes('store.ai'));
  assert.ok(sites.includes('firma.pl'));
  assert.ok(sites.includes('creative.design'));
  assert.ok(sites.includes('techcorp.io'));
  assert.ok(sites.includes('https://download.platform.app:8080/get'));
});

test('extractCandidates associates email and website with phone number card across domains', () => {
  const card = `
    Krakow Dental Care
    +48 71 722 11 11
    reception@krakow-dentist.pl
    www.krakow-dentist.pl
  `;
  const candidates = extractCandidates(card, 'PL');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, 'Krakow Dental Care');
  assert.equal(candidates[0].formatted, '+48 71 722 11 11');
  assert.equal(candidates[0].email, 'reception@krakow-dentist.pl');
  assert.equal(candidates[0].website, 'www.krakow-dentist.pl');
  assert.equal(candidates[0].valid, true);
});

test('standalone email and website without phone numbers creates a contact candidate', () => {
  const card = `
    Creative Studio Ltd
    hello@studio.design
    www.studio.design
  `;
  const candidates = extractCandidates(card, 'US');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, 'Creative Studio Ltd');
  assert.equal(candidates[0].email, 'hello@studio.design');
  assert.equal(candidates[0].website, 'www.studio.design');
  assert.equal(candidates[0].valid, true);
  assert.equal(candidates[0].selected, true);
});

