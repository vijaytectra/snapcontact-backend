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
  email?: string;
  website?: string;
  selected: boolean;
  valid: boolean;
  formatted: string;
  message: string;
  extension?: string;
  countryLabel?: string;
  country?: CountryCode;
  callingCode?: string;
  countryName?: string;
  international?: boolean;
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
  const international = input.startsWith('+') || (phone &&
    (phone.countryCallingCode !== getCountryCallingCode(country) || /^(?:00|011)/.test(input)));
  let countryLabel = '';
  let countryName = '';
  if (phone) {
    const region = international ? phone.country : country;
    let regionName = region ?? '';
    if (region) {
      try { regionName = new Intl.DisplayNames(undefined, { type: 'region' }).of(region) ?? region; }
      catch { /* ISO region codes remain available offline. */ }
    }
    countryLabel = international
      ? R.detectedCallingCode(regionName || (phone.countryCallingCode === '1' ? R.northAmericaShared : R.countryUndetermined), phone.countryCallingCode)
      : R.defaultCallingCode(regionName, phone.countryCallingCode);
    countryName = regionName || (phone.countryCallingCode === '1' ? R.northAmericaShared : R.countryUndetermined);
  }
  const detection = {
    countryLabel, countryName, country: phone?.country,
    callingCode: phone?.countryCallingCode, international: !!international,
  };
  if (!phone || !phone.isPossible()) return {
    valid: false, formatted: input, e164: '', extension: undefined,
    message: R.checkDigits, ...detection,
  };
  if (!phone.isValid()) return {
    valid: false, formatted: phone.formatInternational(), e164: '',
    extension: phone.ext, ...detection,
    message: phone.countryCallingCode === '1' && phone.nationalNumber.startsWith('555')
      ? R.exampleAreaCode : R.invalidPlan,
  };
  return {
    valid: true, formatted: phone.formatInternational(), e164: String(phone.number),
    extension: phone.ext, message: '', ...detection,
  };
}

/** Copy unvalidated input as text without inventing or normalizing its digits. */
export function prepareNumberCopy(raw: string, country: CountryCode) {
  const check = validateNumber(raw, country);
  return {
    text: check.valid
      ? check.e164 + (check.extension ? ` ext. ${check.extension}` : '')
      : raw.trim(),
    valid: check.valid,
  };
}

// Common non-web/non-email file extensions to prevent false domain positives in OCR
const NON_WEB_TLDS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf',
  'zip', 'tar', 'gz', '7z', 'rar',
  'mp3', 'mp4', 'wav', 'mov', 'avi', 'mkv',
  'exe', 'apk', 'dmg', 'iso', 'bin', 'deb', 'rpm',
  'js', 'ts', 'jsx', 'tsx', 'py', 'json', 'yaml', 'yml', 'xml', 'css', 'html',
]);

const POPULAR_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
  'io', 'ai', 'app', 'dev', 'tech', 'co', 'me', 'tv', 'cc', 'xyz', 'info', 'biz',
  'site', 'online', 'store', 'shop', 'blog', 'design', 'cloud', 'pro', 'club',
  'space', 'live', 'digital', 'world', 'life', 'global', 'agency', 'media', 'center',
  'group', 'today', 'link', 'solutions', 'services', 'company', 'network',
  'consulting', 'academy', 'community', 'international', 'photography', 'enterprises',
  'uk', 'de', 'pl', 'fr', 'it', 'es', 'nl', 'ca', 'in', 'jp', 'au', 'us', 'eu',
  'ch', 'se', 'no', 'fi', 'dk', 'be', 'at', 'cz', 'pt', 'ru', 'cn', 'kr', 'sg',
  'hk', 'nz', 'mx', 'ar', 'za', 'cl', 'br', 'ae', 'sa', 'tr', 'gr', 'ro', 'hu',
  'ie', 'il', 'th', 'vn', 'my', 'ph', 'id', 'ua', 'tw', 'ng', 'ke', 'pk', 'bd',
]);

/**
 * Extracts and cleans email addresses across all domains (gTLDs, ccTLDs, subdomains).
 * Handles OCR artifacts like whitespace around @ or dots, and trailing punctuation.
 */
