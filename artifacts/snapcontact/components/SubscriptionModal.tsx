import React from 'react';
import {
  Modal,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { Button, F, IconButton, useInsets } from './ui';
import { SubscriptionInfo } from '@/lib/auth';

export function SubscriptionModal({
  visible,
  onClose,
  subscription,
  onOpenCashfree,
  userEmail,
}: {
  visible: boolean;
  onClose: () => void;
  subscription: SubscriptionInfo;
  onOpenCashfree: () => void;
  userEmail?: string;
}) {
  const c = useColors();
  const i = useInsets();

  // Shown as the server reported it; trial changes and resets happen only on the server.
  const isAnnual = subscription.status === 'annual';
  const isExpired = subscription.status === 'expired';
  const paidUntil = isAnnual && subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;


  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: c.background,
          paddingTop: Math.max(i.top, 44) + 12,
        }}
        testID="subscription-modal"
      >
        <View style={{ flex: 1, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 24,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <View style={{ gap: 2 }}>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: F.b,
                  fontSize: 24,
                  color: c.foreground,
                  letterSpacing: -0.5,
                }}
              >
                Your Plan
              </Text>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                7-day free trial · ₹99 for 1 year · Cashfree Payments
              </Text>
            </View>
            <IconButton
              icon="close"
              label="Close"
              onPress={onClose}
              testID="subscription-close"
              size={38}
            />
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 24,
              paddingBottom: Math.max(i.bottom, 16) + 32,
              gap: 18,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Current Status Card */}
            <Animated.View
              entering={FadeInDown.duration(350)}
              style={{
                backgroundColor: c.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: c.border,
                padding: 20,
                gap: 14,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ gap: 2 }}>
                  <Text style={{ fontFamily: F.b, fontSize: 18, color: c.foreground }}>
                    {isAnnual ? 'Annual Pro Plan' : isExpired ? 'Free trial ended' : '7-Day Free Trial'}
                  </Text>
                  <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                    {isAnnual
                      ? `Paid via Cashfree · Valid until ${paidUntil ?? 'the end of your year'}`
                      : isExpired
                        ? 'Upgrade to keep finding and saving numbers'
                        : `${subscription.trialDaysRemaining} days remaining in trial`}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: isAnnual ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: F.b,
                      fontSize: 11,
                      color: isAnnual ? '#080809' : '#FFFFFF',
                      letterSpacing: 0.5,
                    }}
                  >
                    {isAnnual ? 'ACTIVE' : isExpired ? 'ENDED' : 'TRIAL'}
                  </Text>
                </View>
              </View>

              {/* Price Details */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 8,
                  paddingVertical: 6,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                }}
              >
                <Text style={{ fontFamily: F.b, fontSize: 32, color: '#FFFFFF', letterSpacing: -1 }}>
                  ₹{subscription.price ?? 99}
                </Text>
                <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground }}>
                  for 1 year · one-time payment
                </Text>
              </View>

              {subscription.cashfreePaymentId ? (
                <View style={{ gap: 4, backgroundColor: c.secondary, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ fontFamily: F.s, fontSize: 12, color: c.foreground }}>Cashfree Reference</Text>
                  <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>Payment ID: {subscription.cashfreePaymentId}</Text>
                  {subscription.cashfreeOrderId ? (
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>Order: {subscription.cashfreeOrderId}</Text>
                  ) : null}
                </View>
              ) : null}
            </Animated.View>

            {/* 15-Day Auto-Renewal Schedule Timeline Card */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(350)}
              style={{
                backgroundColor: c.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: c.border,
                padding: 20,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: c.secondary,
                    borderWidth: 1,
                    borderColor: c.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontFamily: F.b, fontSize: 16, color: c.foreground }}>
                    How your plan works
                  </Text>
                  <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                    No automatic charges
                  </Text>
                </View>
              </View>

              <View style={{ gap: 14, paddingLeft: 4 }}>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: true ? '#FFFFFF' : c.secondary,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="checkmark" size={14} color={true ? '#080809' : '#FFFFFF'} />
                    </View>
                    <View style={{ width: 2, height: 36, backgroundColor: c.border, marginVertical: 2 }} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
                      Days 1–7 — Free trial
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                      Full access to reading, extraction and Quick Capture. No payment details needed.
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: isAnnual ? '#FFFFFF' : c.secondary,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="card-outline" size={14} color={isAnnual ? '#080809' : '#FFFFFF'} />
                    </View>
                    <View style={{ width: 2, height: 36, backgroundColor: c.border, marginVertical: 2 }} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
                      Upgrade any time — ₹99
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                      Pay once through Cashfree. Your plan starts when Cashfree confirms the payment.
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: false ? '#FFFFFF' : c.secondary,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="calendar-outline" size={14} color={false ? '#080809' : '#FFFFFF'} />
                    </View>
                    <View style={{ width: 2, height: 36, backgroundColor: c.border, marginVertical: 2 }} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
                      12 months of Annual Pro
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                      Your plan is saved to your account, so it works after reinstalling or on another phone.
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: false ? '#FFFFFF' : c.secondary,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="refresh" size={14} color={false ? '#080809' : '#FFFFFF'} />
                    </View>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
                      After 1 year
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                      The plan simply ends. Nothing renews or charges you automatically; you can pay again to continue.
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            <View style={{ gap: 12 }}>
              {!isAnnual ? (
                <Button
                  testID="open-cashfree-btn"
                  label={`Upgrade — Pay ₹${subscription.price ?? 99} with Cashfree`}
                  icon="shield-checkmark"
                  variant="primary"
                  onPress={() => {
                    onClose();
                    onOpenCashfree();
                  }}
                />
              ) : null}
              {userEmail ? (
                <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground, textAlign: 'center' }}>
                  Signed in as {userEmail}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
