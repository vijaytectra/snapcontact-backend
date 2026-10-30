import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { F, PressScale, tap, useInsets } from './ui';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const i = useInsets();
  const c = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }} testID="onboarding">
      <View style={{ flex: 1, maxWidth: 500, width: '100%', alignSelf: 'center' }}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: Math.max(i.top, 44) + 24,
            paddingHorizontal: 28,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(450)}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <Ionicons name="scan-outline" size={26} color="#FFFFFF" />
            </View>

            <Text
              accessibilityRole="header"
              style={{
                color: c.foreground,
                fontFamily: F.b,
                fontSize: 38,
                lineHeight: 44,
                letterSpacing: -1.2,
              }}
            >
              {S.welcome.title}
            </Text>

            <Text
              style={{
                color: c.mutedForeground,
                fontFamily: F.r,
                fontSize: 16,
                lineHeight: 24,
                marginTop: 14,
              }}
            >
              {S.welcome.body}
            </Text>
          </Animated.View>

          <View style={{ marginTop: 32, gap: 14 }}>
            {S.welcome.points.map(([icon, t, b], n) => (
              <Animated.View
                key={t}
                entering={FadeInDown.delay(160 + n * 110).duration(420)}
                style={{
                  flexDirection: 'row',
                  gap: 16,
                  alignItems: 'flex-start',
                  backgroundColor: c.card,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 18,
                }}
                accessible
                accessibilityLabel={`${t}. ${b}`}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: c.secondary,
                    borderWidth: 1,
                    borderColor: c.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  <Ionicons name={icon as any} size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: c.foreground, fontFamily: F.s, fontSize: 16 }}>{t}</Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: F.r, fontSize: 14, lineHeight: 20 }}>{b}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: 28, paddingBottom: Math.max(i.bottom, 16) + 16, paddingTop: 12 }}>
          <PrimaryOnDark label={S.welcome.cta} onPress={() => { tap('medium'); onDone(); }} />
        </View>
      </View>
    </View>
  );
}

function PrimaryOnDark({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressScale
      testID="get-started"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        backgroundColor: '#FFFFFF',
        minHeight: 56,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 24,
      }}
    >
      <Text style={{ color: '#080809', fontFamily: F.b, fontSize: 17, letterSpacing: -0.2 }}>{label}</Text>
      <Ionicons name="arrow-forward" size={19} color="#080809" />
    </PressScale>
  );
}
