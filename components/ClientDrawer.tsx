import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const DRAWER_W = Math.round(Dimensions.get('window').width * 0.72);

type Props = { visible: boolean; onClose: () => void };

export function ClientDrawer({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const slideX   = useRef(new Animated.Value(-DRAWER_W)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideX,   { toValue: 0,         friction: 9, tension: 60, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 220,        useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX,   { toValue: -DRAWER_W, duration: 240, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0,          duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  if (!mounted) return null;

  const go = (path: string) => {
    onClose();
    setTimeout(() => router.push(path as any), 260);
  };

  const handleSignOut = () => {
    onClose();
    setTimeout(() => signOut(), 260);
  };

  const initials = profile?.name
    ?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) ?? 'ME';

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        pointerEvents="auto"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: '#000', opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            width: DRAWER_W,
            backgroundColor: colors.surface,
            paddingTop: insets.top,
            shadowColor: '#000',
            transform: [{ translateX: slideX }],
          },
        ]}
      >
        {/* Branding */}
        <View style={[styles.brand, { borderBottomColor: colors.border }]}>
          <Text style={[styles.brandName, { color: colors.accent }]}>ELEVATƎ</Text>
          <Text style={[styles.brandSub,  { color: colors.textSecondary }]}>Personal Training</Text>
        </View>

        {/* User info */}
        <View style={[styles.userRow, { borderBottomColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '40' }]}>
            <Text style={[styles.avatarText, { color: colors.accent }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.textPrimary }]} numberOfLines={1}>
              {profile?.name ?? 'Member'}
            </Text>
            <Text style={[styles.userRole, { color: colors.textSecondary }]}>Client</Text>
          </View>
        </View>

        {/* Navigation */}
        <View style={styles.nav}>
          <NavItem icon="calendar-outline"     label="Session History" onPress={() => go('/(client)/session-history')} colors={colors} />
          <NavItem icon="book-outline"         label="User Guide"      onPress={() => go('/(client)/guide')}           colors={colors} />
          <NavItem icon="notifications-outline" label="Notifications"  onPress={() => go('/(client)/notifications')}   colors={colors} />
        </View>

        {/* Sign out */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <NavItem icon="log-out-outline" label="Sign Out" onPress={handleSignOut} colors={colors} danger />
        </View>
      </Animated.View>
    </View>
  );
}

function NavItem({ icon, label, onPress, colors, danger = false }: {
  icon: any; label: string; onPress: () => void; colors: any; danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navItem, pressed && { backgroundColor: colors.border + '60' }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textSecondary} />
      <Text style={[styles.navLabel, { color: danger ? colors.danger : colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 20,
  },
  brand: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  brandName: { fontSize: 22, fontWeight: '800', letterSpacing: 4 },
  brandSub:  { fontSize: 11, fontWeight: '500', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800' },
  userName:  { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  userRole:  { fontSize: 12, fontWeight: '500' },
  nav:    { flex: 1, paddingTop: 8 },
  footer: { borderTopWidth: 1, paddingBottom: 24 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  navLabel: { fontSize: 15, fontWeight: '600' },
});
