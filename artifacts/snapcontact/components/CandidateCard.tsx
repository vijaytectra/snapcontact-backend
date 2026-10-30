import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { Checkbox, F, PressScale, tap } from './ui';

export type Cand = {
  id: string;
  raw: string;
  number: string;
  name: string;
  email?: string;
  website?: string;
  selected: boolean;
  valid: boolean;
  formatted: string;
  message: string;
  extension?: string;
  countryLabel?: string;
};

function Act({ icon, label, onPress, disabled, id }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; disabled?: boolean; id: string }) {
  const c = useColors();
  return (
    <PressScale
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => { tap(); onPress(); }}
      style={{
        minHeight: 42,
        flex: 1,
        minWidth: 68,
        borderRadius: 12,
        backgroundColor: c.secondary,
        borderWidth: 1,
        borderColor: c.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: disabled ? 0.35 : 1,
        paddingHorizontal: 8,
      }}
    >
      <Ionicons name={icon} size={15} color="#FFFFFF" />
      <Text numberOfLines={1} style={{ fontFamily: F.m, fontSize: 13, color: c.foreground }}>
        {label}
      </Text>
    </PressScale>
  );
}

export function CandidateCard({ cand, index, total, onChange, onAction }: {
  cand: Cand; index: number; total?: number;
  onChange: (patch: { number?: string; name?: string; email?: string; website?: string; selected?: boolean }) => void;
  onAction: (a: 'copy' | 'call' | 'whatsapp' | 'email' | 'website') => void;
}) {
  const c = useColors();
  const bad = !cand.valid;
  const inputStyle = {
    fontFamily: F.r,
    fontSize: 15,
    color: c.foreground,
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: c.secondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
  } as const;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 60).duration(380)}
      testID={`candidate-${cand.id}`}
      style={{
        backgroundColor: c.card,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: cand.selected ? '#FFFFFF' : c.border,
        padding: 20,
        gap: 14,
      }}
    >
      {/* Card Header Row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Checkbox
            testID={`select-${cand.id}`}
            checked={cand.selected}
            disabled={bad}
            onChange={(v) => onChange({ selected: v })}
            label={`Select contact ${index + 1}${cand.name ? ', ' + cand.name : ''}`}
          />
          <Text style={{ fontFamily: F.b, fontSize: 16, color: c.foreground }}>
            {`Contact ${index + 1}`}{cand.extension ? `  ·  ${S.review.ext(cand.extension)}` : ''}
          </Text>
        </View>
        {total && total > 1 ? (
          <View
            style={{
              backgroundColor: c.secondary,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ fontFamily: F.s, fontSize: 12, color: c.mutedForeground }}>{`${index + 1} of ${total}`}</Text>
          </View>
        ) : null}
      </View>

      {/* Business Name Field */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
          {S.review.name}
        </Text>
        <TextInput
          testID={`name-${cand.id}`}
          accessibilityLabel={`${S.review.name}, number ${index + 1}`}
          value={cand.name}
          onChangeText={(t) => onChange({ name: t })}
          placeholder={S.review.namePlaceholder}
          placeholderTextColor="#71717A"
          autoCapitalize="words"
          style={inputStyle}
        />
      </View>

      {/* Phone Number Field */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
          {S.review.number}
        </Text>
        <TextInput
          testID={`number-${cand.id}`}
          accessibilityLabel={`${S.review.number}, number ${index + 1}`}
          accessibilityHint={bad ? cand.message : undefined}
          value={cand.number}
          onChangeText={(t) => onChange({ number: t })}
          keyboardType="phone-pad"
          autoCorrect={false}
          style={[inputStyle, { borderColor: bad ? c.destructive : c.border, fontFamily: F.m }]}
        />

        {cand.countryLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Ionicons name="globe-outline" size={14} color="#A1A1AA" />
            <Text testID={`country-${cand.id}`} accessibilityLiveRegion="polite" style={{ fontFamily: F.m, fontSize: 13, color: c.mutedForeground }}>
              {cand.countryLabel}
            </Text>
          </View>
        ) : null}

        {bad ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.28)',
              borderRadius: 12,
              padding: 10,
              marginTop: 2,
            }}
            accessibilityLiveRegion="polite"
          >
            <Ionicons name="alert-circle" size={16} color={c.destructive} />
            <Text testID={`error-${cand.id}`} style={{ flex: 1, fontFamily: F.m, fontSize: 13, color: c.destructive }}>
              {cand.message}
            </Text>
          </View>
        ) : cand.formatted ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
            <Text style={{ fontFamily: F.s, fontSize: 14, color: c.foreground }}>
              {cand.formatted}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Email Field */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
          {S.review.email}
        </Text>
        <TextInput
          testID={`email-${cand.id}`}
          accessibilityLabel={`${S.review.email}, number ${index + 1}`}
          value={cand.email ?? ''}
          onChangeText={(t) => onChange({ email: t })}
          placeholder={S.review.emailPlaceholder}
          placeholderTextColor="#71717A"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
      </View>

      {/* Website Field */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: F.s, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#71717A' }}>
          {S.review.website}
        </Text>
        <TextInput
          testID={`website-${cand.id}`}
          accessibilityLabel={`${S.review.website}, number ${index + 1}`}
          value={cand.website ?? ''}
          onChangeText={(t) => onChange({ website: t })}
          placeholder={S.review.websitePlaceholder}
          placeholderTextColor="#71717A"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
      </View>

      {/* Actions Row */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>
        <Act id={`copy-${cand.id}`} icon="copy-outline" label={S.review.copy} onPress={() => onAction('copy')} disabled={!cand.number.trim() && !cand.email && !cand.website} />
        {cand.number ? <Act id={`call-${cand.id}`} icon="call-outline" label={S.review.call} onPress={() => onAction('call')} disabled={bad} /> : null}
        {cand.number ? <Act id={`wa-${cand.id}`} icon="logo-whatsapp" label={S.review.whatsapp} onPress={() => onAction('whatsapp')} disabled={bad} /> : null}
        {cand.email ? <Act id={`mail-${cand.id}`} icon="mail-outline" label={S.review.mail} onPress={() => onAction('email')} /> : null}
        {cand.website ? <Act id={`web-${cand.id}`} icon="globe-outline" label={S.review.web} onPress={() => onAction('website')} /> : null}
      </View>
    </Animated.View>
  );
}

