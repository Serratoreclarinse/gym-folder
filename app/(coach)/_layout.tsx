import { Image, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function CoachRootLayout() {
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
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-client"
        options={{ title: 'Add Client', presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="log-session"
        options={{ title: 'Log Session', presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="client/[id]"
        options={{ title: 'Client Detail' }}
      />
      <Stack.Screen
        name="guided-workout"
        options={{ title: 'Guided Workout', headerShown: false }}
      />
      <Stack.Screen
        name="revenue"
        options={{ title: 'Revenue' }}
      />
      <Stack.Screen
        name="templates"
        options={{ title: 'Templates' }}
      />
      <Stack.Screen
        name="template-form"
        options={{ title: 'Template' }}
      />
      <Stack.Screen
        name="availability"
        options={{ title: 'Availability' }}
      />
      <Stack.Screen
        name="blocked-dates"
        options={{ title: 'Blocked Dates' }}
      />
      <Stack.Screen
        name="announcements"
        options={{ title: 'Announcements' }}
      />
      <Stack.Screen
        name="schedule-session"
        options={{ title: 'Schedule Session', presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="guide"
        options={{ title: 'User Guide' }}
      />
      <Stack.Screen
        name="chat"
        options={{ title: 'Messages' }}
      />
      <Stack.Screen
        name="exercise-library"
        options={{ title: 'Exercise Library' }}
      />
    </Stack>
    </View>
  );
}
