import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function CoachRootLayout() {
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
    </Stack>
  );
}
