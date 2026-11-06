import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveApiBase } from '../lib/apiConfig.ts';
import { countryName, COUNTRY_NAMES } from '../lib/countryNames.ts';
import { extractCandidates, countryOptions, validateNumber } from '../lib/phone.ts';
import { getCountries } from 'libphonenumber-js/max';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// --- API configuration ---------------------------------------------------------------
test('release builds refuse private LAN, localhost and plain http server addresses', () => {
  for (const raw of ['http://192.168.68.65:5001/api', 'https://192.168.1.4/api', 'https://localhost/api', 'https://10.0.0.5/api',
    'https://172.20.1.1/api', 'http://snapcontact-backend.onrender.com/api', 'https://devbox/api', '', undefined]) {
    const cfg = resolveApiBase({ raw, isDev: false, platform: 'android' });
    assert.ok(cfg.error, `should reject ${raw}`);
    assert.equal(cfg.base, '');
  }
  assert.deepEqual(resolveApiBase({ raw: 'https://snapcontact-backend.onrender.com/api/', isDev: false, platform: 'android' }),
    { base: 'https://snapcontact-backend.onrender.com/api' });
});

test('development keeps working: localhost maps to the dev machine on devices', () => {
  assert.equal(resolveApiBase({ raw: undefined, isDev: true, platform: 'web' }).base, 'http://localhost:5001/api');
  assert.equal(resolveApiBase({ raw: 'http://localhost:5001/api', isDev: true, platform: 'android', devServerHost: '192.168.1.20' }).base, 'http://192.168.1.20:5001/api');
  assert.equal(resolveApiBase({ raw: 'http://localhost:5001/api', isDev: true, platform: 'android' }).base, 'http://10.0.2.2:5001/api');
  assert.equal(resolveApiBase({ raw: 'https://staging.example.com/api', isDev: true, platform: 'ios' }).base, 'https://staging.example.com/api');
});

test('EAS release profiles point at the https production API', () => {
  const eas = JSON.parse(read('eas.json'));
  for (const profile of ['preview', 'production']) {
    const url = eas.build[profile].env.EXPO_PUBLIC_API_URL;
    assert.equal(resolveApiBase({ raw: url, isDev: false, platform: 'android' }).error, undefined, profile);
  }
  assert.doesNotMatch(read('lib/api.ts'), /192\.168\.|10\.0\.2\.2/);
});

// --- Country names (Hermes has no Intl.DisplayNames) ------------------------------------
test('every supported region has a readable bundled name', () => {
  for (const code of getCountries()) {
    assert.ok(COUNTRY_NAMES[code] && COUNTRY_NAMES[code] !== code, `missing name for ${code}`);
  }
  assert.equal(countryName('IN'), 'India');
  assert.equal(countryName('us'), 'United States');
  assert.equal(countryName('AC'), 'Ascension Island');
  assert.equal(countryName('ZZ'), 'ZZ');
  assert.equal(countryName(undefined), '');
});

test('without Intl.DisplayNames the picker and labels still show names, not codes', () => {
  const saved = Intl.DisplayNames;
  try {
    // Simulate the Hermes runtime used by Android release builds.
    // @ts-ignore
    delete Intl.DisplayNames;
    const options = countryOptions('en');
    assert.equal(options.find((o) => o.code === 'IN').name, 'India');
    assert.equal(options.find((o) => o.code === 'GB').callingCode, '+44');
    assert.match(validateNumber('+91 98765 43210', 'US').countryLabel, /India \(\+91\)/);
    assert.match(validateNumber('044 2345 6789', 'IN').countryLabel, /India \(\+91\)/);
  } finally {
    Intl.DisplayNames = saved;
  }
});

// --- Person name vs job title vs company --------------------------------------------------
test('person names are chosen over job titles and companies', () => {
  const card = 'Ravi Kumar\nSales Manager\nMobile: +91 98765 43210\nOffice: 044 2345 6789\nravi@example.com';
  const rows = extractCandidates(card, 'IN').filter((r) => r.number);
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.name, 'Ravi Kumar');
    assert.equal(row.designation, 'Sales Manager');
  }
});

test('more cards: titles above or below names, companies, and no person at all', () => {
  const cases = [
    ['Marketing Director\nANITA SHARMA\nAcme Technologies Pvt Ltd\n+91 91234 56789', { name: 'ANITA SHARMA', designation: 'Marketing Director', company: 'Acme Technologies Pvt Ltd' }],
    ['Dr. Meera Iyer\nConsultant Physician\nSunrise Clinic\nPh: 044 2345 6789', { name: 'Dr. Meera Iyer', designation: 'Consultant Physician', company: 'Sunrise Clinic' }],
    ['Blue Lotus Cafe\nCall: 044 2345 6789', { name: 'Blue Lotus Cafe', company: 'Blue Lotus Cafe' }],
    ['Customer Support\n+91 98765 43210', { name: '' }],
  ];
  for (const [text, expected] of cases) {
    const row = extractCandidates(text, 'IN').find((r) => r.number);
    for (const [k, v] of Object.entries(expected)) assert.equal(row[k] ?? '', v, `${k} for ${JSON.stringify(text)}`);
    assert.ok(!/manager|director|consultant|support/i.test(row.name), 'a designation is never the name');
  }
});

// --- Production UI: no trial debug controls, no fake payments, honest privacy text -------
test('no trial-reset or expiry-simulation controls exist in the app', () => {
  for (const file of ['components/SubscriptionModal.tsx', 'app/index.tsx', 'hooks/useAuth.ts']) {
    const src = read(file);
    assert.doesNotMatch(src, /simulateExpired|resetTrial|onResetTrial|Test 7-Day Expired|Reset 7-Day Trial/i, file);
  }
});

test('no simulated payment success remains on the client', () => {
  const src = read('lib/cashfree.ts') + read('components/CashfreeModal.tsx') + read('hooks/useAuth.ts');
  assert.doesNotMatch(src, /processCashfreePayment|cf_pay_|cf_ref_|session_\$\{|success:\s*true|activateAnnualSubscription/);
  assert.doesNotMatch(read('components/CashfreeModal.tsx'), /cardNumber|cardCvv|luhn/i, 'card data must be entered on Cashfree, not in the app');
});

test('privacy and billing text match what the app actually does', () => {
  const text = read('lib/strings.ts') + read('components/SettingsModal.tsx') + read('components/AuthModal.tsx') + read('components/SubscriptionModal.tsx');
  assert.doesNotMatch(text, /no login|no account|keeps no capture history|Nothing is uploaded|₹999|renews (annually|automatically)|Auto-renewal at/i);
  assert.match(text, /Sign-in is required/);
  assert.match(text, /Search History lists the texts you searched in this session only/);
  assert.match(text, /does not renew/);
  assert.doesNotMatch(read('app/index.tsx'), /Vignesh 9876543210|Arjun Kumar \+91|Priya Sharma \+91/, 'no made-up history entries');
});
