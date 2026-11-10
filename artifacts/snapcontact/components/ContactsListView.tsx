import React, { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Cand } from './CandidateCard';
import { F, LightCheckbox, PressScale, tap } from './ui';
import { EXCLUSION_LABEL, summarizeContacts, type ExclusionReason } from '@/lib/contactSummary';

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

function Stat({ label, value, testID }: { label: string; value: number; testID: string }) {
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontFamily: F.b, fontSize: 26, color: '#0F172A' }}>{value}</Text>
      <Text style={{ fontFamily: F.m, fontSize: 12, color: '#64748B' }}>{label}</Text>
    </View>
  );
}

/**
 * Review step for a batch of contacts. The top shows the three counts (detected, proper, save
 * total). Proper contacts follow as cards. Excluded entries stay visible with the reason they
 * cannot be saved, so nothing is dropped silently. The rows are plain views, not a FlatList,
 * because this list already sits inside the screen's scroll view.
 */
export function ContactsListView({
  candidates,
  onToggle,
  onToggleAll,
  allSelected,
  onSelectCandidate,
  onDeleteSelected,
  onRemove,
}: {
  candidates: Cand[];
  onToggle: (id: string, selected: boolean) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  onSelectCandidate: (index: number) => void;
  onDeleteSelected?: () => void;
  /** Removes one entry from the list (proper or excluded). */
  onRemove?: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showExcluded, setShowExcluded] = useState(false);
  const summary = useMemo(() => summarizeContacts(candidates), [candidates]);
  const indexById = useMemo(() => new Map(candidates.map((c, i) => [c.id, i])), [candidates]);

  const query = searchQuery.trim().toLowerCase();
  const matches = (c: Cand) => !query
    || c.name.toLowerCase().includes(query)
    || c.number.includes(query)
    || (c.formatted ?? '').toLowerCase().includes(query)
    || (c.email ?? '').toLowerCase().includes(query);
  const properRows = summary.proper.filter(matches);
  const excludedRows = summary.excluded.filter(({ candidate }) => matches(candidate));
  const reasons = (Object.keys(EXCLUSION_LABEL) as ExclusionReason[]).filter((r) => summary.excludedCounts[r] > 0);

  const renderProper = (cand: Cand) => {
    const initials = getInitials(cand.name, cand.number);
    return (
      <View
        key={cand.id}
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
        <LightCheckbox
          testID={`list-select-${cand.id}`}
          checked={cand.selected}
          onChange={(val) => onToggle(cand.id, val)}
          label={`Select ${cand.name || cand.number}`}
        />

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
          <Text style={{ fontFamily: F.s, fontSize: 13, color: '#111111' }}>{initials}</Text>
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.m, fontSize: 16, color: '#2B5EA7' }}>
            {cand.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: F.m, fontSize: 15, color: '#111111' }}>
            {cand.formatted || cand.number}
          </Text>
        </View>

        <PressScale
          testID={`edit-card-${cand.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Edit contact ${cand.name || cand.number}`}
          onPress={() => {
            tap();
            onSelectCandidate(indexById.get(cand.id) ?? 0);
          }}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="pencil" size={18} color="#111111" />
        </PressScale>
        {onRemove ? (
          <PressScale
            testID={`delete-card-${cand.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Delete contact ${cand.name || cand.number}`}
            onPress={() => {
              tap();
              onRemove(cand.id);
            }}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="trash-outline" size={18} color="#B91C1C" />
          </PressScale>
        ) : null}
      </View>
    );
  };

  return (
    <View testID="contacts-list" style={{ gap: 14 }}>
      {/* Counts, in order: detected, proper, save total */}
      <View
        testID="batch-summary"
        style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#DDE3EA', padding: 16, gap: 12 }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat testID="summary-detected" label="Detected" value={summary.detected} />
          <Stat testID="summary-proper" label="Proper contacts" value={summary.savable} />
          <Stat testID="summary-save-total" label="Save total" value={summary.saveTotal} />
        </View>
        <Text testID="summary-reconcile" style={{ fontFamily: F.r, fontSize: 12, color: '#64748B' }}>
          {`${summary.detected} detected = ${summary.savable} proper + ${summary.excluded.length} excluded`}
        </Text>
      </View>

      {/* Search */}
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
          style={{ flex: 1, fontFamily: F.r, fontSize: 15, color: '#0F172A', height: '100%' }}
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

      {/* Select all (proper contacts only) and delete */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LightCheckbox
            testID="select-all-checkbox"
            checked={allSelected}
            disabled={summary.savable === 0}
            onChange={onToggleAll}
            label="Select all proper contacts"
          />
          <Text style={{ fontFamily: F.m, fontSize: 14, color: '#111111' }}>Select All</Text>
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
            <Text style={{ fontFamily: F.m, fontSize: 12, color: '#111111' }}>Delete</Text>
          </PressScale>
        ) : null}
      </View>

      <Text style={{ fontFamily: F.s, fontSize: 13, color: '#111111' }}>
        {`Proper contacts (${properRows.length})`}
      </Text>

      <View style={{ gap: 10 }}>
        {properRows.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.r, fontSize: 14, color: '#94A3B8', textAlign: 'center' }}>
              {query ? `No contacts match "${searchQuery}"` : 'No proper contacts. Open "Not saved" to add missing names or numbers.'}
            </Text>
          </View>
        ) : properRows.map(renderProper)}
      </View>

      {/* Excluded entries: kept visible with the reason */}
      {summary.excluded.length > 0 ? (
        <View testID="excluded-section" style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#DDE3EA', padding: 14, gap: 10 }}>
          <PressScale
            testID="toggle-excluded"
            accessibilityRole="button"
            accessibilityState={{ expanded: showExcluded }}
            onPress={() => {
              tap();
              setShowExcluded(!showExcluded);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ fontFamily: F.s, fontSize: 14, color: '#111111' }}>
              {`Not saved (${summary.excluded.length})`}
            </Text>
            <Ionicons name={showExcluded ? 'chevron-up' : 'chevron-down'} size={18} color="#111111" />
          </PressScale>
          <View style={{ gap: 4 }}>
            {reasons.map((reason) => (
              <Text key={reason} testID={`excluded-${reason}`} style={{ fontFamily: F.r, fontSize: 13, color: '#475569' }}>
                {`${EXCLUSION_LABEL[reason]}: ${summary.excludedCounts[reason]}`}
              </Text>
            ))}
          </View>

          {showExcluded ? excludedRows.map(({ candidate, reason }) => (
            <View
              key={candidate.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEF2F6' }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.m, fontSize: 15, color: '#111111' }}>
                  {candidate.formatted || candidate.number || candidate.email || candidate.website || 'Entry'}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: F.r, fontSize: 12, color: '#B45309' }}>
                  {EXCLUSION_LABEL[reason]}
                </Text>
              </View>
              <PressScale
                testID={`edit-excluded-${candidate.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Edit entry: ${EXCLUSION_LABEL[reason]}`}
                onPress={() => {
                  tap();
                  onSelectCandidate(indexById.get(candidate.id) ?? 0);
                }}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="pencil" size={18} color="#111111" />
              </PressScale>
            </View>
          )) : null}
        </View>
      ) : null}

      <Text style={{ fontFamily: F.r, fontSize: 12, color: '#64748B', textAlign: 'center' }}>
        Each contact is checked before saving: it needs a name and a valid phone number.
      </Text>
    </View>
  );
}
