import {
  findPhoneNumbersInText,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';
import { R } from './runtimeStrings.ts';

export type Candidate = {
  id: string;
  raw: string;
  number: string;
  name: string;
  selected: boolean;
  valid: boolean;
  formatted: string;
  message: string;
  extension?: string;
};
export type CountryOption = { code: CountryCode; name: string; callingCode: string };

export function countryOptions(locale = 'en'): CountryOption[] {
  let names: Intl.DisplayNames | undefined;
  try { names = new Intl.DisplayNames([locale], { type: 'region' }); } catch { /* ISO codes remain usable offline */ }
  return getCountries().map(code => ({
    code,
    name: names?.of(code) ?? code,
    callingCode: `+${getCountryCallingCode(code)}`,
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Normalize common OCR digit scripts, not ambiguous letters (O/I). Never guess digits. */
export function normalizeDigits(text: string): string {
  const starts = [0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66,
    0xbe6, 0xc66, 0xce6, 0xd66, 0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090,
    0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50];
  return text.normalize('NFKC').replace(/\p{Nd}/gu, char => {
    const code = char.codePointAt(0)!;
    const start = starts.find(n => code >= n && code <= n + 9);
    return start === undefined ? char : String(code - start);
  }).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
}

export function validateNumber(raw: string, country: CountryCode) {
  const input = normalizeDigits(raw).trim();
  // 00 is an international prefix in many, but not all, regions. Parsing with
  // the selected country preserves NANP 011, Australian 0011 and local trunks.
  const phone = parsePhoneNumberFromString(input, { defaultCountry: country, extract: false });
  if (!phone || !phone.isPossible()) return {
    valid: false, formatted: input, e164: '', extension: undefined,
    message: R.checkDigits,
  };
  if (!phone.isValid()) return {
    valid: false, formatted: phone.formatInternational(), e164: '',
    extension: phone.ext, message: R.invalidPlan,
  };
  return {
    valid: true, formatted: phone.formatInternational(), e164: String(phone.number),
    extension: phone.ext, message: '',
  };
}

function nearbyName(text: string, offset: number): string {
  const before = text.slice(0, offset).split('\n');
  const sameLine = before.at(-1)?.replace(/(?:tel(?:ephone)?|phone|mobile|call|fax|whatsapp|contact)\s*[:：]?\s*$/i, '').trim() ?? '';
  const previous = before.slice(0, -1).reverse().slice(0, 3);
  const next = text.slice(offset).split('\n').slice(1, 3);
  return [sameLine, ...previous, ...next].find(line =>
    line.length >= 2 && line.length <= 90 && /\p{L}/u.test(line) &&
    !/https?:|www\.|@|^\s*(?:tel|phone|mobile|call|fax|whatsapp)\s*[:：]?\s*$/i.test(line) &&
    !/\d{4}/.test(line),
  )?.trim() ?? '';
}

export function extractCandidates(source: string, country: CountryCode): Candidate[] {
  const text = normalizeDigits(source);
  const results: Array<{ raw: string; start: number }> = [];
  // POSSIBLE retains uncertain candidates for explicit review rather than hiding them.
  const matches = findPhoneNumbersInText(text, { defaultCountry: country, extended: true });
  for (const match of matches) {
    results.push({ raw: text.slice(match.startsAt, match.endsAt), start: match.startsAt });
  }
  // Keep invalid-but-phone-shaped OCR fragments visible for repair as well.
  // Never consume newlines: two phone lines must remain two candidates.
  const broad = /(?:\+|00)?\d[\d ().\-\u2010-\u2015]{4,}\d(?:[ \t]*(?:ext\.?|x|#)[ \t]*\d{1,8})?/gi;
  for (const match of text.matchAll(broad)) {
    const raw = match[0].trim();
    const count = raw.replace(/\D/g, '').length;
    if (count >= 6 && count <= 23 && !results.some(r =>
      match.index! < r.start + r.raw.length && match.index! + raw.length > r.start,
    )) results.push({ raw, start: match.index! });
  }
  const seen = new Set<string>();
  return results.sort((a, b) => a.start - b.start).flatMap(({ raw, start }) => {
    const check = validateNumber(raw, country);
    const key = `${check.e164 || raw.replace(/\D/g, '')}:${check.extension ?? ''}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: `number-${start}-${results.length}`, raw, number: raw,
      name: nearbyName(text, start), selected: check.valid,
      valid: check.valid, formatted: check.formatted,
      message: check.message, extension: check.extension,
    }];
  });
}
