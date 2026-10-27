import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { Checkbox, F, PressScale, tap } from './ui';

export type Cand = { id: string; raw: string; number: string; name: string; selected: boolean; valid: boolean; formatted: string; message: string; extension?: string; countryLabel?: string };

function Act({ icon, label, onPress, disabled, id }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; disabled?: boolean; id: string }) {
  const c = useColors();
  return (
    <PressScale testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled}
      onPress={() => { tap(); onPress(); }}
      style={{ minHeight: 44, flex: 1, borderRadius: 12, backgroundColor: c.muted, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: disabled ? 0.4 : 1, paddingHorizontal: 6 }}>
      <Ionicons name={icon} size={18} color={c.foreground} />
      <Text numberOfLines={1} style={{ fontFamily: F.m, fontSize: 14, color: c.foreground }}>{label}</Text>
    </PressScale>
  );
}

export function CandidateCard({ cand, index, onChange, onAction }: {
  cand: Cand; index: number;
  onChange: (patch: { number?: string; name?: string; selected?: boolean }) => void;
  onAction: (a: 'copy' | 'call' | 'whatsapp') => void;
}) {
  const c = useColors();
  const bad = !cand.valid;
  const input = { fontFamily: F.r, fontSize: 17, color: c.foreground, minHeight: 48, paddingHorizontal: 14, backgroundColor: c.background, borderRadius: 12, borderWidth: 1 } as const;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 70).duration(380)} testID={`candidate-${cand.id}`}
      style={{ backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: cand.selected ? c.primary : c.border, padding: 14, paddingTop: 6, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Checkbox testID={`select-${cand.id}`} checked={cand.selected} disabled={bad} onChange={(v) => onChange({ selected: v })} label={`Select number ${index + 1}${cand.name ? ', ' + cand.name : ''}`} />
        <Text style={{ flex: 1, fontFamily: F.s, fontSize: 13, letterSpacing: 0.6, color: c.mutedForeground, textTransform: 'uppercase' }}>
          {`Number ${index + 1}`}{cand.extension ? `  ·  ${S.review.ext(cand.extension)}` : ''}
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: F.m, fontSize: 13, color: c.mutedForeground }}>{S.review.name}</Text>
        <TextInput testID={`name-${cand.id}`} accessibilityLabel={`${S.review.name}, number ${index + 1}`} value={cand.name} onChangeText={(t) => onChange({ name: t })} placeholder={S.review.namePlaceholder} placeholderTextColor={c.mutedForeground} autoCapitalize="words" style={[input, { borderColor: c.border }]} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: F.m, fontSize: 13, color: c.mutedForeground }}>{S.review.number}</Text>
        <TextInput testID={`number-${cand.id}`} accessibilityLabel={`${S.review.number}, number ${index + 1}`} accessibilityHint={bad ? cand.message : undefined} value={cand.number} onChangeText={(t) => onChange({ number: t })} keyboardType="phone-pad" autoCorrect={false} style={[input, { borderColor: bad ? c.destructive : c.border, fontFamily: F.m }]} />
        {cand.countryLabel ? (
          <Text testID={`country-${cand.id}`} accessibilityLiveRegion="polite" style={{ fontFamily: F.m, fontSize: 13, color: c.mutedForeground }}>{cand.countryLabel}</Text>
        ) : null}
        {bad ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={16} color={c.destructive} />
            <Text testID={`error-${cand.id}`} style={{ flex: 1, fontFamily: F.m, fontSize: 14, color: c.destructive }}>{cand.message}</Text>
          </View>
        ) : cand.formatted ? (
          <Text style={{ fontFamily: F.s, fontSize: 14, color: c.primary }}>{cand.formatted}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Act id={`copy-${cand.id}`} icon="copy-outline" label={S.review.copy} onPress={() => onAction('copy')} disabled={!cand.number.trim()} />
        <Act id={`call-${cand.id}`} icon="call-outline" label={S.review.call} onPress={() => onAction('call')} disabled={bad} />
        <Act id={`wa-${cand.id}`} icon="logo-whatsapp" label={S.review.whatsapp} onPress={() => onAction('whatsapp')} disabled={bad} />
      </View>
    </Animated.View>
  );
}
