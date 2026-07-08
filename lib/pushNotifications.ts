import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const PROJECT_ID = 'db3ebbee-d9d6-4d42-94ce-235f563cdb74';

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    await supabase.from('push_tokens').upsert(
      { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  } catch {
    // non-fatal
  }
}

export async function sendPushNotification(
  userId: string,
  { title, body, data }: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  // Log to in-app notification inbox regardless of push token
  supabase.from('notifications').insert({
    user_id: userId, title, body, data: data ?? {},
  }).then(() => {});

  try {
    const { data: row } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .maybeSingle();
    if (!row?.token) return;

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: row.token, title, body, data: data ?? {}, sound: 'default' }),
    });
    const json = await res.json().catch(() => null);
    if (json?.data?.status === 'error' && json?.data?.details?.error === 'DeviceNotRegistered') {
      await supabase.from('push_tokens').delete().eq('user_id', userId);
    }
  } catch {
    // non-fatal
  }
}
