import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNotifications } from '@/context/NotificationsContext';
import { useTheme } from '@/context/ThemeContext';

type Props = { path: string };

export function NotificationBell({ path }: Props) {
  const { unreadCount } = useNotifications();
  const { colors } = useTheme();
  return (
    <Pressable
      style={{ marginRight: 14, padding: 4 }}
      onPress={() => router.push(path as any)}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute', top: 0, right: 2,
          backgroundColor: '#FF4D4D', borderRadius: 8,
          minWidth: 16, height: 16,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
            {unreadCount > 99 ? '99+' : String(unreadCount)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
