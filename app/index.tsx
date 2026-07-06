import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

// Navigation is handled by AuthNavigation in app/_layout.tsx.
// This screen just shows a spinner while the initial auth check runs.
export default function Index() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}
