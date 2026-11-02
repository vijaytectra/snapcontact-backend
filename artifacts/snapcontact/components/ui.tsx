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
  return {
    top: web ? Math.max(i.top, 67) : Math.max(i.top, 44),
    bottom: web ? Math.max(i.bottom, 34) : Math.max(i.bottom, 16),
  };
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
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';

  const bg = disabled && isPrimary
    ? '#1C1C20'
    : isPrimary
    ? '#FFFFFF'
    : isDanger
    ? 'rgba(239, 68, 68, 0.14)'
    : isSecondary
    ? c.secondary
    : 'transparent';

  const fg = disabled && isPrimary
    ? '#71717A'
    : isPrimary
    ? '#080809'
    : isDanger
    ? '#EF4444'
    : isSecondary
    ? '#F8F8FA'
    : '#A1A1AA';

  const border = disabled && isPrimary
    ? c.border
    : isPrimary
    ? 'transparent'
    : isDanger
    ? 'rgba(239, 68, 68, 0.28)'
    : isSecondary
    ? c.border
    : 'transparent';

  return (
    <PressScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => { tap(); onPress(); }}
      style={{
        backgroundColor: bg,
        minHeight: compact ? 42 : 54,
        borderRadius: 999,
        borderWidth: border !== 'transparent' ? 1 : 0,
        borderColor: border,
        paddingHorizontal: compact ? 16 : 24,
        paddingVertical: compact ? 10 : 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        opacity: disabled && !isPrimary ? 0.4 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={compact ? 18 : 20} color={fg} />
      ) : null}
      <Text style={{ color: fg, fontFamily: isPrimary ? F.b : F.s, fontSize: compact ? 14 : 16, letterSpacing: -0.2, textAlign: 'center' }}>
        {label}
      </Text>
    </PressScale>
  );
}

export function IconButton({ icon, label, onPress, testID, disabled, color, size = 44 }: {
  icon: IconName; label: string; onPress: () => void; testID?: string; disabled?: boolean; color?: string; size?: number;
}) {
  const c = useColors();
  return (
    <PressScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => { tap(); onPress(); }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.secondary,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color ?? c.foreground} />
    </PressScale>
  );
}

export function Checkbox({ checked, onChange, label, testID, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; testID?: string; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => { tap(); onChange(!checked); }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      hitSlop={6}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 1.5,
          borderColor: checked ? '#FFFFFF' : c.border,
          backgroundColor: checked ? '#FFFFFF' : c.secondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Ionicons name="checkmark-sharp" size={16} color="#080809" /> : null}
      </View>
    </Pressable>
  );
}

// Light-surface square checkbox used by the review and contacts list screens.
export function LightCheckbox({ checked, onChange, label, testID, disabled = false, size = 22 }: { checked: boolean; onChange: (v: boolean) => void; label: string; testID?: string; disabled?: boolean; size?: number }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => { tap(); onChange(!checked); }}
      style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
      hitSlop={6}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: checked ? '#6B7280' : '#BFC5CE',
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Ionicons name="checkmark" size={size - 6} color="#111111" /> : null}
      </View>
    </Pressable>
  );
}

export function Banner({ kind, text, onDismiss, action, testID }: { kind: 'error' | 'notice'; text: string; onDismiss?: () => void; action?: { label: string; onPress: () => void }; testID?: string }) {
  const c = useColors();
  const err = kind === 'error';
  return (
    <View
      testID={testID}
      accessibilityRole={err ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: err ? 'rgba(239, 68, 68, 0.12)' : c.card,
        borderColor: err ? 'rgba(239, 68, 68, 0.28)' : c.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 15,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <Ionicons name={err ? 'alert-circle' : 'information-circle'} size={22} color={err ? c.destructive : '#A1A1AA'} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: c.foreground, fontFamily: F.m, fontSize: 14, lineHeight: 20 }}>{text}</Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => { tap(); action.onPress(); }}
            style={{ minHeight: 36, justifyContent: 'center' }}
            testID={testID ? testID + '-action' : undefined}
          >
            <Text style={{ color: '#FFFFFF', fontFamily: F.b, fontSize: 14, textDecorationLine: 'underline' }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? <IconButton icon="close" label="Dismiss message" onPress={onDismiss} testID={testID ? testID + '-dismiss' : undefined} size={32} /> : null}
    </View>
  );
}

export function Skeleton({ h, w }: { h: number; w?: number | string }) {
  const c = useColors();
  const o = useSharedValue(0.4);
  React.useEffect(() => {
    o.value = withTiming(0.85, { duration: 800 });
    const t = setInterval(() => { o.value = withTiming(o.value > 0.6 ? 0.35 : 0.85, { duration: 800 }); }, 800);
    return () => clearInterval(t);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height: h, width: (w ?? '100%') as any, borderRadius: 16, backgroundColor: c.secondary }, a]} />;
}

export const sh = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' } });
