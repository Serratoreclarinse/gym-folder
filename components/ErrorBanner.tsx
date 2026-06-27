import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '@/constants/theme';

type Props = {
  message: string;
  onRetry?: () => void;
};

export function ErrorBanner({ message, onRetry }: Props) {
  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} style={styles.icon} />
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  icon: { flexShrink: 0 },
  text: { ...Typography.caption, color: Colors.danger, flex: 1, lineHeight: 18 },
  retryBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.danger + '60',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  retryText: { ...Typography.label, color: Colors.danger, fontSize: 11 },
});
