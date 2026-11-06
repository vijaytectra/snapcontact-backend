import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { S } from '@/lib/strings';
import { Button, F, IconButton, PressScale, tap, useInsets } from './ui';
import { UserProfile, SubscriptionInfo } from '@/lib/auth';
import { BUILD_INFO } from '@/lib/buildInfo';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "6 Nov 2026, 14:32" in the phone's own time zone. */
function formatBuildTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SECTION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'On-device reading': 'hardware-chip-outline',
  'What stays on your phone': 'cloud-offline-outline',
  'Saved contacts': 'person-circle-outline',
  'Share from Photos (iOS)': 'share-social-outline',
  'Native build required': 'phone-portrait-outline',
  'Quick Capture (Android)': 'layers-outline',
  '7-Day Free Trial & Cashfree': 'card-outline',
  'Your account': 'person-outline',
  'Free to use': 'sparkles-outline',
};

export function SettingsModal({
  visible,
  onClose,
  onOpenSettings,
  user,
  subscription,
  onOpenAuth,
  onOpenSubscription,
  onResetOnboarding,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  user?: UserProfile | null;
  subscription?: SubscriptionInfo;
  onOpenAuth?: () => void;
  onOpenSubscription?: () => void;
  onResetOnboarding?: () => void;
}) {
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
                Account, subscription & privacy guarantees
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
            {/* Account & Cashfree Subscription Card */}
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: c.border,
                padding: 18,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: c.secondary,
                      borderWidth: 1,
                      borderColor: c.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="person-outline" size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ gap: 1 }}>
                    <Text style={{ fontFamily: F.b, fontSize: 15, color: c.foreground }}>
                      {user ? user.email : 'Email Account'}
                    </Text>
                    <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                      {user ? 'Logged in' : 'Not signed in'}
                    </Text>
                  </View>
                </View>

                {onOpenAuth ? (
                  <PressScale
                    testID="settings-auth-btn"
                    onPress={() => {
                      tap();
                      onClose();
                      onOpenAuth();
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: c.secondary,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <Text style={{ fontFamily: F.m, fontSize: 12, color: c.foreground }}>
                      {user ? 'Manage' : 'Sign In'}
                    </Text>
                  </PressScale>
                ) : null}
              </View>

              {subscription ? (
                <View
                  style={{
                    backgroundColor: c.secondary,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ gap: 2, flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontFamily: F.s, fontSize: 13, color: c.foreground }}>
                        {subscription.status === 'annual' ? 'Annual Plan' : '1st Week Free Trial'}
                      </Text>
                      <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}>
                        <Text style={{ fontFamily: F.b, fontSize: 9, color: '#080809' }}>
                          {subscription.status === 'annual' ? 'PAID' : `${subscription.trialDaysRemaining}d left`}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontFamily: F.r, fontSize: 11, color: c.mutedForeground }}>
                      ₹99 for 1 year · no automatic renewal · Cashfree
                    </Text>
                  </View>

                  {onOpenSubscription ? (
                    <PressScale
                      testID="settings-subscription-btn"
                      onPress={() => {
                        tap();
                        onClose();
                        onOpenSubscription();
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <Text style={{ fontFamily: F.b, fontSize: 11, color: '#080809' }}>
                        Details
                      </Text>
                    </PressScale>
                  ) : null}
                </View>
              ) : null}
            </View>

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

            <View style={{ marginTop: 8, gap: 10 }}>
              {onResetOnboarding ? (
                <Button
                  testID="open-onboarding-btn"
                  label="View Get Started Screen"
                  icon="sparkles-outline"
                  variant="primary"
                  onPress={() => {
                    onClose();
                    onResetOnboarding();
                  }}
                />
              ) : null}
              <Button
                testID="open-system-settings"
                label={S.settings.open}
                icon="settings-outline"
                variant="secondary"
                onPress={onOpenSettings}
              />
            </View>
            <View
              testID="app-version"
              accessible
              accessibilityLabel={`SnapContact version ${BUILD_INFO.version}, built ${formatBuildTime(BUILD_INFO.builtAt)}`}
              style={{ alignItems: 'center', marginTop: 8, gap: 2 }}
            >
              <Text style={{ fontFamily: F.m, fontSize: 12, color: c.mutedForeground }}>
                SnapContact version {BUILD_INFO.version}
              </Text>
              <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground }}>
                Built {formatBuildTime(BUILD_INFO.builtAt)}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
