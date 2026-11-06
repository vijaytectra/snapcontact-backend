import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  UserProfile,
  SubscriptionInfo,
  calculateSubscriptionState,
  createDefaultTrialSubscription,
  getStoredUser,
  isValidEmail,
  storeUser,
} from '@/lib/auth';
import { ApiError, apiFetch } from '@/lib/api';
import { startCheckout, verifyPayment as verifyPaymentApi, type CheckoutSession, type PaymentOutcome } from '@/lib/cashfree';

const TOKEN_KEY = 'snapcontact.token.v1';
const REFRESH_KEY = 'snapcontact.refresh.v1';

const DEMO_EMAIL = 'traveler@example.com';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [guestSubscription, setGuestSubscription] = useState<SubscriptionInfo>(() =>
    createDefaultTrialSubscription()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const busyRef = useRef(false);
  // Session from a verified code, held until the user creates or resets their password.
  const pendingSessionRef = useRef<any>(null);
  // Email whose magic link was verified and now needs a password (drives the auth screen).
  const [pendingPasswordEmail, setPendingPasswordEmail] = useState<string | null>(null);
  // Tokens also kept in memory: SecureStore is unavailable on web.
  const tokensRef = useRef<{ token: string | null; refresh: string | null }>({ token: null, refresh: null });

  // Load stored user on mount
  useEffect(() => {
    let mounted = true;
    getStoredUser()
      .then((stored) => {
        if (!mounted) return;
        if (stored) {
          setUser(stored);
        } else {
          // Check for device guest trial
          setGuestSubscription(createDefaultTrialSubscription());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const subscription: SubscriptionInfo = user
    ? user.subscription
    : guestSubscription;

  // Saves a server session (tokens + profile) and signs the user in on this device.
  const applySession = useCallback(async (data: any) => {
    const profile: UserProfile = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      createdAt: new Date().toISOString(),
      // The server sends only the stored dates; work out days left and status here.
      subscription: data.user.subscription
        ? calculateSubscriptionState(data.user.subscription)
        : createDefaultTrialSubscription(),
    };
    // SecureStore is unavailable on web; the profile alone keeps the user signed in there.
    tokensRef.current = { token: data.token, refresh: data.refreshToken ?? tokensRef.current.refresh };
    await SecureStore.setItemAsync(TOKEN_KEY, data.token).catch(() => {});
    if (data.refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken).catch(() => {});
    await storeUser(profile);
    setUser(profile);
  }, []);

  /**
   * First step: 'password' when this account already has a password, otherwise 'otp'
   * (new emails and accounts that have not created a password yet). null when the check failed.
   */
  const checkEmail = useCallback(async (email: string): Promise<'password' | 'otp' | null> => {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setAuthError('Please enter a valid email address.');
      return null;
    }
    try {
      const data = await apiFetch('/auth/check-email', { method: 'POST', body: JSON.stringify({ email: cleanEmail }) });
      return data.method === 'password' ? 'password' : 'otp';
    } catch (e: any) {
      // Older server without /auth/check-email: it signs in with an email code only.
      if (e instanceof ApiError && e.status === 404 && !e.code) return 'otp';
      setAuthError(e?.message || 'Could not reach the server. Check your connection and try again.');
      return null;
    }
  }, []);

  /** Emails a code for setting a new password. The server answers the same for unknown emails. */
  const requestPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setAuthError('Please enter a valid email address.');
      return false;
    }
    if (busyRef.current) return false;
    busyRef.current = true;
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: cleanEmail }) });
      return true;
    } catch (e: any) {
      setAuthError(e instanceof ApiError && e.status === 404 && !e.code
        ? 'Password reset is not available yet. Please try again later.'
        : e?.message || 'Failed to send code');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, []);

  const requestOtp = useCallback(async (email: string, mode?: 'signin' | 'signup'): Promise<boolean> => {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setAuthError('Please enter a valid email address.');
      return false;
    }
    if (busyRef.current) return false;
    busyRef.current = true;
    try {
      await apiFetch('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: cleanEmail, mode }) });
      return true;
    } catch (e: any) {
      setAuthError(e?.message || 'Failed to send code');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, []);

  /** Signs in with the ID token from Google's sign-in sheet. Creates the account on first use. */
  const signInWithGoogle = useCallback(async (idToken: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setAuthError(null);
    try {
      const data = await apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) });
      await applySession(data);
      return true;
    } catch (e: any) {
      setAuthError(e?.message || 'Google sign-in failed. Please try again.');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [applySession]);

  /**
   * Signs in from the emailed link. Like a code, a first sign-in holds the session until the
   * user creates a password; `pendingPasswordEmail` tells the auth screen to show that step.
   */
  const verifyLink = useCallback(async (email: string, token: string): Promise<'signed-in' | 'needs-password' | false> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setAuthError(null);
    try {
      const data = await apiFetch(`/auth/verify-link?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);
      if (data.needsPassword === true) {
        pendingSessionRef.current = data;
        setPendingPasswordEmail(data.user?.email ?? email);
        return 'needs-password';
      }
      await applySession(data);
      return 'signed-in';
    } catch (e: any) {
      setAuthError(e?.message || 'This sign-in link is invalid or has expired. Request a new one.');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [applySession]);

  /**
   * Checks the emailed code. When the account still needs a password (first sign-in) or the code
   * was for a password reset, the session is held back until setPassword succeeds, so the user is
   * not signed in without a password.
   */
  const verifyOtp = useCallback(async (
    email: string, otp: string, name?: string, purpose: 'signin' | 'reset' = 'signin',
  ): Promise<'signed-in' | 'needs-password' | false> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setAuthError(null);
    const cleanEmail = email.trim();
    try {
      const data = await apiFetch('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: cleanEmail, otp, name }) });
      if (data.needsPassword === true || purpose === 'reset') {
        pendingSessionRef.current = data;
        return 'needs-password';
      }
      await applySession(data);
      return 'signed-in';
    } catch (e: any) {
      setAuthError(e?.message || 'Invalid code');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [applySession]);

  /** Creates (or resets) the password with the session from the code just verified, then signs in. */
  const setPassword = useCallback(async (password: string): Promise<boolean> => {
    if (busyRef.current) return false;
    setAuthError(null);
    const pending = pendingSessionRef.current;
    if (!pending?.token) {
      setAuthError('Your code has expired. Go back and request a new one.');
      return false;
    }
    busyRef.current = true;
    try {
      const data = await apiFetch('/auth/set-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pending.token}` },
        body: JSON.stringify({ password }),
      });
      pendingSessionRef.current = null;
      setPendingPasswordEmail(null);
      await applySession(data);
      return true;
    } catch (e: any) {
      setAuthError(e?.message || 'Could not save your password. Please try again.');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [applySession]);

  const login = useCallback(
    async (email: string, password?: string): Promise<boolean> => {
      if (busyRef.current) return false;
      setAuthError(null);
      const cleanEmail = email.trim();
      if (!cleanEmail || !isValidEmail(cleanEmail)) {
        setAuthError('Please enter a valid email address.');
        return false;
      }

      // "Try demo account" stays on this device and never talks to the server.
      if (!password && cleanEmail.toLowerCase() === DEMO_EMAIL) {
        const existing = await getStoredUser();
        const same = existing?.email.toLowerCase() === DEMO_EMAIL;
        const profile: UserProfile = {
          id: same ? existing!.id : `usr_${Date.now()}`,
          email: DEMO_EMAIL,
          name: 'traveler',
          createdAt: same ? existing!.createdAt : new Date().toISOString(),
          subscription: same
            ? calculateSubscriptionState(existing!.subscription, existing!.createdAt)
            : createDefaultTrialSubscription(),
        };
        await storeUser(profile);
        setUser(profile);
        return true;
      }
      if (!password) {
        setAuthError('Enter your password.');
        return false;
      }

      busyRef.current = true;
      try {
        const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: cleanEmail, password }) });
        await applySession(data);
        return true;
      } catch (e: any) {
        // Never fall back to an offline sign-in: a wrong password must not open the account.
        setAuthError(e?.message || 'Could not sign in. Please try again.');
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [applySession]
  );

  const signup = useCallback(
    async (email: string, _password?: string, name?: string): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setAuthError(null);
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        setAuthError('Please enter your email address.');
        busyRef.current = false;
        return false;
      }
      if (!isValidEmail(cleanEmail)) {
        setAuthError('Please enter a valid email address.');
        busyRef.current = false;
        return false;
      }

      try {
        const data = await apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ email: cleanEmail, password: _password || '', name }) });
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          createdAt: new Date().toISOString(),
          subscription: data.user.subscription || createDefaultTrialSubscription(),
        };
        await SecureStore.setItemAsync('snapcontact.token.v1', data.token);
        if (data.refreshToken) await SecureStore.setItemAsync('snapcontact.refresh.v1', data.refreshToken);
        await storeUser(profile);
        setUser(profile);
        busyRef.current = false;
        return true;
      } catch {}

      const now = new Date().toISOString();
      const profile: UserProfile = {
        id: `usr_${Date.now()}`,
        email: cleanEmail,
        name: name?.trim() || cleanEmail.split('@')[0],
        createdAt: now,
        subscription: createDefaultTrialSubscription(),
      };

      await storeUser(profile);
      setUser(profile);
      busyRef.current = false;
      return true;
    },
    []
  );

  const logout = useCallback(async () => {
    tokensRef.current = { token: null, refresh: null };
    pendingSessionRef.current = null;
    setPendingPasswordEmail(null);
    await storeUser(null);
    // SecureStore is unavailable on web; a failed token delete must not leave the user signed in.
    await SecureStore.deleteItemAsync('snapcontact.token.v1').catch(() => {});
    await SecureStore.deleteItemAsync('snapcontact.refresh.v1').catch(() => {});
    setUser(null);
    setGuestSubscription(createDefaultTrialSubscription());
  }, []);

  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  /** New access token from the refresh token. False when the session is gone for good. */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    const rt = tokensRef.current.refresh ?? await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null);
    if (!rt) return false;
    try {
      const data = await apiFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: rt }) });
      tokensRef.current = { token: data.token, refresh: data.refreshToken ?? rt };
      await SecureStore.setItemAsync(TOKEN_KEY, data.token).catch(() => {});
      if (data.refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken).catch(() => {});
      return true;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return false;
      throw e; // offline or server down: keep the session, try later
    }
  }, []);

  /**
   * Calls the API as the signed-in user. An expired access token is refreshed once; if the
   * session is revoked, the user is signed out (SESSION_EXPIRED) instead of keeping stale access.
   */
  const authedFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const call = async () => {
      const token = tokensRef.current.token ?? await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      // No stored token (e.g. web, where SecureStore is unavailable): not proof the session is
      // revoked, so don't sign out; only a 401 from the server does that.
      if (!token) throw new ApiError('Please sign in again to continue.', 0, 'NO_SESSION_TOKEN');
      return apiFetch(path, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
    };
    try {
      return await call();
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      if (await refreshSession()) return call();
      await logoutRef.current();
      throw new ApiError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED');
    }
  }, [refreshSession]);

  /** Replaces the cached profile and plan with what the server says. */
  const refreshProfile = useCallback(async (): Promise<boolean> => {
    const data = await authedFetch('/auth/me');
    const current = await getStoredUser();
    const profile: UserProfile = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      createdAt: current?.createdAt ?? new Date().toISOString(),
      subscription: calculateSubscriptionState(data.user.subscription),
    };
    await storeUser(profile);
    setUser(profile);
    return true;
  }, [authedFetch]);

  /** Opens a server-created Cashfree order. Requires a signed-in (server) account. */
  const beginPayment = useCallback(async (phone: string): Promise<CheckoutSession> => {
    return startCheckout(authedFetch, phone);
  }, [authedFetch]);

  /** Asks the server whether the order is paid; refreshes the plan when it is. */
  const checkPayment = useCallback(async (orderId: string): Promise<PaymentOutcome> => {
    const outcome = await verifyPaymentApi(authedFetch, orderId);
    if (outcome === 'paid') await refreshProfile().catch(() => {});
    return outcome;
  }, [authedFetch, refreshProfile]);

  // On launch, replace the cached plan with the server's (reinstall, another device, a payment
  // confirmed by webhook). Offline, the cached copy is shown until the server can be reached.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (isLoading || !user || syncedRef.current || user.email.toLowerCase() === DEMO_EMAIL) return;
    syncedRef.current = true;
    refreshProfile().catch(() => { /* offline: keep cached copy; expired sessions already signed out */ });
  }, [isLoading, user, refreshProfile]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return {
    user,
    subscription,
    isLoading,
    authError,
    login,
    signup,
    checkEmail,
    requestOtp,
    verifyOtp,
    setPassword,
    requestPasswordReset,
    signInWithGoogle,
    verifyLink,
    logout,
    refreshProfile,
    beginPayment,
    checkPayment,
    pendingPasswordEmail,
    /** The on-device demo profile: no server account, so it cannot pay or sync. */
    isDemo: !!user && user.email.toLowerCase() === DEMO_EMAIL,
    clearAuthError,
    refreshSession,
  };
}

