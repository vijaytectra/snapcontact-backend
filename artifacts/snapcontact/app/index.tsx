import React, { useEffect, useState } from 'react';
import { Image, Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
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
  const [countryOpen, setCountryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [dismissed, setDismissed] = useState<unknown>(null);

  useEffect(() => {
    if (cap.imageUri && cap.error) setRawOpen(true);
  }, [cap.error, cap.imageUri]);

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
      <Ionicons name="globe-outline" size={22} color={c.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.m, fontSize: 12, color: c.mutedForeground }}>{S.home.country}</Text>
        <Text style={{ fontFamily: F.s, fontSize: 16, color: c.foreground }}>{countryName ? `${countryName.name}  ${countryName.callingCode.startsWith('+') ? '' : '+'}${countryName.callingCode}` : cap.country}</Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={c.mutedForeground} />
    </PressScale>
  );

  const messages = (
    <>
      {cap.error ? <Banner testID="error-banner" kind="error" text={cap.error} onDismiss={cap.dismissError} action={cap.imageUri && cap.ocrAvailable ? { label: S.review.retry, onPress: () => { cap.retry(); } } : undefined} /> : null}
      {cap.notice ? <Banner testID="notice-banner" kind="notice" text={cap.notice} /> : null}
    </>
  );

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="scan-outline" size={20} color={c.accent} />
        </View>
        <Text accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 20, color: c.foreground, letterSpacing: -0.3 }}>{S.appName}</Text>
      </View>
      <IconButton testID="open-settings" icon="shield-checkmark-outline" label={S.home.settings} onPress={() => setSettingsOpen(true)} />
    </View>
  );

  const body = !reviewing ? (
    <>
      {header}
      <Animated.View entering={FadeInDown.duration(500)} style={{ gap: 6, marginTop: 8, marginBottom: 8 }}>
        <Text style={{ fontFamily: F.b, fontSize: 34, lineHeight: 40, letterSpacing: -1, color: c.foreground }}>{S.tagline}</Text>
      </Animated.View>
      {messages}
      <Animated.View entering={FadeInDown.delay(120).duration(500)} style={{ gap: 12 }}>
        <PressScale testID="import-library" accessibilityRole="button" accessibilityLabel={S.home.library} accessibilityHint={S.home.libraryHint}
          onPress={() => { tap('medium'); cap.importImage('library'); }}
          style={{ backgroundColor: c.primary, borderRadius: 24, padding: 22, minHeight: 120, justifyContent: 'space-between' }}>
          <Ionicons name="images-outline" size={30} color={c.accent} />
          <View>
            <Text style={{ fontFamily: F.b, fontSize: 21, color: c.primaryForeground }}>{S.home.library}</Text>
            <Text style={{ fontFamily: F.r, fontSize: 14, color: c.primaryForeground, opacity: 0.75 }}>{S.home.libraryHint}</Text>
          </View>
        </PressScale>
        <PressScale testID="import-camera" accessibilityRole="button" accessibilityLabel={S.home.camera} accessibilityHint={S.home.cameraHint}
          onPress={() => { tap('medium'); cap.importImage('camera'); }}
          style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 18, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Ionicons name="camera-outline" size={26} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.s, fontSize: 17, color: c.foreground }}>{S.home.camera}</Text>
            <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground }}>{S.home.cameraHint}</Text>
          </View>
        </PressScale>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).duration(500)} style={{ gap: 10, marginTop: 12 }}>
        <Text style={{ fontFamily: F.s, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: c.mutedForeground }}>{S.home.orText}</Text>
        <TextInput testID="text-input" accessibilityLabel={S.home.textLabel} value={cap.text} onChangeText={cap.setText} placeholder={S.home.textPlaceholder} placeholderTextColor={c.mutedForeground} multiline textAlignVertical="top"
          style={{ minHeight: 110, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, fontFamily: F.r, fontSize: 16, color: c.foreground }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Button testID="find-numbers" label={S.home.findNumbers} icon="search" variant="secondary" disabled={!cap.text.trim()} onPress={() => cap.processText(cap.text)} /></View>
          {cap.text ? <Button testID="clear-text" label={S.home.clearText} variant="ghost" onPress={() => cap.setText('')} /> : null}
        </View>
      </Animated.View>

      <View style={{ marginTop: 12 }}>{countryChip}</View>
      <Animated.View entering={FadeIn.delay(400)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 }} accessible accessibilityLabel={Platform.OS === 'web' ? S.home.browserPrivacy : S.home.privacy}>
        <Ionicons name="lock-closed" size={16} color={c.mutedForeground} />
        <Text style={{ flex: 1, fontFamily: F.r, fontSize: 13, lineHeight: 18, color: c.mutedForeground }}>{Platform.OS === 'web' ? S.home.browserPrivacy : S.home.privacy}</Text>
      </Animated.View>
      {!cap.nativeAvailable ? <Banner kind="notice" testID="web-note" text={S.home.webNote} /> : null}
    </>
  ) : (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 28, letterSpacing: -0.6, color: c.foreground }}>{S.review.title}</Text>
        <Button testID="discard" label={S.review.discard} icon="trash-outline" variant="ghost" compact onPress={() => { setRawOpen(false); cap.clear(); }} hint={S.review.discardLabel} />
      </View>
      {messages}
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        {cap.imageUri ? (
          <Image testID="thumbnail" source={{ uri: cap.imageUri }} accessibilityLabel={S.review.imageLabel} style={{ width: 84, height: 84, borderRadius: 16, backgroundColor: c.muted }} />
        ) : (
          <View style={{ width: 84, height: 84, borderRadius: 16, backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="text" size={30} color={c.mutedForeground} /></View>
        )}
        <View style={{ flex: 1, gap: 8 }}>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.s, fontSize: 17, color: c.foreground }}>
            {cap.phase === 'processing' ? S.review.processing : S.review.found(cap.candidates.length)}
          </Text>
          {cap.candidates.length > 1 ? (
            <Pressable testID="select-all" accessibilityRole="button" accessibilityLabel={allSelected ? S.review.selectNone : S.review.selectAll} onPress={() => { tap(); cap.selectAll(!allSelected); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.b, fontSize: 15, color: c.primary }}>{allSelected ? S.review.selectNone : S.review.selectAll}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {detectedCountries.length > 0 ? (
        <View testID="detected-countries" style={{ padding: 16, gap: 8, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ fontFamily: F.s, fontSize: 16, color: c.foreground }}>{S.review.detectedCountries}</Text>
          <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: c.mutedForeground }}>
            {detectedCountries.map(region => `${region.name} +${region.code}`).join(' · ')}
          </Text>
          <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{S.review.mixedCountryHint}</Text>
        </View>
      ) : null}
      {detectedCountries.length === 0 || cap.candidates.some(row => !row.international) ? countryChip : null}

      {cap.phase === 'processing' ? (
        <View testID="processing" accessibilityLabel={S.review.processingBody} style={{ gap: 12 }}>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.r, fontSize: 15, color: c.mutedForeground }}>{Platform.OS === 'web' ? S.review.browserProcessing(Math.round(cap.ocrProgress * 100)) : S.review.processingBody}</Text>
          <Skeleton h={190} /><Skeleton h={190} />
        </View>
      ) : cap.candidates.length === 0 ? (
        <Animated.View entering={FadeIn} testID="empty" style={{ backgroundColor: c.card, borderRadius: 20, padding: 22, gap: 10, borderWidth: 1, borderColor: c.border }}>
          <Ionicons name="search-outline" size={28} color={c.mutedForeground} />
          <Text style={{ fontFamily: F.b, fontSize: 19, color: c.foreground }}>{S.review.emptyTitle}</Text>
          <Text style={{ fontFamily: F.r, fontSize: 15, lineHeight: 22, color: c.mutedForeground }}>{nativeOcrUnavailable ? S.review.previewManualBody : S.review.emptyBody}</Text>
          <View style={{ marginTop: 6, gap: 10 }}>
            {cap.imageUri && cap.ocrAvailable ? <Button testID="retry" label={S.review.retry} icon="refresh" onPress={() => { cap.retry(); }} /> : null}
            <Button testID="try-again" label={S.review.tryAgain} variant="secondary" onPress={cap.clear} />
          </View>
        </Animated.View>
      ) : (
        <View style={{ gap: 14 }}>
          {cap.candidates.map((cd, n) => (
            <CandidateCard key={cd.id} cand={cd} index={n}
              onChange={(patch) => cap.updateCandidate(cd.id, patch)}
              onAction={(a) => { cap.action(cd.id, a); }} />
          ))}
        </View>
      )}

      {cap.phase !== 'processing' ? (
        <View style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
          <Pressable testID="raw-toggle" accessibilityRole="button" accessibilityState={{ expanded: rawOpen }} accessibilityLabel={nativeOcrUnavailable ? S.review.previewTextTitle : S.review.rawTitle}
            onPress={() => { tap(); setRawOpen(!rawOpen); }} style={{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, fontFamily: F.s, fontSize: 16, color: c.foreground }}>{nativeOcrUnavailable ? S.review.previewTextTitle : S.review.rawTitle}</Text>
            <Ionicons name={rawOpen ? 'chevron-up' : 'chevron-down'} size={20} color={c.mutedForeground} />
          </Pressable>
          {rawOpen ? (
            <View style={{ padding: 16, paddingTop: 0, gap: 10 }}>
              <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground }}>{nativeOcrUnavailable ? S.review.previewTextHint : S.review.rawHint}</Text>
              <TextInput testID="raw-input" accessibilityLabel={nativeOcrUnavailable ? S.review.previewTextTitle : S.review.rawTitle} value={cap.text} onChangeText={cap.setText} multiline textAlignVertical="top" placeholder={S.home.textPlaceholder} placeholderTextColor={c.mutedForeground}
                style={{ minHeight: 120, backgroundColor: c.background, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, fontFamily: F.r, fontSize: 15, color: c.foreground }} />
              <Button testID="rescan" label={nativeOcrUnavailable ? S.review.findNumbersInText : S.review.rescan} icon="search" variant="secondary" disabled={!cap.text.trim()} onPress={() => cap.processText(cap.text)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style="auto" />
      <KeyboardAwareScrollViewCompat testID="main-scroll" bottomOffset={24} contentContainerStyle={{ paddingTop: i.top + 12, paddingHorizontal: 20, paddingBottom: i.bottom + (reviewing && cap.candidates.length ? 150 : 32), gap: 14 }}>
        {body}
      </KeyboardAwareScrollViewCompat>

      {reviewing && cap.candidates.length > 0 && cap.phase !== 'processing' ? (
        <Animated.View entering={FadeInDown.duration(300)} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: i.bottom + 12, gap: 6 }}>
           <Button testID="save-selected" label={saving ? S.summary.saving : selected.length ? S.review.save(selected.length) : S.review.saveNone} icon="person-add-outline" disabled={!canSave} loading={saving} onPress={() => { Keyboard.dismiss(); cap.saveSelected(); }} />
          <Text style={{ fontFamily: F.r, fontSize: 12, lineHeight: 17, color: c.mutedForeground, textAlign: 'center' }}>
            {cap.nativeAvailable ? S.review.saveHint : S.review.nativeOnly}
          </Text>
        </Animated.View>
      ) : null}

      <CountrySheet visible={countryOpen} countries={cap.countries} value={cap.country} onSelect={cap.setCountry} onClose={() => setCountryOpen(false)} />
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenSettings={() => { cap.openSettings(); }} />
      <SaveSummary visible={showSummary} saving={saving} outcomes={cap.outcomes} total={selected.length} onDone={() => setDismissed(cap.outcomes)} />
    </View>
  );
}
