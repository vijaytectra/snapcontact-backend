import AsyncStorage from '@react-native-async-storage/async-storage';

export type SubscriptionTier = 'trial' | 'annual' | 'expired';

export type SubscriptionInfo = {
  status: SubscriptionTier;
  planName: string;
  price: number; // 999 INR
  currency: string; // 'INR'
  trialStartDate: string; // ISO
  trialEndDate: string; // ISO (7 days from start)
  trialDaysRemaining: number;
  isTrialActive: boolean;
  currentPeriodStart: string; // ISO
  currentPeriodEnd: string; // ISO (1 year from activation)
  autoRenewal: boolean;
  renewalNoticeDate: string; // ISO (15 days before currentPeriodEnd)
  daysUntilRenewalNotice: number;
  cashfreePaymentId?: string;
  cashfreeOrderId?: string;
  cashfreePaymentMethod?: string;
};

export type UserProfile = {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  subscription: SubscriptionInfo;
};

const AUTH_STORAGE_KEY = 'snapcontact.auth.v1';
const TRIAL_DURATION_DAYS = 7;
const ANNUAL_DURATION_DAYS = 365;
const AUTO_RENEWAL_NOTICE_DAYS = 15; // Auto renewal notice & processing 15 days before 1 year

/**
 * Calculates current subscription & trial timeline values based on stored dates.
 */
export function calculateSubscriptionState(
  rawSub?: Partial<SubscriptionInfo>,
  accountCreatedAt?: string
): SubscriptionInfo {
  const now = new Date();
  const createdDate = accountCreatedAt ? new Date(accountCreatedAt) : now;

  const trialStart = rawSub?.trialStartDate
    ? new Date(rawSub.trialStartDate)
    : createdDate;
  
  const trialEnd = rawSub?.trialEndDate
    ? new Date(rawSub.trialEndDate)
    : new Date(trialStart.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const msRemainingInTrial = trialEnd.getTime() - now.getTime();
  const trialDaysRemaining = Math.max(0, Math.ceil(msRemainingInTrial / (1000 * 60 * 60 * 24)));
  const isTrialActive = msRemainingInTrial > 0;

  // Period start and end for annual plan
  const periodStart = rawSub?.currentPeriodStart
    ? new Date(rawSub.currentPeriodStart)
    : trialStart;

  const periodEnd = rawSub?.currentPeriodEnd
    ? new Date(rawSub.currentPeriodEnd)
    : new Date(periodStart.getTime() + (TRIAL_DURATION_DAYS + ANNUAL_DURATION_DAYS) * 24 * 60 * 60 * 1000);

  // Auto renewal is notified/processed 15 days before the 1 year cycle completes
  const renewalNoticeDate = new Date(
    periodEnd.getTime() - AUTO_RENEWAL_NOTICE_DAYS * 24 * 60 * 60 * 1000
  );

  const msUntilRenewalNotice = renewalNoticeDate.getTime() - now.getTime();
  const daysUntilRenewalNotice = Math.max(0, Math.ceil(msUntilRenewalNotice / (1000 * 60 * 60 * 24)));

  let status: SubscriptionTier = 'trial';
  if (rawSub?.status === 'annual') {
    status = now <= periodEnd ? 'annual' : 'expired';
  } else if (isTrialActive) {
    status = 'trial';
  } else {
    status = 'expired';
  }

  return {
    status,
    planName: 'Annual Pro (7-Day Trial Included)',
    price: 999,
    currency: 'INR',
    trialStartDate: trialStart.toISOString(),
    trialEndDate: trialEnd.toISOString(),
    trialDaysRemaining,
    isTrialActive,
    currentPeriodStart: periodStart.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    autoRenewal: rawSub?.autoRenewal ?? true,
    renewalNoticeDate: renewalNoticeDate.toISOString(),
    daysUntilRenewalNotice,
    cashfreePaymentId: rawSub?.cashfreePaymentId,
    cashfreeOrderId: rawSub?.cashfreeOrderId,
    cashfreePaymentMethod: rawSub?.cashfreePaymentMethod,
  };
}

/**
 * Creates a default trial subscription for a new account.
 */
export function createDefaultTrialSubscription(): SubscriptionInfo {
  return calculateSubscriptionState();
}

/**
 * Validates email format.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Storage helpers for auth state.
 */
export async function getStoredUser(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    // Recompute dynamic subscription fields against current time
    parsed.subscription = calculateSubscriptionState(parsed.subscription, parsed.createdAt);
    return parsed;
  } catch {
    return null;
  }
}

export async function storeUser(user: UserProfile | null): Promise<void> {
  try {
    if (user) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {}
}

