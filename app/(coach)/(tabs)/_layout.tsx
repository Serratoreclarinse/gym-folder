import { Image, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActiveSessionProvider } from '@/context/ActiveSessionContext';
import { FloatingSessionBar } from '@/components/FloatingSessionBar';
import { useTheme } from '@/context/ThemeContext';

export default function CoachTabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  return (
    <ActiveSessionProvider>
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
              title: 'Dashboard',
              tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="clients"
            options={{ href: null }}
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
            options={{
              title: 'Rank',
              tabBarIcon: ({ color, size }) => <Ionicons name="podium-outline" size={size} color={color} />,
            }}
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
            name="profile"
            options={{
              title: 'Profile',
              tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
            }}
          />
        </Tabs>

        <FloatingSessionBar />
      </View>
    </ActiveSessionProvider>
  );
}
