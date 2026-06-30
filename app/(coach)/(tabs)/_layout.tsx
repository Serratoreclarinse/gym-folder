import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActiveSessionProvider } from '@/context/ActiveSessionContext';
import { FloatingSessionBar } from '@/components/FloatingSessionBar';
import { Colors } from '@/constants/theme';

export default function CoachTabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <ActiveSessionProvider>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: Colors.accent,
            tabBarInactiveTintColor: Colors.textSecondary,
            tabBarStyle: {
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
              borderTopWidth: 1,
              paddingBottom: insets.bottom || 4,
              height: 58 + (insets.bottom || 0),
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
            headerStyle: { backgroundColor: Colors.bg },
            headerTintColor: Colors.textPrimary,
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
            options={{
              title: 'Clients',
              tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="sessions"
            options={{
              title: 'Sessions',
              tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
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
