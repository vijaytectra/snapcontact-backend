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
  const icon = { saved: ['checkmark-circle', '#FFFFFF'], cancelled: ['remove-circle-outline', '#A1A1AA'], error: ['alert-circle', c.destructive] } as const;
  const label = { saved: S.summary.saved, cancelled: S.summary.cancelled, error: S.summary.error };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={saving ? undefined : onDone}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
        <View
          testID="save-summary"
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderTopColor: c.border,
            padding: 24,
            paddingBottom: Math.max(i.bottom, 16) + 24,
            maxHeight: '80%',
            maxWidth: 520,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 24, color: c.foreground, letterSpacing: -0.5 }}>
            {saving ? S.summary.saving : S.summary.title}
          </Text>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground, marginTop: 4, marginBottom: 18 }}>
            {saving ? `${outcomes.length} of ${total}. ${S.summary.savingBody}` : S.summary.counts(s, ca, e)}
          </Text>
          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {outcomes.map((o) => (
              <View
                key={o.id}
                accessible
                accessibilityLabel={`${o.name || 'Unnamed'}, ${label[o.status]}${o.message ? '. ' + o.message : ''}`}
                style={{
                  flexDirection: 'row',
                  gap: 14,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                  alignItems: 'center',
                }}
              >
                <Ionicons name={icon[o.status][0]} size={22} color={icon[o.status][1]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground }}>{o.name || 'Unnamed contact'}</Text>
                  <Text style={{ fontFamily: F.r, fontSize: 13, color: o.status === 'error' ? c.destructive : c.mutedForeground }}>
                    {o.message || label[o.status]}
                  </Text>
                </View>
              </View>
            ))}
            {saving && outcomes.length < total ? (
              <View style={{ paddingVertical: 12 }}>
                <Skeleton h={44} />
              </View>
            ) : null}
          </ScrollView>
          {!saving ? (
            <View style={{ marginTop: 20, gap: 14 }}>
              {s > 0 ? (
                <Text style={{ fontFamily: F.r, fontSize: 12, lineHeight: 18, color: '#71717A', textAlign: 'center' }}>
                  {S.summary.syncNote}
                </Text>
              ) : null}
              <Button testID="summary-done" label={S.summary.done} onPress={onDone} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
