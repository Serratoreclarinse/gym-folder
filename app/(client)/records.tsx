import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useClientPRs, type PersonalRecord } from '@/hooks/useClientPRs';
import { useMyProgressPhotos, type ProgressPhoto } from '@/hooks/useProgressPhotos';
import { useMyMeasurements } from '@/hooks/useBodyMeasurements';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Typography } from '@/constants/theme';
import type { ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const SCREEN_W = Dimensions.get('window').width;
const PAD = 20;
const GAP = 3;
const COLS = 3;
const THUMB = (SCREEN_W - PAD * 2 - GAP * (COLS - 1)) / COLS;
const CHART_W = SCREEN_W - PAD * 2;
const CHART_H = 140;
const CP = { top: 12, right: 8, bottom: 28, left: 36 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
    label,
  };
}

async function buildReportHtml(
  userId: string,
  name: string,
  prs: PersonalRecord[],
): Promise<string> {
  const { start, end, label } = monthRange();

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('session_date, status, exercises')
    .eq('client_id', userId)
    .gte('session_date', start)
    .lte('session_date', end)
    .order('session_date', { ascending: true });

  const total     = sessions?.length ?? 0;
  const completed = sessions?.filter(s => s.status !== 'absent').length ?? 0;
  const absent    = total - completed;

  const sessionRows = (sessions ?? []).map(s => `
    <tr>
      <td>${fmtDate(s.session_date)}</td>
      <td style="color:${s.status === 'absent' ? '#FF4D4D' : '#4CAF50'}">
        ${s.status === 'absent' ? 'Absent' : 'Completed'}
      </td>
      <td>${((s.exercises as any[]) ?? []).length} exercises</td>
    </tr>`).join('');

  const prRows = prs.slice(0, 10).map((pr, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${pr.exercise_name}</td>
      <td><strong>${pr.best_weight_str}</strong></td>
      <td>${pr.session_count}&times;</td>
      <td>${fmtDate(pr.achieved_date)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;background:#fff;padding:40px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
  .brand{color:#e07b39;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  h1{font-size:28px;font-weight:800;margin-top:6px}
  .meta{font-size:12px;color:#6b7280;text-align:right}
  .sec{margin-bottom:28px}
  h2{font-size:12px;font-weight:700;color:#6b7280;letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px}
  .stats{display:flex;gap:12px;margin-bottom:20px}
  .sb{flex:1;background:#f9fafb;border-radius:10px;padding:16px;text-align:center}
  .sn{font-size:32px;font-weight:800;color:#e07b39}
  .sl{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#f3f4f6;padding:10px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280}
  td{padding:10px 12px;border-bottom:1px solid #f3f4f6}
  tr:last-child td{border-bottom:none}
  .none{color:#9ca3af;font-size:13px}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div class="brand">Monthly Progress Report</div>
    <h1>${name}</h1>
  </div>
  <div class="meta">
    <div><strong>${label}</strong></div>
    <div>Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
  </div>
</div>

<div class="sec">
  <h2>Attendance — ${label}</h2>
  <div class="stats">
    <div class="sb"><div class="sn">${total}</div><div class="sl">Total</div></div>
    <div class="sb"><div class="sn" style="color:#4CAF50">${completed}</div><div class="sl">Completed</div></div>
    <div class="sb"><div class="sn" style="color:#FF4D4D">${absent}</div><div class="sl">Absent</div></div>
  </div>
  ${total > 0
    ? `<table><thead><tr><th>Date</th><th>Status</th><th>Exercises</th></tr></thead><tbody>${sessionRows}</tbody></table>`
    : '<p class="none">No sessions this month.</p>'}
</div>

<div class="sec">
  <h2>Personal Records (All-Time Top 10)</h2>
  ${prs.length > 0
    ? `<table><thead><tr><th>#</th><th>Exercise</th><th>Best Weight</th><th>Performed</th><th>Achieved</th></tr></thead><tbody>${prRows}</tbody></table>`
    : '<p class="none">No personal records yet.</p>'}
</div>

<div class="footer">JHE Fitness &middot; ${label} Report &middot; Confidential</div>
</body>
</html>`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

function MiniWeightChart({ points }: { points: { logged_at: string; weight_kg: number }[] }) {
  const { colors } = useTheme();
  if (points.length < 2) return null;
  const weights = points.map((p) => p.weight_kg);
  const minW = Math.min(...weights), maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const iW = CHART_W - CP.left - CP.right;
  const iH = CHART_H - CP.top - CP.bottom;
  const x = (i: number) => CP.left + (i / (points.length - 1)) * iW;
  const y = (w: number) => CP.top + (1 - (w - minW) / range) * iH;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.weight_kg)}`).join(' ');
  const yLabels = [minW, maxW];
  return (
    <Svg width={CHART_W} height={CHART_H}>
      {yLabels.map((v, i) => (
        <SvgText key={i} x={CP.left - 4} y={y(v) + 4} fontSize={9} fill={colors.textSecondary} textAnchor="end">
          {v.toFixed(1)}
        </SvgText>
      ))}
      <Line x1={CP.left} y1={CP.top} x2={CP.left} y2={CP.top + iH} stroke={colors.border} strokeWidth={1} />
      <Line x1={CP.left} y1={CP.top + iH} x2={CP.left + iW} y2={CP.top + iH} stroke={colors.border} strokeWidth={1} />
      <Path d={d} stroke={colors.accent} strokeWidth={2} fill="none" />
      {points.map((p, i) => (
        <Circle key={i} cx={x(i)} cy={y(p.weight_kg)} r={3} fill={colors.accent} />
      ))}
      {[0, points.length - 1].map((i) => (
        <SvgText key={i} x={x(i)} y={CHART_H - 4} fontSize={9} fill={colors.textSecondary} textAnchor={i === 0 ? 'start' : 'end'}>
          {new Date(points[i].logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </SvgText>
      ))}
    </Svg>
  );
}

export default function RecordsScreen() {
  const { user, profile } = useAuth();
  const { prs, loading, refetch } = useClientPRs();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [generating, setGenerating] = useState(false);

  // Coach ID from active package
  const [coachId, setCoachId] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('packages')
      .select('coach_id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .single()
      .then(({ data }) => setCoachId(data?.coach_id ?? null));
  }, [user?.id]);

  // Body measurements
  const { measurements, upsert: upsertMeasurement } = useMyMeasurements(user?.id ?? undefined);
  const [measModal, setMeasModal] = useState(false);
  const [mWeight, setMWeight] = useState('');
  const [mFat, setMFat] = useState('');
  const [mMuscle, setMMuscle] = useState('');
  const [mChest, setMChest] = useState('');
  const [mWaist, setMWaist] = useState('');
  const [mHips, setMHips] = useState('');
  const [mArms, setMArms] = useState('');
  const [mThighs, setMThighs] = useState('');
  const [mNotes, setMNotes] = useState('');
  const [savingMeas, setSavingMeas] = useState(false);

  function openMeasModal() {
    const today = measurements.find((m) => m.logged_at === new Date().toISOString().slice(0, 10));
    setMWeight(today?.weight_kg?.toString() ?? '');
    setMFat(today?.body_fat_pct?.toString() ?? '');
    setMMuscle(today?.muscle_mass_kg?.toString() ?? '');
    setMChest(today?.chest_cm?.toString() ?? '');
    setMWaist(today?.waist_cm?.toString() ?? '');
    setMHips(today?.hips_cm?.toString() ?? '');
    setMArms(today?.arms_cm?.toString() ?? '');
    setMThighs(today?.thighs_cm?.toString() ?? '');
    setMNotes(today?.notes ?? '');
    setMeasModal(true);
  }

  async function handleSaveMeasurement() {
    const parse = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    if (!mWeight && !mFat && !mMuscle && !mChest && !mWaist && !mHips && !mArms && !mThighs) {
      Alert.alert('Nothing to save', 'Enter at least one measurement.');
      return;
    }
    setSavingMeas(true);
    const err = await upsertMeasurement({
      client_id: user!.id,
      logged_at: new Date().toISOString().slice(0, 10),
      weight_kg: parse(mWeight),
      body_fat_pct: parse(mFat),
      muscle_mass_kg: parse(mMuscle),
      chest_cm: parse(mChest),
      waist_cm: parse(mWaist),
      hips_cm: parse(mHips),
      arms_cm: parse(mArms),
      thighs_cm: parse(mThighs),
      notes: mNotes.trim() || null,
    });
    setSavingMeas(false);
    if (err) { Alert.alert('Error', err); return; }
    setMeasModal(false);
  }

  // Progress photos
  const { photos, sendPhoto, deletePhoto } = useMyProgressPhotos(user?.id ?? null);
  const [photoModal, setPhotoModal] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to send a progress photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    setPickedUri(result.assets[0].uri);
    setNoteText('');
    setPhotoModal(true);
  }

  async function handleSendPhoto() {
    if (!pickedUri || !coachId) return;
    setSending(true);
    const { error } = await sendPhoto(coachId, pickedUri, noteText);
    setSending(false);
    if (error) {
      Alert.alert('Upload failed', error);
    } else {
      setPhotoModal(false);
      setPickedUri(null);
      setNoteText('');
    }
  }

  function handleDeletePhoto(photo: ProgressPhoto) {
    Alert.alert('Delete photo?', 'This will permanently remove it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await deletePhoto(photo);
          if (error) Alert.alert('Error', error);
          if (viewing?.id === photo.id) setViewing(null);
        },
      },
    ]);
  }

  async function handleGenerateReport() {
    if (!user?.id) return;
    setGenerating(true);
    try {
      const html = await buildReportHtml(user.id, profile?.name ?? 'Client', prs);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF saved', uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not generate report');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
      >
        {/* ── PRs header ── */}
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.sectionHeading}>PERSONAL RECORDS</Text>
            <Text style={s.sub}>Your best lift for each exercise, tracked automatically.</Text>
          </View>
          <Pressable
            style={[s.reportBtn, generating && { opacity: 0.6 }]}
            onPress={handleGenerateReport}
            disabled={generating}
          >
            <Ionicons name="document-text-outline" size={15} color={colors.accent} />
            <Text style={s.reportBtnText}>{generating ? 'Generating…' : 'PDF Report'}</Text>
          </Pressable>
        </View>

        {/* ── PR list ── */}
        {!loading && prs.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="trophy-outline" size={56} color={colors.border} />
            <Text style={s.emptyTitle}>No records yet</Text>
            <Text style={s.emptySub}>Complete sessions with weighted exercises to start tracking PRs</Text>
          </View>
        ) : (
          prs.map((pr, i) => (
            <View key={pr.exercise_name} style={s.card}>
              <View style={s.rankCol}>
                {i === 0 ? <Text style={s.medal}>🥇</Text>
                  : i === 1 ? <Text style={s.medal}>🥈</Text>
                  : i === 2 ? <Text style={s.medal}>🥉</Text>
                  : <Text style={s.rankNum}>{i + 1}</Text>}
              </View>
              <View style={s.info}>
                <Text style={s.exerciseName}>{pr.exercise_name}</Text>
                <View style={s.metaRow}>
                  <Ionicons name="calendar-outline" size={11} color={colors.textSecondary} />
                  <Text style={s.metaText}>{fmtDate(pr.achieved_date)}</Text>
                  <Text style={s.dot}>·</Text>
                  <Ionicons name="repeat-outline" size={11} color={colors.textSecondary} />
                  <Text style={s.metaText}>{pr.session_count}× performed</Text>
                </View>
              </View>
              <View style={s.weightCol}>
                <Text style={s.weight}>{pr.best_weight_str}</Text>
                <Text style={s.weightLabel}>BEST</Text>
              </View>
            </View>
          ))
        )}

        {/* ── Progress Photos ── */}
        {coachId ? (
          <>
            <View style={s.photoHeader}>
              <View>
                <Text style={s.sectionHeading}>PROGRESS PHOTOS</Text>
                <Text style={s.sub}>Sent privately to your coach only.</Text>
              </View>
              <Pressable style={s.sendBtn} onPress={handlePickPhoto}>
                <Ionicons name="camera-outline" size={15} color={colors.accent} />
                <Text style={s.sendBtnText}>Send Photo</Text>
              </Pressable>
            </View>

            {photos.length === 0 ? (
              <View style={s.photoEmpty}>
                <Ionicons name="camera-outline" size={36} color={colors.border} />
                <Text style={s.photoEmptyText}>No photos sent yet</Text>
              </View>
            ) : (
              <View style={s.photoGrid}>
                {photos.map((p) => (
                  <Pressable key={p.id} onPress={() => setViewing(p)}>
                    <Image source={{ uri: p.file_url }} style={s.photoThumb} resizeMode="cover" />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : null}

        {/* ── Body Measurements ── */}
        <View style={s.measHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.sectionHeading}>BODY MEASUREMENTS</Text>
            <Text style={s.sub}>Track your weight and body measurements over time.</Text>
          </View>
          <Pressable style={s.sendBtn} onPress={openMeasModal}>
            <Ionicons name="add-outline" size={15} color={colors.accent} />
            <Text style={s.sendBtnText}>Log Today</Text>
          </Pressable>
        </View>

        {measurements.length === 0 ? (
          <View style={s.photoEmpty}>
            <Ionicons name="body-outline" size={36} color={colors.border} />
            <Text style={s.photoEmptyText}>No measurements logged yet</Text>
          </View>
        ) : (
          <>
            {(() => {
              const chartPoints = [...measurements]
                .filter((m) => m.weight_kg != null)
                .reverse()
                .map((m) => ({ logged_at: m.logged_at, weight_kg: m.weight_kg as number }));
              return chartPoints.length >= 2 ? (
                <View style={s.measChartCard}>
                  <Text style={[s.sectionHeading, { marginBottom: 8 }]}>WEIGHT TREND</Text>
                  <MiniWeightChart points={chartPoints} />
                </View>
              ) : null;
            })()}
            {measurements.slice(0, 10).map((m) => (
              <View key={m.id} style={s.measRow}>
                <Text style={s.measDate}>
                  {new Date(m.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <View style={s.measStats}>
                  {m.weight_kg != null && <Text style={s.measStat}>{m.weight_kg} kg</Text>}
                  {m.body_fat_pct != null && <Text style={s.measStatMuted}>{m.body_fat_pct}% fat</Text>}
                  {m.muscle_mass_kg != null && <Text style={s.measStatMuted}>{m.muscle_mass_kg} kg muscle</Text>}
                  {m.waist_cm != null && <Text style={s.measStatMuted}>waist {m.waist_cm} cm</Text>}
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Send Photo modal ── */}
      {/* ── Log Measurement modal ── */}
      <Modal visible={measModal} transparent animationType="slide" onRequestClose={() => setMeasModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setMeasModal(false)} />
        <ScrollView style={s.measModalSheet} keyboardShouldPersistTaps="handled">
          <Text style={s.modalTitle}>Log Measurements</Text>
          <Text style={[s.sub, { marginBottom: 16 }]}>Today — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>

          <View style={s.measInputRow}>
            <View style={s.measInputGroup}>
              <Text style={s.measInputLabel}>Weight (kg)</Text>
              <TextInput style={s.measInput} placeholder="e.g. 72.5" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad" value={mWeight} onChangeText={setMWeight} />
            </View>
            <View style={s.measInputGroup}>
              <Text style={s.measInputLabel}>Body fat (%)</Text>
              <TextInput style={s.measInput} placeholder="e.g. 18.0" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad" value={mFat} onChangeText={setMFat} />
            </View>
          </View>
          <View style={s.measInputRow}>
            <View style={s.measInputGroup}>
              <Text style={s.measInputLabel}>Muscle mass (kg)</Text>
              <TextInput style={s.measInput} placeholder="e.g. 35.0" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad" value={mMuscle} onChangeText={setMMuscle} />
            </View>
            <View style={s.measInputGroup}>
              <Text style={s.measInputLabel}>Chest (cm)</Text>
              <TextInput style={s.measInput} placeholder="e.g. 95" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad" value={mChest} onChangeText={setMChest} />
            </View>
          </View>
          <View style={s.measInputRow}>
            <View style={s.measInputGroup}>
              <Text style={s.measInputLabel}>Waist (cm)</Text>
              <TextInput style={s.measInput} placeholder="e.g. 80" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad" value={mWaist} onChangeText={setMWaist} />
            </View>
            <View style={s.measInputGroup}>
              <Text style={s.measInputLabel}>Hips (cm)</Text>
              <TextInput style={s.measInput} placeholder="e.g. 98" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad" value={mHips} onChangeText={setMHips} />
            </View>
          </View>
          <View style={s.measInputRow}>
            <View style={s.measInputGroup}>
              <Text style={s.measInputLabel}>Arms (cm)</Text>
              <TextInput style={s.measInput} placeholder="e.g. 35" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad" value={mArms} onChangeText={setMArms} />
            </View>
            <View style={s.measInputGroup}>
              <Text style={s.measInputLabel}>Thighs (cm)</Text>
              <TextInput style={s.measInput} placeholder="e.g. 58" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad" value={mThighs} onChangeText={setMThighs} />
            </View>
          </View>
          <TextInput
            style={[s.measInput, { marginBottom: 16 }]}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.textSecondary}
            value={mNotes} onChangeText={setMNotes}
          />
          <Pressable
            style={[s.sendConfirmBtn, savingMeas && { opacity: 0.6 }]}
            onPress={handleSaveMeasurement}
            disabled={savingMeas}
          >
            <Text style={s.sendConfirmText}>{savingMeas ? 'Saving…' : 'Save'}</Text>
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Modal>

      <Modal visible={photoModal} transparent animationType="slide" onRequestClose={() => setPhotoModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setPhotoModal(false)} />
        <View style={s.modalSheet}>
          <Text style={s.modalTitle}>Send to Coach</Text>
          {pickedUri && (
            <Image source={{ uri: pickedUri }} style={s.modalPreview} resizeMode="cover" />
          )}
          <TextInput
            style={s.noteInput}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.textSecondary}
            value={noteText}
            onChangeText={setNoteText}
            maxLength={200}
          />
          <Pressable
            style={[s.sendConfirmBtn, sending && { opacity: 0.6 }]}
            onPress={handleSendPhoto}
            disabled={sending}
          >
            <Text style={s.sendConfirmText}>{sending ? 'Sending…' : 'Send'}</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Fullscreen viewer ── */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={s.viewerOverlay}>
          <Pressable style={s.viewerClose} onPress={() => setViewing(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Pressable
            style={s.viewerDelete}
            onPress={() => viewing && handleDeletePhoto(viewing)}
          >
            <Ionicons name="trash-outline" size={22} color="#FF4D4D" />
          </Pressable>
          {viewing && (
            <>
              <Image source={{ uri: viewing.file_url }} style={s.viewerImg} resizeMode="contain" />
              <View style={s.viewerCaption}>
                <Text style={s.viewerDate}>{fmtDateTime(viewing.sent_at)}</Text>
                {viewing.note ? <Text style={s.viewerNote}>{viewing.note}</Text> : null}
              </View>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: PAD, paddingTop: 24 },

    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
    sectionHeading: { ...Typography.label, color: c.textSecondary, marginBottom: 4 },
    sub: { ...Typography.caption, color: c.textSecondary, lineHeight: 18 },

    reportBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: c.accent + '60',
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
      backgroundColor: c.accent + '10',
    },
    reportBtnText: { ...Typography.caption, color: c.accent, fontWeight: '600' },

    empty: { alignItems: 'center', paddingTop: 48, paddingBottom: 8, gap: 8 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
    emptySub: { ...Typography.body, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },

    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      paddingVertical: 14, paddingHorizontal: 14,
      marginBottom: 8, gap: 12,
    },
    rankCol: { width: 28, alignItems: 'center' },
    medal: { fontSize: 22 },
    rankNum: { ...Typography.label, color: c.textSecondary, fontSize: 13 },
    info: { flex: 1 },
    exerciseName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { ...Typography.caption, color: c.textSecondary },
    dot: { color: c.border, fontSize: 10 },
    weightCol: { alignItems: 'flex-end' },
    weight: { ...Typography.subtitle, color: c.accent, fontWeight: '700' },
    weightLabel: { ...Typography.label, color: c.textSecondary, fontSize: 9, marginTop: 1 },

    // Progress photos
    photoHeader: {
      flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
      marginTop: 28, marginBottom: 14, gap: 12,
    },
    sendBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: c.accent + '60',
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
      backgroundColor: c.accent + '10',
    },
    sendBtnText: { ...Typography.caption, color: c.accent, fontWeight: '600' },
    photoEmpty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
    photoEmptyText: { ...Typography.body, color: c.textSecondary },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    photoThumb: { width: THUMB, height: THUMB, borderRadius: 4, backgroundColor: c.surface },

    // Send modal
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    modalSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, gap: 14,
    },
    modalTitle: { ...Typography.subtitle, color: c.textPrimary, fontWeight: '700' },
    modalPreview: {
      width: '100%', height: 220, borderRadius: 12,
      backgroundColor: c.border,
    },
    noteInput: {
      borderWidth: 1, borderColor: c.border,
      borderRadius: 10, padding: 12,
      ...Typography.body, color: c.textPrimary,
      backgroundColor: c.bg,
    },
    sendConfirmBtn: {
      backgroundColor: c.accent, borderRadius: 12,
      padding: 14, alignItems: 'center',
    },
    sendConfirmText: { ...Typography.subtitle, color: '#fff', fontWeight: '700' },

    // Body measurements
    measHeader: {
      flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
      marginTop: 28, marginBottom: 14, gap: 12,
    },
    measChartCard: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      padding: 14, marginBottom: 8,
    },
    measRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
      paddingVertical: 10, paddingHorizontal: 14,
      marginBottom: 6, gap: 12,
    },
    measDate: { width: 52, ...Typography.caption, color: c.textSecondary },
    measStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    measStat: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    measStatMuted: { ...Typography.caption, color: c.textSecondary },
    measModalSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24,
    },
    measInputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    measInputGroup: { flex: 1, gap: 5 },
    measInputLabel: { ...Typography.label, color: c.textSecondary, fontSize: 10 },
    measInput: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 11, ...Typography.body, color: c.textPrimary,
      backgroundColor: c.bg,
    },

    // Viewer
    viewerOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center', alignItems: 'center',
    },
    viewerClose: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
    viewerDelete: { position: 'absolute', top: 52, left: 20, zIndex: 10, padding: 8 },
    viewerImg: { width: SCREEN_W, height: SCREEN_W * 1.2 },
    viewerCaption: { marginTop: 16, alignItems: 'center', gap: 4, paddingHorizontal: 24 },
    viewerDate: { ...Typography.caption, color: 'rgba(255,255,255,0.6)' },
    viewerNote: { ...Typography.body, color: '#fff', textAlign: 'center' },
  });
}
