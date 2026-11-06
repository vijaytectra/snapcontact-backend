import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { warmUpServer } from '@/lib/api';

/**
 * Email sign-in:
 *   email -> Next -> has a password? yes -> password -> signed in            (no code)
 *                                    no  -> code -> create password -> signed in (first time)
 *   password -> "Forgot password?" -> code -> new password -> signed in
 * "Create account" asks for a name first and then follows the code path. Screens never say
 * whether an email is registered. "Continue with Google" signs in or creates the account.
 */
type Step = 'email' | 'password' | 'signup' | 'otp' | 'create-password';
type Mode = 'signin' | 'signup' | 'reset';
const MIN_PASSWORD = 8;

export function TrialAuthScreen({
  onSuccess,
  onBack,
  onLogin,
  onCheckEmail,
  onRequestOtp,
  onRequestPasswordReset,
  onVerifyOtp,
  onSetPassword,
  pendingPasswordEmail,
  onGoogleIdToken,
  error,
  isExpired,
}: {
  onSuccess: (email: string) => void;
  onSkip?: () => void;
  onBack?: () => void;
  onLogin: (email: string, password?: string) => Promise<boolean>;
  onCheckEmail: (email: string) => Promise<'password' | 'otp' | null>;
  onRequestOtp: (email: string) => Promise<boolean>;
  onRequestPasswordReset: (email: string) => Promise<boolean>;
  onVerifyOtp: (email: string, otp: string, name?: string, purpose?: 'signin' | 'reset') => Promise<'signed-in' | 'needs-password' | false>;
  onSetPassword: (password: string) => Promise<boolean>;
  /** Set after a first sign-in by emailed link: open straight on "Create a password". */
  pendingPasswordEmail?: string | null;
  onGoogleIdToken: (idToken: string) => Promise<boolean>;
  error?: string | null;
  isExpired?: boolean;
}) {
  const i = useInsets();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [mode, setMode] = useState<Mode>('signin');
  const [localError, setLocalError] = useState<string | null>(null);
  // Server errors arrive through `error`; only show them after the call that caused them.
  const [showServerError, setShowServerError] = useState(() => !!error); // e.g. an expired emailed link
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The server sleeps when idle on free hosting and can take up to a minute to wake.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => { warmUpServer(); }, []);

  useEffect(() => {
    if (!pendingPasswordEmail) return;
    setEmail(pendingPasswordEmail);
    setMode('signin');
    setPassword('');
    setConfirm('');
    setLocalError(null);
    setShowServerError(false);
    setNotice('Your email is verified. Create a password to finish signing in.');
    setStep('create-password');
  }, [pendingPasswordEmail]);

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
    const ok = m === 'reset' ? await onRequestPasswordReset(cleanEmail) : await onRequestOtp(cleanEmail);
    setLoading(false);
    if (!ok) {
      setShowServerError(true);
      return false;
    }
    setMode(m);
    setOtp('');
    setStep('otp');
    setNotice(m === 'reset' ? `If ${cleanEmail} has an account, we sent it a code.` : null);
    return true;
  };

  // Step 1: Next. Accounts with a password go to the password screen; everyone else gets a code.
  const handleNext = async () => {
    tap('medium');
    resetMessages();
    if (!validEmail()) return;
    setLoading(true);
    const method = await onCheckEmail(cleanEmail);
    setLoading(false);
    if (method === null) {
      setShowServerError(true);
      return;
    }
    if (method === 'password') {
      setPassword('');
      goTo('password');
    } else await sendCode('signin');
  };

  const handlePasswordLogin = async () => {
    tap('medium');
    resetMessages();
    if (!password) {
      setLocalError('Enter your password.');
      return;
    }
    setLoading(true);
    const ok = await onLogin(cleanEmail, password);
    setLoading(false);
    if (ok) onSuccess(cleanEmail);
    else setShowServerError(true);
  };

  const handleForgot = async () => {
    tap();
    resetMessages();
    if (!validEmail()) return;
    await sendCode('reset');
  };

  // Create account: name + email, then a code to prove the email is theirs. An existing
  // account is simply signed in by the code, so this never reveals whether the email is taken.
  const handleCreate = async () => {
    tap('medium');
    resetMessages();
    if (!name.trim()) {
      setLocalError('Enter your name.');
      return;
    }
    if (!validEmail()) return;
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
    const result = await onVerifyOtp(cleanEmail, otp.trim(), mode === 'signup' ? name.trim() : undefined, mode === 'reset' ? 'reset' : 'signin');
    setLoading(false);
    if (result === 'signed-in') onSuccess(cleanEmail);
    else if (result === 'needs-password') {
      setPassword('');
      setConfirm('');
      goTo('create-password');
    } else setShowServerError(true);
  };

  const handleSetPassword = async () => {
    tap('medium');
    resetMessages();
    if (password.length < MIN_PASSWORD) {
      setLocalError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setLocalError('The passwords don’t match.');
      return;
    }
    setLoading(true);
    const ok = await onSetPassword(password);
    setLoading(false);
    if (ok) onSuccess(cleanEmail);
    else setShowServerError(true);
  };

  const handleResend = async () => {
    tap();
    resetMessages();
    setLoading(true);
    const ok = mode === 'reset' ? await onRequestPasswordReset(cleanEmail) : await onRequestOtp(cleanEmail);
    setLoading(false);
    if (ok) setNotice(mode === 'reset' ? `If ${cleanEmail} has an account, we sent it a new code.` : `New code sent to ${cleanEmail}.`);
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
    else if (step === 'otp') goTo(mode === 'signup' ? 'signup' : mode === 'reset' ? 'password' : 'email');
    // The code was used up; going back starts over from the email.
    else goTo('email');
  };

  const title =
    step === 'email' ? (isExpired ? 'Session expired' : 'Sign in')
    : step === 'password' ? 'Welcome back'
    : step === 'signup' ? 'Create your account'
    : step === 'create-password' ? (mode === 'reset' ? 'Set a new password' : 'Create a password')
    : mode === 'reset' ? 'Reset your password'
    : 'Verify it’s you';

  const subtitle =
    step === 'email' ? 'to continue to SnapContact'
    : step === 'password' ? cleanEmail
    : step === 'signup' ? 'Start your free 7-day trial'
    : step === 'create-password' ? `You’ll use it to sign in as ${cleanEmail}, without a code.`
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
              {slow ? (
                <View testID="trial-auth-slow" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(138,180,248,0.12)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(138,180,248,0.3)' }}>
                  <ActivityIndicator color="#8AB4F8" />
                  <Text style={{ color: '#D2E3FC', fontSize: 14, flex: 1 }}>Waking up the server… the first sign-in can take up to a minute.</Text>
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

              {step === 'password' && (
                <View style={{ gap: 12 }}>
                  <PasswordInput
                    testID="trial-auth-password"
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={handlePasswordLogin}
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    autoComplete="current-password"
                  />
                  <PrimaryButton testID="trial-auth-signin" label={loading ? 'Signing in…' : 'Sign in'} onPress={handlePasswordLogin} disabled={loading} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <PressScale onPress={() => { tap(); goTo('email'); }} style={{ paddingVertical: 8 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Change email</Text>
                    </PressScale>
                    <PressScale testID="trial-auth-forgot" onPress={handleForgot} disabled={loading} style={{ paddingVertical: 8 }}>
                      <Text style={{ color: '#8AB4F8', fontSize: 14, fontWeight: '600' }}>Forgot password?</Text>
                    </PressScale>
                  </View>
                </View>
              )}

              {step === 'create-password' && (
                <View style={{ gap: 12 }}>
                  <PasswordInput
                    testID="trial-auth-new-password"
                    placeholder={`New password (at least ${MIN_PASSWORD} characters)`}
                    value={password}
                    onChangeText={setPassword}
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    autoComplete="new-password"
                  />
                  <PasswordInput
                    testID="trial-auth-confirm-password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChangeText={setConfirm}
                    onSubmitEditing={handleSetPassword}
                    visible={showPassword}
                    autoComplete="new-password"
                  />
                  <PrimaryButton testID="trial-auth-save-password" label={loading ? 'Saving…' : mode === 'reset' ? 'Save and sign in' : 'Create password'} onPress={handleSetPassword} disabled={loading} />
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
                  <PrimaryButton testID="trial-auth-verify" label={loading ? 'Verifying…' : mode === 'signup' ? 'Verify & create account' : mode === 'reset' ? 'Verify code' : 'Verify & sign in'} onPress={handleVerify} disabled={loading} />
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

function PasswordInput({ visible, onToggle, testID, ...props }: {
  testID?: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmitEditing?: () => void;
  visible: boolean;
  onToggle?: () => void;
  autoComplete: 'current-password' | 'new-password';
}) {
  return (
    <View>
      <TextInput
        testID={testID}
        style={[input, onToggle ? { paddingRight: 52 } : null]}
        placeholderTextColor="rgba(255,255,255,0.4)"
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={props.autoComplete === 'new-password' ? 'newPassword' : 'password'}
        maxLength={128}
        {...props}
      />
      {onToggle ? (
        <View style={{ position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center' }}>
          <PressScale accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={onToggle} style={{ padding: 10 }}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.7)" />
          </PressScale>
        </View>
      ) : null}
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
