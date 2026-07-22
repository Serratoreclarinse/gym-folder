import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';

type BugReport = {
  id: string;
  title: string;
  description: string;
  role: string;
  app_version: string | null;
  status: 'open' | 'resolved';
  created_at: string;
  submitter_name: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function RoleBadge({ role, colors }: { role: string; colors: ColorScheme }) {
  const config: Record<string, { label: string; color: string }> = {
    coach:  { label: 'Coach',  color: colors.accent },
    client: { label: 'Client', color: colors.success },
    admin:  { label: 'Admin',  color: '#9C27B0' },
  };
  const cfg = config[role] ?? { label: role, color: colors.textSecondary };
  return (
    <View style={[s.roleBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '50' }]}>
      <Text style={[s.roleBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export default function BugReportsScreen() {
  const { colors } = useTheme();

  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [resolving, setResolving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bug_reports')
      .select(`
        id, title, description, role, app_version, status, created_at,
        submitter:profiles!bug_reports_submitted_by_fkey ( name )
      `)
      .order('created_at', { ascending: false });

    setReports(
      (data ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        role: r.role,
        app_version: r.app_version ?? null,
        status: r.status,
        created_at: r.created_at,
        submitter_name: r.submitter?.name ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchReports(); }, [fetchReports]));

  const markResolved = async (id: string) => {
    setResolving(id);
    await supabase.from('bug_reports').update({ status: 'resolved' }).eq('id', id);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: 'resolved' } : r));
    setResolving(null);
  };

  const filtered = reports.filter((r) => filter === 'all' ? true : r.status === filter);
  const openCount = reports.filter((r) => r.status === 'open').length;

  return (
    <ScrollView
      style={[s.scroll, { backgroundColor: colors.bg }]}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReports} tintColor={colors.accent} />}
    >
      {/* Summary */}
      <View style={[s.summaryRow]}>
        <View style={[s.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.summaryNum, { color: colors.danger }]}>{openCount}</Text>
          <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Open</Text>
        </View>
        <View style={[s.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.summaryNum, { color: colors.success }]}>{reports.length - openCount}</Text>
          <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Resolved</Text>
        </View>
        <View style={[s.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.summaryNum, { color: colors.accent }]}>{reports.length}</Text>
          <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        {(['open', 'resolved', 'all'] as const).map((f) => (
          <Pressable
            key={f}
            style={[s.filterChip, { backgroundColor: colors.surface, borderColor: colors.border },
              filter === f && { backgroundColor: colors.accent, borderColor: colors.accent }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, { color: colors.textSecondary },
              filter === f && { color: colors.bg }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

      {!loading && filtered.length === 0 && (
        <View style={s.empty}>
          <Ionicons name="checkmark-circle-outline" size={52} color={colors.border} />
          <Text style={[s.emptyText, { color: colors.textSecondary }]}>
            {filter === 'open' ? 'No open bug reports' : 'No reports found'}
          </Text>
        </View>
      )}

      {filtered.map((r) => {
        const isExpanded = expanded === r.id;
        const isOpen = r.status === 'open';
        return (
          <Pressable
            key={r.id}
            style={[s.card, { backgroundColor: colors.surface, borderColor: isOpen ? colors.danger + '40' : colors.border }]}
            onPress={() => setExpanded(isExpanded ? null : r.id)}
          >
            {/* Card header */}
            <View style={s.cardTop}>
              <View style={[s.statusDot, { backgroundColor: isOpen ? colors.danger : colors.success }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitle, { color: colors.textPrimary }]} numberOfLines={isExpanded ? undefined : 1}>
                  {r.title}
                </Text>
                <View style={s.cardMeta}>
                  <RoleBadge role={r.role} colors={colors} />
                  {r.submitter_name && (
                    <Text style={[s.cardMetaText, { color: colors.textSecondary }]}>{r.submitter_name}</Text>
                  )}
                  <Text style={[s.cardMetaText, { color: colors.textSecondary }]}>·</Text>
                  <Text style={[s.cardMetaText, { color: colors.textSecondary }]}>{fmtDate(r.created_at)}</Text>
                </View>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16} color={colors.textSecondary}
              />
            </View>

            {/* Expanded */}
            {isExpanded && (
              <View style={[s.cardBody, { borderTopColor: colors.border }]}>
                <Text style={[s.descText, { color: colors.textSecondary }]}>{r.description}</Text>
                {r.app_version && (
                  <Text style={[s.versionText, { color: colors.textSecondary }]}>v{r.app_version}</Text>
                )}
                {isOpen && (
                  <Pressable
                    style={[s.resolveBtn, { backgroundColor: colors.success }, resolving === r.id && { opacity: 0.5 }]}
                    onPress={() => markResolved(r.id)}
                    disabled={resolving === r.id}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={s.resolveBtnText}>
                      {resolving === r.id ? 'Resolving…' : 'Mark Resolved'}
                    </Text>
                  </Pressable>
                )}
                {!isOpen && (
                  <View style={[s.resolvedBadge, { borderColor: colors.success + '40', backgroundColor: colors.success + '12' }]}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={[s.resolvedBadgeText, { color: colors.success }]}>Resolved</Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 12 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  summaryChip: {
    flex: 1, borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1,
  },
  summaryNum: { fontFamily: 'Montserrat_800ExtraBold', fontSize: 22, marginBottom: 2 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  filterText: { fontFamily: 'Montserrat_600SemiBold', fontSize: 12 },

  card: {
    borderRadius: 14, borderWidth: 1,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, padding: 14,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: 4, flexShrink: 0,
  },
  cardTitle: { fontFamily: 'Montserrat_600SemiBold', fontSize: 14, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardMetaText: { fontFamily: 'Inter_400Regular', fontSize: 12 },

  roleBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1,
  },
  roleBadgeText: { fontFamily: 'Montserrat_600SemiBold', fontSize: 10, letterSpacing: 0.3 },

  cardBody: {
    padding: 14, paddingTop: 12,
    borderTopWidth: 1, gap: 10,
  },
  descText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },
  versionText: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'right' },

  resolveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  resolveBtnText: { fontFamily: 'Montserrat_700Bold', fontSize: 13, color: '#fff' },

  resolvedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  resolvedBadgeText: { fontFamily: 'Montserrat_600SemiBold', fontSize: 12 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
});
