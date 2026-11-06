/**
 * Which API server the app talks to.
 *  - Release builds: EXPO_PUBLIC_API_URL must be an https URL on a public host (set per EAS
 *    profile in eas.json). Anything else is a configuration error, never a silent fallback.
 *  - Development: EXPO_PUBLIC_API_URL from .env, or http://localhost:5001/api. On a phone or
 *    emulator "localhost" is the device itself, so it is swapped for the computer running the
 *    Expo dev server (from Expo's hostUri) or the Android emulator's host alias 10.0.2.2.
 */

export const DEV_DEFAULT_API = 'http://localhost:5001/api';

const PRIVATE_HOST = /^(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?|[^.]+\.local|[^.]+)$/i;

export type ApiConfigInput = {
  raw: string | undefined;
  isDev: boolean;
  platform: 'web' | 'ios' | 'android' | 'node';
  /** Host of the Expo dev server as seen by the device, e.g. "192.168.1.20". */
  devServerHost?: string | null;
};

export type ApiConfig = { base: string; error?: undefined } | { base: ''; error: string };

export function resolveApiBase({ raw, isDev, platform, devServerHost }: ApiConfigInput): ApiConfig {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!isDev) {
    let url: URL;
    try { url = new URL(value); } catch {
      return { base: '', error: 'This build has no valid server address (EXPO_PUBLIC_API_URL). Please update the app.' };
    }
    if (url.protocol !== 'https:') return { base: '', error: 'This build must use an https server address.' };
    if (PRIVATE_HOST.test(url.hostname)) return { base: '', error: 'This build points at a local network address instead of the live server.' };
    return { base: value };
  }
  const devValue = value || DEV_DEFAULT_API;
  if (platform === 'web' || platform === 'node') return { base: devValue };
  if (!/\/\/(?:localhost|127\.0\.0\.1)(?=[:/]|$)/.test(devValue)) return { base: devValue };
  const host = devServerHost || (platform === 'android' ? '10.0.2.2' : 'localhost');
  return { base: devValue.replace(/localhost|127\.0\.0\.1/, host) };
}
