export type GoogleIdTokenInfo = {
  aud: string;
  iss: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  exp: string | number;
};

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/**
 * Verifies a Google ID token with Google's tokeninfo endpoint, which checks the signature
 * and expiry. Returns null for anything Google rejects or that isn't a Google-issued token.
 * The caller must still check `aud` against our own client IDs.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenInfo | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) return null;
    const info = (await res.json()) as GoogleIdTokenInfo;
    if (!info?.email || !info?.aud || !GOOGLE_ISSUERS.has(info.iss)) return null;
    if (Number(info.exp) * 1000 < Date.now()) return null;
    return info;
  } catch {
    return null;
  }
}
