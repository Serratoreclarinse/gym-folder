import { createContext, useContext, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { NotificationsProvider, useNotifications } from '@/context/NotificationsContext';
import { NotificationBell } from '@/components/NotificationBell';
import { ClientDrawer } from '@/components/ClientDrawer';
import { useMyUnreadCount } from '@/hooks/useChat';

const DrawerCtx = createContext<() => void>(() => {});

function BurgerButton() {
  const open = useContext(DrawerCtx);
  const { colors } = useTheme();
  return (
    <Pressable onPress={open} style={{ paddingLeft: 8 }} hitSlop={8}>
      <Ionicons name="menu-outline" size={26} color={colors.textPrimary} />
    </Pressable>
  );
}

function BackButton() {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }} hitSlop={8}>
      <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
    </Pressable>
  );
}

function NotifDot() {
  const { unreadCount } = useNotifications();
  if (unreadCount <= 0) return null;
  return (
    <View style={{
      position: 'absolute', top: -3, right: -7,
      width: 9, height: 9, borderRadius: 5,
      backgroundColor: '#FF4D4D',
      borderWidth: 1.5, borderColor: 'transparent',
    }} />
  );
}

export default function ClientLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { count: unreadMsgCount } = useMyUnreadCount();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>;
      if (data?.type === 'message') router.push('/(client)/messages' as any);
      else if (data?.type === 'package_renewed') router.push('/(client)/profile' as any);
    });
    return () => sub.remove();
  }, []);

  const tabBarH = 58 + (insets.bottom || 0);

  return (
    <DrawerCtx.Provider value={() => setDrawerOpen(true)}>
      <NotificationsProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ position: 'absolute', width: '100%', height: '100%', opacity: isDark ? 0.05 : 0.08 }}
            resizeMode="contain"
            tintColor={isDark ? undefined : '#000000'}
          />

          <Tabs
            screenOptions={{
              sceneStyle: { backgroundColor: colors.bg },
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: colors.textSecondary,
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                borderTopWidth: 1,
                paddingBottom: insets.bottom || 4,
                height: tabBarH,
              },
              tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.textPrimary,
              headerTitleStyle: { fontWeight: '700', fontSize: 17 },
              headerShadowVisible: false,
              headerLeft: () => <BurgerButton />,
              headerRight: () => <NotificationBell path="/(client)/notifications" />,
            }}
          >
            {/* ── Visible tabs ── */}
            <Tabs.Screen
              name="index"
              options={{
                title: 'My Progress',
                tabBarIcon: ({ color, size }) => (
                  <View>
                    <Ionicons name="trending-up-outline" size={size} color={color} />
                    <NotifDot />
                  </View>
                ),
              }}
            />

            {/* Center QR button */}
            <Tabs.Screen
              name="qr"
              options={{
                title: '',
                tabBarIcon: () => <Ionicons name="qr-code-outline" size={26} color="#fff" />,
                tabBarButton: (props) => (
                  <Pressable
                    onPress={props.onPress}
                    style={s.qrTabBtn}
                    hitSlop={6}
                  >
                    <View style={[s.qrCircle, { backgroundColor: colors.accent }]}>
                      <Ionicons name="qr-code-outline" size={26} color="#fff" />
                    </View>
                  </Pressable>
                ),
              }}
            />

            <Tabs.Screen
              name="messages"
              options={{
                title: 'Messages',
                headerShown: false,
                tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
                tabBarBadge: unreadMsgCount > 0 ? String(unreadMsgCount) : undefined,
              }}
            />

            {/* ── Drawer-only screens (hidden from tab bar) ── */}
            <Tabs.Screen
              name="records"
              options={{
                href: null,
                title: 'Records',
                headerLeft: () => <BackButton />,
                headerRight: () => null,
              }}
            />
            <Tabs.Screen
              name="workouts"
              options={{
                href: null,
                title: 'Workouts',
                headerLeft: () => <BackButton />,
                headerRight: () => null,
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                href: null,
                title: 'Profile',
                headerLeft: () => (
                  <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }} hitSlop={8}>
                    <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
                  </Pressable>
                ),
                headerRight: () => null,
              }}
            />
            <Tabs.Screen
              name="guide"
              options={{
                href: null,
                title: 'User Guide',
                headerLeft: () => (
                  <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }} hitSlop={8}>
                    <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
                  </Pressable>
                ),
              }}
            />
            <Tabs.Screen
              name="notifications"
              options={{
                href: null,
                title: 'Notifications',
                headerLeft: () => (
                  <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }} hitSlop={8}>
                    <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
                  </Pressable>
                ),
              }}
            />
            <Tabs.Screen
              name="session-history"
              options={{
                href: null,
                title: 'Session History',
                headerLeft: () => (
                  <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }} hitSlop={8}>
                    <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
                  </Pressable>
                ),
              }}
            />
            <Tabs.Screen
              name="renewal-history"
              options={{
                href: null,
                title: 'Renewal History',
                headerLeft: () => (
                  <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }} hitSlop={8}>
                    <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
                  </Pressable>
                ),
                headerRight: () => null,
              }}
            />
          </Tabs>

          <ClientDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </View>
      </NotificationsProvider>
    </DrawerCtx.Provider>
  );
}

const s = StyleSheet.create({
  qrTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -16,
  },
  qrCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
