import { useCallback, useEffect, useState } from 'react';
import {
  UserProfile,
  SubscriptionInfo,
  calculateSubscriptionState,
  createDefaultTrialSubscription,
  getStoredUser,
  isValidEmail,
  storeUser,
} from '@/lib/auth';
import { CashfreePaymentResult } from '@/lib/cashfree';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [guestSubscription, setGuestSubscription] = useState<SubscriptionInfo>(() =>
    createDefaultTrialSubscription()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const login = useCallback(
    async (email: string, _password?: string): Promise<boolean> => {
      setAuthError(null);
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        setAuthError('Please enter your email address.');
        return false;
      }
      if (!isValidEmail(cleanEmail)) {
        setAuthError('Please enter a valid email address.');
        return false;
      }

      // Existing or new login profile
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
      return true;
    },
    []
  );

  const signup = useCallback(
    async (email: string, _password?: string, name?: string): Promise<boolean> => {
      setAuthError(null);
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        setAuthError('Please enter your email address.');
        return false;
      }
      if (!isValidEmail(cleanEmail)) {
        setAuthError('Please enter a valid email address.');
        return false;
      }

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
      return true;
    },
    []
  );

  const logout = useCallback(async () => {
    await storeUser(null);
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
        price: 999,
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
    logout,
    activateAnnualSubscription,
    toggleAutoRenewal,
    clearAuthError,
  };
}

