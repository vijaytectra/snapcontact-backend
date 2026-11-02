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
          backgroundColor: '#F5F8FC',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: Math.max(i.top, 44),
          paddingBottom: Math.max(i.bottom, 20),
          paddingHorizontal: 28,
        }}
        testID="save-summary"
      >
        {/* Center Saved Animation, Status & Done */}
        <View style={{ alignItems: 'center', width: '100%', maxWidth: 320 }}>
          <Animated.View
            entering={ZoomIn.duration(400)}
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: '#D3F5E1',
              borderWidth: 1,
              borderColor: '#BDEFD2',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Ionicons name="checkmark" size={30} color="#0E9F5B" />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(150).duration(400)}
            accessibilityRole="header"
            style={{
              fontFamily: F.b,
              fontSize: 19,
              color: '#111111',
              letterSpacing: -0.3,
              textAlign: 'center',
              marginBottom: 6,
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
              color: '#1F2937',
              textAlign: 'center',
              lineHeight: 18,
              maxWidth: 200,
            }}
          >
            {saving
              ? `Processing ${outcomes.length} of ${total} contacts on your device.`
              : savedCount > 1
              ? `${savedCount} contacts have been successfully added to your device contacts.`
              : `${contactName} has been successfully added to your device contacts.`}
          </Animated.Text>

          {!saving ? (
            <Animated.View entering={FadeIn.delay(350).duration(400)} style={{ width: 240, marginTop: 22 }}>
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
                  height: 40,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                <Text style={{ fontFamily: F.m, fontSize: 14, color: '#FFFFFF' }}>
                  Done
                </Text>
              </PressScale>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
