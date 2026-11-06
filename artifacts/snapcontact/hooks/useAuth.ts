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
import { CashfreePaymentResult } from '@/lib/cashfree';

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
      subscription: data.user.subscription || createDefaultTrialSubscription(),
    };
    // SecureStore is unavailable on web; the profile alone keeps the user signed in there.
    await SecureStore.setItemAsync('snapcontact.token.v1', data.token).catch(() => {});
    if (data.refreshToken) await SecureStore.setItemAsync('snapcontact.refresh.v1', data.refreshToken).catch(() => {});
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

  const verifyLink = useCallback(async (email: string, token: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setAuthError(null);
    try {
      const data = await apiFetch(`/auth/verify-link?email=${encodeURIComponent(email)}&token=${token}`);
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
      return true;
    } catch (e: any) {
      setAuthError(e?.message || 'Invalid link');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, []);

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
    await storeUser(null);
    // SecureStore is unavailable on web; a failed token delete must not leave the user signed in.
    await SecureStore.deleteItemAsync('snapcontact.token.v1').catch(() => {});
    await SecureStore.deleteItemAsync('snapcontact.refresh.v1').catch(() => {});
    setUser(null);
    setGuestSubscription(createDefaultTrialSubscription());
  }, []);

  const activateAnnualSubscription = useCallback(
    async (paymentResult: CashfreePaymentResult): Promise<void> => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const renewalNotice = new Date(periodEnd.getTime() - 15 * 24 * 60 * 60 * 1000);

      const updatedSub: SubscriptionInfo = {
        status: 'annual',
        planName: 'Annual Pro Membership',
        price: 99,
        currency: 'INR',
        trialStartDate: subscription.trialStartDate,
        trialEndDate: subscription.trialEndDate,
        trialDaysRemaining: 0,
        isTrialActive: false,
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        autoRenewal: true,
        renewalNoticeDate: renewalNotice.toISOString(),
        daysUntilRenewalNotice: Math.max(0, Math.ceil((renewalNotice.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
        cashfreePaymentId: paymentResult.paymentId,
        cashfreeOrderId: paymentResult.orderId,
        cashfreePaymentMethod: `${paymentResult.paymentMethod} (${paymentResult.paymentDetails})`,
      };

      if (user) {
        const updatedUser: UserProfile = {
          ...user,
          subscription: updatedSub,
        };
        await storeUser(updatedUser);
        setUser(updatedUser);
      } else {
        setGuestSubscription(updatedSub);
      }
    },
    [user, subscription]
  );

  const toggleAutoRenewal = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (user) {
        const updatedUser: UserProfile = {
          ...user,
          subscription: {
            ...user.subscription,
            autoRenewal: enabled,
          },
        };
        await storeUser(updatedUser);
        setUser(updatedUser);
      } else {
        setGuestSubscription((prev) => ({
          ...prev,
          autoRenewal: enabled,
        }));
      }
    },
    [user]
  );

  const simulateExpiredTrial = useCallback(async (): Promise<void> => {
    const pastDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const expiredSub = calculateSubscriptionState({
      status: 'expired',
      trialStartDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      trialEndDate: pastDate,
      isTrialActive: false,
    });
    if (user) {
      const updatedUser: UserProfile = { ...user, subscription: expiredSub };
      await storeUser(updatedUser);
      setUser(updatedUser);
    } else {
      setGuestSubscription(expiredSub);
    }
  }, [user]);

  const resetTrial = useCallback(async (): Promise<void> => {
    const freshSub = createDefaultTrialSubscription();
    if (user) {
      const updatedUser: UserProfile = { ...user, subscription: freshSub };
      await storeUser(updatedUser);
      setUser(updatedUser);
    } else {
      setGuestSubscription(freshSub);
    }
  }, [user]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const rt = await SecureStore.getItemAsync('snapcontact.refresh.v1');
      if (!rt) return false;
      const data = await apiFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: rt }) });
      await SecureStore.setItemAsync('snapcontact.token.v1', data.token);
      if (data.refreshToken) await SecureStore.setItemAsync('snapcontact.refresh.v1', data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }, []);

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
    activateAnnualSubscription,
    toggleAutoRenewal,
    simulateExpiredTrial,
    resetTrial,
    clearAuthError,
    refreshSession,
  };
}

