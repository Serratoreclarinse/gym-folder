import { Image, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function AdminRootLayout() {
  const { colors, isDark } = useTheme();
  return (
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
          contentStyle: { backgroundColor: 'transparent' },
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
      </Stack>
    </View>
  );
}
