/**
 * The server is the only source of truth for plans and access. The app shows what
 * describeSubscription returns and never decides prices or activation itself.
 */

export const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PlanId = 'annual';
export type Plan = { id: PlanId; name: string; amount: number; currency: 'INR'; durationDays: number };

// Prices live here, never in a request. Changing a price is a server deploy.
export const PLANS: Record<PlanId, Plan> = {
  annual: { id: 'annual', name: 'Annual Pro', amount: 99, currency: 'INR', durationDays: 365 },
};

export function getPlan(id: unknown): Plan | null {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PLANS, id) ? PLANS[id as PlanId] : null;
}

/** What is stored in users.subscription (jsonb). */
export type StoredSubscription = {
  status?: 'trial' | 'annual' | 'expired';
  trialStartDate?: string;
  trialEndDate?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cashfreeOrderId?: string | null;
  cashfreePaymentId?: string | null;
};

/** What the app receives. Field names match the app's SubscriptionInfo. */
export type SubscriptionView = {
  status: 'trial' | 'annual' | 'expired';
  planName: string;
  price: number;
  currency: 'INR';
  trialStartDate: string;
  trialEndDate: string;
  trialDaysRemaining: number;
  isTrialActive: boolean;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  autoRenewal: false;
  cashfreeOrderId?: string;
  cashfreePaymentId?: string;
};

export function newTrial(now: number): StoredSubscription {
  return { status: 'trial', trialStartDate: new Date(now).toISOString(), trialEndDate: new Date(now + TRIAL_DAYS * DAY_MS).toISOString() };
}

const validDate = (s: unknown) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/** Works out access from stored dates. Accounts from before trials were stored start at sign-up. */
export function describeSubscription(raw: unknown, createdAt: string, now: number): SubscriptionView {
  const sub = (raw && typeof raw === 'object' ? raw : {}) as StoredSubscription;
  const trialStart = validDate(sub.trialStartDate) ? Date.parse(sub.trialStartDate!) : (validDate(createdAt) ? Date.parse(createdAt) : now);
  const trialEnd = validDate(sub.trialEndDate) ? Date.parse(sub.trialEndDate!) : trialStart + TRIAL_DAYS * DAY_MS;
  const trialLeft = trialEnd - now;
  const paidUntil = sub.status === 'annual' && validDate(sub.currentPeriodEnd) ? Date.parse(sub.currentPeriodEnd!) : 0;
  const status: SubscriptionView['status'] = paidUntil > now ? 'annual' : trialLeft > 0 && sub.status !== 'annual' ? 'trial' : 'expired';
  return {
    status,
    planName: PLANS.annual.name,
    price: PLANS.annual.amount,
    currency: 'INR',
    trialStartDate: new Date(trialStart).toISOString(),
    trialEndDate: new Date(trialEnd).toISOString(),
    trialDaysRemaining: Math.max(0, Math.ceil(trialLeft / DAY_MS)),
    isTrialActive: status === 'trial',
    ...(paidUntil ? { currentPeriodStart: sub.currentPeriodStart, currentPeriodEnd: sub.currentPeriodEnd } : {}),
    autoRenewal: false,
    ...(sub.cashfreeOrderId ? { cashfreeOrderId: sub.cashfreeOrderId } : {}),
    ...(sub.cashfreePaymentId ? { cashfreePaymentId: sub.cashfreePaymentId } : {}),
  };
}

/** The subscription after a verified payment. A renewal before expiry adds to the remaining time. */
export function activatePlan(raw: unknown, plan: Plan, orderId: string, paymentId: string, now: number): StoredSubscription {
  const sub = (raw && typeof raw === 'object' ? raw : {}) as StoredSubscription;
  const currentEnd = sub.status === 'annual' && validDate(sub.currentPeriodEnd) ? Date.parse(sub.currentPeriodEnd!) : 0;
  const start = Math.max(now, currentEnd);
  return {
    ...sub,
    status: 'annual',
    currentPeriodStart: new Date(currentEnd > now ? Date.parse(sub.currentPeriodStart ?? new Date(now).toISOString()) : now).toISOString(),
    currentPeriodEnd: new Date(start + plan.durationDays * DAY_MS).toISOString(),
    cashfreeOrderId: orderId,
    cashfreePaymentId: paymentId,
  };
}
