import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { Button, F, IconButton, PressScale, tap, useInsets } from './ui';
import {
  CASHFREE_PAYMENT_METHODS,
  createCashfreeOrder,
  processCashfreePayment,
  CashfreePaymentResult,
} from '@/lib/cashfree';
import { detectCardBrand, cardBrandLabel } from '@/lib/cardBrand';

function luhnCheck(num: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function CashfreeModal({
  visible,
  onClose,
  customerEmail,
  onSuccess,
  onFailure,
}: {
  visible: boolean;
  onClose: () => void;
  customerEmail?: string;
  onSuccess: (result: CashfreePaymentResult) => void;
  onFailure?: (error: string) => void;
}) {
  const c = useColors();
  const i = useInsets();

  const [method, setMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'custom'>('gpay');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<CashfreePaymentResult | null>(null);

  const emailToUse = customerEmail?.trim() || 'customer@snapcontact.app';

  const handlePay = async () => {
    tap('medium');

    // Input validation
    if (method === 'card') {
      const cleanNum = cardNumber.replace(/\\s+/g, '');
      if (cleanNum.length < 13 || cleanNum.length > 19) {
        alert('Please enter a valid card number.');
        return;
      }
      if (!luhnCheck(cleanNum)) {
        alert('Invalid card number.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        alert('Enter expiry as MM/YY.');
        return;
      }
      const [mm, yy] = cardExpiry.split('/').map(Number);
      if (mm < 1 || mm > 12) {
        alert('Invalid expiry month.');
        return;
      }
      const now = new Date();
      const expDate = new Date(2000 + yy, mm - 1, 1);
      if (expDate < new Date(now.getFullYear(), now.getMonth(), 1)) {
        alert('Card has expired.');
        return;
      }
      if (cardCvv.length < 3 || cardCvv.length > 4) {
        alert('Enter a valid CVV.');
        return;
      }
    }
    if (method === 'upi' && selectedUpiApp === 'custom') {
      if (!upiId.trim() || !upiId.includes('@')) {
        alert('Enter a valid UPI ID (e.g. name@upi).');
        return;
      }
    }

    setProcessing(true);

    let order;
    try {
      order = await createCashfreeOrder({
        customerId: `cust_${Date.now()}`,
        customerEmail: emailToUse,
        customerName: emailToUse.split('@')[0],
        customerPhone: '9876543210',
      });
    } catch (e: any) {
      setProcessing(false);
      onFailure?.(e?.message || 'Unable to create payment order.');
      return;
    }

    let details = '';
    let methodType: 'UPI' | 'CARD' | 'NETBANKING' = 'UPI';

    if (method === 'upi') {
      methodType = 'UPI';
      details = selectedUpiApp === 'custom' ? (upiId.trim() || 'user@upi') : `${selectedUpiApp.toUpperCase()} AutoPay`;
    } else if (method === 'card') {
      methodType = 'CARD';
      const cleanNum = cardNumber.replace(/\s+/g, '');
      const last4 = cleanNum.slice(-4) || '4242';
      details = `Ending in •••• ${last4}`;
    } else {
      methodType = 'NETBANKING';
      details = selectedBank;
    }

    try {
      const result = await processCashfreePayment(order, methodType, details);
      setReceipt(result);
      onSuccess(result);
    } catch (e: any) {
      setProcessing(false);
      onFailure?.(e?.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleDone = () => {
    tap();
    setReceipt(null);
    onClose();
  };

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
        testID="cashfree-modal"
      >
        <View style={{ flex: 1, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          {/* Header with Cashfree Branding */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    fontFamily: F.b,
                    fontSize: 22,
                    color: c.foreground,
                    letterSpacing: -0.5,
                  }}
                >
                  Cashfree Payments
                </Text>
                <View
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontFamily: F.b, fontSize: 10, color: '#FFFFFF', letterSpacing: 0.5 }}>
                    SECURE PG
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                PCI-DSS Level 1 · 256-Bit SSL Encrypted
              </Text>
            </View>
            <IconButton
              icon="close"
              label="Close"
              onPress={onClose}
              testID="cashfree-close"
              size={38}
            />
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 24,
              paddingBottom: Math.max(i.bottom, 16) + 32,
              gap: 18,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {receipt ? (
              /* Payment Success Receipt View */
              <Animated.View entering={FadeIn.duration(300)} style={{ gap: 18, alignItems: 'center' }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 12,
                  }}
                >
                  <Ionicons name="checkmark-sharp" size={36} color="#080809" />
                </View>

                <View style={{ gap: 4, alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.b, fontSize: 24, color: c.foreground, textAlign: 'center' }}>
                    Payment Authorized!
                  </Text>
                  <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground, textAlign: 'center' }}>
                    1st week trial is now active.
                  </Text>
                </View>

                {/* Receipt Card */}
                <View
                  style={{
                    width: '100%',
                    backgroundColor: c.card,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: 20,
                    gap: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#71717A' }}>Plan</Text>
                    <Text style={{ fontFamily: F.s, fontSize: 13, color: c.foreground }}>SnapContact Annual Pro</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#71717A' }}>Today's Charge</Text>
                    <Text style={{ fontFamily: F.b, fontSize: 13, color: '#FFFFFF' }}>₹0.00 (7-Day Trial)</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#71717A' }}>Annual Price</Text>
                    <Text style={{ fontFamily: F.s, fontSize: 13, color: c.foreground }}>₹99 / year</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#71717A' }}>Auto-Renewal Notice</Text>
                    <Text style={{ fontFamily: F.s, fontSize: 13, color: c.foreground }}>15 Days in Advance</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#71717A' }}>Payment ID</Text>
                    <Text style={{ fontFamily: F.m, fontSize: 12, color: '#A1A1AA' }}>{receipt.paymentId}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#71717A' }}>Order ID</Text>
                    <Text style={{ fontFamily: F.m, fontSize: 12, color: '#A1A1AA' }}>{receipt.orderId}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#71717A' }}>Payment Gateway</Text>
                    <Text style={{ fontFamily: F.m, fontSize: 13, color: c.foreground }}>Cashfree Payments</Text>
                  </View>
                </View>

                <View style={{ width: '100%', marginTop: 8 }}>
                  <Button
                    testID="cashfree-done-btn"
                    label="Continue to App"
                    icon="arrow-forward"
                    variant="primary"
                    onPress={handleDone}
                  />
                </View>
              </Animated.View>
            ) : (
              /* Checkout Details Form */
              <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
                {/* Order Summary Card */}
                <View
                  style={{
                    backgroundColor: c.card,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: 20,
                    gap: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ gap: 2 }}>
                      <Text style={{ fontFamily: F.b, fontSize: 17, color: c.foreground }}>
                        SnapContact Pro Annual
                      </Text>
                      <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                        Billed to: {emailToUse}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={{ fontFamily: F.b, fontSize: 18, color: '#FFFFFF' }}>
                        ₹0.00
                      </Text>
                      <Text style={{ fontFamily: F.r, fontSize: 11, color: '#71717A', textDecorationLine: 'line-through' }}>
                        ₹99/yr
                      </Text>
                    </View>
                  </View>

                  {/* 15 Days Auto-Renewal Notice Callout */}
                  <View
                    style={{
                      backgroundColor: c.secondary,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: c.border,
                      padding: 14,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="notifications-outline" size={16} color="#FFFFFF" />
                      <Text style={{ fontFamily: F.s, fontSize: 13, color: c.foreground }}>
                        Auto-Renewal Policy (15 Days Prior)
                      </Text>
                    </View>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground, lineHeight: 18 }}>
                      Your first 7 days are completely free. The annual plan (₹99) activates after 7 days. Auto-renewal is notified and processed 15 days before the 1-year mark. You can cancel anytime before this window.
                    </Text>
                  </View>
                </View>

                {/* Cashfree Payment Methods Tab Group */}
                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                    Select Payment Method (Cashfree Gateway)
                  </Text>

                  <View style={{ gap: 8 }}>
                    {CASHFREE_PAYMENT_METHODS.map((m) => {
                      const active = method === m.id;
                      return (
                        <PressScale
                          key={m.id}
                          testID={`cashfree-method-${m.id}`}
                          onPress={() => {
                            tap();
                            setMethod(m.id);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            padding: 14,
                            borderRadius: 16,
                            backgroundColor: active ? c.card : c.secondary,
                            borderWidth: 1.5,
                            borderColor: active ? '#FFFFFF' : c.border,
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: active ? '#FFFFFF' : c.card,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons
                              name={m.icon as any}
                              size={18}
                              color={active ? '#080809' : '#FFFFFF'}
                            />
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
                              {m.title}
                            </Text>
                            <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                              {m.subtitle}
                            </Text>
                          </View>
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={18}
                            color={active ? '#FFFFFF' : '#71717A'}
                          />
                        </PressScale>
                      );
                    })}
                  </View>
                </View>

                {/* Dynamic Payment Method Fields */}
                {method === 'upi' ? (
                  <View style={{ gap: 12 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                      Fast UPI Apps
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {[
                        { id: 'gpay', name: 'Google Pay' },
                        { id: 'phonepe', name: 'PhonePe' },
                        { id: 'paytm', name: 'Paytm' },
                      ].map((app) => (
                        <PressScale
                          key={app.id}
                          onPress={() => {
                            tap();
                            setSelectedUpiApp(app.id as any);
                          }}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            borderRadius: 12,
                            backgroundColor: selectedUpiApp === app.id ? '#FFFFFF' : c.secondary,
                            borderWidth: 1,
                            borderColor: selectedUpiApp === app.id ? '#FFFFFF' : c.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: F.b,
                              fontSize: 12,
                              color: selectedUpiApp === app.id ? '#080809' : c.foreground,
                            }}
                          >
                            {app.name}
                          </Text>
                        </PressScale>
                      ))}
                    </View>

                    {/* Or Enter UPI ID */}
                    <View style={{ gap: 6, marginTop: 4 }}>
                      <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                        Or Enter UPI ID (VPA)
                      </Text>
                      <TextInput
                        testID="cashfree-upi-input"
                        placeholder="yourname@okaxis"
                        placeholderTextColor="#71717A"
                        value={upiId}
                        onChangeText={(t) => {
                          setUpiId(t);
                          setSelectedUpiApp('custom');
                        }}
                        autoCapitalize="none"
                        style={{
                          backgroundColor: c.secondary,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: c.border,
                          paddingHorizontal: 14,
                          minHeight: 48,
                          fontFamily: F.r,
                          fontSize: 15,
                          color: c.foreground,
                        }}
                      />
                      {cardNumber.replace(/\\s+/g, '').length >= 4 && (
                        <Text style={{ marginTop: 6, fontSize: 12, color: c.muted, fontFamily: F.m }}>
                          {cardBrandLabel(detectCardBrand(cardNumber))}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : method === 'card' ? (
                  <View style={{ gap: 12 }}>
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                        Card Number
                      </Text>
                      <TextInput
                        testID="cashfree-card-input"
                        placeholder="•••• •••• •••• ••••"
                        placeholderTextColor="#71717A"
                        value={cardNumber}
                        onChangeText={setCardNumber}
                        keyboardType="numeric"
                        maxLength={19}
                        style={{
                          backgroundColor: c.secondary,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: c.border,
                          paddingHorizontal: 14,
                          minHeight: 48,
                          fontFamily: F.r,
                          fontSize: 15,
                          color: c.foreground,
                        }}
                      />
                      {cardNumber.replace(/\\s+/g, '').length >= 4 && (
                        <Text style={{ marginTop: 6, fontSize: 12, color: c.muted, fontFamily: F.m }}>
                          {cardBrandLabel(detectCardBrand(cardNumber))}
                        </Text>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                          Expiry MM/YY
                        </Text>
                        <TextInput
                          placeholder="MM/YY"
                          placeholderTextColor="#71717A"
                          value={cardExpiry}
                          onChangeText={setCardExpiry}
                          keyboardType="numeric"
                          maxLength={5}
                          style={{
                            backgroundColor: c.secondary,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: c.border,
                            paddingHorizontal: 14,
                            minHeight: 48,
                            fontFamily: F.r,
                            fontSize: 15,
                            color: c.foreground,
                          }}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                          CVV
                        </Text>
                        <TextInput
                          placeholder="•••"
                          placeholderTextColor="#71717A"
                          value={cardCvv}
                          onChangeText={setCardCvv}
                          keyboardType="numeric"
                          secureTextEntry
                          maxLength={4}
                          style={{
                            backgroundColor: c.secondary,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: c.border,
                            paddingHorizontal: 14,
                            minHeight: 48,
                            fontFamily: F.r,
                            fontSize: 15,
                            color: c.foreground,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                      Popular Banks
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra'].map((b) => (
                        <PressScale
                          key={b}
                          onPress={() => {
                            tap();
                            setSelectedBank(b);
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 12,
                            backgroundColor: selectedBank === b ? '#FFFFFF' : c.secondary,
                            borderWidth: 1,
                            borderColor: selectedBank === b ? '#FFFFFF' : c.border,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: F.m,
                              fontSize: 13,
                              color: selectedBank === b ? '#080809' : c.foreground,
                            }}
                          >
                            {b}
                          </Text>
                        </PressScale>
                      ))}
                    </View>
                  </View>
                )}

                {/* Pay Button */}
                <View style={{ marginTop: 8 }}>
                  <Button
                    testID="cashfree-pay-btn"
                    label="Authorize via Cashfree (₹0 Today)"
                    icon="shield-checkmark"
                    variant="primary"
                    loading={processing}
                    onPress={handlePay}
                  />
                  <Text
                    style={{
                      fontFamily: F.r,
                      fontSize: 12,
                      color: '#71717A',
                      textAlign: 'center',
                      marginTop: 10,
                    }}
                  >
                    Powered by Cashfree Payments · Auto-Renewal notice 15 days before year ends
                  </Text>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

