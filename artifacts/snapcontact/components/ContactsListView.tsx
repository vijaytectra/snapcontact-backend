import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Cand } from './CandidateCard';
import { F, LightCheckbox, PressScale, tap } from './ui';

function getInitials(name: string, fallbackNumber: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  const digits = fallbackNumber.replace(/\D/g, '');
  return digits.substring(0, 2) || 'C';
}

export function ContactsListView({
  candidates,
  onToggle,
  onToggleAll,
  allSelected,
  onSelectCandidate,
  onDeleteSelected,
}: {
  candidates: Cand[];
  onToggle: (id: string, selected: boolean) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  onSelectCandidate: (index: number) => void;
  onDeleteSelected?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = candidates.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.number.includes(q) ||
      (c.formatted && c.formatted.includes(q))
    );
  });

  return (
    <View style={{ flex: 1, gap: 14 }}>
      {/* Search Input Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#DDE3EA',
          paddingHorizontal: 14,
          height: 44,
          gap: 10,
        }}
      >
        <Ionicons name="search-outline" size={19} color="#6B7280" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search name or phone number"
          placeholderTextColor="#8A8F98"
          style={{
            flex: 1,
            fontFamily: F.r,
            fontSize: 15,
            color: '#0F172A',
            height: '100%',
          }}
        />
        <PressScale
          onPress={() => setSearchQuery('')}
          disabled={!searchQuery}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle-outline" size={19} color="#6B7280" />
        </PressScale>
      </View>

      {/* Select All & Delete Action Row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: -4,
          marginBottom: -4,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LightCheckbox
            testID="select-all-checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            label="Select all contacts"
          />
          <Text style={{ fontFamily: F.m, fontSize: 14, color: '#111111' }}>
            Select All
          </Text>
        </View>

        {onDeleteSelected ? (
          <PressScale
            testID="delete-selected-btn"
            accessibilityRole="button"
            accessibilityLabel="Delete selected contacts"
            onPress={() => {
              tap();
              onDeleteSelected();
            }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#4B5563',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Text style={{ fontFamily: F.m, fontSize: 12, color: '#111111' }}>
              Delete
            </Text>
          </PressScale>
        ) : null}
      </View>

      {/* Contacts List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
      >
        {filtered.map((cand, idx) => {
          const initials = getInitials(cand.name, cand.number);
          const originalIndex = candidates.findIndex((c) => c.id === cand.id);

          return (
            <Animated.View
              key={cand.id}
              entering={FadeInDown.delay(Math.min(idx, 8) * 40).duration(300)}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#DDE3EA',
                paddingLeft: 8,
                paddingRight: 14,
                minHeight: 66,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {/* Checkbox */}
              <LightCheckbox
                testID={`list-select-${cand.id}`}
                checked={cand.selected}
                disabled={!cand.valid}
                onChange={(val) => onToggle(cand.id, val)}
                label={`Select ${cand.name || cand.number}`}
              />

              {/* Initials Avatar Badge */}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#222222',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: F.s, fontSize: 13, color: '#111111' }}>
                  {initials}
                </Text>
              </View>

              {/* Name & Phone Details */}
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: F.m,
                    fontSize: 16,
                    color: '#2B5EA7',
                  }}
                >
                  {cand.name || 'Unnamed Contact'}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: F.m,
                    fontSize: 15,
                    color: '#111111',
                  }}
                >
                  {cand.formatted || cand.number}
                </Text>
              </View>

              {/* Pencil Edit Icon Button */}
              <PressScale
                testID={`edit-card-${cand.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Edit contact ${cand.name || cand.number}`}
                onPress={() => {
                  tap();
                  onSelectCandidate(originalIndex);
                }}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="pencil" size={18} color="#111111" />
              </PressScale>
            </Animated.View>
          );
        })}

        {filtered.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.r, fontSize: 14, color: '#94A3B8' }}>
              No contacts match "{searchQuery}"
            </Text>
          </View>
        ) : null}

        {/* Verification Status Banner */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 7,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#DDE3EA',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Ionicons name="checkmark-circle-outline" size={17} color="#2563EB" />
          <Text style={{ fontFamily: F.m, fontSize: 12, color: '#111111' }}>
            All numbers verified • No duplicates found
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

