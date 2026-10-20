import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { F, PressScale, tap, useInsets } from './ui';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const c = useColors();
  const i = useInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.primary }} testID="onboarding">
      <ScrollView contentContainerStyle={{ paddingTop: i.top + 40, paddingHorizontal: 28, paddingBottom: 24, flexGrow: 1 }}>
        <Animated.View entering={FadeInDown.duration(500)}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
            <Ionicons name="scan-outline" size={28} color={c.accentForeground} />
          </View>
          <Text accessibilityRole="header" style={{ color: c.primaryForeground, fontFamily: F.b, fontSize: 40, lineHeight: 46, letterSpacing: -1 }}>{S.welcome.title}</Text>
          <Text style={{ color: c.primaryForeground, opacity: 0.8, fontFamily: F.r, fontSize: 17, lineHeight: 25, marginTop: 16 }}>{S.welcome.body}</Text>
        </Animated.View>
        <View style={{ marginTop: 36, gap: 22 }}>
          {S.welcome.points.map(([icon, t, b], n) => (
            <Animated.View key={t} entering={FadeInDown.delay(200 + n * 120).duration(450)} style={{ flexDirection: 'row', gap: 16 }} accessible accessibilityLabel={`${t}. ${b}`}>
              <Ionicons name={icon as any} size={24} color={c.accent} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.primaryForeground, fontFamily: F.s, fontSize: 17 }}>{t}</Text>
                <Text style={{ color: c.primaryForeground, opacity: 0.7, fontFamily: F.r, fontSize: 15, lineHeight: 21 }}>{b}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
      <View style={{ padding: 24, paddingBottom: i.bottom + 20 }}>
        <PrimaryOnDark label={S.welcome.cta} onPress={() => { tap('medium'); onDone(); }} />
      </View>
    </View>
  );
}

function PrimaryOnDark({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <PressScale testID="get-started" accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ backgroundColor: c.accent, minHeight: 58, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22 }}>
      <Text style={{ color: c.accentForeground, fontFamily: F.b, fontSize: 17 }}>{label}</Text>
      <Ionicons name="arrow-forward" size={20} color={c.accentForeground} />
    </PressScale>
  );
}
