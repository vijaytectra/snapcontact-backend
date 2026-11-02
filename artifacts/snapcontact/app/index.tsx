import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useCapture } from '@/hooks/useCapture';
import { S } from '@/lib/strings';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Banner, Button, F, PressScale, Skeleton, tap, useInsets } from '@/components/ui';
import { Onboarding } from '@/components/Onboarding';
import { CountrySheet } from '@/components/CountrySheet';
import { SettingsModal } from '@/components/SettingsModal';
import { SaveSummary } from '@/components/SaveSummary';
import { CandidateCard } from '@/components/CandidateCard';
import { ContactsListView } from '@/components/ContactsListView';
import { AuthModal } from '@/components/AuthModal';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { CashfreeModal } from '@/components/CashfreeModal';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const cap = useCapture();
  const auth = useAuth();
  const i = useInsets();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(windowWidth - 40, 480);

  const [countryOpen, setCountryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [cashfreeOpen, setCashfreeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [dismissed, setDismissed] = useState<unknown>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [searchHistory, setSearchHistory] = useState<string[]>([
    'Vignesh 9876543210',
    'Arjun Kumar +91 98765 43210',
    'Priya Sharma +91 91234 56789',
  ]);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (cap.imageUri && cap.error) setRawOpen(true);
  }, [cap.error, cap.imageUri]);

  useEffect(() => {
    if (currentCardIndex >= cap.candidates.length && cap.candidates.length > 0) {
      setCurrentCardIndex(cap.candidates.length - 1);
    }
  }, [cap.candidates.length, currentCardIndex]);

  const scrollToIndex = (idx: number) => {
    tap();
    setCurrentCardIndex(idx);
    try {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true });
    } catch {
      flatListRef.current?.scrollToOffset({ offset: idx * (cardWidth + 12), animated: true });
    }
  };

  if (!cap.ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#091838',
          padding: 24,
          paddingTop: i.top + 24,
          gap: 16,
        }}
        testID="loading"
      >
        <Skeleton h={40} w={180} />
        <Skeleton h={120} />
        <Skeleton h={120} />
      </View>
    );
  }

  // Screen 1: Onboarding
  if (!cap.onboarded && cap.phase === 'idle' && cap.candidates.length === 0) {
    return (
      <>
        <StatusBar style="light" />
        <Onboarding
          onDone={() => {
            cap.completeOnboarding();
          }}
        />
      </>
    );
  }

  const countryName = cap.countries.find((o) => o.code === cap.country);
  const reviewing = cap.phase !== 'idle' || cap.candidates.length > 0 || !!cap.imageUri;
  const saving = cap.phase === 'saving';
  const nativeOcrUnavailable = !!cap.imageUri && !cap.ocrAvailable;
  const selected = cap.candidates.filter((x) => x.selected);
  const canSave = selected.length > 0 && selected.every((x) => x.valid) && cap.nativeAvailable && !saving;
  const showSummary = !saving && cap.outcomes.length > 0 && dismissed !== cap.outcomes;
  const allSelected = cap.candidates.length > 0 && cap.candidates.every((x) => x.selected);

  const messages = (
    <>
      {cap.error ? (
        <Banner
          testID="error-banner"
          kind="error"
          text={cap.error}
          onDismiss={cap.dismissError}
          action={
            cap.imageUri && cap.ocrAvailable
              ? {
                  label: S.review.retry,
                  onPress: () => {
                    cap.retry();
                  },
                }
              : undefined
          }
        />
      ) : null}
      {cap.notice ? <Banner testID="notice-banner" kind="notice" text={cap.notice} /> : null}
    </>
  );

  // -------------------------------------------------------------
  // SCREEN 2 — HOME SCREEN (When not reviewing contacts)
  // -------------------------------------------------------------
  if (!reviewing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#091838' }}>
        <StatusBar style="light" />
        <KeyboardAwareScrollViewCompat
          testID="main-scroll"
          bottomOffset={24}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Royal Blue Hero Section */}
          <LinearGradient
            colors={['#1F4A89', '#143368', '#0D2249', '#091838']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{
              paddingTop: Math.max(i.top, 44) + 12,
              paddingHorizontal: 22,
              paddingBottom: 28,
            }}
          >
            {/* Top Bar: Brand, Mail Login, and Country */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              {/* Logo & App Name - Tap to return to Get Started page */}
              <PressScale
                testID="logo-to-onboarding"
                accessibilityRole="button"
                accessibilityLabel="Go to Get Started page"
                onPress={() => {
                  tap();
                  cap.resetOnboarding();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                  }}
                >
                  <Ionicons name="scan-outline" size={20} color="#080809" />
                </View>
                <Text
                  accessibilityRole="header"
                  style={{
                    fontFamily: F.b,
                    fontSize: 22,
                    color: '#FFFFFF',
                    letterSpacing: -0.5,
                  }}
                >
                  SnapContact
                </Text>
              </PressScale>

              {/* Header Right Action Pills: Intro + Mail Login + Country */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {/* Intro / Get Started Pill */}
                <PressScale
                  testID="header-intro-btn"
                  accessibilityRole="button"
                  accessibilityLabel="View Get Started page"
                  onPress={() => {
                    tap();
                    cap.resetOnboarding();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <Ionicons name="sparkles-outline" size={13} color="#FFFFFF" />
                  <Text style={{ fontFamily: F.s, fontSize: 12, color: '#FFFFFF' }}>
                    Intro
                  </Text>
                </PressScale>

                {/* Mail Login Pill */}
                <PressScale
                  testID="header-auth-btn"
                  accessibilityRole="button"
                  accessibilityLabel={auth.user ? `Account: ${auth.user.email}` : 'Sign in with email'}
                  onPress={() => {
                    tap();
                    setAuthOpen(true);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: auth.user ? '#FFFFFF' : 'rgba(255, 255, 255, 0.14)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <Ionicons
                    name={auth.user ? 'person-circle' : 'mail-outline'}
                    size={14}
                    color={auth.user ? '#080809' : '#FFFFFF'}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: F.s,
                      fontSize: 12,
                      color: auth.user ? '#080809' : '#FFFFFF',
                      maxWidth: 90,
                    }}
                  >
                    {auth.user ? auth.user.email.split('@')[0] : 'Mail Login'}
                  </Text>
                </PressScale>

                {/* Country Pill */}
                <PressScale
                  testID="country-chip"
                  accessibilityRole="button"
                  accessibilityLabel={`${S.home.country}: ${countryName?.name ?? cap.country}`}
                  onPress={() => {
                    tap();
                    setCountryOpen(true);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <Ionicons name="globe-outline" size={13} color="#FFFFFF" />
                  <Text style={{ fontFamily: F.s, fontSize: 12, color: '#FFFFFF' }}>
                    {countryName ? `${countryName.code} +${countryName.callingCode.replace('+', '')}` : cap.country}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color="#CBD5E1" />
                </PressScale>
              </View>
            </View>

            {/* Trial & Cashfree Banner */}
            <PressScale
              testID="trial-banner"
              accessibilityRole="button"
              accessibilityLabel="View subscription and 1-week free trial"
              onPress={() => {
                tap();
                setSubscriptionOpen(true);
              }}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.18)',
                borderRadius: 14,
                padding: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginBottom: 18,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="sparkles" size={15} color="#080809" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.b, fontSize: 12, color: '#FFFFFF' }}>
                  {auth.subscription.status === 'annual'
                    ? 'Annual Pro Member · Cashfree Verified'
                    : `1st Week Free Trial (${auth.subscription.trialDaysRemaining}d left) · CASHFREE`}
                </Text>
                <Text style={{ fontFamily: F.r, fontSize: 11, color: '#CBD5E1' }}>
                  Auto-renews with 15-day notice · Cancel anytime
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
            </PressScale>

            {/* Hero Headline: Your Screenshots Organized */}
            <Animated.View entering={FadeInDown.duration(400)}>
              <Text
                style={{
                  fontFamily: F.b,
                  fontSize: 32,
                  lineHeight: 38,
                  letterSpacing: -1,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: '#FFFFFF' }}>Your </Text>
                <Text style={{ color: '#38BDF8' }}>Screenshots{'\n'}</Text>
                <Text style={{ color: '#FFFFFF' }}>Organized</Text>
              </Text>
              <Text
                style={{
                  fontFamily: F.r,
                  fontSize: 15,
                  color: '#CBD5E1',
                  lineHeight: 21,
                  marginBottom: 24,
                }}
              >
                Turn saved numbers into contacts automatically.
              </Text>
            </Animated.View>

            {/* 3 Circular Action Buttons in Horizontal Row */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(450)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-around',
                paddingVertical: 4,
              }}
            >
              {/* Action 1: Import Photo */}
              <View style={{ alignItems: 'center', gap: 8 }}>
                <PressScale
                  testID="import-library"
                  accessibilityRole="button"
                  accessibilityLabel="Import Photo"
                  onPress={() => {
                    tap('medium');
                    cap.importImage('library');
                  }}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Ionicons name="images-outline" size={26} color="#080809" />
                </PressScale>
                <Text style={{ fontFamily: F.m, fontSize: 12, color: '#FFFFFF' }}>
                  Import Photo
                </Text>
              </View>

              {/* Action 2: Camera */}
              <View style={{ alignItems: 'center', gap: 8 }}>
                <PressScale
                  testID="import-camera"
                  accessibilityRole="button"
                  accessibilityLabel="Camera"
                  onPress={() => {
                    tap('medium');
                    cap.importImage('camera');
                  }}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Ionicons name="camera-outline" size={26} color="#080809" />
                </PressScale>
                <Text style={{ fontFamily: F.m, fontSize: 12, color: '#FFFFFF' }}>
                  Camera
                </Text>
              </View>

              {/* Action 3: Quick Capture */}
              <View style={{ alignItems: 'center', gap: 8 }}>
                <PressScale
                  testID="toggle-quick-capture"
                  accessibilityRole="button"
                  accessibilityLabel="Quick Capture"
                  onPress={() => {
                    tap('medium');
                    void cap.toggleQuickCapture();
                  }}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Ionicons name="layers-outline" size={26} color="#080809" />
                </PressScale>
                <Text style={{ fontFamily: F.m, fontSize: 12, color: '#FFFFFF' }}>
                  Quick Capture
                </Text>
              </View>
            </Animated.View>
          </LinearGradient>

          {/* Bottom Sliding Sheet: Text or Paste Section */}
          <View
            style={{
              flex: 1,
              backgroundColor: '#EBF2FA',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingHorizontal: 22,
              paddingTop: 16,
              paddingBottom: Math.max(i.bottom, 20) + 24,
              gap: 16,
            }}
          >
            {/* Grab Handle */}
            <View
              style={{
                width: 44,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#94A3B8',
                alignSelf: 'center',
                marginBottom: 6,
              }}
            />

            {messages}

            {/* Title: Text or Paste */}
            <Text
              style={{
                fontFamily: F.b,
                fontSize: 18,
                color: '#0F172A',
                letterSpacing: -0.3,
              }}
            >
              Text or Paste
            </Text>

            {/* Pure White Text Input Card */}
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#CBD5E1',
                padding: 16,
                minHeight: 110,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons name="document-text-outline" size={20} color="#64748B" style={{ marginTop: 2 }} />
                <TextInput
                  testID="text-input"
                  accessibilityLabel={S.home.textLabel}
                  value={cap.text}
                  onChangeText={cap.setText}
                  placeholder="Paste or type text containing phone numbers here."
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                  style={{
                    flex: 1,
                    fontFamily: F.r,
                    fontSize: 14,
                    color: '#0F172A',
                    minHeight: 80,
                  }}
                />
              </View>
            </View>

            {/* Primary Action Button: Find Numbers → */}
            <PressScale
              testID="find-numbers"
              accessibilityRole="button"
              accessibilityLabel="Find Numbers"
              disabled={!cap.text.trim()}
              onPress={() => {
                if (cap.text.trim()) {
                  setSearchHistory((prev) => [cap.text.trim(), ...prev.slice(0, 9)]);
                  cap.processText(cap.text);
                }
              }}
              style={{
                backgroundColor: '#000000',
                height: 50,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: cap.text.trim() ? 1 : 0.4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <Text style={{ fontFamily: F.b, fontSize: 15, color: '#FFFFFF' }}>
                Find Numbers
              </Text>
              <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
            </PressScale>

            {/* Secondary Button: Search History */}
            <PressScale
              testID="search-history-btn"
              accessibilityRole="button"
              accessibilityLabel="Search History"
              onPress={() => {
                tap();
                setHistoryOpen(true);
              }}
              style={{
                backgroundColor: '#E2E8F0',
                height: 48,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: F.m, fontSize: 14, color: '#334155' }}>
                Search History
              </Text>
            </PressScale>

            {/* Privacy and Help Footer Trigger */}
            <PressScale
              testID="open-settings"
              accessibilityRole="button"
              accessibilityLabel="Privacy and help"
              onPress={() => {
                tap();
                setSettingsOpen(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={15} color="#64748B" />
              <Text style={{ fontFamily: F.m, fontSize: 13, color: '#64748B' }}>
                Privacy and help
              </Text>
            </PressScale>
          </View>
        </KeyboardAwareScrollViewCompat>

        {/* Search History Modal */}
        <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 24,
                maxHeight: '70%',
                gap: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.b, fontSize: 18, color: '#0F172A' }}>Search History</Text>
                <PressScale onPress={() => setHistoryOpen(false)}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </PressScale>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {searchHistory.map((item, idx) => (
                  <PressScale
                    key={idx}
                    onPress={() => {
                      cap.setText(item);
                      setHistoryOpen(false);
                      cap.processText(item);
                    }}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text numberOfLines={1} style={{ fontFamily: F.r, fontSize: 14, color: '#0F172A', flex: 1 }}>
                      {item}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#64748B" />
                  </PressScale>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Global Sheets & Modals */}
        <CountrySheet visible={countryOpen} countries={cap.countries} value={cap.country} onSelect={cap.setCountry} onClose={() => setCountryOpen(false)} />
        <SettingsModal
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onOpenSettings={() => { cap.openSettings(); }}
          user={auth.user}
          subscription={auth.subscription}
          onOpenAuth={() => setAuthOpen(true)}
          onOpenSubscription={() => setSubscriptionOpen(true)}
          onResetOnboarding={cap.resetOnboarding}
        />
        <AuthModal
          visible={authOpen}
          onClose={() => setAuthOpen(false)}
          user={auth.user}
          onLogin={auth.login}
          onSignup={auth.signup}
          onLogout={auth.logout}
          error={auth.authError}
          onClearError={auth.clearAuthError}
          onOpenSubscription={() => setSubscriptionOpen(true)}
        />
        <SubscriptionModal
          visible={subscriptionOpen}
          onClose={() => setSubscriptionOpen(false)}
          subscription={auth.subscription}
          onOpenCashfree={() => setCashfreeOpen(true)}
          onToggleAutoRenewal={auth.toggleAutoRenewal}
          userEmail={auth.user?.email}
        />
        <CashfreeModal
          visible={cashfreeOpen}
          onClose={() => setCashfreeOpen(false)}
          customerEmail={auth.user?.email}
          onSuccess={(result) => {
            auth.activateAnnualSubscription(result);
          }}
        />
      </View>
    );
  }

  // -------------------------------------------------------------
  // REVIEW SCREENS: SCREEN 3 (Single Card) & SCREEN 4 (List View)
  // -------------------------------------------------------------
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <StatusBar style="dark" />
      <KeyboardAwareScrollViewCompat
        testID="main-scroll"
        bottomOffset={24}
        contentContainerStyle={{
          paddingTop: Math.max(i.top, 44) + 12,
          paddingHorizontal: 20,
          paddingBottom: Math.max(i.bottom, 16) + (cap.candidates.length ? 140 : 36),
          gap: 14,
        }}
      >
        <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center', gap: 14 }}>
          {/* Header Row: < Review + View Toggle + Discard */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            {/* Back to Review / Home */}
            <PressScale
              testID="review-back"
              accessibilityRole="button"
              accessibilityLabel="Back to home"
              onPress={() => {
                tap();
                cap.clear();
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="chevron-back" size={22} color="#0F172A" />
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: F.b,
                  fontSize: 20,
                  color: '#0F172A',
                  letterSpacing: -0.4,
                }}
              >
                Review
              </Text>
            </PressScale>

            {/* Center Toggle: Card View vs List View */}
            {cap.candidates.length > 1 ? (
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: '#E2E8F0',
                  borderRadius: 999,
                  padding: 3,
                }}
              >
                <PressScale
                  testID="toggle-card-view"
                  accessibilityRole="button"
                  accessibilityLabel="Card View"
                  onPress={() => {
                    tap();
                    setViewMode('card');
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: viewMode === 'card' ? '#000000' : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: F.s,
                      fontSize: 12,
                      color: viewMode === 'card' ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    Card
                  </Text>
                </PressScale>
                <PressScale
                  testID="toggle-list-view"
                  accessibilityRole="button"
                  accessibilityLabel="List View"
                  onPress={() => {
                    tap();
                    setViewMode('list');
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: viewMode === 'list' ? '#000000' : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: F.s,
                      fontSize: 12,
                      color: viewMode === 'list' ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    List
                  </Text>
                </PressScale>
              </View>
            ) : null}

            {/* Discard Black Pill Button */}
            <PressScale
              testID="discard"
              accessibilityRole="button"
              accessibilityLabel="Discard"
              onPress={() => {
                setRawOpen(false);
                cap.clear();
              }}
              style={{
                backgroundColor: '#000000',
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: F.b, fontSize: 13, color: '#FFFFFF' }}>
                Discard
              </Text>
            </PressScale>
          </View>

          {messages}

          {cap.phase === 'processing' ? (
            <View testID="processing" style={{ gap: 12, paddingVertical: 20 }}>
              <Text style={{ fontFamily: F.r, fontSize: 15, color: '#64748B', textAlign: 'center' }}>
                {Platform.OS === 'web'
                  ? S.review.browserProcessing(Math.round(cap.ocrProgress * 100))
                  : S.review.processingBody}
              </Text>
              <Skeleton h={190} />
              <Skeleton h={190} />
            </View>
          ) : cap.candidates.length === 0 ? (
            <Animated.View
              entering={FadeIn}
              testID="empty"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 24,
                gap: 12,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="search-outline" size={26} color="#64748B" />
              </View>
              <Text style={{ fontFamily: F.b, fontSize: 20, color: '#0F172A', textAlign: 'center' }}>
                {S.review.emptyTitle}
              </Text>
              <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: '#64748B', textAlign: 'center' }}>
                {nativeOcrUnavailable ? S.review.previewManualBody : S.review.emptyBody}
              </Text>
              <View style={{ marginTop: 8, gap: 10, width: '100%' }}>
                {cap.imageUri && cap.ocrAvailable ? (
                  <Button testID="retry" label={S.review.retry} icon="refresh" onPress={() => { cap.retry(); }} />
                ) : null}
                <Button testID="try-again" label={S.review.tryAgain} variant="secondary" onPress={cap.clear} />
              </View>
            </Animated.View>
          ) : viewMode === 'list' ? (
            // SCREEN 4: Multi-Select Contacts List View
            <ContactsListView
              candidates={cap.candidates}
              onToggle={(id, sel) => cap.updateCandidate(id, { selected: sel })}
              onToggleAll={() => cap.selectAll(!allSelected)}
              allSelected={allSelected}
              onSelectCandidate={(index) => {
                setCurrentCardIndex(index);
                setViewMode('card');
              }}
              onDeleteSelected={() => {
                cap.candidates.filter(c => c.selected).forEach(c => cap.updateCandidate(c.id, { selected: false }));
              }}
            />
          ) : (
            // SCREEN 3: Single Card View with Carousel Navigation
            <View style={{ gap: 14 }}>
              {/* Pagination Bar: <  1 of 5  > */}
              {cap.candidates.length > 1 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 8,
                  }}
                >
                  <PressScale
                    testID="prev-card"
                    accessibilityRole="button"
                    accessibilityLabel="Previous contact"
                    disabled={currentCardIndex === 0}
                    onPress={() => scrollToIndex(Math.max(0, currentCardIndex - 1))}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: currentCardIndex === 0 ? 0.35 : 1,
                    }}
                  >
                    <Ionicons name="chevron-back" size={18} color="#0F172A" />
                  </PressScale>

                  {/* 1 of 5 and dots */}
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontFamily: F.m, fontSize: 12, color: '#64748B' }}>
                      {`${currentCardIndex + 1} of ${cap.candidates.length}`}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {cap.candidates.map((_, idx) => (
                        <Pressable key={idx} onPress={() => scrollToIndex(idx)} hitSlop={6}>
                          <View
                            style={{
                              width: idx === currentCardIndex ? 16 : 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: idx === currentCardIndex ? '#0284C7' : '#CBD5E1',
                            }}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <PressScale
                    testID="next-card"
                    accessibilityRole="button"
                    accessibilityLabel="Next contact"
                    disabled={currentCardIndex === cap.candidates.length - 1}
                    onPress={() => scrollToIndex(Math.min(cap.candidates.length - 1, currentCardIndex + 1))}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: currentCardIndex === cap.candidates.length - 1 ? 0.35 : 1,
                    }}
                  >
                    <Ionicons name="chevron-forward" size={18} color="#0F172A" />
                  </PressScale>
                </View>
              ) : null}

              {/* Default Country Selector Card */}
              <PressScale
                testID="country-chip"
                accessibilityRole="button"
                accessibilityLabel={`${S.home.country}: ${countryName?.name ?? cap.country}`}
                onPress={() => {
                  tap();
                  setCountryOpen(true);
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.03,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="globe-outline" size={18} color="#0F172A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.m, fontSize: 11, color: '#64748B' }}>
                    Default country
                  </Text>
                  <Text style={{ fontFamily: F.b, fontSize: 14, color: '#0F172A' }}>
                    {countryName ? `${countryName.code} +${countryName.callingCode.replace('+', '')}` : cap.country}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#64748B" />
              </PressScale>

              {/* Horizontal Swiper Carousel of Cards */}
              <FlatList
                ref={flatListRef}
                data={cap.candidates}
                keyExtractor={(cd) => cd.id}
                horizontal
                snapToInterval={cardWidth + 12}
                snapToAlignment="center"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                contentContainerStyle={{ gap: 12 }}
                onMomentumScrollEnd={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const nextIdx = Math.round(x / (cardWidth + 12));
                  if (nextIdx >= 0 && nextIdx < cap.candidates.length) {
                    setCurrentCardIndex(nextIdx);
                  }
                }}
                onScrollToIndexFailed={(info) => {
                  flatListRef.current?.scrollToOffset({ offset: info.index * (cardWidth + 12), animated: true });
                }}
                renderItem={({ item: cd, index: n }) => (
                  <View style={{ width: cardWidth }}>
                    <CandidateCard
                      cand={cd}
                      index={n}
                      total={cap.candidates.length}
                      onChange={(patch) => cap.updateCandidate(cd.id, patch)}
                      onAction={(a) => {
                        cap.action(cd.id, a);
                      }}
                    />
                  </View>
                )}
              />

              {/* Collapsible Recognized Text */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  overflow: 'hidden',
                  marginTop: 2,
                }}
              >
                <Pressable
                  testID="raw-toggle"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: rawOpen }}
                  accessibilityLabel="Recognized text"
                  onPress={() => {
                    tap();
                    setRawOpen(!rawOpen);
                  }}
                  style={{
                    minHeight: 48,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ fontFamily: F.s, fontSize: 14, color: '#0F172A' }}>
                    Recognized text
                  </Text>
                  <Ionicons name={rawOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
                </Pressable>
                {rawOpen ? (
                  <View style={{ padding: 16, paddingTop: 0, gap: 10 }}>
                    <TextInput
                      testID="raw-input"
                      value={cap.text}
                      onChangeText={cap.setText}
                      multiline
                      textAlignVertical="top"
                      placeholder="Recognized OCR text"
                      placeholderTextColor="#94A3B8"
                      style={{
                        minHeight: 90,
                        backgroundColor: '#F8FAFC',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        padding: 12,
                        fontFamily: F.r,
                        fontSize: 14,
                        color: '#0F172A',
                      }}
                    />
                    <Button
                      testID="rescan"
                      label="Rescan this text"
                      icon="search"
                      variant="secondary"
                      disabled={!cap.text.trim()}
                      onPress={() => cap.processText(cap.text)}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          )}
        </View>
      </KeyboardAwareScrollViewCompat>

      {/* Sticky Bottom Action: Review and save contact */}
      {reviewing && cap.candidates.length > 0 && cap.phase !== 'processing' ? (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#F1F5F9',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(i.bottom, 16) + 12,
          }}
        >
          <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center', gap: 6 }}>
            <PressScale
              testID="save-selected"
              accessibilityRole="button"
              accessibilityLabel="Review and save contact"
              disabled={!canSave}
              onPress={() => {
                Keyboard.dismiss();
                cap.saveSelected();
              }}
              style={{
                backgroundColor: '#000000',
                height: 52,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: canSave ? 1 : 0.4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <Ionicons name="person-outline" size={17} color="#FFFFFF" />
              <Text style={{ fontFamily: F.b, fontSize: 15, color: '#FFFFFF' }}>
                {saving
                  ? 'Saving contacts...'
                  : selected.length === 1
                  ? 'Review and save contact'
                  : `Review and save ${selected.length} contacts`}
              </Text>
            </PressScale>
          </View>
        </Animated.View>
      ) : null}

      {/* Global Modals */}
      <CountrySheet visible={countryOpen} countries={cap.countries} value={cap.country} onSelect={cap.setCountry} onClose={() => setCountryOpen(false)} />
      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenSettings={() => { cap.openSettings(); }}
        user={auth.user}
        subscription={auth.subscription}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenSubscription={() => setSubscriptionOpen(true)}
        onResetOnboarding={cap.resetOnboarding}
      />
      <AuthModal
        visible={authOpen}
        onClose={() => setAuthOpen(false)}
        user={auth.user}
        onLogin={auth.login}
        onSignup={auth.signup}
        onLogout={auth.logout}
        error={auth.authError}
        onClearError={auth.clearAuthError}
        onOpenSubscription={() => setSubscriptionOpen(true)}
      />
      <SubscriptionModal
        visible={subscriptionOpen}
        onClose={() => setSubscriptionOpen(false)}
        subscription={auth.subscription}
        onOpenCashfree={() => setCashfreeOpen(true)}
        onToggleAutoRenewal={auth.toggleAutoRenewal}
        userEmail={auth.user?.email}
      />
      <CashfreeModal
        visible={cashfreeOpen}
        onClose={() => setCashfreeOpen(false)}
        customerEmail={auth.user?.email}
        onSuccess={(result) => {
          auth.activateAnnualSubscription(result);
        }}
      />
      {/* SCREEN 5: Saved Confirmation Page */}
      <SaveSummary visible={showSummary} saving={saving} outcomes={cap.outcomes} total={selected.length} onDone={() => setDismissed(cap.outcomes)} />
    </View>
  );
}
