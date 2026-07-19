import { useEffect } from 'react';
import { Image, View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useTheme } from '@/context/ThemeContext';
import { NotificationsProvider } from '@/context/NotificationsContext';

export default function AdminRootLayout() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>;
      if (data?.type === 'renewal_request') router.push('/(admin)/renewals' as any);
      else if (data?.type === 'transfer_request') router.push('/(admin)/(tabs)/transfers' as any);
    });
    return () => sub.remove();
  }, []);
  return (
    <NotificationsProvider>
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ position: 'absolute', width: '100%', height: '100%', opacity: isDark ? 0.05 : 0.08 }}
        resizeMode="contain"
        tintColor={isDark ? undefined : '#000000'}
      />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          sceneStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-coach"
          options={{ title: 'Add Coach', presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="add-client"
          options={{ title: 'Add Client', presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="coach/[id]" options={{ title: 'Coach Details' }} />
        <Stack.Screen name="client/[id]" options={{ title: 'Client Details' }} />
        <Stack.Screen name="recycle-bin" options={{ title: 'Recycle Bin' }} />
        <Stack.Screen name="invoice/[paymentId]" options={{ title: 'Invoice' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="equipment-requests" options={{ title: 'Equipment Requests' }} />
        <Stack.Screen name="coach-sessions/[id]" options={{ title: 'Session History' }} />
        <Stack.Screen name="client-sessions/[id]" options={{ title: 'Session History' }} />
        <Stack.Screen name="renewals" options={{ title: 'Renewal Requests' }} />
      </Stack>
    </View>
    </NotificationsProvider>
  );
}
