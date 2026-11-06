const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

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

export async function apiFetch(path: string, options: RequestInit = {}) {
  let res: Response | undefined;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      res = await fetch(`${BASE}${path}`, {
        ...options,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
      break;
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new ApiError('The server is taking too long to respond. Please try again in a moment.', 0);
      }
      if (attempt >= RETRY_DELAYS_MS.length) {
        throw new ApiError('Could not reach the server. Check your internet connection and try again.', 0);
      }
      await wait(RETRY_DELAYS_MS[attempt]);
    } finally {
      clearTimeout(timer);
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error || `Something went wrong (error ${res.status}). Please try again.`, res.status, data?.code);
  }
  return data;
}

/** Wakes a sleeping free-tier server early, so the first sign-in tap does not wait for it. */
export function warmUpServer() {
  fetch(`${BASE}/healthz`).catch(() => { /* best effort */ });
}

export const API_BASE = BASE;
