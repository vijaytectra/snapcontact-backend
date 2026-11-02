import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { F, PressScale, tap, useInsets } from './ui';

export function TrialAuthScreen({
  onSuccess,
  onSkip,
  onBack,
  onLogin,
  error,
  isExpired,
}: {
  onSuccess: (email: string) => void;
  onSkip?: () => void;
  onBack?: () => void;
  onLogin: (email: string, password?: string) => Promise<boolean>;
  error?: string | null;
  isExpired?: boolean;
}) {
  const i = useInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    tap('medium');
    setLocalError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setLocalError('Please enter your email address.');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    const ok = await onLogin(cleanEmail, password);
    setLoading(false);
    if (ok) {
      onSuccess(cleanEmail);
    }
  };

  const handleDemo = async () => {
    tap('light');
    setEmail('traveler@example.com');
    setPassword('secret123');
    setLoading(true);
    const ok = await onLogin('traveler@example.com', 'secret123');
    setLoading(false);
    if (ok) {
      onSuccess('traveler@example.com');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#091838' }} testID="trial-auth-screen">
      <LinearGradient
        colors={['#1F4A89', '#143368', '#0D2249', '#091838']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: Math.max(i.top, 44) + 12,
              paddingBottom: Math.max(i.bottom, 20) + 24,
              paddingHorizontal: 24,
              justifyContent: 'space-between',
              maxWidth: 480,
              width: '100%',
              alignSelf: 'center',
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: 20 }}>
              {/* Top Navigation Row: Back Button & Logo */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {onBack ? (
                  <PressScale
                    testID="trial-auth-back"
                    accessibilityRole="button"
                    accessibilityLabel="Back to Get Started"
                    onPress={() => {
                      tap();
                      onBack();
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                  </PressScale>
                ) : (
                  <View style={{ width: 40 }} />
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="scan-outline" size={20} color="#080809" />
                  </View>
                  <Text style={{ fontFamily: F.b, fontSize: 20, color: '#FFFFFF' }}>
                    SnapContact
                  </Text>
                </View>

                <View style={{ width: 40 }} />
              </View>

              {/* Headline & Subtitle */}
              <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 6, marginTop: 4 }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    fontFamily: F.b,
                    fontSize: 30,
                    lineHeight: 36,
                    color: '#FFFFFF',
                    letterSpacing: -0.8,
                  }}
                >
                  Sign in with Email
                </Text>
                <Text
                  style={{
                    fontFamily: F.s,
                    fontSize: 16,
                    color: '#38BDF8',
                    lineHeight: 22,
                  }}
                >
                  Start your 7-day free trial on all devices
                </Text>
              </Animated.View>

              {/* 7-Day Free Trial Feature Highlights */}
              <Animated.View
                entering={FadeInDown.delay(100).duration(400)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.16)',
                  padding: 16,
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="sparkles" size={17} color="#080809" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.b, fontSize: 14, color: '#FFFFFF' }}>
                      1st Week Free Trial · Unlimited Access
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: '#CBD5E1' }}>
                      ₹0 due today · Cancel anytime before trial ends
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    height: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    marginVertical: 2,
                  }}
                />

                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#38BDF8" />
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#E2E8F0' }}>
                      Auto-renewal notice sent 15 days before 1 year
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#38BDF8" />
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#E2E8F0' }}>
                      Secure Cashfree payments integration
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#38BDF8" />
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: '#E2E8F0' }}>
                      Works 100% on-device · Private by design
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Error Banner */}
              {localError || error ? (
                <View
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#EF4444',
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  <Text style={{ fontFamily: F.m, fontSize: 13, color: '#FCA5A5', flex: 1 }}>
                    {localError || error}
                  </Text>
                </View>
              ) : null}

              {/* Email & Password Input Fields */}
              <Animated.View entering={FadeInDown.delay(180).duration(400)} style={{ gap: 14 }}>
                {/* Email Field */}
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: F.b,
                      fontSize: 11,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: '#CBD5E1',
                    }}
                  >
                    Email Address
                  </Text>
                  <TextInput
                    testID="trial-auth-email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#64748B"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      height: 50,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      paddingHorizontal: 16,
                      fontFamily: F.r,
                      fontSize: 15,
                      color: '#FFFFFF',
                    }}
                  />
                </View>

                {/* Password Field */}
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: F.b,
                      fontSize: 11,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: '#CBD5E1',
                    }}
                  >
                    Password
                  </Text>
                  <View
                    style={{
                      height: 50,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <TextInput
                      testID="trial-auth-password"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter password"
                      placeholderTextColor="#64748B"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      style={{
                        flex: 1,
                        fontFamily: F.r,
                        fontSize: 15,
                        color: '#FFFFFF',
                        height: '100%',
                      }}
                    />
                    <PressScale
                      onPress={() => setShowPassword(!showPassword)}
                      accessibilityRole="button"
                      accessibilityLabel="Toggle password visibility"
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="#CBD5E1"
                      />
                    </PressScale>
                  </View>
                </View>

                {/* Quick 1-Tap Demo Fill */}
                <PressScale
                  testID="trial-demo-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Fill demo credentials"
                  onPress={handleDemo}
                  style={{ alignSelf: 'flex-start', paddingTop: 2 }}
                >
                  <Text style={{ fontFamily: F.m, fontSize: 12, color: '#38BDF8' }}>
                    ⚡ Fill Demo Credentials
                  </Text>
                </PressScale>
              </Animated.View>
            </View>

            {/* Bottom Actions */}
            <View style={{ gap: 14, marginTop: 24 }}>
              {/* Primary CTA: Start 7-Day Free Trial */}
              <PressScale
                testID="trial-auth-submit"
                accessibilityRole="button"
                accessibilityLabel="Start 7-Day Free Trial"
                disabled={loading}
                onPress={handleSubmit}
                style={{
                  backgroundColor: '#FFFFFF',
                  height: 52,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text style={{ fontFamily: F.b, fontSize: 16, color: '#080809' }}>
                  {loading ? 'Starting Trial...' : 'Start 7-Day Free Trial'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#080809" />
              </PressScale>

              {/* Skip Option during 7-day trial period */}
              {!isExpired && onSkip ? (
                <PressScale
                  testID="trial-auth-skip"
                  accessibilityRole="button"
                  accessibilityLabel="Skip for now"
                  onPress={() => {
                    tap();
                    onSkip();
                  }}
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ fontFamily: F.m, fontSize: 13, color: '#94A3B8' }}>
                    Skip for now · Continue with 7-day guest trial →
                  </Text>
                </PressScale>
              ) : isExpired ? (
                <View
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: F.m, fontSize: 12, color: '#F87171', textAlign: 'center' }}>
                    ⚠️ Your 7-day trial period has expired. Sign in or subscription is mandatory to continue.
                  </Text>
                </View>
              ) : null}

              {/* Bottom Home Indicator */}
              <View
                style={{
                  width: 112,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#FFFFFF',
                  opacity: 0.6,
                  alignSelf: 'center',
                  marginTop: 8,
                }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}
