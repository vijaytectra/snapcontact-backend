import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCandidates } from '../lib/phone.ts';
import { exclusionReason } from '../lib/contactSummary.ts';
import { sanitizeName, MAX_NAME_LENGTH } from '../lib/nameRules.ts';

test('pasted "Name - number" lines map each name to its own number', () => {
  const text = `Arun - +91 9876543210
Priya - +91 8765432109
Kumar - 9600521789
Sneha - +91 9123456780
Rahul - +91 9988776655
Divya - 9090909090`;
  const rows = extractCandidates(text, 'IN');
  assert.deepEqual(rows.map((r) => r.name), ['Arun', 'Priya', 'Kumar', 'Sneha', 'Rahul', 'Divya']);
  assert.ok(rows.every((r) => exclusionReason(r) === null), 'all six are proper contacts');
});

test('a dash after a company name is not kept as part of it', () => {
  const [row] = extractCandidates('Acme Technologies - +91 9876543210', 'IN');
  assert.equal(row.name, 'Acme Technologies');
});

test('names keep letters, apostrophes, hyphens and dots, and lose symbols and digits', () => {
  assert.equal(sanitizeName("O'Brien-Smith St. John"), "O'Brien-Smith St. John");
  assert.equal(sanitizeName('Ravi@#$ Kumar 123<>'), 'Ravi Kumar ');
  assert.equal(sanitizeName('Zoë Müller'), 'Zoë Müller');
  assert.equal(sanitizeName('A'.repeat(100)).length, MAX_NAME_LENGTH);
});
