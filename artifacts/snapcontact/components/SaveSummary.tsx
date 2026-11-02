import React from 'react';
import { Modal, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { F, PressScale, tap, useInsets } from './ui';

export type Outcome = {
  id: string;
  name: string;
  status: 'saved' | 'cancelled' | 'error';
  message?: string;
};

export function SaveSummary({
  visible,
  saving,
  outcomes,
  total,
  onDone,
}: {
  visible: boolean;
  saving: boolean;
  outcomes: Outcome[];
  total: number;
  onDone: () => void;
}) {
  const i = useInsets();
  const savedCount = outcomes.filter((o) => o.status === 'saved').length;
  const firstSaved = outcomes.find((o) => o.status === 'saved');
  const contactName = firstSaved?.name ? `"${firstSaved.name}"` : 'Your contact';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={saving ? undefined : onDone}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          justifyContent: 'space-between',
          paddingTop: Math.max(i.top, 44) + 40,
          paddingBottom: Math.max(i.bottom, 20) + 16,
          paddingHorizontal: 28,
        }}
        testID="save-summary"
      >
        {/* Center Saved Animation & Status */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Animated.View
            entering={ZoomIn.duration(400)}
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: '#DCFCE7',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <Ionicons name="checkmark" size={44} color="#16A34A" />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(150).duration(400)}
            accessibilityRole="header"
            style={{
              fontFamily: F.b,
              fontSize: 24,
              color: '#0F172A',
              letterSpacing: -0.5,
              textAlign: 'center',
            }}
          >
            {saving
              ? 'Saving Contacts...'
              : savedCount > 1
              ? `${savedCount} Contacts Saved`
              : 'Contact Saved'}
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(250).duration(400)}
            style={{
              fontFamily: F.r,
              fontSize: 14,
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 22,
              maxWidth: 280,
            }}
          >
            {saving
              ? `Processing ${outcomes.length} of ${total} contacts on your device.`
              : savedCount > 1
              ? `${savedCount} contacts have been successfully added to your device contacts.`
              : `${contactName} has been successfully added to your device contacts.`}
          </Animated.Text>
        </View>

        {/* Bottom Black Done Button */}
        {!saving ? (
          <Animated.View entering={FadeIn.delay(350).duration(400)}>
            <PressScale
              testID="summary-done"
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={() => {
                tap('medium');
                onDone();
              }}
              style={{
                backgroundColor: '#000000',
                height: 52,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <Text
                style={{
                  fontFamily: F.b,
                  fontSize: 16,
                  color: '#FFFFFF',
                  letterSpacing: -0.2,
                }}
              >
                Done
              </Text>
            </PressScale>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}
