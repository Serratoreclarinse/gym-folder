import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/constants/theme';

// Navigation is handled by AuthNavigation in app/_layout.tsx.
// This screen just shows a spinner while the initial auth check runs.
export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}>
      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}
