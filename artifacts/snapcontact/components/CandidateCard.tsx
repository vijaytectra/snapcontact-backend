import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
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

function BlackActionPill({
  icon,
  label,
  onPress,
  disabled,
  id,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <PressScale
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={{
        height: 38,
        borderRadius: 999,
        backgroundColor: '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 16,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Ionicons name={icon} size={14} color="#FFFFFF" />
      <Text style={{ fontFamily: F.s, fontSize: 13, color: '#FFFFFF' }}>{label}</Text>
    </PressScale>
  );
}

export function CandidateCard({
  cand,
  index,
  total,
  onChange,
  onAction,
}: {
  cand: Cand;
  index: number;
  total?: number;
  onChange: (patch: {
    number?: string;
    name?: string;
    email?: string;
    website?: string;
    selected?: boolean;
  }) => void;
  onAction: (a: 'copy' | 'call' | 'whatsapp' | 'email' | 'website') => void;
}) {
  const bad = !cand.valid;

  const inputStyle = {
    fontFamily: F.r,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 46,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  } as const;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 60).duration(380)}
      testID={`candidate-${cand.id}`}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 18,
        gap: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Header Row: ✓ NUMBER N + Selection Checkbox */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#F1F5F9',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Checkbox
            testID={`select-${cand.id}`}
            checked={cand.selected}
            disabled={bad}
            onChange={(v) => onChange({ selected: v })}
            label={`Select contact ${index + 1}${cand.name ? ', ' + cand.name : ''}`}
          />
          <Text
            style={{
              fontFamily: F.b,
              fontSize: 14,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: '#0F172A',
            }}
          >
            {`NUMBER ${index + 1}`}
            {cand.extension ? `  ·  ${S.review.ext(cand.extension)}` : ''}
          </Text>
        </View>

        {total && total > 1 ? (
          <View
            style={{
              backgroundColor: '#F1F5F9',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontFamily: F.m, fontSize: 12, color: '#64748B' }}>
              {`${index + 1} of ${total}`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Field 1: Business Name */}
      <View style={{ gap: 5 }}>
        <Text
          style={{
            fontFamily: F.b,
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: '#64748B',
          }}
        >
          {S.review.name}
        </Text>
        <TextInput
          testID={`name-${cand.id}`}
          accessibilityLabel={`${S.review.name}, number ${index + 1}`}
          value={cand.name}
          onChangeText={(t) => onChange({ name: t })}
          placeholder={S.review.namePlaceholder}
          placeholderTextColor="#94A3B8"
          autoCapitalize="words"
          style={inputStyle}
        />
      </View>

      {/* Field 2: Phone Number */}
      <View style={{ gap: 5 }}>
        <Text
          style={{
            fontFamily: F.b,
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: '#64748B',
          }}
        >
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
          style={[
            inputStyle,
            {
              borderColor: bad ? '#EF4444' : '#E2E8F0',
              fontFamily: F.m,
            },
          ]}
        />

        {cand.countryLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Ionicons name="globe-outline" size={13} color="#64748B" />
            <Text
              testID={`country-${cand.id}`}
              accessibilityLiveRegion="polite"
              style={{ fontFamily: F.m, fontSize: 12, color: '#64748B' }}
            >
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
              backgroundColor: '#FEF2F2',
              borderWidth: 1,
              borderColor: '#FEE2E2',
              borderRadius: 10,
              padding: 9,
              marginTop: 2,
            }}
            accessibilityLiveRegion="polite"
          >
            <Ionicons name="alert-circle" size={15} color="#EF4444" />
            <Text
              testID={`error-${cand.id}`}
              style={{ flex: 1, fontFamily: F.m, fontSize: 12, color: '#EF4444' }}
            >
              {cand.message}
            </Text>
          </View>
        ) : cand.formatted ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
            <Text style={{ fontFamily: F.s, fontSize: 13, color: '#16A34A' }}>
              {cand.formatted}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Field 3: Email Address (Optional) */}
      <View style={{ gap: 5 }}>
        <Text
          style={{
            fontFamily: F.b,
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: '#64748B',
          }}
        >
          {`${S.review.email} (OPTIONAL)`}
        </Text>
        <TextInput
          testID={`email-${cand.id}`}
          accessibilityLabel={`${S.review.email}, number ${index + 1}`}
          value={cand.email ?? ''}
          onChangeText={(t) => onChange({ email: t })}
          placeholder="Email"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
      </View>

      {/* Field 4: Website */}
      <View style={{ gap: 5 }}>
        <Text
          style={{
            fontFamily: F.b,
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: '#64748B',
          }}
        >
          {S.review.website}
        </Text>
        <TextInput
          testID={`website-${cand.id}`}
          accessibilityLabel={`${S.review.website}, number ${index + 1}`}
          value={cand.website ?? ''}
          onChangeText={(t) => onChange({ website: t })}
          placeholder="Website"
          placeholderTextColor="#94A3B8"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
      </View>

      {/* Quick Action Pills: Copy, Call, WhatsApp */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
        <BlackActionPill
          id={`copy-${cand.id}`}
          icon="copy-outline"
          label={S.review.copy}
          onPress={() => onAction('copy')}
          disabled={!cand.number.trim() && !cand.email && !cand.website}
        />
        {cand.number ? (
          <BlackActionPill
            id={`call-${cand.id}`}
            icon="call-outline"
            label={S.review.call}
            onPress={() => onAction('call')}
            disabled={bad}
          />
        ) : null}
        {cand.number ? (
          <BlackActionPill
            id={`wa-${cand.id}`}
            icon="logo-whatsapp"
            label={S.review.whatsapp}
            onPress={() => onAction('whatsapp')}
            disabled={bad}
          />
        ) : null}
        {cand.email ? (
          <BlackActionPill
            id={`mail-${cand.id}`}
            icon="mail-outline"
            label={S.review.mail}
            onPress={() => onAction('email')}
          />
        ) : null}
        {cand.website ? (
          <BlackActionPill
            id={`web-${cand.id}`}
            icon="globe-outline"
            label={S.review.web}
            onPress={() => onAction('website')}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}
