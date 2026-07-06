import { Image, Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

export default function AdminTabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.body.style.backgroundColor = colors.bg;
      document.documentElement.style.backgroundColor = colors.bg;
    }
  }, [colors.bg]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ position: 'absolute', width: '100%', height: '100%', opacity: isDark ? 0.05 : 0.08 }}
        resizeMode="contain"
        tintColor={isDark ? undefined : '#000000'}
      />
      <Tabs
        sceneStyle={{ backgroundColor: colors.bg }}
        screenOptions={{
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
            title: 'Transfers',
            tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal-outline" size={size} color={color} />,
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
            title: 'Rankings',
            tabBarIcon: ({ color, size }) => <Ionicons name="podium-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
