import { createContext, useContext, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActiveSessionProvider } from '@/context/ActiveSessionContext';
import { FloatingSessionBar } from '@/components/FloatingSessionBar';
import { useTheme } from '@/context/ThemeContext';
import { NotificationBell } from '@/components/NotificationBell';
import { CoachDrawer } from '@/components/CoachDrawer';

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

export default function CoachTabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <DrawerCtx.Provider value={() => setDrawerOpen(true)}>
    <ActiveSessionProvider>
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
            headerRight: () => <NotificationBell path="/(coach)/notifications" />,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="clients"
            options={{ href: null, title: 'Clients', headerLeft: () => <BackButton /> }}
          />
          <Tabs.Screen
            name="sessions"
            options={{
              title: 'Sessions',
              tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="rankings"
            options={{ href: null, title: 'Rankings', headerLeft: () => <BackButton /> }}
          />
          <Tabs.Screen
            name="qr-scanner"
            options={{
              title: 'Scan',
              tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              title: 'Schedule',
              tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="timer"
            options={{
              title: 'Timer',
              tabBarIcon: ({ color, size }) => <Ionicons name="timer-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="form-checker"
            options={{
              title: 'Form',
              headerShown: false,
              tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{ href: null, title: 'Profile', headerLeft: () => <BackButton /> }}
          />
        </Tabs>

        <FloatingSessionBar />
        <CoachDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </View>
    </ActiveSessionProvider>
    </DrawerCtx.Provider>
  );
}
