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
import { apiFetch } from '@/lib/api';
import { CashfreePaymentResult } from '@/lib/cashfree';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [guestSubscription, setGuestSubscription] = useState<SubscriptionInfo>(() =>
    createDefaultTrialSubscription()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const busyRef = useRef(false);

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

  const requestOtp = useCallback(async (email: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setAuthError('Please enter a valid email address.');
      return false;
    }
    try {
      await apiFetch('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: cleanEmail }) });
      return true;
    } catch (e: any) {
      setAuthError(e?.message || 'Failed to send code');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, []);

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

  const verifyOtp = useCallback(async (email: string, otp: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setAuthError(null);
    const cleanEmail = email.trim();
    try {
      const data = await apiFetch('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: cleanEmail, otp }) });
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
      setAuthError(e?.message || 'Invalid code');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, []);

  const login = useCallback(
    async (email: string, _password?: string): Promise<boolean> => {
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

      // Try backend auth first
      try {
        const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: cleanEmail, password: _password || '' }) });
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
      } catch {
        // fallback to local profile (offline)
      }

      const now = new Date().toISOString();
      const existing = await getStoredUser();

      const profile: UserProfile = {
        id: existing?.email.toLowerCase() === cleanEmail.toLowerCase() ? existing.id : `usr_${Date.now()}`,
        email: cleanEmail,
        name: cleanEmail.split('@')[0],
        createdAt: existing?.email.toLowerCase() === cleanEmail.toLowerCase() ? existing.createdAt : now,
        subscription: existing?.email.toLowerCase() === cleanEmail.toLowerCase()
          ? calculateSubscriptionState(existing.subscription, existing.createdAt)
          : createDefaultTrialSubscription(),
      };

      await storeUser(profile);
      setUser(profile);
      busyRef.current = false;
      return true;
    },
    []
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
    requestOtp,
    verifyOtp,
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

