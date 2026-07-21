import { useMemo, useState } from 'react';
import {
  Dimensions, Keyboard, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useClientMeasurements, BodyMeasurement } from '@/hooks/useBodyMeasurements';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 48;
const CHART_H = 160;
const PAD = { top: 16, right: 8, bottom: 32, left: 40 };

type Range = '30' | '90' | 'all';

function WeightChart({ data }: { data: BodyMeasurement[] }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const points = [...data].reverse().filter((m) => m.weight_kg != null);
  if (points.length < 2) return (
    <View style={s.chartEmpty}>
      <Text style={s.chartEmptyText}>Log at least 2 entries to see the graph</Text>
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
          <SvgText key={i} x={PAD.left - 6} y={y + 4} fontSize={9} fill={colors.textSecondary} textAnchor="end">
            {label}
          </SvgText>
        );
      })}
      <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke={colors.border} strokeWidth={1} />
      <Path d={d} stroke={colors.accent} strokeWidth={2} fill="none" />
      {points.map((p, i) => (
        <Circle key={i} cx={xOf(i)} cy={yOf(p.weight_kg as number)} r={3} fill={colors.accent} />
      ))}
      {[0, Math.floor(points.length / 2), points.length - 1].map((i) => {
        if (i >= points.length) return null;
        const label = new Date(points[i].logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <SvgText key={i} x={xOf(i)} y={CHART_H - 6} fontSize={9} fill={colors.textSecondary} textAnchor="middle">
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function MeasRow({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (value == null) return null;
  return (
    <View style={s.measRow}>
      <Text style={s.measLabel}>{label}</Text>
      <Text style={s.measValue}>{value} {unit}</Text>
    </View>
  );
}

export function ClientMeasurementsTab({ clientId }: { clientId: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { measurements, loading, upsert } = useClientMeasurements(clientId);
  const [range, setRange] = useState<Range>('30');

  const [logModal, setLogModal] = useState(false);
  const [lWeight, setLWeight] = useState('');
  const [lFat, setLFat] = useState('');
  const [lMuscle, setLMuscle] = useState('');
  const [lChest, setLChest] = useState('');
  const [lWaist, setLWaist] = useState('');
  const [lHips, setLHips] = useState('');
  const [lArms, setLArms] = useState('');
  const [lThighs, setLThighs] = useState('');
  const [lNotes, setLNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  function openLogModal() {
    const today = measurements.find((m) => m.logged_at === new Date().toISOString().slice(0, 10));
    setLWeight(today?.weight_kg?.toString() ?? '');
    setLFat(today?.body_fat_pct?.toString() ?? '');
    setLMuscle(today?.muscle_mass_kg?.toString() ?? '');
    setLChest(today?.chest_cm?.toString() ?? '');
    setLWaist(today?.waist_cm?.toString() ?? '');
    setLHips(today?.hips_cm?.toString() ?? '');
    setLArms(today?.arms_cm?.toString() ?? '');
    setLThighs(today?.thighs_cm?.toString() ?? '');
    setLNotes('');
    setLogError(null);
    setLogModal(true);
  }

  function closeLogModal() {
    Keyboard.dismiss();
    setLogModal(false);
  }

  async function handleSave() {
    const parse = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    if (!lWeight && !lFat && !lMuscle && !lChest && !lWaist && !lHips && !lArms && !lThighs) {
      setLogError('Enter at least one measurement.');
      return;
    }
    setLogError(null);
    setSaving(true);
    try {
      const err = await upsert({
        logged_at: new Date().toISOString().slice(0, 10),
        weight_kg: parse(lWeight),
        body_fat_pct: parse(lFat),
        muscle_mass_kg: parse(lMuscle),
        chest_cm: parse(lChest),
        waist_cm: parse(lWaist),
        hips_cm: parse(lHips),
        arms_cm: parse(lArms),
        thighs_cm: parse(lThighs),
        notes: lNotes.trim() || null,
      });
      if (err) { setLogError(err); return; }
      closeLogModal();
    } catch (e: any) {
      setLogError(e?.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const filtered = measurements.filter((m) => {
    if (range === 'all') return true;
    const days = Number(range);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(m.logged_at) >= cutoff;
  });

  const LogModal = (
    <Modal visible={logModal} transparent animationType="slide" onRequestClose={closeLogModal}>
      <Pressable style={s.backdrop} onPress={closeLogModal} />
      <ScrollView
        style={[s.modalSheet, { backgroundColor: colors.surface }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.modalTitle}>Log Measurements</Text>
        <Text style={s.modalSub}>
          Today — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>

        <View style={s.inputRow}>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Weight (kg)</Text>
            <TextInput style={s.input} placeholder="e.g. 75.0" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" value={lWeight} onChangeText={setLWeight} />
          </View>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Body fat (%)</Text>
            <TextInput style={s.input} placeholder="e.g. 18.0" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" value={lFat} onChangeText={setLFat} />
          </View>
        </View>
        <View style={s.inputRow}>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Muscle mass (kg)</Text>
            <TextInput style={s.input} placeholder="e.g. 35.0" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" value={lMuscle} onChangeText={setLMuscle} />
          </View>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Chest (cm)</Text>
            <TextInput style={s.input} placeholder="e.g. 95" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" value={lChest} onChangeText={setLChest} />
          </View>
        </View>
        <View style={s.inputRow}>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Waist (cm)</Text>
            <TextInput style={s.input} placeholder="e.g. 80" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" value={lWaist} onChangeText={setLWaist} />
          </View>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Hips (cm)</Text>
            <TextInput style={s.input} placeholder="e.g. 98" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" value={lHips} onChangeText={setLHips} />
          </View>
        </View>
        <View style={s.inputRow}>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Arms (cm)</Text>
            <TextInput style={s.input} placeholder="e.g. 35" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" value={lArms} onChangeText={setLArms} />
          </View>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Thighs (cm)</Text>
            <TextInput style={s.input} placeholder="e.g. 58" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" value={lThighs} onChangeText={setLThighs} />
          </View>
        </View>
        <TextInput
          style={[s.input, { marginBottom: 16 }]}
          placeholder="Notes (optional)"
          placeholderTextColor={colors.textSecondary}
          value={lNotes} onChangeText={setLNotes}
          onSubmitEditing={Keyboard.dismiss}
        />
        {logError ? <Text style={s.errorText}>{logError}</Text> : null}
        <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Modal>
  );

  if (loading) return (
    <View style={s.center}>
      <Text style={s.emptyText}>Loading…</Text>
      {LogModal}
    </View>
  );

  if (measurements.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="body-outline" size={40} color={colors.textSecondary} />
        <Text style={s.emptyTitle}>No measurements yet</Text>
        <Text style={s.emptyText}>Log your client's measurements after each InBody scan or check-in.</Text>
        <Pressable style={s.logBtn} onPress={openLogModal}>
          <Ionicons name="add-outline" size={16} color="#fff" />
          <Text style={s.logBtnText}>Log Measurement</Text>
        </Pressable>
        {LogModal}
      </View>
    );
  }

  const latest = measurements[0];

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.logHeader}>
          <Pressable style={s.logBtn} onPress={openLogModal}>
            <Ionicons name="add-outline" size={16} color="#fff" />
            <Text style={s.logBtnText}>Log Measurement</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.sectionLabel}>
            LATEST — {new Date(latest.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <View style={s.latestRow}>
            {latest.weight_kg != null && (
              <View style={s.latestStat}>
                <Text style={s.latestNum}>{latest.weight_kg}</Text>
                <Text style={s.latestUnit}>kg</Text>
              </View>
            )}
            {latest.body_fat_pct != null && (
              <View style={s.latestStat}>
                <Text style={s.latestNum}>{latest.body_fat_pct}</Text>
                <Text style={s.latestUnit}>% fat</Text>
              </View>
            )}
            {latest.muscle_mass_kg != null && (
              <View style={s.latestStat}>
                <Text style={s.latestNum}>{latest.muscle_mass_kg}</Text>
                <Text style={s.latestUnit}>kg muscle</Text>
              </View>
            )}
          </View>
          {(latest.chest_cm || latest.waist_cm || latest.hips_cm || latest.arms_cm || latest.thighs_cm) && (
            <View style={s.measGrid}>
              <MeasRow label="Chest"  value={latest.chest_cm}  unit="cm" />
              <MeasRow label="Waist"  value={latest.waist_cm}  unit="cm" />
              <MeasRow label="Hips"   value={latest.hips_cm}   unit="cm" />
              <MeasRow label="Arms"   value={latest.arms_cm}   unit="cm" />
              <MeasRow label="Thighs" value={latest.thighs_cm} unit="cm" />
            </View>
          )}
          {latest.notes ? <Text style={s.noteText}>{latest.notes}</Text> : null}
        </View>

        {filtered.some((m) => m.weight_kg != null) && (
          <View style={s.card}>
            <View style={s.chartHeader}>
              <Text style={s.sectionLabel}>WEIGHT TREND</Text>
              <View style={s.rangeRow}>
                {(['30', '90', 'all'] as Range[]).map((r) => (
                  <Pressable key={r} style={[s.rangeBtn, range === r && s.rangeBtnActive]} onPress={() => setRange(r)}>
                    <Text style={[s.rangeBtnText, range === r && s.rangeBtnTextActive]}>
                      {r === 'all' ? 'All' : `${r}d`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <WeightChart data={filtered} />
          </View>
        )}

        <View style={s.card}>
          <Text style={s.sectionLabel}>HISTORY</Text>
          {filtered.map((m) => (
            <View key={m.id} style={s.histRow}>
              <Text style={s.histDate}>
                {new Date(m.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
              <View style={s.histStats}>
                {m.weight_kg != null && <Text style={s.histStat}>{m.weight_kg} kg</Text>}
                {m.body_fat_pct != null && <Text style={s.histStatMuted}>{m.body_fat_pct}% fat</Text>}
                {m.muscle_mass_kg != null && <Text style={s.histStatMuted}>{m.muscle_mass_kg} kg muscle</Text>}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {LogModal}
    </>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, textAlign: 'center' },
    emptyText: { ...Typography.body, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },

    logHeader: { paddingHorizontal: 16, paddingTop: 16, alignItems: 'flex-end' },
    logBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.accent, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 9,
    },
    logBtnText: { ...Typography.label, color: '#fff', fontSize: 13 },

    card: { margin: 16, marginBottom: 0, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16 },
    sectionLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 12 },
    latestRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
    latestStat: { alignItems: 'center' },
    latestNum: { fontSize: 28, fontWeight: '700', color: c.textPrimary },
    latestUnit: { ...Typography.caption, color: c.textSecondary },
    measGrid: { gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
    measRow: { flexDirection: 'row', justifyContent: 'space-between' },
    measLabel: { ...Typography.body, color: c.textSecondary },
    measValue: { ...Typography.body, color: c.textPrimary, fontWeight: '500' },
    noteText: { ...Typography.caption, color: c.textSecondary, marginTop: 8, fontStyle: 'italic' },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    rangeRow: { flexDirection: 'row', gap: 4 },
    rangeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    rangeBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
    rangeBtnText: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
    rangeBtnTextActive: { color: '#fff' },
    chartEmpty: { height: 80, alignItems: 'center', justifyContent: 'center' },
    chartEmptyText: { ...Typography.caption, color: c.textSecondary },
    histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
    histDate: { width: 60, ...Typography.caption, color: c.textSecondary },
    histStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    histStat: { ...Typography.body, color: c.textPrimary, fontWeight: '500' },
    histStatMuted: { ...Typography.caption, color: c.textSecondary },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    modalSheet: {
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, maxHeight: '85%',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
    modalSub: { ...Typography.caption, color: c.textSecondary, marginBottom: 20 },
    inputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    inputGroup: { flex: 1, gap: 5 },
    inputLabel: { ...Typography.label, color: c.textSecondary, fontSize: 10 },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 11, ...Typography.body, color: c.textPrimary,
      backgroundColor: c.bg,
    },
    errorText: { color: c.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 },
    saveBtn: { backgroundColor: c.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
    saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}
