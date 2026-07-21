import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useProgress, ProgressEntry, NewProgressEntry } from '@/hooks/useProgress';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricKey = 'weight' | 'body_fat' | 'muscle_mass';

type FormState = {
  date: string;
  weight: string;
  body_fat: string;
  muscle_mass: string;
  waist: string;
  hip: string;
  chest: string;
  arms: string;
  notes: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'body_fat', label: 'Body Fat', unit: '%' },
  { key: 'muscle_mass', label: 'Muscle', unit: 'kg' },
];

const CHART_HEIGHT = 180;
const CHART_L = 40;
const CHART_R = 8;
const CHART_T = 10;
const CHART_B = 26;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split('T')[0];

function getMetricValue(entry: ProgressEntry, metric: MetricKey): number | null {
  if (metric === 'weight') return entry.weight;
  if (metric === 'body_fat') return entry.body_fat_percentage;
  if (metric === 'muscle_mass') return entry.muscle_mass;
  return null;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function entryToForm(e: ProgressEntry): FormState {
  return {
    date: e.date,
    weight: e.weight != null ? String(e.weight) : '',
    body_fat: e.body_fat_percentage != null ? String(e.body_fat_percentage) : '',
    muscle_mass: e.muscle_mass != null ? String(e.muscle_mass) : '',
    waist: e.waist != null ? String(e.waist) : '',
    hip: e.hip != null ? String(e.hip) : '',
    chest: e.chest != null ? String(e.chest) : '',
    arms: e.arms != null ? String(e.arms) : '',
    notes: e.notes ?? '',
  };
}

function blankForm(): FormState {
  return {
    date: todayISO(),
    weight: '', body_fat: '', muscle_mass: '',
    waist: '', hip: '', chest: '', arms: '', notes: '',
  };
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LineChart({
  data,
  width,
  yMin,
  yMax,
}: {
  data: { value: number; date: string }[];
  width: number;
  yMin: number;
  yMax: number;
}) {
  const { colors } = useTheme();

  const drawW = width - CHART_L - CHART_R;
  const drawH = CHART_HEIGHT - CHART_T - CHART_B;

  const toX = (i: number) =>
    CHART_L + (data.length > 1 ? (i / (data.length - 1)) * drawW : drawW / 2);
  const toY = (val: number) =>
    CHART_T + (1 - (val - yMin) / (yMax - yMin)) * drawH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`)
    .join(' ');

  const fmtY = (v: number) => {
    const r = Math.round(v * 10) / 10;
    return r === Math.floor(r) ? String(Math.floor(r)) : r.toFixed(1);
  };

  const gridVals = [yMax, (yMax + yMin) / 2, yMin];

  const allXIndices = data.length <= 3
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];
  const xLabelIndices = [...new Set(allXIndices)];

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {/* Grid lines + Y labels */}
      {gridVals.map((val, i) => (
        <G key={`g${i}`}>
          <Line
            x1={CHART_L} y1={toY(val)}
            x2={width - CHART_R} y2={toY(val)}
            stroke={colors.border}
            strokeWidth={1}
          />
          <SvgText
            x={CHART_L - 4}
            y={toY(val) + 4}
            textAnchor="end"
            fontSize={9}
            fill={colors.textSecondary}
          >
            {fmtY(val)}
          </SvgText>
        </G>
      ))}

      {/* Connecting line */}
      <Path
        d={linePath}
        stroke={colors.accent}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Area fill */}
      <Path
        d={`${linePath} L${toX(data.length - 1).toFixed(1)},${(CHART_T + drawH).toFixed(1)} L${CHART_L.toFixed(1)},${(CHART_T + drawH).toFixed(1)} Z`}
        fill={colors.accent}
        fillOpacity={0.08}
      />

      {/* Dots */}
      {data.map((d, i) => (
        <Circle
          key={`dot${i}`}
          cx={toX(i)}
          cy={toY(d.value)}
          r={4.5}
          fill={colors.accent}
          stroke={colors.bg}
          strokeWidth={2}
        />
      ))}

      {/* X labels */}
      {xLabelIndices.map((idx) => {
        const [, mm, dd] = data[idx].date.split('-');
        const x = toX(idx);
        const anchor = idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle';
        return (
          <SvgText
            key={`xl${idx}`}
            x={x}
            y={CHART_HEIGHT - 4}
            textAnchor={anchor}
            fontSize={9}
            fill={colors.textSecondary}
          >
            {`${mm}/${dd}`}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Measurement Form ─────────────────────────────────────────────────────────

function MeasurementForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: ProgressEntry | null;
  onSave: (data: FormState) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const fm = useMemo(() => makeFmStyles(colors), [colors]);

  const [form, setForm] = useState<FormState>(entry ? entryToForm(entry) : blankForm());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const set = (field: keyof FormState) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const numericSet = (field: keyof FormState) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v.replace(/[^0-9.]/g, '') }));

  const canSave = form.date.trim().length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={fm.handle} />
      <View style={fm.header}>
        <Text style={fm.title}>{entry ? 'EDIT MEASUREMENT' : 'LOG MEASUREMENT'}</Text>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={fm.scroll}
        contentContainerStyle={fm.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Date */}
        <Text style={fm.label}>DATE</Text>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={new Date(form.date + 'T00:00:00')}
            mode="date"
            display="compact"
            onChange={(_, selected) => {
              if (selected) setForm((p) => ({ ...p, date: selected.toISOString().split('T')[0] }));
            }}
            style={{ alignSelf: 'flex-start', marginLeft: -8, marginBottom: 12 }}
          />
        ) : (
          <>
            <Pressable style={fm.datePressable} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={fm.datePressableText}>{fmtDate(form.date)}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(form.date + 'T00:00:00')}
                mode="date"
                display="default"
                onChange={(_, selected) => {
                  setShowDatePicker(false);
                  if (selected) setForm((p) => ({ ...p, date: selected.toISOString().split('T')[0] }));
                }}
              />
            )}
          </>
        )}

        {/* Main stats */}
        <Text style={[fm.label, { marginTop: 16 }]}>MAIN STATS</Text>
        <View style={fm.row}>
          <View style={fm.halfField}>
            <Text style={fm.subLabel}>Weight (kg)</Text>
            <TextInput
              style={[fm.input, { color: colors.textPrimary }]}
              value={form.weight}
              onChangeText={numericSet('weight')}
              placeholder="70.5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={fm.halfField}>
            <Text style={fm.subLabel}>Body Fat (%)</Text>
            <TextInput
              style={[fm.input, { color: colors.textPrimary }]}
              value={form.body_fat}
              onChangeText={numericSet('body_fat')}
              placeholder="18.5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Text style={fm.subLabel}>Muscle Mass (kg)</Text>
        <TextInput
          style={[fm.input, { color: colors.textPrimary }]}
          value={form.muscle_mass}
          onChangeText={numericSet('muscle_mass')}
          placeholder="35.0"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
        />

        {/* Body measurements */}
        <Text style={[fm.label, { marginTop: 16 }]}>BODY MEASUREMENTS (cm)</Text>
        <View style={fm.row}>
          <View style={fm.halfField}>
            <Text style={fm.subLabel}>Waist</Text>
            <TextInput
              style={[fm.input, { color: colors.textPrimary }]}
              value={form.waist}
              onChangeText={numericSet('waist')}
              placeholder="80"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={fm.halfField}>
            <Text style={fm.subLabel}>Hip</Text>
            <TextInput
              style={[fm.input, { color: colors.textPrimary }]}
              value={form.hip}
              onChangeText={numericSet('hip')}
              placeholder="95"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <View style={fm.row}>
          <View style={fm.halfField}>
            <Text style={fm.subLabel}>Chest</Text>
            <TextInput
              style={[fm.input, { color: colors.textPrimary }]}
              value={form.chest}
              onChangeText={numericSet('chest')}
              placeholder="100"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={fm.halfField}>
            <Text style={fm.subLabel}>Arms</Text>
            <TextInput
              style={[fm.input, { color: colors.textPrimary }]}
              value={form.arms}
              onChangeText={numericSet('arms')}
              placeholder="35"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Notes */}
        <Text style={[fm.label, { marginTop: 16 }]}>NOTES</Text>
        <TextInput
          style={[fm.input, fm.notesInput, { color: colors.textPrimary }]}
          value={form.notes}
          onChangeText={set('notes')}
          placeholder="Any observations…"
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={3}
        />

        <Pressable
          style={[fm.saveBtn, !canSave && fm.saveBtnDisabled]}
          onPress={() => canSave && onSave(form)}
          disabled={!canSave}
        >
          <Text style={fm.saveBtnText}>{entry ? 'UPDATE' : 'SAVE'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Main Progress Tab ─────────────────────────────────────────────────────────

export function ClientProgressTab({ clientId }: { clientId: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { entries, loading, addEntry, updateEntry, deleteEntry } = useProgress(clientId);
  const { width: screenWidth } = useWindowDimensions();

  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('weight');
  const [timeRange, setTimeRange] = useState<'3m' | 'all'>('3m');
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<ProgressEntry | null>(null);
  const [formKey, setFormKey] = useState(0);

  // ── Strength chart state ──────────────────────────────────────────────────
  type StrengthSession = { date: string; exercises: Array<{ exercise_name: string; weight: string | null }> };
  const [strengthSessions, setStrengthSessions] = useState<StrengthSession[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('workout_sessions')
        .select('session_date, exercises')
        .eq('client_id', clientId)
        .order('session_date', { ascending: true })
        .limit(500);
      if (cancelled) return;
      const parsed: StrengthSession[] = (data ?? []).map((row: any) => ({
        date: row.session_date,
        exercises: Array.isArray(row.exercises) ? row.exercises
          : typeof row.exercises === 'string'
            ? (() => { try { return JSON.parse(row.exercises); } catch { return []; } })()
            : [],
      }));
      setStrengthSessions(parsed);
      const names = new Set<string>();
      for (const sess of parsed) {
        for (const ex of sess.exercises) {
          if (ex.exercise_name && !isNaN(parseFloat(ex.weight ?? ''))) names.add(ex.exercise_name);
        }
      }
      const first = [...names][0];
      if (first && !cancelled) setSelectedExercise(first);
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const exerciseNames = useMemo(() => {
    const names = new Set<string>();
    for (const sess of strengthSessions) {
      for (const ex of sess.exercises) {
        if (ex.exercise_name && !isNaN(parseFloat(ex.weight ?? ''))) names.add(ex.exercise_name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [strengthSessions]);

  const strengthChartData = useMemo(() => {
    if (!selectedExercise) return [];
    const byDate = new Map<string, number>();
    for (const sess of strengthSessions) {
      for (const ex of sess.exercises) {
        if (ex.exercise_name !== selectedExercise) continue;
        const w = parseFloat(ex.weight ?? '');
        if (isNaN(w) || w <= 0) continue;
        const prev = byDate.get(sess.date) ?? 0;
        if (w > prev) byDate.set(sess.date, w);
      }
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  }, [strengthSessions, selectedExercise]);

  const strengthPR = strengthChartData.length > 0
    ? strengthChartData.reduce((best, d) => d.value > best.value ? d : best)
    : null;

  // ─────────────────────────────────────────────────────────────────────────

  const openForm = (entry: ProgressEntry | null) => {
    setEditEntry(entry);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const closeForm = () => {
    Keyboard.dismiss();
    setShowForm(false);
  };

  // ── Data derivations ──────────────────────────────────────────────────────

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const filteredEntries = timeRange === '3m'
    ? entries.filter((e) => new Date(e.date + 'T00:00:00') >= cutoff)
    : entries;

  const availableMetrics = METRICS.filter((m) =>
    entries.some((e) => getMetricValue(e, m.key) != null)
  );

  const currentMetric = availableMetrics.find((m) => m.key === selectedMetric)
    ?? availableMetrics[0]
    ?? METRICS[0];

  const chartData = filteredEntries
    .filter((e) => getMetricValue(e, currentMetric.key) != null)
    .map((e) => ({ value: getMetricValue(e, currentMetric.key) as number, date: e.date }));

  const chartValues = chartData.map((d) => d.value);
  const rawMin = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const rawMax = chartValues.length > 0 ? Math.max(...chartValues) : 0;
  const range = rawMax - rawMin;
  const pad = range < 1 ? 1 : range * 0.15;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const weightEntries = entries.filter((e) => e.weight != null);
  const startWeight = weightEntries.length > 0 ? (weightEntries[0].weight as number) : null;
  const currentWeight = weightEntries.length > 0 ? (weightEntries[weightEntries.length - 1].weight as number) : null;
  const weightDelta = startWeight != null && currentWeight != null ? currentWeight - startWeight : null;

  const firstDate = entries.length > 0 ? new Date(entries[0].date + 'T00:00:00') : null;
  const weeksTracked = firstDate
    ? Math.max(0, Math.floor((Date.now() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : 0;

  const chartWidth = screenWidth - 72;

  // ── Form save handler ─────────────────────────────────────────────────────

  const handleFormSave = (form: FormState) => {
    closeForm();
    const data: NewProgressEntry = {
      client_id: clientId,
      date: form.date,
      weight: form.weight ? parseFloat(form.weight) : null,
      body_fat_percentage: form.body_fat ? parseFloat(form.body_fat) : null,
      muscle_mass: form.muscle_mass ? parseFloat(form.muscle_mass) : null,
      waist: form.waist ? parseFloat(form.waist) : null,
      hip: form.hip ? parseFloat(form.hip) : null,
      chest: form.chest ? parseFloat(form.chest) : null,
      arms: form.arms ? parseFloat(form.arms) : null,
      notes: form.notes.trim() || null,
    };
    if (editEntry) {
      updateEntry(editEntry.id, data).catch(() =>
        Alert.alert('Error', 'Failed to update measurement')
      );
    } else {
      addEntry(data).catch(() =>
        Alert.alert('Error', 'Failed to save measurement')
      );
    }
  };

  const handleEntryPress = (entry: ProgressEntry) => {
    Alert.alert(fmtDate(entry.date), 'What would you like to do?', [
      { text: 'Edit', onPress: () => openForm(entry) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete entry?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(entry.id) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const fmtW = (w: number | null) => w != null ? `${w} kg` : '—';
  const fmtDelta = (d: number | null) => {
    if (d === null) return '—';
    if (Math.abs(d) < 0.05) return 'No change';
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(1)} kg`;
  };
  const deltaColor = weightDelta == null ? colors.textSecondary
    : weightDelta < 0 ? '#4CAF50'
    : weightDelta > 0 ? colors.danger
    : colors.textSecondary;

  const FormModal = (
    <Modal visible={showForm} animationType="slide" transparent onRequestClose={closeForm}>
      <Pressable style={s.overlay} onPress={closeForm}>
        <Pressable style={[s.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <MeasurementForm
            key={formKey}
            entry={editEntry}
            onSave={handleFormSave}
            onCancel={closeForm}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!loading && entries.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <Ionicons name="trending-up-outline" size={52} color={colors.border} />
        <Text style={s.emptyTitle}>No Progress Logged Yet</Text>
        <Text style={s.emptySub}>Start tracking measurements to see this client's progress over time</Text>
        <Pressable style={s.emptyBtn} onPress={() => openForm(null)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.emptyBtnText}>LOG FIRST MEASUREMENT</Text>
        </Pressable>
        {FormModal}
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <>
      {/* Summary cards */}
      <View style={s.summaryGrid}>
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>STARTING</Text>
          <Text style={s.summaryValue}>{fmtW(startWeight)}</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>CURRENT</Text>
          <Text style={s.summaryValue}>{fmtW(currentWeight)}</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>TOTAL CHANGE</Text>
          <Text style={[s.summaryValue, { color: deltaColor }]}>{fmtDelta(weightDelta)}</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>WEEKS TRACKED</Text>
          <Text style={s.summaryValue}>{weeksTracked}</Text>
        </View>
      </View>

      {/* Add measurement button */}
      <Pressable style={s.addBtn} onPress={() => openForm(null)}>
        <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
        <Text style={s.addBtnText}>ADD MEASUREMENT</Text>
      </Pressable>

      {/* Chart section */}
      <View style={s.chartCard}>
        {/* Metric selector */}
        <View style={s.metricRow}>
          {METRICS.map((m) => {
            const hasData = entries.some((e) => getMetricValue(e, m.key) != null);
            const isActive = currentMetric.key === m.key;
            return (
              <Pressable
                key={m.key}
                style={[s.metricBtn, isActive && s.metricBtnActive, !hasData && s.metricBtnDisabled]}
                onPress={() => hasData && setSelectedMetric(m.key)}
                disabled={!hasData}
              >
                <Text style={[s.metricBtnText, isActive && s.metricBtnTextActive, !hasData && s.metricBtnTextDisabled]}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
          <View style={s.metricSpacer} />
          <Pressable
            style={[s.rangeBtn, timeRange === '3m' && s.rangeBtnActive]}
            onPress={() => setTimeRange('3m')}
          >
            <Text style={[s.rangeBtnText, timeRange === '3m' && s.rangeBtnTextActive]}>3M</Text>
          </Pressable>
          <Pressable
            style={[s.rangeBtn, timeRange === 'all' && s.rangeBtnActive]}
            onPress={() => setTimeRange('all')}
          >
            <Text style={[s.rangeBtnText, timeRange === 'all' && s.rangeBtnTextActive]}>ALL</Text>
          </Pressable>
        </View>

        {/* Graph area */}
        {chartData.length < 2 ? (
          <View style={s.chartPlaceholder}>
            <Ionicons name="stats-chart-outline" size={32} color={colors.border} />
            <Text style={s.chartPlaceholderText}>
              {chartData.length === 0
                ? 'No data in this time range'
                : 'Add more entries to see your progress graph'}
            </Text>
          </View>
        ) : (
          <View style={s.chartWrap}>
            <LineChart data={chartData} width={chartWidth} yMin={yMin} yMax={yMax} />
          </View>
        )}

        <Text style={s.unitLabel}>{currentMetric.label} ({currentMetric.unit})</Text>
      </View>

      {/* ── Strength Progress Chart ── */}
      {exerciseNames.length > 0 && (
        <>
          <Text style={s.sectionTitle}>STRENGTH PROGRESS</Text>
          <View style={s.chartCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
              contentContainerStyle={{ gap: 6, paddingRight: 8 }}
            >
              {exerciseNames.map((name) => (
                <Pressable
                  key={name}
                  style={[s.metricBtn, selectedExercise === name && s.metricBtnActive]}
                  onPress={() => setSelectedExercise(name)}
                >
                  <Text style={[s.metricBtnText, selectedExercise === name && s.metricBtnTextActive]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {strengthPR && (
              <View style={s.prRow}>
                <Text style={s.prLabel}>🏆 Personal Record</Text>
                <Text style={s.prValue}>{strengthPR.value} kg</Text>
                <Text style={s.prDate}>
                  {(() => {
                    const [, mm, dd] = strengthPR.date.split('-');
                    return `${mm}/${dd}`;
                  })()}
                </Text>
              </View>
            )}

            {strengthChartData.length < 2 ? (
              <View style={s.chartPlaceholder}>
                <Ionicons name="barbell-outline" size={32} color={colors.border} />
                <Text style={s.chartPlaceholderText}>
                  {strengthChartData.length === 0
                    ? 'No weight data for this exercise'
                    : 'Log more sessions to see strength trend'}
                </Text>
              </View>
            ) : (() => {
              const vals = strengthChartData.map((d) => d.value);
              const sMin = Math.min(...vals);
              const sMax = Math.max(...vals);
              const sPad = (sMax - sMin) < 1 ? 2 : (sMax - sMin) * 0.2;
              return (
                <View style={s.chartWrap}>
                  <LineChart
                    data={strengthChartData}
                    width={chartWidth}
                    yMin={sMin - sPad}
                    yMax={sMax + sPad}
                  />
                </View>
              );
            })()}
            <Text style={s.unitLabel}>Max weight per session (kg)</Text>
          </View>
        </>
      )}

      {/* History list */}
      <Text style={s.sectionTitle}>MEASUREMENT HISTORY</Text>
      {[...entries].reverse().map((entry) => {
        const parts: string[] = [];
        if (entry.weight != null) parts.push(`${entry.weight} kg`);
        if (entry.body_fat_percentage != null) parts.push(`${entry.body_fat_percentage}% BF`);
        if (entry.muscle_mass != null) parts.push(`${entry.muscle_mass} kg muscle`);

        const measurements: string[] = [];
        if (entry.waist != null) measurements.push(`W ${entry.waist}`);
        if (entry.hip != null) measurements.push(`H ${entry.hip}`);
        if (entry.chest != null) measurements.push(`C ${entry.chest}`);
        if (entry.arms != null) measurements.push(`A ${entry.arms}`);

        return (
          <Pressable
            key={entry.id}
            style={({ pressed }) => [s.historyCard, pressed && { opacity: 0.7 }]}
            onPress={() => handleEntryPress(entry)}
          >
            <View style={s.historyTop}>
              <Text style={s.historyDate}>{fmtDate(entry.date)}</Text>
              <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
            </View>
            {parts.length > 0 && (
              <Text style={s.historyStats}>{parts.join('  ·  ')}</Text>
            )}
            {measurements.length > 0 && (
              <Text style={s.historyMeasurements}>{measurements.join('  ·  ')} cm</Text>
            )}
            {entry.notes ? (
              <Text style={s.historyNotes} numberOfLines={1}>{entry.notes}</Text>
            ) : null}
          </Pressable>
        );
      })}

      {FormModal}
    </>
  );
}

// ─── Style factories ──────────────────────────────────────────────────────────

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 8 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
    emptySub: { ...Typography.body, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 16 },
    emptyBtn: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 13,
    },
    emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },

    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    summaryCard: {
      flex: 1,
      minWidth: '44%',
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    summaryLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 6, fontSize: 10 },
    summaryValue: { ...Typography.subtitle, color: c.textPrimary, fontSize: 17 },

    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1.5,
      borderColor: c.accent + '60',
      borderRadius: 12,
      paddingVertical: 12,
      marginBottom: 16,
      backgroundColor: c.accent + '10',
    },
    addBtnText: { color: c.accent, fontSize: 13, fontWeight: '800', letterSpacing: 1 },

    chartCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 20,
    },
    metricRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    metricBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bg,
    },
    metricBtnActive: { borderColor: c.accent, backgroundColor: c.accent },
    metricBtnDisabled: { opacity: 0.35 },
    metricBtnText: { fontSize: 11, fontWeight: '700', color: c.textSecondary },
    metricBtnTextActive: { color: '#fff' },
    metricBtnTextDisabled: { color: c.border },
    metricSpacer: { flex: 1 },
    rangeBtn: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: c.border,
    },
    rangeBtnActive: { borderColor: c.accent, backgroundColor: c.accent + '18' },
    rangeBtnText: { fontSize: 10, fontWeight: '800', color: c.textSecondary },
    rangeBtnTextActive: { color: c.accent },
    chartWrap: { marginHorizontal: -2 },
    chartPlaceholder: {
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    chartPlaceholderText: { ...Typography.caption, color: c.textSecondary, textAlign: 'center' },
    unitLabel: { ...Typography.label, color: c.textSecondary, textAlign: 'center', marginTop: 8, fontSize: 10 },

    prRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.accent + '12',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.accent + '40',
    },
    prLabel: { fontSize: 11, fontWeight: '700', color: c.accent, flex: 1 },
    prValue: { fontSize: 16, fontWeight: '800', color: c.accent },
    prDate: { fontSize: 10, fontWeight: '600', color: c.textSecondary },

    sectionTitle: { ...Typography.label, color: c.textSecondary, marginBottom: 12 },
    historyCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    historyDate: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    historyStats: { ...Typography.body, color: c.accent, fontWeight: '600', marginBottom: 2 },
    historyMeasurements: { ...Typography.caption, color: c.textSecondary, marginBottom: 2 },
    historyNotes: { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic', marginTop: 4 },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingBottom: 32,
    },
  });
}

function makeFmStyles(c: ColorScheme) {
  return StyleSheet.create({
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginTop: 12, marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 4,
    },
    title: { ...Typography.label, color: c.textPrimary, fontSize: 14 },
    scroll: { flexGrow: 0 },
    scrollContent: { padding: 20, paddingTop: 8 },
    label: { ...Typography.label, color: c.textSecondary, marginBottom: 8 },
    subLabel: { ...Typography.label, color: c.textSecondary, fontSize: 11, marginBottom: 6 },
    row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    halfField: { flex: 1 },
    input: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 15,
      marginBottom: 10,
    },
    notesInput: { minHeight: 72, textAlignVertical: 'top' },
    datePressable: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: 8, borderWidth: 1, borderColor: c.accent + '50',
      backgroundColor: c.accent + '10', alignSelf: 'flex-start', marginBottom: 12,
    },
    datePressableText: { fontSize: 14, fontWeight: '600', color: c.accent },
    saveBtn: {
      backgroundColor: c.accent,
      borderRadius: 13,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 4,
    },
    saveBtnDisabled: { opacity: 0.35 },
    saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1.2 },
  });
}
