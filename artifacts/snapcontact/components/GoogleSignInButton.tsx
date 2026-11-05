import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { PressScale, tap } from './ui';

// Closes the Google popup and hands the result back to the app on web.
WebBrowser.maybeCompleteAuthSession();

// OAuth client IDs from Google Cloud Console (APIs & Services > Credentials).
// They are public identifiers, not secrets. The server must list the same IDs in GOOGLE_CLIENT_IDS.
const CLIENT_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
};

// The Google provider throws if this platform's client ID is missing, so only mount it when set.
const platformClientId =
  Platform.OS === 'ios' ? CLIENT_IDS.iosClientId : Platform.OS === 'android' ? CLIENT_IDS.androidClientId : CLIENT_IDS.webClientId;

type Props = {
  onIdToken: (idToken: string) => Promise<boolean>;
  onError: (message: string) => void;
  disabled?: boolean;
};

export function GoogleSignInButton(props: Props) {
  if (!platformClientId) {
    return (
      <GoogleButtonView
        label="Continue with Google"
        onPress={() => props.onError('Google sign-in is not set up yet. Use your email for now.')}
        disabled={props.disabled}
      />
    );
  }
  return <ConfiguredGoogleButton {...props} />;
}

function ConfiguredGoogleButton({ onIdToken, onError, disabled }: Props) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    ...CLIENT_IDS,
    selectAccount: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token || response.authentication?.idToken;
      if (!idToken) {
        setBusy(false);
        onError('Google did not return a sign-in token. Please try again.');
        return;
      }
      onIdToken(idToken).finally(() => setBusy(false));
    } else {
      setBusy(false);
      if (response.type === 'error') onError(response.error?.message || 'Google sign-in failed. Please try again.');
      // 'cancel' / 'dismiss': the user closed the sheet, nothing to report.
    }
  }, [response]);

  return (
    <GoogleButtonView
      label={busy ? 'Signing in…' : 'Continue with Google'}
      loading={busy}
      disabled={disabled || busy || !request}
      onPress={() => {
        setBusy(true);
        promptAsync().catch(() => {
          setBusy(false);
          onError('Could not open Google sign-in. Please try again.');
        });
      }}
    />
  );
}

function GoogleButtonView({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <PressScale
      testID="google-sign-in"
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      disabled={disabled}
      onPress={() => {
        tap('medium');
        onPress();
      }}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: disabled && !loading ? 0.6 : 1,
      }}
    >
      {loading ? <ActivityIndicator color="#1F1F1F" /> : <GoogleG />}
      <Text style={{ color: '#1F1F1F', fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </PressScale>
  );
}

// Google's four-colour "G" mark.
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}
