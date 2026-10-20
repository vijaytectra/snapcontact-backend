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
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 12 }} testID="country-sheet">
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 24, paddingRight: 8 }}>
          <Text accessibilityRole="header" style={{ flex: 1, fontFamily: F.b, fontSize: 22, color: c.foreground }}>{S.country.title}</Text>
          <IconButton icon="close" label={S.country.close} onPress={onClose} testID="country-close" />
        </View>
        <View style={{ margin: 20, marginTop: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, minHeight: 52 }}>
          <Ionicons name="search" size={20} color={c.mutedForeground} />
          <TextInput testID="country-search" accessibilityLabel={S.country.search} placeholder={S.country.search} placeholderTextColor={c.mutedForeground} value={q} onChangeText={setQ} autoCorrect={false} style={{ flex: 1, marginLeft: 10, fontFamily: F.r, fontSize: 16, color: c.foreground, minHeight: 48 }} />
        </View>
        <FlatList
          data={list}
          keyExtractor={(o) => o.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: i.bottom + 20 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: c.mutedForeground, fontFamily: F.r, fontSize: 16, padding: 32 }}>{S.country.none}</Text>}
          renderItem={({ item }) => {
            const on = item.code === value;
            return (
              <Pressable testID={`country-${item.code}`} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.callingCode}`} accessibilityState={{ selected: on }}
                onPress={() => { tap(); onSelect(item.code); setQ(''); onClose(); }}
                style={{ minHeight: 56, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? c.muted : 'transparent' }}>
                <Text style={{ flex: 1, fontFamily: on ? F.s : F.r, fontSize: 16, color: c.foreground }}>{item.name}</Text>
                <Text style={{ fontFamily: F.m, fontSize: 15, color: c.mutedForeground }}>{item.callingCode.startsWith('+') ? item.callingCode : '+' + item.callingCode}</Text>
                {on ? <Ionicons name="checkmark" size={20} color={c.primary} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
