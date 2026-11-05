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

export async function apiFetch(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (e: any) {
    throw new ApiError(
      e?.name === 'AbortError'
        ? 'The server is taking too long to respond. Please try again in a moment.'
        : 'Could not reach the server. Check your internet connection and try again.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error || `Something went wrong (error ${res.status}). Please try again.`, res.status, data?.code);
  }
  return data;
}

export const API_BASE = BASE;
