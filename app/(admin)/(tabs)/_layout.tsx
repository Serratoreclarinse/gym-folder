import { createContext, useContext, useEffect, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { NotificationBell } from '@/components/NotificationBell';
import { AdminDrawer } from '@/components/AdminDrawer';

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

export default function AdminTabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.body.style.backgroundColor = colors.bg;
      document.documentElement.style.backgroundColor = colors.bg;
    }
  }, [colors.bg]);

  return (
    <DrawerCtx.Provider value={() => setDrawerOpen(true)}>
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
          headerRight: () => <NotificationBell path="/(admin)/notifications" />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Overview',
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="coaches"
          options={{
            title: 'Coaches',
            tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: 'Clients',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="transfers"
          options={{
            href: null,
            title: 'Transfers',
            headerLeft: () => <BackButton />,
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: 'Payments',
            tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="rankings"
          options={{
            href: null,
            title: 'Rankings',
            headerLeft: () => <BackButton />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
            title: 'Profile',
            headerLeft: () => <BackButton />,
          }}
        />
      </Tabs>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
    </DrawerCtx.Provider>
  );
}
