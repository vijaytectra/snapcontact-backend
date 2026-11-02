import React from 'react';
import { View, Text, Image, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { F, PressScale, tap, useInsets } from './ui';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const i = useInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Responsive layout scaling
  const isCompact = windowHeight < 720;
  const contentMaxWidth = Math.min(windowWidth, 480);

  return (
    <View style={{ flex: 1, backgroundColor: '#091838' }} testID="onboarding">
      <LinearGradient
        colors={['#1F4A89', '#143368', '#0D2146', '#081634']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            width: '100%',
            paddingTop: Math.max(i.top, 44) + (isCompact ? 8 : 16),
            paddingBottom: Math.max(i.bottom, 20) + 12,
            justifyContent: 'space-between',
          }}
        >
          {/* Header & Typography Section */}
          <Animated.View
            entering={FadeInDown.duration(450)}
            style={{
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
                gap: 12,
                marginBottom: isCompact ? 14 : 22,
              }}
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
                  elevation: 2,
                }}
              >
                <Ionicons name="scan-outline" size={20} color="#080809" />
              </View>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontFamily: F.b,
                  fontSize: 24,
                  letterSpacing: -0.5,
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
                fontSize: isCompact ? 28 : 34,
                lineHeight: isCompact ? 34 : 40,
                letterSpacing: -1,
                marginBottom: 10,
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
                fontSize: 16,
                lineHeight: 23,
                letterSpacing: -0.2,
              }}
            >
              Turn saved numbers into contacts{'\n'}automatically.
            </Text>
          </Animated.View>

          {/* Hero 3D Mockup Visual - Edge to edge, utilizing full width and side areas! */}
          <Animated.View
            entering={FadeIn.delay(200).duration(600)}
            style={{
              flex: 1,
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              marginVertical: isCompact ? 4 : 10,
            }}
          >
            <Image
              source={require('@/assets/images/onboarding_phones.png')}
              style={{
                width: '100%',
                height: '100%',
              }}
              resizeMode="cover"
              accessibilityLabel="SnapContact preview showing contact extraction, live scanner, and contact profile"
            />
          </Animated.View>

          {/* Bottom CTA Button & Home Indicator */}
          <Animated.View
            entering={FadeInDown.delay(350).duration(450)}
            style={{
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
                minHeight: 52,
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
                marginTop: 18,
              }}
            />
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}
