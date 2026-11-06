import { resolveApiBase } from './apiConfig.ts';

declare const __DEV__: boolean | undefined;
declare const require: ((id: string) => any) | undefined;

function runtimePlatform(): 'web' | 'ios' | 'android' | 'node' {
  try {
    const os = typeof require === 'function' ? require('react-native').Platform.OS : undefined;
    if (os === 'ios' || os === 'android' || os === 'web') return os;
  } catch { /* not running in React Native */ }
  return typeof window !== 'undefined' && typeof document !== 'undefined' ? 'web' : 'node';
}

/** The computer running the Expo dev server, as the phone reaches it (development only). */
function devServerHost(): string | null {
  try {
    const Constants = typeof require === 'function' ? require('expo-constants').default : null;
    const hostUri: string | undefined = Constants?.expoConfig?.hostUri ?? Constants?.expoGoConfig?.debuggerHost;
    return hostUri ? hostUri.split(':')[0] : null;
  } catch { return null; }
}

const IS_DEV = typeof __DEV__ !== 'undefined' ? !!__DEV__ : process.env.NODE_ENV !== 'production';
const platform = runtimePlatform();
const CONFIG = resolveApiBase({
  raw: process.env.EXPO_PUBLIC_API_URL,
  isDev: IS_DEV,
  platform,
  devServerHost: IS_DEV && platform !== 'web' && platform !== 'node' ? devServerHost() : null,
});
if (CONFIG.error) console.error(`API configuration error: ${CONFIG.error}`);
const BASE = CONFIG.base;

// Free hosting (Render) sleeps when idle and can take ~50s to wake, so allow a full minute.
const TIMEOUT_MS = 60_000;

/** Error from the API, with the HTTP status (0 = no response) and the server's error code if any. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// A dropped connection (flaky mobile data, Wi-Fi waking up, a server restarting) usually
// succeeds a moment later, so retry those before telling the user. Timeouts are not retried:
// the server already had a full minute.
const RETRY_DELAYS_MS = [1500, 3000];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `retry` overrides the default: reads (GET) retry a dropped connection; other methods do not,
 * because the first attempt may already have reached the server (a second email, order or
 * spent code). Pass `retry: true` only for calls that are safe to repeat.
 */
export async function apiFetch(path: string, options: RequestInit & { retry?: boolean } = {}) {
  if (CONFIG.error) throw new ApiError(CONFIG.error, 0, 'CONFIG');
  const { retry, ...init } = options;
  const maxRetries = (retry ?? (init.method ?? 'GET').toUpperCase() === 'GET') ? RETRY_DELAYS_MS.length : 0;
  const timeoutError = () => new ApiError('The server is taking too long to respond. Please try again in a moment.', 0);
  let res: Response | undefined;
  let controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  for (let attempt = 0; ; attempt++) {
    controller = new AbortController();
    timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      res = await fetch(`${BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      });
      break;
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === 'AbortError') throw timeoutError();
      if (attempt >= maxRetries) {
        throw new ApiError('Could not reach the server. Check your internet connection and try again.', 0);
      }
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
  // The same timer keeps running while the body is read, so a stalled response cannot hang forever.
  let data: any;
  try {
    data = await res.json();
  } catch {
    if (controller.signal.aborted) throw timeoutError();
    // A success status with a non-JSON body (e.g. a captive Wi-Fi login page) is not a valid answer.
    if (res.ok) throw new ApiError('The server sent an unexpected response. Please try again.', res.status);
    data = {};
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Something went wrong (error ${res.status}). Please try again.`, res.status, data?.code);
  }
  return data;
}

/** Wakes a sleeping free-tier server early, so the first sign-in tap does not wait for it. */
export function warmUpServer() {
  if (CONFIG.error) return;
  fetch(`${BASE}/healthz`).catch(() => { /* best effort */ });
}

export const API_BASE = BASE;
