/**
 * What a contact name may contain: letters in any script, combining marks, spaces, apostrophes,
 * hyphens and dots (for "St. John", "O'Brien", "Anne-Marie"). Digits, symbols such as @ # $ % * < >,
 * brackets and emoji are removed as the name is entered or read from a screenshot.
 */
const DISALLOWED = /[^\p{L}\p{M} .'’-]/gu;
export const MAX_NAME_LENGTH = 60;

export function sanitizeName(raw: string): string {
  return raw
    .replace(DISALLOWED, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, MAX_NAME_LENGTH);
}
