import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A Cashfree order the customer came back from but that is not confirmed yet.
 * Kept on the device so the check still runs after sign-in or a restart.
 * `userId` is null when the return happened while signed out.
 */
export type PendingPayment = { orderId: string; userId: string | null };

const KEY = 'snapcontact.pendingPayment';

export async function savePendingPayment(pending: PendingPayment): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    /* storage unavailable: the on-screen check still runs */
  }
}

export async function loadPendingPayment(): Promise<PendingPayment | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.orderId !== 'string' || !parsed.orderId) return null;
    return { orderId: parsed.orderId, userId: typeof parsed.userId === 'string' ? parsed.userId : null };
  } catch {
    return null;
  }
}

export async function clearPendingPayment(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
