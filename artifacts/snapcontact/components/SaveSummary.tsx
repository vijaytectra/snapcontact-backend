import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { Button, F, Skeleton, useInsets } from './ui';

export type Outcome = { id: string; name: string; status: 'saved' | 'cancelled' | 'error'; message?: string };

export function SaveSummary({ visible, saving, outcomes, total, onDone }: { visible: boolean; saving: boolean; outcomes: Outcome[]; total: number; onDone: () => void }) {
  const c = useColors();
  const i = useInsets();
  const s = outcomes.filter((o) => o.status === 'saved').length;
  const ca = outcomes.filter((o) => o.status === 'cancelled').length;
  const e = outcomes.filter((o) => o.status === 'error').length;
  const icon = { saved: ['checkmark-circle', c.primary], cancelled: ['remove-circle-outline', c.mutedForeground], error: ['alert-circle', c.destructive] } as const;
  const label = { saved: S.summary.saved, cancelled: S.summary.cancelled, error: S.summary.error };
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={saving ? undefined : onDone}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,26,22,0.55)', justifyContent: 'flex-end' }}>
        <View testID="save-summary" style={{ backgroundColor: c.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: i.bottom + 20, maxHeight: '80%' }}>
          <Text accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 24, color: c.foreground }}>{saving ? S.summary.saving : S.summary.title}</Text>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.r, fontSize: 15, color: c.mutedForeground, marginTop: 4, marginBottom: 16 }}>
            {saving ? `${outcomes.length} of ${total}. ${S.summary.savingBody}` : S.summary.counts(s, ca, e)}
          </Text>
          <ScrollView style={{ flexGrow: 0 }}>
            {outcomes.map((o) => (
              <View key={o.id} accessible accessibilityLabel={`${o.name || 'Unnamed'}, ${label[o.status]}${o.message ? '. ' + o.message : ''}`} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border, alignItems: 'flex-start' }}>
                <Ionicons name={icon[o.status][0]} size={24} color={icon[o.status][1]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.s, fontSize: 16, color: c.foreground }}>{o.name || 'Unnamed contact'}</Text>
                  <Text style={{ fontFamily: F.r, fontSize: 14, color: o.status === 'error' ? c.destructive : c.mutedForeground }}>{o.message || label[o.status]}</Text>
                </View>
              </View>
            ))}
            {saving && outcomes.length < total ? <View style={{ paddingVertical: 12 }}><Skeleton h={44} /></View> : null}
          </ScrollView>
          {!saving ? (
            <View style={{ marginTop: 18, gap: 12 }}>
              {s > 0 ? <Text style={{ fontFamily: F.r, fontSize: 13, lineHeight: 19, color: c.mutedForeground }}>{S.summary.syncNote}</Text> : null}
              <Button testID="summary-done" label={S.summary.done} onPress={onDone} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
