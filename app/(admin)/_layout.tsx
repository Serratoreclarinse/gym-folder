import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function AdminRootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.bg },
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
    </Stack>
  );
}
