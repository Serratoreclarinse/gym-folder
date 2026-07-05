import { useState } from 'react';
import {
  Dimensions, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useClientMeasurements, BodyMeasurement } from '@/hooks/useBodyMeasurements';
import { Colors, Typography } from '@/constants/theme';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 48;
const CHART_H = 160;
const PAD = { top: 16, right: 8, bottom: 32, left: 40 };

type Range = '30' | '90' | 'all';

function WeightChart({ data }: { data: BodyMeasurement[] }) {
  const points = [...data].reverse().filter((m) => m.weight_kg != null);
  if (points.length < 2) return (
    <View style={styles.chartEmpty}>
      <Text style={styles.chartEmptyText}>Log at least 2 entries to see the graph</Text>
    </View>
  );

  const weights = points.map((m) => m.weight_kg as number);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const xOf = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const yOf = (w: number) => PAD.top + (1 - (w - minW) / range) * innerH;

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(p.weight_kg as number)}`).join(' ');

  const yLabels = [minW, (minW + maxW) / 2, maxW].map((v) => v.toFixed(1));

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {yLabels.map((label, i) => {
        const y = PAD.top + (1 - i * 0.5) * innerH;
        return (
          <SvgText key={i} x={PAD.left - 6} y={y + 4} fontSize={9} fill={Colors.textSecondary} textAnchor="end">
            {label}
          </SvgText>
        );
      })}
      <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke={Colors.border} strokeWidth={1} />
      <Path d={d} stroke={Colors.accent} strokeWidth={2} fill="none" />
      {points.map((p, i) => (
        <Circle key={i} cx={xOf(i)} cy={yOf(p.weight_kg as number)} r={3} fill={Colors.accent} />
      ))}
      {[0, Math.floor(points.length / 2), points.length - 1].map((i) => {
        if (i >= points.length) return null;
        const label = new Date(points[i].logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <SvgText key={i} x={xOf(i)} y={CHART_H - 6} fontSize={9} fill={Colors.textSecondary} textAnchor="middle">
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function MeasRow({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value == null) return null;
  return (
    <View style={styles.measRow}>
      <Text style={styles.measLabel}>{label}</Text>
      <Text style={styles.measValue}>{value} {unit}</Text>
    </View>
  );
}

export function ClientMeasurementsTab({ clientId }: { clientId: string }) {
  const { measurements, loading } = useClientMeasurements(clientId);
  const [range, setRange] = useState<Range>('30');

  const filtered = measurements.filter((m) => {
    if (range === 'all') return true;
    const days = Number(range);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(m.logged_at) >= cutoff;
  });

  if (loading) return <View style={styles.center}><Text style={styles.emptyText}>Loading…</Text></View>;

  if (measurements.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="body-outline" size={40} color={Colors.textSecondary} />
        <Text style={styles.emptyTitle}>No measurements yet</Text>
        <Text style={styles.emptyText}>Your client can log their weight and body measurements from their Records screen</Text>
      </View>
    );
  }

  const latest = measurements[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Latest snapshot */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>LATEST — {new Date(latest.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
        <View style={styles.latestRow}>
          {latest.weight_kg != null && (
            <View style={styles.latestStat}>
              <Text style={styles.latestNum}>{latest.weight_kg}</Text>
              <Text style={styles.latestUnit}>kg</Text>
            </View>
          )}
          {latest.body_fat_pct != null && (
            <View style={styles.latestStat}>
              <Text style={styles.latestNum}>{latest.body_fat_pct}</Text>
              <Text style={styles.latestUnit}>% fat</Text>
            </View>
          )}
          {latest.muscle_mass_kg != null && (
            <View style={styles.latestStat}>
              <Text style={styles.latestNum}>{latest.muscle_mass_kg}</Text>
              <Text style={styles.latestUnit}>kg muscle</Text>
            </View>
          )}
        </View>
        {(latest.chest_cm || latest.waist_cm || latest.hips_cm || latest.arms_cm || latest.thighs_cm) && (
          <View style={styles.measGrid}>
            <MeasRow label="Chest" value={latest.chest_cm} unit="cm" />
            <MeasRow label="Waist" value={latest.waist_cm} unit="cm" />
            <MeasRow label="Hips" value={latest.hips_cm} unit="cm" />
            <MeasRow label="Arms" value={latest.arms_cm} unit="cm" />
            <MeasRow label="Thighs" value={latest.thighs_cm} unit="cm" />
          </View>
        )}
        {latest.notes ? <Text style={styles.noteText}>{latest.notes}</Text> : null}
      </View>

      {/* Weight chart */}
      {filtered.some((m) => m.weight_kg != null) && (
        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionLabel}>WEIGHT TREND</Text>
            <View style={styles.rangeRow}>
              {(['30', '90', 'all'] as Range[]).map((r) => (
                <Pressable key={r} style={[styles.rangeBtn, range === r && styles.rangeBtnActive]} onPress={() => setRange(r)}>
                  <Text style={[styles.rangeBtnText, range === r && styles.rangeBtnTextActive]}>
                    {r === 'all' ? 'All' : `${r}d`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <WeightChart data={filtered} />
        </View>
      )}

      {/* History list */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>HISTORY</Text>
        {filtered.map((m) => (
          <View key={m.id} style={styles.histRow}>
            <Text style={styles.histDate}>
              {new Date(m.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
            <View style={styles.histStats}>
              {m.weight_kg != null && <Text style={styles.histStat}>{m.weight_kg} kg</Text>}
              {m.body_fat_pct != null && <Text style={styles.histStatMuted}>{m.body_fat_pct}% fat</Text>}
              {m.muscle_mass_kg != null && <Text style={styles.histStatMuted}>{m.muscle_mass_kg} kg muscle</Text>}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, textAlign: 'center' },
  emptyText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: { margin: 16, marginBottom: 0, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  sectionLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 12 },
  latestRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  latestStat: { alignItems: 'center' },
  latestNum: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  latestUnit: { ...Typography.caption, color: Colors.textSecondary },
  measGrid: { gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  measRow: { flexDirection: 'row', justifyContent: 'space-between' },
  measLabel: { ...Typography.body, color: Colors.textSecondary },
  measValue: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  noteText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 8, fontStyle: 'italic' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rangeRow: { flexDirection: 'row', gap: 4 },
  rangeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  rangeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  rangeBtnText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  rangeBtnTextActive: { color: Colors.bg },
  chartEmpty: { height: 80, alignItems: 'center', justifyContent: 'center' },
  chartEmptyText: { ...Typography.caption, color: Colors.textSecondary },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  histDate: { width: 60, ...Typography.caption, color: Colors.textSecondary },
  histStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  histStat: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  histStatMuted: { ...Typography.caption, color: Colors.textSecondary },
});
