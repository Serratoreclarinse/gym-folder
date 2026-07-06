import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClients, type ClientWithPackage } from '@/hooks/useClients';
import { getDaysUntilBirthday } from '@/hooks/useBirthdays';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const PACKAGE_LABEL: Record<string, string> = {
  '30min': '30 min',
  '45min': '45 min',
  '1hr': '1 hour',
};

function PackageBadge({ remaining, status }: { remaining: number; status: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const expired = status === 'expired';
  const warning = !expired && remaining <= 2;
  const color = expired ? colors.textSecondary : warning ? '#FFA500' : colors.accent;
  const bg = expired ? colors.border : warning ? '#FFA50020' : colors.accent + '18';
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color + '60' }]}>
      <Text style={[styles.badgeText, { color }]}>
        {expired ? 'EXPIRED' : `${remaining} LEFT`}
      </Text>
    </View>
  );
}

function ClientCard({ client }: { client: ClientWithPackage }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pkg = client.activePackage;
  const initials = client.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const hasBday = client.birthday != null && getDaysUntilBirthday(client.birthday) <= 3;

  return (
    <Pressable
      style={({ pressed }) => [styles.clientCard, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/(coach)/client/${client.id}`)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.clientInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={styles.clientName}>{client.name}</Text>
          {hasBday && <Text style={{ fontSize: 14 }}>🎂</Text>}
        </View>
        <Text style={styles.clientEmail}>{client.email}</Text>
        {pkg ? (
          <Text style={styles.packageType}>
            {PACKAGE_LABEL[pkg.package_type]} · {pkg.sessions_used}/{pkg.total_sessions} sessions
          </Text>
        ) : (
          <Text style={styles.packageType}>No active package</Text>
        )}
      </View>

      <View style={styles.rightCol}>
        {pkg ? (
          <PackageBadge remaining={pkg.sessions_remaining} status={pkg.status} />
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginTop: 8 }} />
      </View>
    </Pressable>
  );
}

export default function CoachClientsScreen() {
  const { clients, loading, error, refetch } = useClients();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
    >
      {error && <ErrorBanner message={error} onRetry={refetch} />}
      <View style={styles.header}>
        <Text style={styles.count}>
          {clients.length} {clients.length === 1 ? 'client' : 'clients'}
        </Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/(coach)/add-client')}>
          <Ionicons name="add" size={18} color={colors.bg} />
          <Text style={styles.addBtnText}>ADD CLIENT</Text>
        </Pressable>
      </View>

      {!loading && clients.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={colors.border} />
          <Text style={styles.emptyTitle}>No clients yet</Text>
          <Text style={styles.emptySub}>Tap "Add Client" to get started</Text>
        </View>
      ) : (
        clients.map((c) => <ClientCard key={c.id} client={c} />)
      )}
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    count: { ...Typography.body, color: c.textSecondary },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    addBtnText: { color: c.bg, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
    clientCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
      gap: 12,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.accent + '18',
      borderWidth: 1,
      borderColor: c.accent + '40',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: { fontSize: 16, fontWeight: '700', color: c.accent },
    clientInfo: { flex: 1 },
    clientName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    clientEmail: { ...Typography.caption, color: c.textSecondary, marginBottom: 4 },
    packageType: { ...Typography.caption, color: c.textSecondary },
    rightCol: { alignItems: 'flex-end' },
    badge: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
    },
    badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
    emptySub: { ...Typography.body, color: c.textSecondary },
  });
}
