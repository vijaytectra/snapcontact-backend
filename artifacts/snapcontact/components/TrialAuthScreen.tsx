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
  onRequestOtp,
  onVerifyOtp,
  error,
  isExpired,
}: {
  onSuccess: (email: string) => void;
  onSkip?: () => void;
  onBack?: () => void;
  onLogin: (email: string, password?: string) => Promise<boolean>;
  onRequestOtp?: (email: string) => Promise<boolean>;
  onVerifyOtp?: (email: string, otp: string) => Promise<boolean>;
  error?: string | null;
  isExpired?: boolean;
}) {
  const i = useInsets();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendCode = async () => {
    tap('medium');
    setLocalError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    const ok = onRequestOtp ? await onRequestOtp(cleanEmail) : true;
    setLoading(false);
    if (ok) {
      setSent(true);
      setStep('otp');
    } else {
      setLocalError(error || 'Failed to send code.');
    }
  };

  const handleVerify = async () => {
    tap('medium');
    setLocalError(null);
    if (!otp.trim() || otp.trim().length < 4) {
      setLocalError('Please enter the code from your email.');
      return;
    }
    setLoading(true);
    const ok = onVerifyOtp ? await onVerifyOtp(email.trim(), otp.trim()) : await onLogin(email.trim());
    setLoading(false);
    if (ok) onSuccess(email.trim());
  };

  const handleDemo = async () => {
    tap('light');
    setEmail('traveler@example.com');
    setLoading(true);
    const ok = await onLogin('traveler@example.com');
    setLoading(false);
    if (ok) onSuccess('traveler@example.com');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#091838' }} testID="trial-auth-screen">
      <LinearGradient colors={['#1F4A89', '#143368', '#0D2249', '#091838']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(i.top, 44) + 12, paddingBottom: Math.max(i.bottom, 20) + 24, paddingHorizontal: 24, justifyContent: 'space-between', maxWidth: 480, width: '100%', alignSelf: 'center' }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {onBack ? (
                  <PressScale testID="trial-auth-back" accessibilityRole="button" accessibilityLabel="Back" onPress={() => { tap(); onBack(); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                  </PressScale>
                ) : <View style={{ width: 40 }} />}
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#FFFFFF' }}>
                  {isExpired ? 'Session expired' : 'Sign in with email'}
                </Text>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>
                  {step === 'email' ? 'We’ll send a verification code to your email.' : `Enter the code sent to ${email}`}
                </Text>
              </View>

              {(localError || error) && (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
                  <Text style={{ color: '#FCA5A5', fontSize: 14 }}>{localError || error}</Text>
                </View>
              )}

              {step === 'email' ? (
                <View style={{ gap: 12 }}>
                  <TextInput
                    testID="trial-auth-email"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 14, color: '#FFFFFF', fontSize: 16 }}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <PressScale testID="trial-auth-submit" onPress={handleSendCode} disabled={loading} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#091838', fontSize: 16, fontWeight: '600' }}>{loading ? 'Sending…' : 'Send code'}</Text>
                  </PressScale>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <TextInput
                    testID="trial-auth-otp"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 14, color: '#FFFFFF', fontSize: 20, letterSpacing: 8, textAlign: 'center' }}
                    placeholder="000000"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <PressScale testID="trial-auth-verify" onPress={handleVerify} disabled={loading} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#091838', fontSize: 16, fontWeight: '600' }}>{loading ? 'Verifying…' : 'Verify'}</Text>
                  </PressScale>
                  <PressScale onPress={() => { setStep('email'); setOtp(''); }} style={{ paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Change email</Text>
                  </PressScale>
                </View>
              )}

              <PressScale onPress={handleDemo} style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Try demo account</Text>
              </PressScale>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}
