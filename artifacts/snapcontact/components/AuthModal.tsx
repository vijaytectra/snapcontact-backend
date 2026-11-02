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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { Button, F, IconButton, PressScale, tap, useInsets } from './ui';
import { UserProfile } from '@/lib/auth';

export function AuthModal({
  visible,
  onClose,
  user,
  onLogin,
  onSignup,
  onLogout,
  error,
  onClearError,
  onOpenSubscription,
}: {
  visible: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onLogin: (email: string, password?: string) => Promise<boolean>;
  onSignup: (email: string, password?: string, name?: string) => Promise<boolean>;
  onLogout: () => Promise<void>;
  error: string | null;
  onClearError: () => void;
  onOpenSubscription?: () => void;
}) {
  const c = useColors();
  const i = useInsets();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    tap('medium');
    setLoading(true);
    let ok = false;
    if (mode === 'signin') {
      ok = await onLogin(email, password);
    } else {
      ok = await onSignup(email, password, name);
    }
    setLoading(false);
    if (ok) {
      setEmail('');
      setPassword('');
      setName('');
      onClose();
    }
  };

  const handleQuickDemo = async () => {
    tap('medium');
    setLoading(true);
    const demoEmail = 'alex.traveler@example.com';
    const ok = await onLogin(demoEmail, 'demo1234');
    setLoading(false);
    if (ok) {
      onClose();
    }
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
        testID="auth-modal"
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
                {user ? 'Account' : mode === 'signin' ? 'Sign in with Email' : 'Create Account'}
              </Text>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                {user
                  ? 'Manage your session and Cashfree subscription'
                  : 'Start your 7-day free trial on all devices'}
              </Text>
            </View>
            <IconButton
              icon="close"
              label="Close"
              onPress={onClose}
              testID="auth-close"
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
            {user ? (
              /* Signed In Profile View */
              <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 16 }}>
                {/* Profile Card */}
                <View
                  style={{
                    backgroundColor: c.card,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: 20,
                    gap: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 16,
                        backgroundColor: c.secondary,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="person" size={24} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ fontFamily: F.b, fontSize: 18, color: c.foreground }}>
                        {user.name || user.email.split('@')[0]}
                      </Text>
                      <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground }}>
                        {user.email}
                      </Text>
                    </View>
                  </View>

                  {/* Subscription Pill */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: c.secondary,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: c.border,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name={user.subscription.status === 'annual' ? 'star' : 'timer-outline'}
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={{ fontFamily: F.m, fontSize: 13, color: c.foreground }}>
                        {user.subscription.status === 'annual'
                          ? 'Annual Pro (Active)'
                          : `7-Day Free Trial (${user.subscription.trialDaysRemaining}d left)`}
                      </Text>
                    </View>
                    {onOpenSubscription ? (
                      <Pressable
                        onPress={() => {
                          onClose();
                          onOpenSubscription();
                        }}
                      >
                        <Text style={{ fontFamily: F.b, fontSize: 12, color: '#FFFFFF', textDecorationLine: 'underline' }}>
                          Manage
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={{ gap: 4, paddingTop: 4 }}>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: '#71717A' }}>
                      Member since: {new Date(user.createdAt).toLocaleDateString()}
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: '#71717A' }}>
                      Auto-renewal notice: 15 days before 1-year mark
                    </Text>
                  </View>
                </View>

                {/* Sign Out Button */}
                <Button
                  testID="auth-logout-btn"
                  label="Sign Out"
                  icon="log-out-outline"
                  variant="secondary"
                  onPress={async () => {
                    await onLogout();
                    onClose();
                  }}
                />
              </Animated.View>
            ) : (
              /* Not Signed In: Login / Register Form */
              <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
                {/* 1-Week Trial Highlight Banner */}
                <View
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="sparkles" size={18} color="#080809" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.b, fontSize: 14, color: '#FFFFFF' }}>
                      1st Week Free Trial Included
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: '#A1A1AA', lineHeight: 17 }}>
                      7 days zero-cost access. Auto-renewal at ₹99/year with notice 15 days prior.
                    </Text>
                  </View>
                </View>

                {/* Mode Tabs */}
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: c.card,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: 4,
                  }}
                >
                  <PressScale
                    testID="auth-tab-signin"
                    onPress={() => {
                      tap();
                      setMode('signin');
                      onClearError();
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: mode === 'signin' ? '#FFFFFF' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: F.b,
                        fontSize: 14,
                        color: mode === 'signin' ? '#080809' : '#A1A1AA',
                      }}
                    >
                      Sign In
                    </Text>
                  </PressScale>
                  <PressScale
                    testID="auth-tab-signup"
                    onPress={() => {
                      tap();
                      setMode('signup');
                      onClearError();
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: mode === 'signup' ? '#FFFFFF' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: F.b,
                        fontSize: 14,
                        color: mode === 'signup' ? '#080809' : '#A1A1AA',
                      }}
                    >
                      Create Account
                    </Text>
                  </PressScale>
                </View>

                {/* Error Banner */}
                {error ? (
                  <View
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      borderWidth: 1,
                      borderColor: 'rgba(239, 68, 68, 0.28)',
                      borderRadius: 14,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Ionicons name="alert-circle" size={18} color="#EF4444" />
                    <Text style={{ flex: 1, fontFamily: F.m, fontSize: 13, color: '#EF4444' }}>
                      {error}
                    </Text>
                  </View>
                ) : null}

                {/* Name Input (Sign Up Only) */}
                {mode === 'signup' ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                      Your Name
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: c.secondary,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: c.border,
                        paddingHorizontal: 14,
                        minHeight: 50,
                      }}
                    >
                      <Ionicons name="person-outline" size={18} color="#71717A" />
                      <TextInput
                        testID="auth-name-input"
                        placeholder="e.g. Alex Traveler"
                        placeholderTextColor="#71717A"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        style={{
                          flex: 1,
                          marginLeft: 10,
                          fontFamily: F.r,
                          fontSize: 15,
                          color: c.foreground,
                          minHeight: 46,
                        }}
                      />
                    </View>
                  </View>
                ) : null}

                {/* Email Input */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                    Email Address
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: c.secondary,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: c.border,
                      paddingHorizontal: 14,
                      minHeight: 50,
                    }}
                  >
                    <Ionicons name="mail-outline" size={18} color="#71717A" />
                    <TextInput
                      testID="auth-email-input"
                      placeholder="name@example.com"
                      placeholderTextColor="#71717A"
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (error) onClearError();
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{
                        flex: 1,
                        marginLeft: 10,
                        fontFamily: F.r,
                        fontSize: 15,
                        color: c.foreground,
                        minHeight: 46,
                      }}
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
                    Password
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: c.secondary,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: c.border,
                      paddingHorizontal: 14,
                      minHeight: 50,
                    }}
                  >
                    <Ionicons name="lock-closed-outline" size={18} color="#71717A" />
                    <TextInput
                      testID="auth-password-input"
                      placeholder="••••••••"
                      placeholderTextColor="#71717A"
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        if (error) onClearError();
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      style={{
                        flex: 1,
                        marginLeft: 10,
                        fontFamily: F.r,
                        fontSize: 15,
                        color: c.foreground,
                        minHeight: 46,
                      }}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={10}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="#71717A"
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Submit Action */}
                <View style={{ marginTop: 8, gap: 12 }}>
                  <Button
                    testID="auth-submit-btn"
                    label={mode === 'signin' ? 'Sign In with Email' : 'Start 7-Day Free Trial'}
                    icon={mode === 'signin' ? 'log-in-outline' : 'sparkles'}
                    variant="primary"
                    loading={loading}
                    onPress={handleSubmit}
                  />

                  {/* Fast Demo One-Tap Login */}
                  <PressScale
                    testID="auth-demo-btn"
                    onPress={handleQuickDemo}
                    style={{
                      minHeight: 46,
                      borderRadius: 14,
                      backgroundColor: c.card,
                      borderWidth: 1,
                      borderColor: c.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="flash-outline" size={16} color="#FFFFFF" />
                    <Text style={{ fontFamily: F.m, fontSize: 13, color: c.foreground }}>
                      One-Tap Demo Login (alex.traveler@example.com)
                    </Text>
                  </PressScale>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

