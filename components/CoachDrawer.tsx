import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useMyUnreadCount } from '@/hooks/useChat';

const DRAWER_W = Math.round(Dimensions.get('window').width * 0.72);

type Props = { visible: boolean; onClose: () => void };

export function CoachDrawer({ visible, onClose }: Props) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const slideX   = useRef(new Animated.Value(-DRAWER_W)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const { count: unreadMsgCount } = useMyUnreadCount();

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
      // Fallback: force-unmount after 350ms in case animation callback doesn't fire
      const t = setTimeout(() => setMounted(false), 350);
      return () => clearTimeout(t);
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
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: '#000', elevation: 15, opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) },
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandName, { color: colors.accent }]}>ELEVATƎ</Text>
            <Text style={[styles.brandSub,  { color: colors.textSecondary }]}>Personal Training</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.accent + '80' }}
            thumbColor={isDark ? colors.accent : colors.textSecondary}
          />
        </View>

        {/* User info — tappable → profile */}
        <Pressable
          style={({ pressed }) => [styles.userRow, { borderBottomColor: colors.border }, pressed && { opacity: 0.7 }]}
          onPress={() => go('/(coach)/(tabs)/profile')}
        >
          <View style={[styles.avatar, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '40' }]}>
            <Text style={[styles.avatarText, { color: colors.accent }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.textPrimary }]} numberOfLines={1}>
              {profile?.name ?? 'Coach'}
            </Text>
            <Text style={[styles.userRole, { color: colors.textSecondary }]}>Coach</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>

        {/* Navigation */}
        <ScrollView style={styles.nav} showsVerticalScrollIndicator={false} bounces={false}>
          <NavItem icon="chatbubbles-outline"   label="Messages"         onPress={() => go('/(coach)/messages')}          colors={colors} badge={unreadMsgCount} />
          <NavItem icon="cash-outline"          label="Revenue"          onPress={() => go('/(coach)/revenue')}           colors={colors} />
          <NavItem icon="podium-outline"        label="Rankings"         onPress={() => go('/(coach)/(tabs)/rankings')}   colors={colors} />
          <NavItem icon="document-text-outline" label="Templates"        onPress={() => go('/(coach)/templates')}         colors={colors} />
          <NavItem icon="body-outline"          label="Exercise Library" onPress={() => go('/(coach)/exercise-library')}  colors={colors} />
          <NavItem icon="megaphone-outline"     label="Announcements"    onPress={() => go('/(coach)/announcements')}     colors={colors} />
          <NavItem icon="warning-outline"       label="Emergency Notice" onPress={() => { onClose(); setTimeout(() => router.push({ pathname: '/(coach)/announcements', params: { preset: 'emergency' } } as any), 260); }} colors={colors} />
          <NavItem icon="time-outline"          label="Session History"  onPress={() => go('/(coach)/session-history')}   colors={colors} />
          <NavItem icon="calendar-outline"      label="Availability"     onPress={() => go('/(coach)/availability')}      colors={colors} />
          <NavItem icon="construct-outline"     label="Equipment Req."   onPress={() => go('/(coach)/equipment-requests')} colors={colors} />
          <NavItem icon="book-outline"          label="User Guide"       onPress={() => go('/(coach)/guide')}             colors={colors} />
        </ScrollView>

        {/* Sign out */}
        <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom || 8 }]}>
          <NavItem icon="log-out-outline" label="Sign Out" onPress={handleSignOut} colors={colors} danger />
        </View>
      </Animated.View>
    </View>
  );
}

function NavItem({ icon, label, onPress, colors, danger = false, badge = 0 }: {
  icon: any; label: string; onPress: () => void; colors: any; danger?: boolean; badge?: number;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navItem, pressed && { backgroundColor: colors.border + '60' }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textSecondary} />
      <Text style={[styles.navLabel, { color: danger ? colors.danger : colors.textPrimary, flex: 1 }]}>
        {label}
      </Text>
      {badge > 0 && (
        <View style={[styles.navBadge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.navBadgeText, { color: colors.bg }]}>{badge}</Text>
        </View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
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
  navBadge: {
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
    minWidth: 20, alignItems: 'center',
  },
  navBadgeText: { fontSize: 11, fontWeight: '800' },
});
