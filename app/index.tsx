import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <ActivityIndicator size="large" color="#E8001D" style={{ marginTop: 'auto', marginBottom: 'auto' }} />
    </View>
  );
}
