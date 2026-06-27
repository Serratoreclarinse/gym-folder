import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClients } from '@/hooks/useClients';
import { useSessions } from '@/hooks/useSessions';
import { useStrikes } from '@/hooks/useStrikes';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ClientProgressTab } from '@/components/ClientProgressTab';
import { ClientNotesTab } from '@/components/ClientNotesTab';
import { Colors, Typography } from '@/constants/theme';

const PACKAGE_LABEL: Record<string, string> = {
  '30min': '30 min',
  '45min': '45 min',
  '1hr': '1 hour',
};

type Tab = 'overview' | 'sessions' | 'progress' | 'notes' | 'files';

const MAX_STRIKES = 3;

// Defined OUTSIDE parent so its component type reference never changes.
// If defined inside, every parent re-render creates a new function reference →
// React unmounts + remounts it → TextInput loses focus on every keystroke.
function StrikeInputForm({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <View style={styles.strikeInputCard}>
      <Text style={styles.strikeInputLabel}>Reason (optional)</Text>
      <TextInput
        style={styles.strikeInputField}
        value={reason}
        onChangeText={setReason}
        placeholder="e.g. missed session, late payment…"
        placeholderTextColor={Colors.textSecondary}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => onConfirm(reason)}
      />
      <View style={styles.strikeInputBtns}>
        <Pressable style={styles.strikeInputCancel} onPress={onCancel}>
          <Text style={styles.strikeInputCancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.strikeInputConfirm} onPress={() => onConfirm(reason)}>
          <Text style={styles.strikeInputConfirmText}>Add Strike</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ClientDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showStrikeInput, setShowStrikeInput] = useState(false);

  const { clients, loading: clientsLoading, error: clientsError, refetch: refetchClients } = useClients();
  const { sessions, loading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useSessions(id);
  const { strikes, refetch: refetchStrikes, addStrike, removeStrike } = useStrikes(id);

  const client = clients.find((c) => c.id === id);
  const pkg = client?.activePackage;
  const initials = client?.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  const progressPct = pkg ? Math.min(pkg.sessions_used / pkg.total_sessions, 1) : 0;

  useEffect(() => {
    if (client?.name) navigation.setOptions({ title: client.name });
  }, [client?.name]);

  const refreshing = clientsLoading || sessionsLoading;
  const onRefresh = () => { refetchClients(); refetchSessions(); refetchStrikes(); };

  const handleAddStrike = () => {
    if (strikes.length >= MAX_STRIKES) {
      Alert.alert('Max strikes reached', 'This client already has 3 strikes.');
      return;
    }
    setShowStrikeInput(true);
  };

  const confirmAddStrike = async (reason: string) => {
    setShowStrikeInput(false);
    const result = await addStrike(reason);
    if (result.autoDeducted) {
      Alert.alert('3 Strikes!', `${client?.name ?? 'Client'} reached 3 strikes — 1 session auto-deducted from their package and strikes reset to 0.`);
    }
  };

  const handleRemoveStrike = (strikeId: string) => {
    Alert.alert('Remove Strike', 'Remove this strike from the client?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeStrike(strikeId) },
    ]);
  };

  // ── Client Header (always visible) ──────────────────────────
  const ClientHeader = () => (
    <View style={styles.clientHeader}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.clientMeta}>
        <Text style={styles.clientName}>{client?.name ?? '—'}</Text>
        <Text style={styles.clientEmail}>{client?.email ?? ''}</Text>
        {client?.phone ? <Text style={styles.clientPhone}>{client.phone}</Text> : null}
      </View>
    </View>
  );

  // ── Overview Tab ─────────────────────────────────────────────
  const OverviewContent = () => (
    <>
      {/* Package card */}
      {pkg ? (
        <View style={styles.packageCard}>
          <View style={styles.packageTop}>
            <View>
              <Text style={styles.packageLabel}>ACTIVE PACKAGE</Text>
              <Text style={styles.packageType}>{PACKAGE_LABEL[pkg.package_type]} sessions</Text>
            </View>
            <View style={[
              styles.statusBadge,
              pkg.sessions_remaining <= 3 && pkg.sessions_remaining > 0 && styles.statusWarning,
              pkg.sessions_remaining === 0 && styles.statusExpired,
            ]}>
              <Text style={[
                styles.statusText,
                pkg.sessions_remaining <= 3 && pkg.sessions_remaining > 0 && styles.statusTextWarning,
                pkg.sessions_remaining === 0 && styles.statusTextExpired,
              ]}>
                {pkg.sessions_remaining} REMAINING
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {pkg.sessions_used} of {pkg.total_sessions} sessions used
          </Text>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No active package</Text>
        </View>
      )}

      {/* Log session CTA */}
      {pkg && pkg.sessions_remaining > 0 && (
        <Pressable
          style={styles.logBtn}
          onPress={() => router.push({ pathname: '/(coach)/log-session', params: { clientId: id } })}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.bg} />
          <Text style={styles.logBtnText}>LOG A SESSION</Text>
        </Pressable>
      )}

      {/* Strikes section */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>STRIKES</Text>
        {!showStrikeInput && (
          <Pressable style={styles.addStrikeBtn} onPress={handleAddStrike}>
            <Ionicons name="add" size={14} color={Colors.bg} />
            <Text style={styles.addStrikeBtnText}>ADD</Text>
          </Pressable>
        )}
      </View>

      {/* Inline strike reason form — StrikeInputForm defined outside parent to prevent keyboard flicker */}
      {showStrikeInput && (
        <StrikeInputForm
          onConfirm={confirmAddStrike}
          onCancel={() => setShowStrikeInput(false)}
        />
      )}

      <View style={styles.strikesCard}>
        {/* Strike indicator dots */}
        <View style={styles.strikeDots}>
          {Array.from({ length: MAX_STRIKES }).map((_, i) => (
            <View
              key={i}
              style={[styles.strikeDot, i < strikes.length && styles.strikeDotFilled]}
            />
          ))}
          <Text style={[
            styles.strikeCount,
            strikes.length >= MAX_STRIKES && styles.strikeCountMax,
          ]}>
            {strikes.length} / {MAX_STRIKES} strikes
          </Text>
        </View>

        {/* Strike history */}
        {strikes.length === 0 ? (
          <Text style={styles.noStrikesText}>No strikes — great client!</Text>
        ) : (
          strikes.map((s, i) => (
            <Pressable key={s.id} style={styles.strikeRow} onLongPress={() => handleRemoveStrike(s.id)}>
              <View style={styles.strikeIcon}>
                <Text style={styles.strikeIconText}>⚡</Text>
              </View>
              <View style={styles.strikeInfo}>
                <Text style={styles.strikeLabel}>Strike {i + 1}</Text>
                <Text style={styles.strikeDate}>
                  {new Date(s.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
                {s.reason ? <Text style={styles.strikeReason}>{s.reason}</Text> : null}
              </View>
            </Pressable>
          ))
        )}
        {strikes.length > 0 && (
          <Text style={styles.strikeTip}>Hold a strike to remove it</Text>
        )}
      </View>
    </>
  );

  // ── Sessions Tab ─────────────────────────────────────────────
  const SessionsContent = () => (
    <>
      <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>
        SESSION HISTORY{sessions.length > 0 ? `  (${sessions.length})` : ''}
      </Text>

      {sessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No sessions logged yet</Text>
        </View>
      ) : (
        sessions.map((s) => {
          const dateStr = new Date(s.session_date).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          });
          return (
            <View key={s.id} style={styles.sessionCard}>
              <View style={styles.sessionCardTop}>
                <Text style={styles.sessionDate}>{dateStr}</Text>
                <View style={styles.durationChip}>
                  <Ionicons name="time-outline" size={12} color={Colors.accent} />
                  <Text style={styles.durationText}>{s.duration_minutes} min</Text>
                </View>
              </View>
              {s.exercises.map((ex, i) => (
                <View key={i} style={styles.exRow}>
                  <View style={styles.exBullet} />
                  <View style={styles.exDetails}>
                    <Text style={styles.exName}>{ex.exercise_name}</Text>
                    <Text style={styles.exMeta}>
                      {[
                        ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : null,
                        ex.weight ?? null,
                        ex.notes ?? null,
                      ].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                </View>
              ))}
              {s.notes ? <Text style={styles.sessionNotes}>{s.notes}</Text> : null}
            </View>
          );
        })
      )}
    </>
  );

  // ── Files Tab ────────────────────────────────────────────────
  const FilesContent = () => (
    <View style={styles.filesEmpty}>
      <Ionicons name="folder-outline" size={52} color={Colors.border} />
      <Text style={styles.filesEmptyTitle}>No files yet</Text>
      <Text style={styles.filesEmptySub}>File uploads coming soon</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {(clientsError || sessionsError) && (
        <ErrorBanner message={clientsError ?? sessionsError!} onRetry={onRefresh} />
      )}

      {client && <ClientHeader />}

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {(['overview', 'sessions', 'progress', 'notes', 'files'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'overview' ? 'Overview'
                : tab === 'sessions' ? `Sessions${sessions.length > 0 ? ` (${sessions.length})` : ''}`
                : tab === 'progress' ? 'Progress'
                : tab === 'notes' ? 'Notes'
                : 'Files'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewContent />}
      {activeTab === 'sessions' && <SessionsContent />}
      {activeTab === 'progress' && <ClientProgressTab clientId={id} />}
      {activeTab === 'notes' && <ClientNotesTab clientId={id} />}
      {activeTab === 'files' && <FilesContent />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },

  // Client header
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.accent + '18', borderWidth: 2, borderColor: Colors.accent + '50',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: Colors.accent },
  clientMeta: { flex: 1 },
  clientName: { ...Typography.subtitle, color: Colors.textPrimary, marginBottom: 2 },
  clientEmail: { ...Typography.caption, color: Colors.textSecondary },
  clientPhone: { ...Typography.caption, color: Colors.textSecondary },

  // Tab bar
  tabBar: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBarContent: { flexDirection: 'row', padding: 4 },
  tabBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Colors.accent },
  tabLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  tabLabelActive: { color: Colors.bg },

  // Package card
  packageCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.accent + '30', marginBottom: 14,
  },
  packageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  packageLabel: { ...Typography.label, color: Colors.accent, marginBottom: 4 },
  packageType: { ...Typography.subtitle, color: Colors.textPrimary },
  statusBadge: {
    backgroundColor: Colors.accent + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accent + '40',
  },
  statusWarning: { backgroundColor: '#FFA50018', borderColor: '#FFA50050' },
  statusExpired: { backgroundColor: Colors.border + '80', borderColor: Colors.border },
  statusText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  statusTextWarning: { color: '#FFA500' },
  statusTextExpired: { color: Colors.textSecondary },
  progressTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  progressLabel: { ...Typography.caption, color: Colors.textSecondary },

  // Log button
  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 13, paddingVertical: 14, marginBottom: 28,
  },
  logBtnText: { color: Colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },

  // Section
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary },
  addStrikeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF4D4D', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  addStrikeBtnText: { color: Colors.bg, fontSize: 11, fontWeight: '800' },

  // Strikes
  strikesCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  strikeDots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  strikeDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent',
  },
  strikeDotFilled: { backgroundColor: '#FF4D4D', borderColor: '#FF4D4D' },
  strikeCount: { ...Typography.caption, color: Colors.textSecondary, marginLeft: 4 },
  strikeCountMax: { color: '#FF4D4D', fontWeight: '700' },
  noStrikesText: { ...Typography.body, color: Colors.textSecondary, fontStyle: 'italic' },
  strikeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  strikeIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FF4D4D20', borderWidth: 1, borderColor: '#FF4D4D40',
    justifyContent: 'center', alignItems: 'center',
  },
  strikeIconText: { fontSize: 14 },
  strikeInfo: { flex: 1 },
  strikeLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  strikeDate: { ...Typography.caption, color: Colors.textSecondary },
  strikeReason: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  strikeTip: { ...Typography.caption, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },

  // Sessions
  sessionCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  sessionCardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sessionDate: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  durationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  durationText: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  exRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  exBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 6 },
  exDetails: { flex: 1 },
  exName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  exMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  sessionNotes: {
    ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },

  // Files
  filesEmpty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  filesEmptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  filesEmptySub: { ...Typography.body, color: Colors.textSecondary },

  // Strike inline input
  strikeInputCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FF4D4D50', marginBottom: 12,
  },
  strikeInputLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  strikeInputField: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 10, color: Colors.textPrimary, fontSize: 14, marginBottom: 10,
  },
  strikeInputBtns: { flexDirection: 'row', gap: 8 },
  strikeInputCancel: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  strikeInputCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  strikeInputConfirm: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#FF4D4D', alignItems: 'center',
  },
  strikeInputConfirmText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Shared
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 24,
    alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textSecondary },
});
