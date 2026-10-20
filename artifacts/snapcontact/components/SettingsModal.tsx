import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { Button, F, IconButton, useInsets } from './ui';

export function SettingsModal({ visible, onClose, onOpenSettings }: { visible: boolean; onClose: () => void; onOpenSettings: () => void }) {
  const c = useColors();
  const i = useInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 12 }} testID="settings-modal">
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 24, paddingRight: 8 }}>
          <Text accessibilityRole="header" style={{ flex: 1, fontFamily: F.b, fontSize: 24, color: c.foreground }}>{S.settings.title}</Text>
          <IconButton icon="close" label={S.settings.close} onPress={onClose} testID="settings-close" />
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: i.bottom + 24, gap: 26 }}>
          {S.settings.sections.map(([t, b]) => (
            <View key={t} accessible accessibilityLabel={`${t}. ${b}`} style={{ gap: 6, borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: 16 }}>
              <Text style={{ fontFamily: F.s, fontSize: 17, color: c.foreground }}>{t}</Text>
              <Text style={{ fontFamily: F.r, fontSize: 15, lineHeight: 22, color: c.mutedForeground }}>{b}</Text>
            </View>
          ))}
          <Button testID="open-system-settings" label={S.settings.open} icon="settings-outline" variant="secondary" onPress={onOpenSettings} />
        </ScrollView>
      </View>
    </Modal>
  );
}
