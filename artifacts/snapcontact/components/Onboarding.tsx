import React from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { F, PressScale, tap, useInsets } from './ui';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const i = useInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Responsive layout scaling
  const isCompact = windowHeight < 720;
  const contentMaxWidth = Math.min(windowWidth, 480);

  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#091838',
      }}
      testID="onboarding"
    >
      {/* 1. Underlying Seamless Royal Blue Gradient */}
      <LinearGradient
        colors={['#1F4A89', '#143368', '#0D2146', '#081634']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Responsive Background Image: Contains full aspect ratio composition without cropping */}
      <Image
        source={require('@/assets/images/onboarding_bg.jpg')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
        resizeMode="contain"
        accessibilityLabel="SnapContact preview showing contact extraction, live scanner, and contact profile"
      />

      {/* 3. Header & Typography Section: Positioned relative near the top with safe area handling */}
      <Animated.View
        entering={FadeInDown.duration(450)}
        style={{
          position: 'relative',
          zIndex: 2,
          paddingTop: Math.max(i.top, 40),
          paddingHorizontal: 24,
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {/* App Logo & Title */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Ionicons name="scan-outline" size={19} color="#080809" />
          </View>
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: F.b,
              fontSize: 22,
              letterSpacing: -0.4,
            }}
          >
            SnapContact
          </Text>
        </View>

        {/* Main Headline with Sky Blue Accent */}
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: F.b,
            fontSize: isCompact ? 25 : 28,
            lineHeight: isCompact ? 30 : 34,
            letterSpacing: -0.8,
            marginBottom: 4,
          }}
        >
          <Text style={{ color: '#FFFFFF' }}>Your </Text>
          <Text style={{ color: '#38BDF8' }}>Screenshots{'\n'}</Text>
          <Text style={{ color: '#FFFFFF' }}>Organized</Text>
        </Text>

        {/* Supporting Subtitle */}
        <Text
          style={{
            color: '#CBD5E1',
            fontFamily: F.r,
            fontSize: isCompact ? 13.5 : 14.5,
            lineHeight: isCompact ? 18 : 20,
            letterSpacing: -0.2,
          }}
        >
          Turn saved numbers into contacts{'\n'}automatically.
        </Text>
      </Animated.View>

      {/* 4. Footer Section: Anchored near the bottom with safe area insets */}
      <Animated.View
        entering={FadeInDown.delay(350).duration(450)}
        style={{
          position: 'absolute',
          bottom: Math.max(i.bottom, 16) + (isCompact ? 4 : 8),
          left: 0,
          right: 0,
          zIndex: 3,
          paddingHorizontal: 24,
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
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
            minHeight: 50,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 28,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <Text
            style={{
              color: '#080809',
              fontFamily: F.b,
              fontSize: 16,
              letterSpacing: -0.2,
            }}
          >
            Get Started
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#080809" />
        </PressScale>

        {/* Subtle Home Indicator Bar */}
        <View
          style={{
            width: 112,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#FFFFFF',
            opacity: 0.75,
            alignSelf: 'center',
            marginTop: 14,
          }}
        />
      </Animated.View>
    </View>
  );
}
