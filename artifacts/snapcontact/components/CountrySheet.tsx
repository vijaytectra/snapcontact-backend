import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CountryCode } from 'libphonenumber-js/max';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { F, IconButton, tap, useInsets } from './ui';

type Opt = { code: CountryCode; name: string; callingCode: string };

export function CountrySheet({ visible, countries, value, onSelect, onClose }: { visible: boolean; countries: Opt[]; value: CountryCode; onSelect: (c: CountryCode) => void; onClose: () => void }) {
  const c = useColors();
  const i = useInsets();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^\+/, '');
    if (!t) return countries;
    return countries.filter((o) => o.name.toLowerCase().includes(t) || o.code.toLowerCase() === t || o.callingCode.replace('+', '').startsWith(t));
  }, [q, countries]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: Math.max(i.top, 44) + 12 }} testID="country-sheet">
        <View style={{ flex: 1, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 24,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <View style={{ gap: 2 }}>
              <Text accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 24, color: c.foreground, letterSpacing: -0.5 }}>
                {S.country.title}
              </Text>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                Select national dialing code
              </Text>
            </View>
            <IconButton icon="close" label={S.country.close} onPress={onClose} testID="country-close" size={38} />
          </View>

          <View
            style={{
              marginHorizontal: 20,
              marginTop: 14,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: 14,
              minHeight: 50,
            }}
          >
            <Ionicons name="search" size={18} color="#A1A1AA" />
            <TextInput
              testID="country-search"
              accessibilityLabel={S.country.search}
              placeholder={S.country.search}
              placeholderTextColor="#71717A"
              value={q}
              onChangeText={setQ}
              autoCorrect={false}
              style={{ flex: 1, marginLeft: 10, fontFamily: F.r, fontSize: 15, color: c.foreground, minHeight: 46 }}
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color="#71717A" />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={list}
            keyExtractor={(o) => o.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(i.bottom, 16) + 24 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: c.mutedForeground, fontFamily: F.r, fontSize: 15, padding: 40 }}>
                {S.country.none}
              </Text>
            }
            renderItem={({ item }) => {
              const on = item.code === value;
              return (
                <Pressable
                  testID={`country-${item.code}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.callingCode}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => { tap(); onSelect(item.code); setQ(''); onClose(); }}
                  style={{
                    minHeight: 56,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginVertical: 2,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: on ? c.card : 'transparent',
                    borderWidth: on ? 1 : 0,
                    borderColor: on ? c.border : 'transparent',
                  }}
                >
                  <Text style={{ flex: 1, fontFamily: on ? F.s : F.r, fontSize: 16, color: c.foreground }}>
                    {item.name}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: c.secondary,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <Text style={{ fontFamily: F.m, fontSize: 13, color: on ? '#FFFFFF' : c.mutedForeground }}>
                      {item.callingCode.startsWith('+') ? item.callingCode : '+' + item.callingCode}
                    </Text>
                  </View>
                  {on ? (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="checkmark-sharp" size={15} color="#080809" />
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
