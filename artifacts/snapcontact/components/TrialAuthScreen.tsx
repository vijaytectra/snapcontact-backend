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
import { PressScale, tap, useInsets } from './ui';
import { GoogleSignInButton } from './GoogleSignInButton';

/**
 * Sign in / sign up, modelled on Google's flow:
 *   email  -> Next -> account exists?  yes -> code sent -> otp -> signed in
 *                                      no  -> "No account found" -> create account (name) -> code -> otp
 * Plus "Continue with Google", which signs in or creates the account in one step.
 * Sign-in is passwordless: the code is emailed (and a magic link alongside it).
 */
type Step = 'email' | 'no-account' | 'signup' | 'otp';
type Mode = 'signin' | 'signup';

export function TrialAuthScreen({
  onSuccess,
  onBack,
  onLogin,
  onCheckEmail,
  onRequestOtp,
  onVerifyOtp,
  onGoogleIdToken,
  error,
  isExpired,
}: {
  onSuccess: (email: string) => void;
  onSkip?: () => void;
  onBack?: () => void;
  onLogin: (email: string, password?: string) => Promise<boolean>;
  onCheckEmail: (email: string) => Promise<boolean | null>;
  onRequestOtp: (email: string, mode?: Mode) => Promise<boolean>;
  onVerifyOtp: (email: string, otp: string, name?: string) => Promise<boolean>;
  onGoogleIdToken: (idToken: string) => Promise<boolean>;
  error?: string | null;
  isExpired?: boolean;
}) {
  const i = useInsets();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [mode, setMode] = useState<Mode>('signin');
  const [localError, setLocalError] = useState<string | null>(null);
  // Server errors arrive through `error`; only show them after the call that caused them.
  const [showServerError, setShowServerError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const shownError = localError || (showServerError ? error : null);
  const cleanEmail = email.trim();

  const resetMessages = () => {
    setLocalError(null);
    setShowServerError(false);
    setNotice(null);
  };

  const goTo = (next: Step) => {
    resetMessages();
    setStep(next);
  };

  const validEmail = () => {
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setLocalError('Enter a valid email address.');
      return false;
    }
    return true;
  };

  const sendCode = async (m: Mode) => {
    setLoading(true);
    const ok = await onRequestOtp(cleanEmail, m);
    setLoading(false);
    if (!ok) {
      setShowServerError(true);
      return false;
    }
    setMode(m);
    setOtp('');
    setStep('otp');
    return true;
  };

  // Step 1: Next. Decide between sign in and "no account found".
  const handleNext = async () => {
    tap('medium');
    resetMessages();
    if (!validEmail()) return;
    setLoading(true);
    const exists = await onCheckEmail(cleanEmail);
    setLoading(false);
    if (exists === null) {
      setShowServerError(true);
      return;
    }
    if (exists) await sendCode('signin');
    else goTo('no-account');
  };

  // Create account: name + email, then a code to prove the email is theirs.
  const handleCreate = async () => {
    tap('medium');
    resetMessages();
    if (!name.trim()) {
      setLocalError('Enter your name.');
      return;
    }
    if (!validEmail()) return;
    setLoading(true);
    const exists = await onCheckEmail(cleanEmail);
    setLoading(false);
    if (exists === null) {
      setShowServerError(true);
      return;
    }
    if (exists) {
      // Already registered: sign them in instead of failing.
      if (await sendCode('signin')) setNotice('You already have an account, so we sent you a sign-in code.');
      return;
    }
    await sendCode('signup');
  };

  const handleVerify = async () => {
    tap('medium');
    resetMessages();
    if (otp.trim().length < 6) {
      setLocalError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    const ok = await onVerifyOtp(cleanEmail, otp.trim(), mode === 'signup' ? name.trim() : undefined);
    setLoading(false);
    if (ok) onSuccess(cleanEmail);
    else setShowServerError(true);
  };

  const handleResend = async () => {
    tap();
    resetMessages();
    setLoading(true);
    const ok = await onRequestOtp(cleanEmail, mode);
    setLoading(false);
    if (ok) setNotice(`New code sent to ${cleanEmail}.`);
    else setShowServerError(true);
  };

  const handleGoogle = async (idToken: string) => {
    resetMessages();
    const ok = await onGoogleIdToken(idToken);
    if (ok) onSuccess('');
    else setShowServerError(true);
    return ok;
  };

  const handleDemo = async () => {
    tap('light');
    setLoading(true);
    const ok = await onLogin('traveler@example.com');
    setLoading(false);
    if (ok) onSuccess('traveler@example.com');
  };

  const handleBack = () => {
    tap();
    if (step === 'email') onBack?.();
    else if (step === 'otp') goTo(mode === 'signup' ? 'signup' : 'email');
    else goTo('email');
  };

  const title =
    step === 'email' ? (isExpired ? 'Session expired' : 'Sign in')
    : step === 'no-account' ? 'No account found'
    : step === 'signup' ? 'Create your account'
    : 'Verify it’s you';

  const subtitle =
    step === 'email' ? 'to continue to SnapContact'
    : step === 'no-account' ? `There’s no SnapContact account for ${cleanEmail}.`
    : step === 'signup' ? 'Start your free 7-day trial'
    : `Enter the 6-digit code we sent to ${cleanEmail}`;

  const canGoBack = step !== 'email' || !!onBack;

  return (
    <View style={{ flex: 1, backgroundColor: '#091838' }} testID="trial-auth-screen">
      <LinearGradient colors={['#1F4A89', '#143368', '#0D2249', '#091838']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(i.top, 44) + 12, paddingBottom: Math.max(i.bottom, 20) + 24, paddingHorizontal: 24, justifyContent: 'space-between', maxWidth: 480, width: '100%', alignSelf: 'center' }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {canGoBack ? (
                  <PressScale testID="trial-auth-back" accessibilityRole="button" accessibilityLabel="Back" onPress={handleBack} style={iconButton}>
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                  </PressScale>
                ) : <View style={{ width: 40, height: 40 }} />}
              </View>

              <View style={{ gap: 8 }}>
                <Text testID="trial-auth-title" style={{ fontSize: 28, fontWeight: '700', color: '#FFFFFF' }}>{title}</Text>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>{subtitle}</Text>
              </View>

              {shownError ? (
                <View testID="trial-auth-error" style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
                  <Text style={{ color: '#FCA5A5', fontSize: 14 }}>{shownError}</Text>
                </View>
              ) : null}
              {notice ? (
                <View style={{ backgroundColor: 'rgba(52,168,83,0.15)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(52,168,83,0.35)' }}>
                  <Text style={{ color: '#A7F3D0', fontSize: 14 }}>{notice}</Text>
                </View>
              ) : null}

              {step === 'email' && (
                <View style={{ gap: 12 }}>
                  <GoogleSignInButton
                    disabled={loading}
                    onIdToken={handleGoogle}
                    onError={(m) => { resetMessages(); setLocalError(m); }}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
                    <View style={divider} />
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>or</Text>
                    <View style={divider} />
                  </View>
                  <TextInput
                    testID="trial-auth-email"
                    style={input}
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={email}
                    onChangeText={setEmail}
                    onSubmitEditing={handleNext}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                  <PrimaryButton testID="trial-auth-next" label={loading ? 'Checking…' : 'Next'} onPress={handleNext} disabled={loading} />
                  <PressScale testID="trial-auth-create" onPress={() => { tap(); goTo('signup'); }} style={{ paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#8AB4F8', fontSize: 15, fontWeight: '600' }}>Create account</Text>
                  </PressScale>
                </View>
              )}

              {step === 'no-account' && (
                <View style={{ gap: 12 }}>
                  <PrimaryButton testID="trial-auth-go-signup" label="Create account" onPress={() => { tap('medium'); goTo('signup'); }} />
                  <PressScale testID="trial-auth-other-email" onPress={() => { tap(); setEmail(''); goTo('email'); }} style={{ paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#8AB4F8', fontSize: 15, fontWeight: '600' }}>Try another email</Text>
                  </PressScale>
                </View>
              )}

              {step === 'signup' && (
                <View style={{ gap: 12 }}>
                  <TextInput
                    testID="trial-auth-name"
                    style={input}
                    placeholder="Full name"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={name}
                    onChangeText={setName}
                    autoComplete="name"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                  <TextInput
                    testID="trial-auth-signup-email"
                    style={input}
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={email}
                    onChangeText={setEmail}
                    onSubmitEditing={handleCreate}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                  />
                  <PrimaryButton testID="trial-auth-signup-submit" label={loading ? 'Sending code…' : 'Create account'} onPress={handleCreate} disabled={loading} />
                  <PressScale onPress={() => { tap(); goTo('email'); }} style={{ paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#8AB4F8', fontSize: 15, fontWeight: '600' }}>Sign in instead</Text>
                  </PressScale>
                </View>
              )}

              {step === 'otp' && (
                <View style={{ gap: 12 }}>
                  <TextInput
                    testID="trial-auth-otp"
                    style={[input, { fontSize: 20, letterSpacing: 8, textAlign: 'center' }]}
                    placeholder="000000"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/\D/g, ''))}
                    onSubmitEditing={handleVerify}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={6}
                  />
                  <PrimaryButton testID="trial-auth-verify" label={loading ? 'Verifying…' : mode === 'signup' ? 'Verify & create account' : 'Verify & sign in'} onPress={handleVerify} disabled={loading} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <PressScale onPress={() => { tap(); setOtp(''); goTo(mode === 'signup' ? 'signup' : 'email'); }} style={{ paddingVertical: 8 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Change email</Text>
                    </PressScale>
                    <PressScale testID="trial-auth-resend" onPress={handleResend} disabled={loading} style={{ paddingVertical: 8 }}>
                      <Text style={{ color: '#8AB4F8', fontSize: 14, fontWeight: '600' }}>Resend code</Text>
                    </PressScale>
                  </View>
                </View>
              )}

              {step === 'email' && (
                <PressScale onPress={handleDemo} style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Try demo account</Text>
                </PressScale>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, testID }: { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <PressScale testID={testID} accessibilityRole="button" onPress={onPress} disabled={disabled} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: disabled ? 0.7 : 1 }}>
      <Text style={{ color: '#091838', fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </PressScale>
  );
}

const input = { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 14, color: '#FFFFFF', fontSize: 16 } as const;
const divider = { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' } as const;
const iconButton = { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' } as const;
