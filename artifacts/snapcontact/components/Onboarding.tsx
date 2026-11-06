import React from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { F, PressScale, tap, useInsets } from './ui';

// The background artwork is a 390x844 composition; its phones start at y=258.
const ART_W = 390;
const ART_H = 844;
const ART_PHONES_TOP = 258;
// Fallback height of the logo + headline + subtitle block at scale 1, used until it is measured.
const TEXT_BLOCK_H = 186;
// Narrowest the text column should get, so headlines do not wrap one word per line (landscape).
const MIN_TEXT_W = 300;
// Users' larger system fonts are honoured, but capped so the fixed-scale layout does not break.
const MAX_FONT_SCALE = 1.25;
const BG = '#061738';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const i = useInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [measuredTextH, setMeasuredTextH] = React.useState<number | null>(null);

  // The artwork always fills the screen height, so it scales with height.
  // On taller-than-design screens it is cropped at the sides; on wider ones it
  // sits in a centered column and the sides get a blurred fill.
  const k = windowHeight / ART_H;
  const artWidth = ART_W * k;
  const boxWidth = Math.min(windowWidth, artWidth);
  // Scale floor lowered so short (landscape) screens shrink the content instead of overflowing.
  const s = Math.max(0.55, Math.min(1, k, windowWidth / ART_W));
  const letterboxed = artWidth < windowWidth - 1;
  // Text column: the artwork column, but never narrower than MIN_TEXT_W (or the screen).
  const textW = Math.min(windowWidth - 32, Math.max(boxWidth, MIN_TEXT_W));

  // Keep the text clear of the phones, even when the top inset is large. Uses the measured
  // height, so wrapped text (landscape, large fonts) is accounted for.
  const textBlockH = measuredTextH ?? TEXT_BLOCK_H * s;
  const textTop = Math.max(16, Math.min(i.top, ART_PHONES_TOP * k - textBlockH - 12));
  const entering = (delay: number, duration: number) =>
    reduceMotion ? undefined : FadeInDown.delay(delay).duration(duration);

  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: BG,
      }}
      testID="onboarding"
    >
      {/* 1. Side fill for wide screens: the same artwork, blurred and dimmed */}
      {letterboxed ? (
        <>
          <Image
            source={require('@/assets/images/onboarding_bg.jpg')}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={40}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3, 14, 37, 0.55)' }]} />
        </>
      ) : null}

      {/* 2. Artwork at its native proportions, full screen height */}
      <Image
        source={require('@/assets/images/onboarding_bg.jpg')}
        style={{
          position: 'absolute',
          top: 0,
          height: windowHeight,
          width: artWidth,
          left: (windowWidth - artWidth) / 2,
        }}
        resizeMode="cover"
        accessibilityLabel="SnapContact preview showing contact extraction, live scanner, and contact profile"
      />

      {/* Soften the artwork's left and right edges into the side fill */}
      {letterboxed ? (
        <>
          <LinearGradient
            colors={[BG, 'rgba(6, 23, 56, 0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, bottom: 0, width: 48, left: (windowWidth - artWidth) / 2 }}
          />
          <LinearGradient
            colors={['rgba(6, 23, 56, 0)', BG]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, bottom: 0, width: 48, right: (windowWidth - artWidth) / 2 }}
          />
        </>
      ) : null}

      {/* 3. Header & Typography, in the same column as the artwork */}
      <Animated.View
        entering={entering(0, 450)}
        onLayout={e => {
          const h = Math.round(e.nativeEvent.layout.height);
          if (h !== measuredTextH) setMeasuredTextH(h);
        }}
        style={{
          position: 'absolute',
          zIndex: 2,
          top: textTop,
          width: textW,
          left: (windowWidth - textW) / 2,
          paddingHorizontal: 24 * s,
        }}
      >
        {/* App Logo & Title */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10 * s,
            marginBottom: 28 * s,
          }}
        >
          <View
            style={{
              width: 34 * s,
              height: 34 * s,
              borderRadius: 9 * s,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="scan-outline" size={20 * s} color="#080809" />
          </View>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={{
              color: '#FFFFFF',
              fontFamily: F.s,
              fontSize: 22 * s,
              letterSpacing: -0.4,
            }}
          >
            SnapContact
          </Text>
        </View>

        {/* Main Headline with Sky Blue Accent */}
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={{
            fontFamily: F.b,
            fontSize: 30 * s,
            lineHeight: 36 * s,
            letterSpacing: -0.8 * s,
            marginBottom: 6 * s,
          }}
        >
          <Text style={{ color: '#FFFFFF' }}>Your </Text>
          <Text style={{ color: '#38BDF8' }}>Screenshots{'\n'}</Text>
          <Text style={{ color: '#FFFFFF' }}>Organized</Text>
        </Text>

        {/* Supporting Subtitle */}
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={{
            color: '#E2E8F0',
            fontFamily: F.r,
            fontSize: 16 * s,
            lineHeight: 23 * s,
            letterSpacing: -0.2,
          }}
        >
          Turn saved numbers into contacts{'\n'}automatically.
        </Text>
      </Animated.View>

      {/* 4. Footer: Get Started, anchored near the bottom of the same column */}
      <Animated.View
        entering={entering(350, 450)}
        style={{
          position: 'absolute',
          zIndex: 3,
          bottom: Math.max(i.bottom, 16) + 18 * s,
          width: boxWidth,
          left: (windowWidth - boxWidth) / 2,
          paddingHorizontal: 20 * s,
        }}
      >
        <PressScale
          testID="get-started"
          accessibilityRole="button"
          accessibilityLabel="Get Started"
          onPress={() => {
            tap('medium');
            onDone();
          }}
          style={{
            backgroundColor: '#FFFFFF',
            minHeight: Math.max(44, 52 * s),
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingHorizontal: 28,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={{
              color: '#111111',
              fontFamily: F.m,
              fontSize: 15,
              letterSpacing: -0.1,
            }}
          >
            Get Started
          </Text>
          <Ionicons name="arrow-forward" size={Math.round(12 * s)} color="#111111" />
        </PressScale>
      </Animated.View>
    </View>
  );
}
