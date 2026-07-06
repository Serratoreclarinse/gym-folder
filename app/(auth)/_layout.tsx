import { Image, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.05 }}
        resizeMode="contain"
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      />
    </View>
  );
}
