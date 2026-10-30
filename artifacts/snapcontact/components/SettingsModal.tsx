import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { Button, F, IconButton, useInsets } from './ui';

const SECTION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'On-device reading': 'hardware-chip-outline',
  'No upload, no login': 'cloud-offline-outline',
  'Saved contacts': 'person-circle-outline',
  'Share from Photos (iOS)': 'share-social-outline',
  'Native build required': 'phone-portrait-outline',
  'Quick Capture (Android)': 'layers-outline',
  'Free to use': 'sparkles-outline',
};

export function SettingsModal({ visible, onClose, onOpenSettings }: { visible: boolean; onClose: () => void; onOpenSettings: () => void }) {
  const c = useColors();
  const i = useInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: Math.max(i.top, 44) + 12 }} testID="settings-modal">
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
                {S.settings.title}
              </Text>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                Privacy guarantees & documentation
              </Text>
            </View>
            <IconButton icon="close" label={S.settings.close} onPress={onClose} testID="settings-close" size={38} />
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 20,
              paddingBottom: Math.max(i.bottom, 16) + 32,
              gap: 14,
            }}
            showsVerticalScrollIndicator={false}
          >
            {S.settings.sections.map(([t, b]) => {
              const iconName = SECTION_ICONS[t] || 'shield-checkmark-outline';
              return (
                <View
                  key={t}
                  accessible
                  accessibilityLabel={`${t}. ${b}`}
                  style={{
                    backgroundColor: c.card,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: 18,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        backgroundColor: c.secondary,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={iconName} size={18} color="#FFFFFF" />
                    </View>
                    <Text style={{ flex: 1, fontFamily: F.s, fontSize: 16, color: c.foreground }}>{t}</Text>
                  </View>
                  <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 22, color: c.mutedForeground, paddingLeft: 46 }}>
                    {b}
                  </Text>
                </View>
              );
            })}

            <View style={{ marginTop: 8 }}>
              <Button
                testID="open-system-settings"
                label={S.settings.open}
                icon="settings-outline"
                variant="secondary"
                onPress={onOpenSettings}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
