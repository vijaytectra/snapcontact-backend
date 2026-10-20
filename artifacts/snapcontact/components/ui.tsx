import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export const F = { r: 'Inter_400Regular', m: 'Inter_500Medium', s: 'Inter_600SemiBold', b: 'Inter_700Bold' };

export function useInsets() {
  const i = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  return { top: web ? Math.max(i.top, 67) : i.top, bottom: web ? Math.max(i.bottom, 34) : i.bottom };
}

export const tap = (style: 'light' | 'medium' | 'success' | 'warning' = 'light') => {
  try {
    if (style === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (style === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {}
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function PressScale({ children, style, onPress, disabled, ...rest }: React.ComponentProps<typeof Pressable> & { style?: ViewStyle | ViewStyle[] }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => (s.value = withTiming(0.97, { duration: 90 }))}
      onPressOut={() => (s.value = withTiming(1, { duration: 140 }))}
    >
      <Animated.View style={[a, style as any]}>{children as React.ReactNode}</Animated.View>
    </Pressable>
  );
}

export function Button({ label, onPress, icon, variant = 'primary', disabled, loading, testID, hint, compact }: {
  label: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean; loading?: boolean; testID?: string; hint?: string; compact?: boolean;
}) {
  const c = useColors();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.destructive : variant === 'secondary' ? c.secondary : 'transparent';
  const fg = variant === 'primary' ? c.primaryForeground : variant === 'danger' ? c.destructiveForeground : variant === 'ghost' ? c.mutedForeground : c.secondaryForeground;
  return (
    <PressScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => { tap(); onPress(); }}
      style={{ backgroundColor: bg, minHeight: compact ? 44 : 56, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: disabled ? 0.45 : 1 }}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
      <Text style={{ color: fg, fontFamily: F.s, fontSize: 16, flexShrink: 1, textAlign: 'center' }}>{label}</Text>
    </PressScale>
  );
}

export function IconButton({ icon, label, onPress, testID, disabled, color }: { icon: IconName; label: string; onPress: () => void; testID?: string; disabled?: boolean; color?: string }) {
  const c = useColors();
  return (
    <PressScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => { tap(); onPress(); }}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <Ionicons name={icon} size={24} color={color ?? c.foreground} />
    </PressScale>
  );
}

export function Checkbox({ checked, onChange, label, testID }: { checked: boolean; onChange: (v: boolean) => void; label: string; testID?: string }) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => { tap(); onChange(!checked); }}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: 26, height: 26, borderRadius: 9, borderWidth: 2, borderColor: checked ? c.primary : c.border, backgroundColor: checked ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked ? <Ionicons name="checkmark" size={18} color={c.primaryForeground} /> : null}
      </View>
    </Pressable>
  );
}

export function Banner({ kind, text, onDismiss, action, testID }: { kind: 'error' | 'notice'; text: string; onDismiss?: () => void; action?: { label: string; onPress: () => void }; testID?: string }) {
  const c = useColors();
  const err = kind === 'error';
  return (
    <View testID={testID} accessibilityRole={err ? 'alert' : undefined} accessibilityLiveRegion="polite"
      style={{ backgroundColor: err ? c.destructive + '1A' : c.accent + '26', borderColor: err ? c.destructive : c.accent, borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Ionicons name={err ? 'alert-circle' : 'information-circle'} size={22} color={err ? c.destructive : c.foreground} />
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ color: c.foreground, fontFamily: F.m, fontSize: 15, lineHeight: 21 }}>{text}</Text>
        {action ? (
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={() => { tap(); action.onPress(); }} style={{ minHeight: 44, justifyContent: 'center' }} testID={testID ? testID + '-action' : undefined}>
            <Text style={{ color: c.primary, fontFamily: F.b, fontSize: 15 }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? <IconButton icon="close" label="Dismiss message" onPress={onDismiss} testID={testID ? testID + '-dismiss' : undefined} /> : null}
    </View>
  );
}

export function Skeleton({ h, w }: { h: number; w?: number | string }) {
  const c = useColors();
  const o = useSharedValue(0.5);
  React.useEffect(() => {
    o.value = withTiming(1, { duration: 900 });
    const t = setInterval(() => { o.value = withTiming(o.value > 0.7 ? 0.5 : 1, { duration: 900 }); }, 900);
    return () => clearInterval(t);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height: h, width: (w ?? '100%') as any, borderRadius: 14, backgroundColor: c.muted }, a]} />;
}

export const sh = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' } });
