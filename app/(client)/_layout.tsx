import { createContext, useContext, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { NotificationBell } from '@/components/NotificationBell';
import { ClientDrawer } from '@/components/ClientDrawer';

// Context so BurgerButton (inside the tab header) can open the drawer
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

export default function ClientLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
                height: 58 + (insets.bottom || 0),
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
            <Tabs.Screen
              name="index"
              options={{
                title: 'My Progress',
                tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} />,
              }}
            />
            <Tabs.Screen
              name="workouts"
              options={{
                title: 'Workouts',
                tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
              }}
            />
            <Tabs.Screen
              name="records"
              options={{
                title: 'Records',
                tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} />,
              }}
            />
            <Tabs.Screen
              name="messages"
              options={{
                title: 'Messages',
                tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: 'Profile',
                tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
              }}
            />
            {/* Secondary screens — accessible from drawer only */}
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
          </Tabs>

          {/* Drawer renders as overlay above everything */}
          <ClientDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </View>
      </NotificationsProvider>
    </DrawerCtx.Provider>
  );
}
