import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCandidates } from '../lib/phone.ts';
import { summarizeContacts, exclusionReason } from '../lib/contactSummary.ts';

const find = (rows, digits) => rows.find((r) => r.number.replace(/\D/g, '').endsWith(digits));

// Letter-only names, unique per index: a name with digits is not a person's name.
const letters = (i) => String(i).replace(/\d/g, (d) => 'bdfgkmnprt'[Number(d)]);
const personName = (i) => `Gita ${letters(i).charAt(0).toUpperCase()}${letters(i).slice(1)}`;

test('a name written to the right of the number on the same line belongs to it', () => {
  const rows = extractCandidates('+91 98765 43210 Akash Verma', 'IN');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Akash Verma');
  assert.equal(rows[0].valid, true);
});

test('"Akash 7904549387" is one proper contact: name and valid number together', () => {
  const [row] = extractCandidates('Akash 7904549387', 'IN');
  assert.equal(row.name, 'Akash');
  assert.equal(exclusionReason(row), null);
});

test('name above, below, or beside the number within one card all pair with that number', () => {
  const above = extractCandidates('Ravi Kumar\n+91 98765 43210', 'IN')[0];
  const below = extractCandidates('+91 98765 43210\nRavi Kumar', 'IN')[0];
  const beside = extractCandidates('Ravi Kumar  +91 98765 43210', 'IN')[0];
  for (const row of [above, below, beside]) assert.equal(row.name, 'Ravi Kumar');
});

test('two cards separated by a blank line keep their own names', () => {
  const rows = extractCandidates('Ravi Kumar\n+91 98765 43210\n\nAnita Sharma\n+91 91234 56789', 'IN');
  assert.equal(find(rows, '9876543210').name, 'Ravi Kumar');
  assert.equal(find(rows, '9123456789').name, 'Anita Sharma');
});

test('a name across a blank line is not attached to a number in another card', () => {
  const [row] = extractCandidates('Ravi Kumar\n\n+91 98765 43210', 'IN');
  assert.equal(row.name, '');
  assert.equal(exclusionReason(row), 'NO_NAME');
});

test('a country list line is never taken as the company or the name', () => {
  const [row] = extractCandidates('Tanzania (+255)\n+86 138 0013 8000', 'IN');
  assert.equal(row.company, undefined);
  assert.equal(row.designation, undefined);
  assert.equal(row.name, '');
});

test('a number with no name is excluded as NO_NAME and not selected', () => {
  const [row] = extractCandidates('+86 138 0013 8000', 'IN');
  assert.equal(exclusionReason(row), 'NO_NAME');
  assert.equal(row.selected, false);
});

test('an invalid or unclear number is excluded as INVALID_NUMBER', () => {
  const [row] = extractCandidates('Ravi Kumar\n+91 12345', 'IN');
  assert.equal(exclusionReason(row), 'INVALID_NUMBER');
});

test('an email or website without a phone number is excluded as NO_PHONE', () => {
  const rows = extractCandidates('Anita Sharma\nanita@example.com', 'IN');
  const email = rows.find((r) => r.email);
  assert.equal(exclusionReason(email), 'NO_PHONE');
  assert.equal(email.selected, false);
});

test('a batch of 120 proper cards is fully processed: nothing truncated, all savable', () => {
  const cards = [];
  for (let i = 0; i < 120; i++) {
    cards.push(`${personName(i)}\n+91 98000 ${String(10000 + i)}`);
  }
  const rows = extractCandidates(cards.join('\n\n'), 'IN');
  const summary = summarizeContacts(rows);
  assert.equal(summary.detected, 120);
  assert.equal(summary.savable, 120);
  assert.equal(summary.saveTotal, 120);
  assert.equal(summary.excluded.length, 0);
  assert.equal(summary.detected, summary.savable + summary.excluded.length);
});

test('a mixed batch over 100 reconciles: detected = proper + excluded, with every exclusion counted', () => {
  const parts = [];
  for (let i = 0; i < 100; i++) parts.push(`${personName(i)}\n+91 98000 ${String(10000 + i)}`);
  for (let i = 0; i < 15; i++) parts.push(`+91 97000 ${String(20000 + i)}`); // numbers with no name
  for (let i = 0; i < 5; i++) parts.push(`Bad Number ${i}\n+91 1234${i}`); // too short to be valid
  for (let i = 0; i < 3; i++) parts.push(`Mail Only ${i}\nperson${i}@example.com`); // no phone

  const rows = extractCandidates(parts.join('\n\n'), 'IN');
  const summary = summarizeContacts(rows);

  assert.equal(summary.detected, rows.length);
  assert.equal(summary.savable, 100, 'every named, valid number is a proper contact');
  assert.equal(summary.excludedCounts.NO_NAME, 15);
  assert.equal(summary.excludedCounts.INVALID_NUMBER, 5);
  assert.equal(summary.excludedCounts.NO_PHONE, 3);
  assert.equal(summary.detected, summary.savable + summary.excluded.length, 'the counts reconcile');
  assert.equal(summary.saveTotal, 100);
});

test('unselecting a proper contact lowers the save total but not the proper count', () => {
  const rows = extractCandidates('Ravi Kumar\n+91 98765 43210\n\nAnita Sharma\n+91 91234 56789', 'IN');
  rows[0].selected = false;
  const summary = summarizeContacts(rows);
  assert.equal(summary.savable, 2);
  assert.equal(summary.saveTotal, 1);
});
