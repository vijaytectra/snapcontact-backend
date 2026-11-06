import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import { useColors } from '@/hooks/useColors';
import { Button, F, IconButton, tap, useInsets } from './ui';
import {
  CASHFREE_PAYMENT_METHODS,
  normalizeIndianMobile,
  waitForPayment,
  type CheckoutSession,
  type PaymentOutcome,
} from '@/lib/cashfree';

type Phase =
  | { kind: 'form' }
  | { kind: 'working'; label: string }
  | { kind: 'result'; outcome: PaymentOutcome; orderId: string };

/**
 * Pays for the annual plan through Cashfree's hosted checkout. The server creates the order and
 * prices it; after checkout the server confirms with Cashfree before anything is activated.
 */
export function CashfreeModal({
  visible,
  onClose,
  customerEmail,
  canPay,
  price,
  beginPayment,
  checkPayment,
}: {
  visible: boolean;
  onClose: () => void;
  customerEmail?: string;
  /** False for the on-device demo account, which has no server account to pay for. */
  canPay: boolean;
  price: number;
  beginPayment: (phone: string) => Promise<CheckoutSession>;
  checkPayment: (orderId: string) => Promise<PaymentOutcome>;
}) {
  const c = useColors();
  const i = useInsets();
  const [phone, setPhone] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) { setPhase({ kind: 'form' }); setError(null); }
  }, [visible]);

  const verify = async (orderId: string) => {
    setPhase({ kind: 'working', label: 'Confirming your payment with Cashfree…' });
    try {
      const outcome = await waitForPayment(() => checkPayment(orderId));
      setPhase({ kind: 'result', outcome, orderId });
    } catch (e: any) {
      setError(e?.message || 'Could not confirm the payment. Check again in a moment.');
      setPhase({ kind: 'result', outcome: 'pending', orderId });
    }
  };

  const handlePay = async () => {
    tap('medium');
    setError(null);
    const mobile = normalizeIndianMobile(phone);
    if (!mobile) { setError('Enter a valid 10-digit Indian mobile number.'); return; }
    setPhase({ kind: 'working', label: 'Creating your secure order…' });
    let session: CheckoutSession;
    try {
      session = await beginPayment(mobile);
    } catch (e: any) {
      setError(e?.message || 'Could not start the payment. Please try again.');
      setPhase({ kind: 'form' });
      return;
    }
    setPhase({ kind: 'working', label: 'Complete the payment in Cashfree…' });
    try {
      // Cashfree's page returns to snapcontact://payment when checkout ends; the browser
      // result itself is never treated as proof of payment.
      await WebBrowser.openAuthSessionAsync(session.checkoutUrl, 'snapcontact://payment');
    } catch {
      /* closed or failed to open: still ask the server, the payment may have gone through */
    }
    await verify(session.orderId);
  };

  const result = phase.kind === 'result' ? phase : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: Math.max(i.top, 44) + 12 }} testID="cashfree-modal">
        <View style={{ flex: 1, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View style={{ gap: 2, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 22, color: c.foreground, letterSpacing: -0.5 }}>
                  Cashfree Payments
                </Text>
                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontFamily: F.b, fontSize: 10, color: '#FFFFFF', letterSpacing: 0.5 }}>SECURE CHECKOUT</Text>
                </View>
              </View>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                Card and UPI details are entered on Cashfree, not in SnapContact.
              </Text>
            </View>
            <IconButton icon="close" label="Close" onPress={onClose} testID="cashfree-close" size={38} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: Math.max(i.bottom, 16) + 32, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!canPay ? (
              <Notice c={c} icon="information-circle-outline" title="Sign in to upgrade"
                text="The demo account lives only on this device. Sign in with your email to buy Annual Pro, so your plan is saved to your account and works on any phone." />
            ) : result ? (
              <Animated.View entering={FadeIn.duration(300)} style={{ gap: 18, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: result.outcome === 'paid' ? '#FFFFFF' : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                  <Ionicons
                    name={result.outcome === 'paid' ? 'checkmark-sharp' : result.outcome === 'pending' ? 'time-outline' : 'close'}
                    size={34}
                    color={result.outcome === 'paid' ? '#080809' : '#FFFFFF'}
                  />
                </View>
                <View style={{ gap: 6, alignItems: 'center' }}>
                  <Text testID="cashfree-result-title" style={{ fontFamily: F.b, fontSize: 24, color: c.foreground, textAlign: 'center' }}>
                    {result.outcome === 'paid' ? 'Annual Pro is active'
                      : result.outcome === 'pending' ? 'Payment not confirmed yet'
                      : result.outcome === 'cancelled' ? 'Payment cancelled' : 'Payment failed'}
                  </Text>
                  <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground, textAlign: 'center' }}>
                    {result.outcome === 'paid' ? 'Cashfree confirmed your payment. Your plan is saved to your account.'
                      : result.outcome === 'pending' ? 'If you completed the payment, it can take a minute to confirm. You will not be charged twice.'
                      : result.outcome === 'cancelled' ? 'No money was taken. You can try again whenever you like.'
                      : 'The payment did not go through. No plan was activated; try again or use another method.'}
                  </Text>
                  <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>Order {result.orderId}</Text>
                </View>
                {error ? <Text style={{ fontFamily: F.r, fontSize: 13, color: '#FCA5A5', textAlign: 'center' }}>{error}</Text> : null}
                {result.outcome === 'paid' ? (
                  <Button label="Done" onPress={() => { tap(); onClose(); }} testID="cashfree-done" />
                ) : result.outcome === 'pending' ? (
                  <Button label="Check again" icon="refresh" onPress={() => { setError(null); void verify(result.orderId); }} testID="cashfree-check-again" />
                ) : (
                  <Button label="Try again" onPress={() => { setError(null); setPhase({ kind: 'form' }); }} testID="cashfree-retry" />
                )}
              </Animated.View>
            ) : (
              <>
                <View style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, gap: 6 }}>
                  <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground }}>Annual Pro · 1 year</Text>
                  <Text style={{ fontFamily: F.b, fontSize: 28, color: c.foreground }}>₹{price}</Text>
                  <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                    One-time payment for 12 months. It does not renew or charge you again automatically.
                  </Text>
                  {customerEmail ? <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>Account: {customerEmail}</Text> : null}
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: F.s, fontSize: 13, color: c.foreground }}>Mobile number for the receipt</Text>
                  <TextInput
                    testID="cashfree-phone"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="98765 43210"
                    placeholderTextColor={c.mutedForeground}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    maxLength={16}
                    style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 12, color: c.foreground, fontFamily: F.r, fontSize: 16 }}
                  />
                  <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>Cashfree requires a mobile number for every payment.</Text>
                </View>

                <View style={{ gap: 8 }}>
                  {CASHFREE_PAYMENT_METHODS.map((m) => (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={m.icon as any} size={18} color={c.mutedForeground} />
                      <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{m.title} · {m.subtitle}</Text>
                    </View>
                  ))}
                </View>

                {error ? <Text testID="cashfree-error" style={{ fontFamily: F.r, fontSize: 13, color: '#FCA5A5' }}>{error}</Text> : null}
                <Button
                  label={phase.kind === 'working' ? phase.label : `Pay ₹${price} with Cashfree`}
                  loading={phase.kind === 'working'}
                  disabled={phase.kind === 'working'}
                  onPress={handlePay}
                  testID="cashfree-pay"
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Notice({ c, icon, title, text }: { c: ReturnType<typeof useColors>; icon: any; title: string; text: string }) {
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={20} color={c.foreground} />
        <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground }}>{title}</Text>
      </View>
      <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{text}</Text>
    </View>
  );
}
