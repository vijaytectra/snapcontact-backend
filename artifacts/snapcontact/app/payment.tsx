import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button, F, useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/hooks/useAuth';
import { waitForPayment, type PaymentOutcome } from '@/lib/cashfree';
import { savePendingPayment, clearPendingPayment } from '@/lib/pendingPayment';

type Status = 'checking' | PaymentOutcome | 'error' | 'signed-out';

/**
 * Cashfree sends the customer back to snapcontact://payment?order_id=... once checkout ends.
 * This screen asks the server whether the order is paid. Only the server can activate Pro.
 */
export default function PaymentReturnScreen() {
  const c = useColors();
  const i = useInsets();
  const { order_id } = useLocalSearchParams<{ order_id?: string }>();
  const orderId = typeof order_id === 'string' ? order_id : '';
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string | null>(null);

  const { checkPayment } = auth;
  const check = useCallback(async () => {
    if (!orderId) {
      setStatus('error');
      setMessage('This link has no payment reference. If money was taken, open the subscription screen in SnapContact to check it.');
      return;
    }
    setStatus('checking');
    setMessage(null);
    try {
      const outcome = await waitForPayment(() => checkPayment(orderId));
      setStatus(outcome);
      // Pending stays saved so the check runs again on the next sign-in or launch.
      if (outcome !== 'pending') await clearPendingPayment();
    } catch (e: any) {
      setStatus('error');
      setMessage(e?.message || 'Could not confirm the payment. Check again in a moment.');
    }
  }, [orderId, checkPayment]);

  // Runs once per order and account. Waits for the stored session to load first, so a
  // signed-in user is not mistaken for a signed-out one on a cold start.
  const startedRef = useRef<string | null>(null);
  useEffect(() => {
    if (auth.isLoading) return;
    const key = `${orderId}|${userId ?? ''}`;
    if (startedRef.current === key) return;
    startedRef.current = key;
    if (!orderId) {
      void check();
      return;
    }
    if (!userId) {
      // Not signed in: keep the order and the home screen checks it after sign-in.
      setStatus('signed-out');
      void savePendingPayment({ orderId, userId: null });
      return;
    }
    void savePendingPayment({ orderId, userId });
    void check();
  }, [auth.isLoading, orderId, userId, check]);

  const heading =
    status === 'checking' ? 'Checking your payment…'
    : status === 'paid' ? 'Payment done'
    : status === 'pending' ? 'Payment is still processing'
    : status === 'cancelled' ? 'Payment cancelled'
    : status === 'failed' ? 'Payment not completed'
    : status === 'signed-out' ? 'Sign in to confirm your payment'
    : 'Could not check the payment';

  const body =
    status === 'checking' ? 'Confirming with Cashfree. This takes a few seconds.'
    : status === 'paid' ? 'Annual Pro is now active on your account.'
    : status === 'pending' ? 'Cashfree has not confirmed the payment yet. Tap "Check again" in a moment. If money was taken, SnapContact keeps checking the next time you open the app while signed in.'
    : status === 'cancelled' ? 'The payment was cancelled. You can start it again from the subscription screen.'
    : status === 'failed' ? 'Cashfree did not complete the payment. You can try again from the subscription screen.'
    : status === 'signed-out' ? 'Sign in to SnapContact. Your payment is checked automatically after you sign in.'
    : message ?? '';

  const finished = status === 'paid' || status === 'cancelled' || status === 'failed' || status === 'signed-out';
  const canRetry = status === 'pending' || status === 'error';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: Math.max(i.top, 24) + 24, paddingBottom: Math.max(i.bottom, 16) + 24, gap: 16 }}
        testID="payment-return"
      >
        <View style={{ gap: 12, alignItems: 'center' }}>
          <Text accessibilityRole="header" testID="payment-return-heading" style={{ fontFamily: F.b, fontSize: 24, color: c.foreground, textAlign: 'center' }}>
            {heading}
          </Text>
          <Text testID="payment-return-body" style={{ fontFamily: F.r, fontSize: 15, color: c.mutedForeground, textAlign: 'center', lineHeight: 22 }}>
            {body}
          </Text>
        </View>

        {finished ? (
          <Button label="Back to SnapContact" onPress={() => router.replace('/')} testID="payment-return-home" />
        ) : null}
        {canRetry ? (
          <Button label="Check again" onPress={() => { void check(); }} testID="payment-return-retry" />
        ) : null}
        {canRetry ? (
          <Button label="Back to SnapContact" onPress={() => router.replace('/')} testID="payment-return-home-alt" />
        ) : null}
      </ScrollView>
    </>
  );
}
