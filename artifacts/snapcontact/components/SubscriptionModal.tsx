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
import { Button, F, IconButton, PressScale, tap, useInsets } from './ui';
import { SubscriptionInfo } from '@/lib/auth';

export function SubscriptionModal({
  visible,
  onClose,
  subscription,
  onOpenCashfree,
  onToggleAutoRenewal,
  userEmail,
  onSimulateExpired,
  onResetTrial,
}: {
  visible: boolean;
  onClose: () => void;
  subscription: SubscriptionInfo;
  onOpenCashfree: () => void;
  onToggleAutoRenewal: (enabled: boolean) => Promise<void>;
  userEmail?: string;
  onSimulateExpired?: () => void;
  onResetTrial?: () => void;
}) {
  const c = useColors();
  const i = useInsets();

  const isAnnual = subscription.status === 'annual';
  const isTrial = subscription.status === 'trial';

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
                Plan & Auto-Renewal
              </Text>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                1-Week Trial · 15-Day Renewal Notice · Cashfree Payments
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
                    {isAnnual ? 'Annual Pro Plan' : '1st Week Free Trial'}
                  </Text>
                  <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                    {isAnnual
                      ? `Active via Cashfree · Auto-renews annually`
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
                    {isAnnual ? 'ACTIVE' : 'TRIAL'}
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
                  ₹99
                </Text>
                <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground }}>
                  / year (₹0 for 1st week)
                </Text>
              </View>

              {subscription.cashfreePaymentId ? (
                <View style={{ gap: 4, backgroundColor: c.secondary, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ fontFamily: F.s, fontSize: 12, color: c.foreground }}>Cashfree Reference</Text>
                  <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>ID: {subscription.cashfreePaymentId}</Text>
                  {subscription.cashfreePaymentMethod ? (
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>Method: {subscription.cashfreePaymentMethod}</Text>
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
                    Auto-Renewal Schedule
                  </Text>
                  <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                    Notification 15 days before 1 year
                  </Text>
                </View>
              </View>

              {/* Timeline Steps */}
              <View style={{ gap: 14, paddingLeft: 4 }}>
                {/* Step 1 */}
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="checkmark" size={14} color="#080809" />
                    </View>
                    <View style={{ width: 2, height: 36, backgroundColor: c.border, marginVertical: 2 }} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
                      Day 0 — 1st Week Free Trial
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                      Zero charge today. Full access to OCR, extraction & Quick Capture.
                    </Text>
                  </View>
                </View>

                {/* Step 2 */}
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
                      <Text style={{ fontFamily: F.b, fontSize: 11, color: isAnnual ? '#080809' : '#FFFFFF' }}>2</Text>
                    </View>
                    <View style={{ width: 2, height: 36, backgroundColor: c.border, marginVertical: 2 }} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
                      Day 7 — Annual Billing Begins
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                      1-year period starts at ₹99/year.
                    </Text>
                  </View>
                </View>

                {/* Step 3 */}
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: c.secondary,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="notifications" size={12} color="#FFFFFF" />
                    </View>
                    <View style={{ width: 2, height: 36, backgroundColor: c.border, marginVertical: 2 }} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
                      Day 350 — Auto-Renewal Notice (15 Days Prior)
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                      Advance notification & renewal window before completion of 1 year.
                    </Text>
                  </View>
                </View>

                {/* Step 4 */}
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: c.secondary,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="repeat" size={12} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
                      Day 365 — Annual Renewal
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                      Next 1-year cycle begins seamlessly. Cancel anytime prior to this date.
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Auto-Renewal Setting & Cashfree Action */}
            <View style={{ gap: 12 }}>
              {/* Auto Renewal Toggle Box */}
              <View
                style={{
                  backgroundColor: c.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ gap: 3, flex: 1 }}>
                  <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground }}>
                    Auto-Renewal Status
                  </Text>
                  <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                    {subscription.autoRenewal
                      ? 'Enabled · Advance notice 15 days before year ends'
                      : 'Disabled · Manual renewal required'}
                  </Text>
                </View>

                <PressScale
                  testID="toggle-auto-renewal"
                  onPress={async () => {
                    tap('medium');
                    await onToggleAutoRenewal(!subscription.autoRenewal);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: subscription.autoRenewal ? '#FFFFFF' : c.secondary,
                    borderWidth: 1,
                    borderColor: subscription.autoRenewal ? '#FFFFFF' : c.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: F.b,
                      fontSize: 12,
                      color: subscription.autoRenewal ? '#080809' : c.foreground,
                    }}
                  >
                    {subscription.autoRenewal ? 'Enabled' : 'Disabled'}
                  </Text>
                </PressScale>
              </View>

              {/* Cashfree Action */}
              {!isAnnual ? (
                <Button
                  testID="open-cashfree-btn"
                  label="Authorize 1-Year Plan via Cashfree (₹0 Today)"
                  icon="shield-checkmark"
                  variant="primary"
                  onPress={() => {
                    onClose();
                    onOpenCashfree();
                  }}
                />
              ) : (
                <Button
                  label="Update Payment Method (Cashfree)"
                  icon="card-outline"
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    onOpenCashfree();
                  }}
                />
              )}

              {/* Developer / Testing: Simulate Expiration & Reset */}
              {onSimulateExpired && onResetTrial ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <PressScale
                    testID="simulate-expire-btn"
                    onPress={() => {
                      tap();
                      onSimulateExpired();
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: c.secondary,
                      borderWidth: 1,
                      borderColor: '#EF4444',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: F.m, fontSize: 11, color: '#EF4444' }}>
                      🧪 Test 7-Day Expired
                    </Text>
                  </PressScale>
                  <PressScale
                    testID="reset-trial-btn"
                    onPress={() => {
                      tap();
                      onResetTrial();
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: c.secondary,
                      borderWidth: 1,
                      borderColor: '#10B981',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: F.m, fontSize: 11, color: '#10B981' }}>
                      🔄 Reset 7-Day Trial
                    </Text>
                  </PressScale>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

