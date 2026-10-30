import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Keyboard, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useCapture } from '@/hooks/useCapture';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Banner, Button, F, IconButton, PressScale, Skeleton, tap, useInsets } from '@/components/ui';
import { Onboarding } from '@/components/Onboarding';
import { CountrySheet } from '@/components/CountrySheet';
import { SettingsModal } from '@/components/SettingsModal';
import { SaveSummary } from '@/components/SaveSummary';
import { CandidateCard } from '@/components/CandidateCard';

export default function Index() {
  const cap = useCapture();
  const c = useColors();
  const i = useInsets();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(windowWidth - 40, 480);
  const [countryOpen, setCountryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [dismissed, setDismissed] = useState<unknown>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
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
      <View style={{ flex: 1, backgroundColor: c.background, padding: 24, paddingTop: i.top + 24, gap: 16 }} testID="loading">
        <Skeleton h={40} w={180} /><Skeleton h={120} /><Skeleton h={120} />
      </View>
    );
  }
  if (!cap.onboarded && cap.phase === 'idle' && cap.candidates.length === 0) {
    return (<><StatusBar style="light" /><Onboarding onDone={() => { cap.completeOnboarding(); }} /></>);
  }

  const countryName = cap.countries.find((o) => o.code === cap.country);
  const reviewing = cap.phase !== 'idle' || cap.candidates.length > 0 || !!cap.imageUri;
  const saving = cap.phase === 'saving';
  const nativeOcrUnavailable = !!cap.imageUri && !cap.ocrAvailable;
  const selected = cap.candidates.filter((x) => x.selected);
  const canSave = selected.length > 0 && selected.every((x) => x.valid) && cap.nativeAvailable && !saving;
  // Never present a React Native Modal over the OS contact editor. It competes
  // for iOS presentation and can hide the editor or break delegate completion.
  const showSummary = !saving && cap.outcomes.length > 0 && dismissed !== cap.outcomes;
  const allSelected = cap.candidates.length > 0 && cap.candidates.every((x) => x.selected);
  const detectedCountries = [...new Map(cap.candidates
    .filter(row => row.international && row.callingCode)
    .map(row => [row.country || `calling-${row.callingCode}`, {
      name: row.countryName, code: row.callingCode,
    }])).values()];

  const countryChip = (
    <PressScale testID="country-chip" accessibilityRole="button" accessibilityLabel={`${S.home.country}: ${countryName?.name ?? cap.country}. ${S.home.countryHint}`}
      onPress={() => { tap(); setCountryOpen(true); }}
      style={{ minHeight: 52, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.m, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: '#71717A' }}>{S.home.country}</Text>
        <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground }}>{countryName ? `${countryName.name}  ${countryName.callingCode.startsWith('+') ? '' : '+'}${countryName.callingCode}` : cap.country}</Text>
      </View>
      <Ionicons name="chevron-down" size={18} color="#A1A1AA" />
    </PressScale>
  );

  const messages = (
    <>
      {cap.error ? <Banner testID="error-banner" kind="error" text={cap.error} onDismiss={cap.dismissError} action={cap.imageUri && cap.ocrAvailable ? { label: S.review.retry, onPress: () => { cap.retry(); } } : undefined} /> : null}
      {cap.notice ? <Banner testID="notice-banner" kind="notice" text={cap.notice} /> : null}
    </>
  );

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
        </View>
        <View style={{ gap: 1 }}>
          <Text accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 21, color: c.foreground, letterSpacing: -0.5 }}>{S.appName}</Text>
          <Text style={{ fontFamily: F.r, fontSize: 12, color: '#A1A1AA' }}>Privacy-first contact capture</Text>
        </View>
      </View>
      <PressScale
        testID="open-settings"
        accessibilityRole="button"
        accessibilityLabel={S.home.settings}
        accessibilityHint="Opens privacy settings and help documentation"
        onPress={() => { tap(); setSettingsOpen(true); }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingHorizontal: 13,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <Ionicons name="shield-checkmark-outline" size={16} color="#FFFFFF" />
        <Text style={{ fontFamily: F.s, fontSize: 13, color: c.foreground, letterSpacing: -0.1 }}>{S.home.settings}</Text>
      </PressScale>
    </View>
  );

  const body = !reviewing ? (
    <>
      {header}
      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 6, marginTop: 4, marginBottom: 12 }}>
        <Text style={{ fontFamily: F.b, fontSize: 36, lineHeight: 42, letterSpacing: -1.2, color: c.foreground }}>
          {S.tagline}
        </Text>
      </Animated.View>
      {messages}

      {/* Main Actions Group */}
      <Animated.View entering={FadeInDown.delay(100).duration(450)} style={{ gap: 12 }}>
        {/* Large Beautiful Import Card */}
        <PressScale
          testID="import-library"
          accessibilityRole="button"
          accessibilityLabel={S.home.library}
          accessibilityHint={S.home.libraryHint}
          onPress={() => { tap('medium'); cap.importImage('library'); }}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            padding: 24,
            minHeight: 124,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#080809', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="images" size={24} color="#FFFFFF" />
            </View>
            <Ionicons name="arrow-forward" size={20} color="#080809" />
          </View>
          <View style={{ gap: 4, marginTop: 12 }}>
            <Text style={{ fontFamily: F.b, fontSize: 21, color: '#080809', letterSpacing: -0.4 }}>{S.home.library}</Text>
            <Text style={{ fontFamily: F.r, fontSize: 14, color: '#080809', opacity: 0.75 }}>{S.home.libraryHint}</Text>
          </View>
        </PressScale>

        {/* Secondary Action: Take a Photo */}
        <PressScale
          testID="import-camera"
          accessibilityRole="button"
          accessibilityLabel={S.home.camera}
          accessibilityHint={S.home.cameraHint}
          onPress={() => { tap('medium'); cap.importImage('camera'); }}
          style={{
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 18,
            padding: 18,
            minHeight: 74,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: F.s, fontSize: 16, color: c.foreground }}>{S.home.camera}</Text>
            <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{S.home.cameraHint}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#71717A" />
        </PressScale>

        {/* Quick Capture (Android) */}
        {cap.quickCaptureAvailable ? (
          <PressScale
            testID="toggle-quick-capture"
            accessibilityRole="button"
            accessibilityLabel={S.home.quickCapture}
            accessibilityHint={S.home.quickCaptureHint}
            onPress={() => { tap('medium'); void cap.toggleQuickCapture(); }}
            style={{
              backgroundColor: cap.quickCaptureActive ? '#FFFFFF' : c.card,
              borderWidth: 1,
              borderColor: cap.quickCaptureActive ? '#FFFFFF' : c.border,
              borderRadius: 18,
              padding: 18,
              minHeight: 74,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: cap.quickCaptureActive ? '#080809' : c.secondary, borderWidth: 1, borderColor: cap.quickCaptureActive ? '#080809' : c.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={cap.quickCaptureActive ? "radio-button-on" : "layers-outline"} size={22} color={cap.quickCaptureActive ? '#FFFFFF' : '#FFFFFF'} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: F.s, fontSize: 16, color: cap.quickCaptureActive ? '#080809' : c.foreground }}>{S.home.quickCapture}</Text>
                {cap.quickCaptureActive ? (
                  <View style={{ backgroundColor: '#080809', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: F.b, fontSize: 11, color: '#FFFFFF' }}>{S.home.quickCaptureActiveBadge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: cap.quickCaptureActive ? '#080809' : c.mutedForeground, opacity: cap.quickCaptureActive ? 0.75 : 1 }}>
                {cap.quickCaptureActive ? S.home.quickCaptureTapToStop : S.home.quickCaptureHint}
              </Text>
            </View>
          </PressScale>
        ) : null}
      </Animated.View>

      {/* Text Extraction Card */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(450)}
        style={{
          backgroundColor: c.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.border,
          padding: 18,
          gap: 12,
          marginTop: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: '#71717A' }}>
            {S.home.orText}
          </Text>
          {cap.text ? (
            <Pressable onPress={() => cap.setText('')} hitSlop={8}>
              <Text style={{ fontFamily: F.m, fontSize: 12, color: '#A1A1AA' }}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <TextInput
          testID="text-input"
          accessibilityLabel={S.home.textLabel}
          value={cap.text}
          onChangeText={cap.setText}
          placeholder={S.home.textPlaceholder}
          placeholderTextColor="#71717A"
          multiline
          textAlignVertical="top"
          style={{
            minHeight: 110,
            backgroundColor: c.secondary,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.border,
            padding: 14,
            fontFamily: F.r,
            fontSize: 15,
            color: c.foreground,
          }}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              testID="find-numbers"
              label={S.home.findNumbers}
              icon="search"
              variant="primary"
              disabled={!cap.text.trim()}
              onPress={() => cap.processText(cap.text)}
            />
          </View>
          {cap.text ? (
            <Button testID="clear-text" label={S.home.clearText} variant="ghost" onPress={() => cap.setText('')} compact />
          ) : null}
        </View>
      </Animated.View>

      {/* Privacy and Help Card */}
      <Animated.View entering={FadeIn.delay(300)} style={{ marginTop: 10 }}>
        <PressScale
          testID="footer-privacy-link"
          accessibilityRole="button"
          accessibilityLabel={S.home.settings}
          accessibilityHint="Tap to view offline privacy policy and help"
          onPress={() => { tap(); setSettingsOpen(true); }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 18,
            borderRadius: 18,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground }}>{S.home.settings}</Text>
            <Text style={{ fontFamily: F.r, fontSize: 13, lineHeight: 18, color: c.mutedForeground }}>
              {Platform.OS === 'web' ? S.home.browserPrivacy : S.home.privacy}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#71717A" />
        </PressScale>
      </Animated.View>

      {!cap.nativeAvailable ? <Banner kind="notice" testID="web-note" text={S.home.webNote} /> : null}
    </>
  ) : (
    <>
      {/* Review Screen Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
        <Text accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 30, letterSpacing: -0.8, color: c.foreground }}>
          {S.review.title}
        </Text>
        <Button testID="discard" label={S.review.discard} icon="trash-outline" variant="ghost" compact onPress={() => { setRawOpen(false); cap.clear(); }} hint={S.review.discardLabel} />
      </View>
      {messages}

      {/* Review Summary Panel */}
      <View
        style={{
          flexDirection: 'row',
          gap: 14,
          alignItems: 'center',
          backgroundColor: c.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
        }}
      >
        {cap.imageUri ? (
          <Image testID="thumbnail" source={{ uri: cap.imageUri }} accessibilityLabel={S.review.imageLabel} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border }} />
        ) : (
          <View style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="document-text-outline" size={28} color="#FFFFFF" />
          </View>
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.b, fontSize: 18, color: c.foreground, letterSpacing: -0.3 }}>
            {cap.phase === 'processing' ? S.review.processing : S.review.found(cap.candidates.length)}
          </Text>
          {cap.candidates.length > 1 ? (
            <Pressable testID="select-all" accessibilityRole="button" accessibilityLabel={allSelected ? S.review.selectNone : S.review.selectAll} onPress={() => { tap(); cap.selectAll(!allSelected); }} style={{ minHeight: 36, justifyContent: 'center' }} hitSlop={8}>
              <Text style={{ fontFamily: F.s, fontSize: 14, color: '#FFFFFF', textDecorationLine: 'underline' }}>
                {allSelected ? S.review.selectNone : S.review.selectAll}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Detected Countries Panel */}
      {detectedCountries.length > 0 ? (
        <View testID="detected-countries" style={{ padding: 16, gap: 10, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
            <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground }}>{S.review.detectedCountries}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {detectedCountries.map(region => (
              <View
                key={`${region.name}-${region.code}`}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 10,
                  backgroundColor: c.secondary,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Text style={{ fontFamily: F.m, fontSize: 13, color: c.foreground }}>
                  {region.name} +{region.code}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: F.r, fontSize: 13, lineHeight: 19, color: c.mutedForeground }}>{S.review.mixedCountryHint}</Text>
        </View>
      ) : null}
      {detectedCountries.length === 0 || cap.candidates.some(row => !row.international) ? countryChip : null}

      {cap.phase === 'processing' ? (
        <View testID="processing" accessibilityLabel={S.review.processingBody} style={{ gap: 12 }}>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.r, fontSize: 15, color: c.mutedForeground }}>{Platform.OS === 'web' ? S.review.browserProcessing(Math.round(cap.ocrProgress * 100)) : S.review.processingBody}</Text>
          <Skeleton h={190} /><Skeleton h={190} />
        </View>
      ) : cap.candidates.length === 0 ? (
        <Animated.View entering={FadeIn} testID="empty" style={{ backgroundColor: c.card, borderRadius: 22, padding: 24, gap: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="search-outline" size={26} color="#A1A1AA" />
          </View>
          <Text style={{ fontFamily: F.b, fontSize: 20, color: c.foreground, textAlign: 'center' }}>{S.review.emptyTitle}</Text>
          <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: c.mutedForeground, textAlign: 'center' }}>{nativeOcrUnavailable ? S.review.previewManualBody : S.review.emptyBody}</Text>
          <View style={{ marginTop: 8, gap: 10, width: '100%' }}>
            {cap.imageUri && cap.ocrAvailable ? <Button testID="retry" label={S.review.retry} icon="refresh" onPress={() => { cap.retry(); }} /> : null}
            <Button testID="try-again" label={S.review.tryAgain} variant="secondary" onPress={cap.clear} />
          </View>
        </Animated.View>
      ) : (
        <View style={{ gap: 12 }}>
          {/* Swiper Controls & Pagination */}
          {cap.candidates.length > 1 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
              <PressScale
                testID="prev-card"
                accessibilityRole="button"
                accessibilityLabel="Previous contact"
                disabled={currentCardIndex === 0}
                onPress={() => scrollToIndex(Math.max(0, currentCardIndex - 1))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: currentCardIndex === 0 ? 0.3 : 1,
                }}
              >
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </PressScale>

              <View style={{ alignItems: 'center', gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {cap.candidates.map((_, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => scrollToIndex(idx)}
                      accessibilityRole="button"
                      accessibilityLabel={`Go to contact ${idx + 1}`}
                      hitSlop={8}
                    >
                      <View
                        style={{
                          width: idx === currentCardIndex ? 22 : 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: idx === currentCardIndex ? '#FFFFFF' : c.border,
                        }}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text style={{ fontFamily: F.m, fontSize: 12, color: c.mutedForeground }}>
                  {`Contact ${currentCardIndex + 1} of ${cap.candidates.length}  ·  Swipe left / right`}
                </Text>
              </View>

              <PressScale
                testID="next-card"
                accessibilityRole="button"
                accessibilityLabel="Next contact"
                disabled={currentCardIndex === cap.candidates.length - 1}
                onPress={() => scrollToIndex(Math.min(cap.candidates.length - 1, currentCardIndex + 1))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: currentCardIndex === cap.candidates.length - 1 ? 0.3 : 1,
                }}
              >
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </PressScale>
            </View>
          ) : null}

          {/* Horizontal Swiper Carousel */}
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
                  onAction={(a) => { cap.action(cd.id, a); }}
                />
              </View>
            )}
          />
        </View>
      )}

      {/* Raw / Edit Text Panel */}
      {cap.phase !== 'processing' ? (
        <View style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, overflow: 'hidden', marginTop: 4 }}>
          <Pressable testID="raw-toggle" accessibilityRole="button" accessibilityState={{ expanded: rawOpen }} accessibilityLabel={nativeOcrUnavailable ? S.review.previewTextTitle : S.review.rawTitle}
            onPress={() => { tap(); setRawOpen(!rawOpen); }} style={{ minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, fontFamily: F.s, fontSize: 15, color: c.foreground }}>{nativeOcrUnavailable ? S.review.previewTextTitle : S.review.rawTitle}</Text>
            <Ionicons name={rawOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#A1A1AA" />
          </Pressable>
          {rawOpen ? (
            <View style={{ padding: 16, paddingTop: 0, gap: 10 }}>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{nativeOcrUnavailable ? S.review.previewTextHint : S.review.rawHint}</Text>
              <TextInput testID="raw-input" accessibilityLabel={nativeOcrUnavailable ? S.review.previewTextTitle : S.review.rawTitle} value={cap.text} onChangeText={cap.setText} multiline textAlignVertical="top" placeholder={S.home.textPlaceholder} placeholderTextColor="#71717A"
                style={{ minHeight: 110, backgroundColor: c.secondary, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14, fontFamily: F.r, fontSize: 15, color: c.foreground }} />
              <Button testID="rescan" label={nativeOcrUnavailable ? S.review.findNumbersInText : S.review.rescan} icon="search" variant="secondary" disabled={!cap.text.trim()} onPress={() => cap.processText(cap.text)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style="light" />
      <KeyboardAwareScrollViewCompat
        testID="main-scroll"
        bottomOffset={24}
        contentContainerStyle={{
          paddingTop: Math.max(i.top, 44) + 16,
          paddingHorizontal: 20,
          paddingBottom: Math.max(i.bottom, 16) + (reviewing && cap.candidates.length ? 150 : 36),
          gap: 16,
        }}
      >
        <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center', gap: 16 }}>
          {body}
        </View>
      </KeyboardAwareScrollViewCompat>

      {/* Screen 8: Sticky Save Action Bar */}
      {reviewing && cap.candidates.length > 0 && cap.phase !== 'processing' ? (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: c.background,
            borderTopWidth: 1,
            borderTopColor: c.border,
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: Math.max(i.bottom, 16) + 12,
          }}
        >
          <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center', gap: 6 }}>
            <Button
              testID="save-selected"
              label={saving ? S.summary.saving : selected.length ? S.review.save(selected.length) : S.review.saveNone}
              icon="person-add-outline"
              disabled={!canSave}
              loading={saving}
              onPress={() => { Keyboard.dismiss(); cap.saveSelected(); }}
            />
            <Text style={{ fontFamily: F.r, fontSize: 12, lineHeight: 17, color: '#71717A', textAlign: 'center' }}>
              {cap.nativeAvailable ? S.review.saveHint : S.review.nativeOnly}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <CountrySheet visible={countryOpen} countries={cap.countries} value={cap.country} onSelect={cap.setCountry} onClose={() => setCountryOpen(false)} />
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenSettings={() => { cap.openSettings(); }} />
      <SaveSummary visible={showSummary} saving={saving} outcomes={cap.outcomes} total={selected.length} onDone={() => setDismissed(cap.outcomes)} />
    </View>
  );
}
