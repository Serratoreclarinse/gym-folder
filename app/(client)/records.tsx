import { useEffect, useState } from 'react';
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
import { useClientPRs, type PersonalRecord } from '@/hooks/useClientPRs';
import { useMyProgressPhotos, type ProgressPhoto } from '@/hooks/useProgressPhotos';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors, Typography } from '@/constants/theme';

const SCREEN_W = Dimensions.get('window').width;
const PAD = 20;
const GAP = 3;
const COLS = 3;
const THUMB = (SCREEN_W - PAD * 2 - GAP * (COLS - 1)) / COLS;

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

export default function RecordsScreen() {
  const { user, profile } = useAuth();
  const { prs, loading, refetch } = useClientPRs();
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />}
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
            <Ionicons name="document-text-outline" size={15} color={Colors.accent} />
            <Text style={s.reportBtnText}>{generating ? 'Generating…' : 'PDF Report'}</Text>
          </Pressable>
        </View>

        {/* ── PR list ── */}
        {!loading && prs.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="trophy-outline" size={56} color={Colors.border} />
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
                  <Ionicons name="calendar-outline" size={11} color={Colors.textSecondary} />
                  <Text style={s.metaText}>{fmtDate(pr.achieved_date)}</Text>
                  <Text style={s.dot}>·</Text>
                  <Ionicons name="repeat-outline" size={11} color={Colors.textSecondary} />
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
                <Ionicons name="camera-outline" size={15} color={Colors.accent} />
                <Text style={s.sendBtnText}>Send Photo</Text>
              </Pressable>
            </View>

            {photos.length === 0 ? (
              <View style={s.photoEmpty}>
                <Ionicons name="camera-outline" size={36} color={Colors.border} />
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

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Send Photo modal ── */}
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
            placeholderTextColor={Colors.textSecondary}
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

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: PAD, paddingTop: 24 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
  sectionHeading: { ...Typography.label, color: Colors.textSecondary, marginBottom: 4 },
  sub: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18 },

  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.accent + '60',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: Colors.accent + '10',
  },
  reportBtnText: { ...Typography.caption, color: Colors.accent, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 48, paddingBottom: 8, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 14,
    marginBottom: 8, gap: 12,
  },
  rankCol: { width: 28, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { ...Typography.label, color: Colors.textSecondary, fontSize: 13 },
  info: { flex: 1 },
  exerciseName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.caption, color: Colors.textSecondary },
  dot: { color: Colors.border, fontSize: 10 },
  weightCol: { alignItems: 'flex-end' },
  weight: { ...Typography.subtitle, color: Colors.accent, fontWeight: '700' },
  weightLabel: { ...Typography.label, color: Colors.textSecondary, fontSize: 9, marginTop: 1 },

  // Progress photos
  photoHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginTop: 28, marginBottom: 14, gap: 12,
  },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.accent + '60',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: Colors.accent + '10',
  },
  sendBtnText: { ...Typography.caption, color: Colors.accent, fontWeight: '600' },
  photoEmpty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  photoEmptyText: { ...Typography.body, color: Colors.textSecondary },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  photoThumb: { width: THUMB, height: THUMB, borderRadius: 4, backgroundColor: Colors.surface },

  // Send modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 14,
  },
  modalTitle: { ...Typography.subtitle, color: Colors.textPrimary, fontWeight: '700' },
  modalPreview: {
    width: '100%', height: 220, borderRadius: 12,
    backgroundColor: Colors.border,
  },
  noteInput: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 12,
    ...Typography.body, color: Colors.textPrimary,
    backgroundColor: Colors.bg,
  },
  sendConfirmBtn: {
    backgroundColor: Colors.accent, borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  sendConfirmText: { ...Typography.subtitle, color: '#fff', fontWeight: '700' },

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
