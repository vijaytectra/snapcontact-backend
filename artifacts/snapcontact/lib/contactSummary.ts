import type { Candidate } from './phone.ts';

/**
 * A contact can be saved only when it has a usable name and a valid phone number. Every detected
 * entry is either saved-ready ("proper") or excluded with one reason, so the counts always add up:
 *
 *   detected = proper + excluded
 *   save total = proper contacts that are selected
 */
export type ExclusionReason = 'NO_NAME' | 'INVALID_NUMBER' | 'NO_PHONE';

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  NO_NAME: 'No name found',
  INVALID_NUMBER: 'Number is invalid or unclear',
  NO_PHONE: 'No phone number',
};

/** Why an entry cannot be saved, or null when it is a proper contact. Checked in this order. */
export function exclusionReason(candidate: Candidate): ExclusionReason | null {
  if (!candidate.number.trim()) return 'NO_PHONE';
  if (!candidate.valid) return 'INVALID_NUMBER';
  if (!candidate.name.trim()) return 'NO_NAME';
  return null;
}

export const isProper = (candidate: Candidate) => exclusionReason(candidate) === null;

export function summarizeContacts(candidates: Candidate[]) {
  const proper: Candidate[] = [];
  const excluded: Array<{ candidate: Candidate; reason: ExclusionReason }> = [];
  const excludedCounts: Record<ExclusionReason, number> = { NO_NAME: 0, INVALID_NUMBER: 0, NO_PHONE: 0 };
  for (const candidate of candidates) {
    const reason = exclusionReason(candidate);
    if (reason === null) {
      proper.push(candidate);
    } else {
      excluded.push({ candidate, reason });
      excludedCounts[reason] += 1;
    }
  }
  return {
    detected: candidates.length,
    proper,
    excluded,
    excludedCounts,
    savable: proper.length,
    saveTotal: proper.filter((c) => c.selected).length,
  };
}
