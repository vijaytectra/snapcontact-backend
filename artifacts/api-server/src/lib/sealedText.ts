import crypto from 'node:crypto';
import { getCredentialKey } from './config';
import { AuthError } from './authFlow';

/**
 * AES-256-GCM for the one value that must come back out: the password, until its credentials
 * email is sent. Output is base64(iv | auth tag | ciphertext). Tampering makes `open` throw.
 */
const ALGORITHM = 'aes-256-gcm';

export function sealWith(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function openWith(sealed: string, key: Buffer): string {
  const buf = Buffer.from(sealed, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

/** The server key, or a 503 so username sign-up stays off until CREDENTIAL_KEY is set. */
export function requireCredentialKey(): Buffer {
  const key = getCredentialKey();
  if (!key) throw new AuthError(503, 'Username sign-up is not available right now. Please try again later.', 'NOT_CONFIGURED');
  return key;
}