export function extractEmails(source: string): Array<{ email: string; start: number; end: number }> {
  const results: Array<{ email: string; start: number; end: number }> = [];
  if (!source) return results;

  const pattern = /(?:^|[^\p{L}\p{N}._%+-])(?:(?:e-?mail|mail|contact)\s*[:：]\s*)?([\p{L}\p{N}._%+-]+(?:\s*@\s*|\s*[\(\[]\s*at\s*[\)\]]\s*)[\p{L}\p{N}.-]+\.[\p{L}]{2,24})/giu;

  for (const match of source.matchAll(pattern)) {
    const raw = match[1];
    if (!raw) continue;
    const email = raw
      .replace(/\s*@\s*|\s*[\(\[]\s*at\s*[\)\]]\s*/gi, '@')
      .replace(/\s*\.\s*/g, '.')
      .replace(/[.,;:!?)\]>"']+$/, '')
      .trim();

    const at = email.indexOf('@');
    if (at > 0 && at < email.length - 3) {
      const domain = email.slice(at + 1);
      const dot = domain.lastIndexOf('.');
      if (dot > 0 && dot < domain.length - 1) {
        const tld = domain.slice(dot + 1).toLowerCase();
        if (/^[\p{L}]{2,24}$/u.test(tld) && !NON_WEB_TLDS.has(tld)) {
          const start = match.index! + (match[0].length - raw.length);
          if (!results.some(r => r.email.toLowerCase() === email.toLowerCase())) {
            results.push({ email, start, end: start + raw.length });
          }
        }
      }
    }
  }
  return results;
}

/**
 * Extracts and cleans website URLs / domain names across all domains.
 * Handles protocols (https://, http://), www prefixes, and standalone domains.
 * Strips leading labels (Web:, Site:) and trailing punctuation.
 */
export function extractWebsites(
  source: string,
  emailSpans: Array<{ start: number; end: number }> = [],
): Array<{ website: string; start: number; end: number }> {
  const results: Array<{ website: string; start: number; end: number }> = [];
  if (!source) return results;

  const explicitPattern = /(?:(?:web|website|site|url|homepage)\s*[:：]\s*)?((?:https?:\/\/|www\.)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?:\.[a-z]{2,24})(?::\d{2,5})?(?:\/[^\s<>"'{}|\\^`[\]]*)?)/gi;

  for (const match of source.matchAll(explicitPattern)) {
    const raw = match[1];
    if (!raw) continue;
    const cleaned = raw.replace(/[.,;:!?)\]>"']+$/, '').trim();
    const start = match.index! + (match[0].length - raw.length);
    const end = start + cleaned.length;

    if (emailSpans.some(span => start >= span.start && end <= span.end)) continue;

    if (!results.some(r => r.website.toLowerCase() === cleaned.toLowerCase())) {
      results.push({ website: cleaned, start, end });
    }
  }

  const lines = source.split('\n');
  let currentOffset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const domainMatch = trimmed.match(/^(?:(?:web|website|site|url|homepage)\s*[:：]\s*)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}(?::\d{2,5})?(?:\/[^\s<>"'{}|\\^`[\]]*)?)$/i);
    if (domainMatch) {
      const rawDomain = domainMatch[1].replace(/[.,;:!?)\]>"']+$/, '').trim();
      const slash = rawDomain.indexOf('/');
      const hostPart = slash > 0 ? rawDomain.slice(0, slash) : rawDomain;
      const lastDot = hostPart.lastIndexOf('.');
      if (lastDot > 0) {
        const tld = hostPart.slice(lastDot + 1).toLowerCase();
        if (/^[a-z]{2,24}$/.test(tld) && !NON_WEB_TLDS.has(tld)) {
          const lineStart = currentOffset + line.indexOf(rawDomain);
          const lineEnd = lineStart + rawDomain.length;
          if (!emailSpans.some(span => lineStart >= span.start && lineEnd <= span.end) &&
              !results.some(r => r.website.toLowerCase() === rawDomain.toLowerCase())) {
            results.push({ website: rawDomain, start: lineStart, end: lineEnd });
          }
        }
      }
    } else {
      const inlinePattern = /(?:^|[^\p{L}\p{N}/._@-])(?:(?:web|website|site|url|homepage)\s*[:：]\s*)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}(?::\d{2,5})?(?:\/[^\s<>"'{}|\\^`[\]]*)?)(?![@\w.-])/giu;
      for (const m of line.matchAll(inlinePattern)) {
        const candidateDomain = m[1].replace(/[.,;:!?)\]>"']+$/, '').trim();
        const slash = candidateDomain.indexOf('/');
        const hostPart = slash > 0 ? candidateDomain.slice(0, slash) : candidateDomain;
        const lastDot = hostPart.lastIndexOf('.');
        if (lastDot > 0) {
          const tld = hostPart.slice(lastDot + 1).toLowerCase();
          const isKnownTld = POPULAR_TLDS.has(tld);
          const hasPath = slash > 0 && candidateDomain.length > slash + 1;
          const hasSubdomain = hostPart.indexOf('.') !== lastDot;
          if ((isKnownTld || hasPath || hasSubdomain) && !NON_WEB_TLDS.has(tld)) {
            const start = currentOffset + m.index! + (m[0].length - m[1].length);
            const end = start + candidateDomain.length;
            if (!emailSpans.some(span => start >= span.start && end <= span.end) &&
                !results.some(r => r.website.toLowerCase() === candidateDomain.toLowerCase())) {
              results.push({ website: candidateDomain, start, end });
            }
          }
        }
      }
    }
    currentOffset += line.length + 1;
  }

  return results.sort((a, b) => a.start - b.start);
}

function nearbyName(text: string, offset: number): string {
  const before = text.slice(0, offset).split('\n');
  const sameLine = before.at(-1)?.replace(/(?:tel(?:ephone)?|phone|mobile|call|fax|whatsapp|contact|email|e-mail|mail|web|website|site)\s*[:：]?\s*$/i, '').trim() ?? '';
  const previous = before.slice(0, -1).reverse().slice(0, 3);
  const next = text.slice(offset).split('\n').slice(1, 3);
  return [sameLine, ...previous, ...next].find(line =>
    line.length >= 2 && line.length <= 90 && /\p{L}/u.test(line) &&
    !/https?:|www\.|@|^\s*(?:tel|phone|mobile|call|fax|whatsapp|email|e-mail|mail|web|website|site)\s*[:：]?\s*$/i.test(line) &&
    !/\d{4}/.test(line) &&
    !/\.(?:com|org|net|edu|gov|io|ai|app|dev|tech|co|pl|de|uk|eu)\b/i.test(line),
  )?.trim() ?? '';
}

export function extractCandidates(source: string, country: CountryCode): Candidate[] {
  const text = normalizeDigits(source);
  const emails = extractEmails(source);
  const emailSpans = emails.map(e => ({ start: e.start, end: e.end }));
  const websites = extractWebsites(source, emailSpans);

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
  const usedEmails = new Set<number>();
  const usedWebsites = new Set<number>();

  const candidates: Candidate[] = results.sort((a, b) => a.start - b.start).flatMap(({ raw, start }) => {
    const check = validateNumber(raw, country);
    const key = `${check.e164 || raw.replace(/\D/g, '')}:${check.extension ?? ''}`;
    if (seen.has(key)) return [];
    seen.add(key);

    // Associate nearest unused email
    let attachedEmail: string | undefined;
    let bestEmailIdx = -1;
    let bestEmailDist = Infinity;
    for (let i = 0; i < emails.length; i++) {
      if (usedEmails.has(i)) continue;
      const dist = Math.abs(emails[i].start - start);
      if (dist < bestEmailDist) {
        bestEmailDist = dist;
        bestEmailIdx = i;
      }
    }
    if (bestEmailIdx !== -1 && (emails.length === 1 || bestEmailDist < 600)) {
      attachedEmail = emails[bestEmailIdx].email;
      usedEmails.add(bestEmailIdx);
    }

    // Associate nearest unused website
    let attachedWebsite: string | undefined;
    let bestWebIdx = -1;
    let bestWebDist = Infinity;
    for (let i = 0; i < websites.length; i++) {
      if (usedWebsites.has(i)) continue;
      const dist = Math.abs(websites[i].start - start);
      if (dist < bestWebDist) {
        bestWebDist = dist;
        bestWebIdx = i;
      }
    }
    if (bestWebIdx !== -1 && (websites.length === 1 || bestWebDist < 600)) {
      attachedWebsite = websites[bestWebIdx].website;
      usedWebsites.add(bestWebIdx);
    }

    return [{
      id: `number-${start}-${results.length}`, raw, number: raw,
      name: nearbyName(text, start),
      email: attachedEmail,
      website: attachedWebsite,
      selected: check.valid,
      valid: check.valid, formatted: check.formatted,
      message: check.message, extension: check.extension,
      countryLabel: check.countryLabel,
      country: check.country, callingCode: check.callingCode,
      countryName: check.countryName, international: check.international,
    }];
  });

  // Also include standalone email/website contacts that had no phone number
  for (let i = 0; i < emails.length; i++) {
    if (usedEmails.has(i)) continue;
    const em = emails[i];
    let attachedWebsite: string | undefined;
    let bestWebIdx = -1;
    let bestWebDist = Infinity;
    for (let w = 0; w < websites.length; w++) {
      if (usedWebsites.has(w)) continue;
      const dist = Math.abs(websites[w].start - em.start);
      if (dist < bestWebDist) {
        bestWebDist = dist;
        bestWebIdx = w;
      }
    }
    if (bestWebIdx !== -1 && (websites.length === 1 || bestWebDist < 600)) {
      attachedWebsite = websites[bestWebIdx].website;
      usedWebsites.add(bestWebIdx);
    }
    usedEmails.add(i);

    candidates.push({
      id: `email-${em.start}`,
      raw: '',
      number: '',
      name: nearbyName(text, em.start),
      email: em.email,
      website: attachedWebsite,
      selected: true,
      valid: true,
      formatted: em.email,
      message: '',
      extension: undefined,
      countryLabel: undefined,
      country: undefined,
      callingCode: undefined,
      countryName: undefined,
      international: false,
    });
  }

  return candidates;

}

