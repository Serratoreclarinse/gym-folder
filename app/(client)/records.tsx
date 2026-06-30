import { Dimensions, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useClientPRs } from '@/hooks/useClientPRs';
import { useClientProgressPhotos } from '@/hooks/useClientProgressPhotos';
import { Colors, Typography } from '@/constants/theme';

const SCREEN_W = Dimensions.get('window').width;
const PAD = 20;
const GAP = 3;
const COLS = 3;
const THUMB = (SCREEN_W - PAD * 2 - GAP * (COLS - 1)) / COLS;

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function RecordsScreen() {
  const { prs, loading: prsLoading, refetch: refetchPRs } = useClientPRs();
  const { photos, loading: photosLoading, refetch: refetchPhotos } = useClientProgressPhotos();
  const [viewPhoto, setViewPhoto] = useState<{ url: string; label: string | null; date: string } | null>(null);

  const loading = prsLoading || photosLoading;
  const refetch = () => { refetchPRs(); refetchPhotos(); };

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />}
      >
        {/* ── Personal Records ── */}
        <Text style={s.sectionHeading}>PERSONAL RECORDS</Text>
        <Text style={s.sub}>Your best lift for each exercise, tracked automatically from your sessions.</Text>

        {!prsLoading && prs.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="trophy-outline" size={56} color={Colors.border} />
            <Text style={s.emptyTitle}>No records yet</Text>
            <Text style={s.emptySub}>Complete sessions with weighted exercises to start tracking PRs</Text>
          </View>
        ) : (
          prs.map((pr, i) => (
            <View key={pr.exercise_name} style={s.card}>
              <View style={s.rankCol}>
                {i === 0 ? (
                  <Text style={s.medal}>🥇</Text>
                ) : i === 1 ? (
                  <Text style={s.medal}>🥈</Text>
                ) : i === 2 ? (
                  <Text style={s.medal}>🥉</Text>
                ) : (
                  <Text style={s.rankNum}>{i + 1}</Text>
                )}
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
        <View style={s.divider} />
        <Text style={s.sectionHeading}>PROGRESS PHOTOS</Text>
        <Text style={s.sub}>Photos uploaded by your coach to track your transformation.</Text>

        {!photosLoading && photos.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="images-outline" size={56} color={Colors.border} />
            <Text style={s.emptyTitle}>No photos yet</Text>
            <Text style={s.emptySub}>Your coach will upload progress photos here as you train</Text>
          </View>
        ) : (
          <View style={s.photoGrid}>
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                style={s.photoThumb}
                onPress={() => setViewPhoto({ url: photo.file_url, label: photo.label, date: photo.date })}
              >
                <Image source={{ uri: photo.file_url }} style={s.photoImg} resizeMode="cover" />
                {photo.label && (
                  <View style={s.photoLabelBadge}>
                    <Text style={s.photoLabelText} numberOfLines={1}>{photo.label}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Fullscreen photo viewer */}
      <Modal visible={!!viewPhoto} transparent animationType="fade" onRequestClose={() => setViewPhoto(null)}>
        <Pressable style={s.modalBg} onPress={() => setViewPhoto(null)}>
          <Pressable onPress={() => {}} style={s.modalContent}>
            {viewPhoto && (
              <>
                <Image source={{ uri: viewPhoto.url }} style={s.modalImg} resizeMode="contain" />
                <View style={s.modalMeta}>
                  {viewPhoto.label && <Text style={s.modalLabel}>{viewPhoto.label}</Text>}
                  <Text style={s.modalDate}>{fmtDate(viewPhoto.date)}</Text>
                </View>
              </>
            )}
            <Pressable style={s.closeBtn} onPress={() => setViewPhoto(null)}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: PAD, paddingTop: 24 },

  sectionHeading: { ...Typography.label, color: Colors.textSecondary, marginBottom: 4 },
  sub: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 20, lineHeight: 18 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 28 },

  empty: { alignItems: 'center', paddingTop: 40, paddingBottom: 8, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // PR cards
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

  // Photo grid
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  photoThumb: { width: THUMB, height: THUMB, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surface },
  photoImg: { width: '100%', height: '100%' },
  photoLabelBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 5, paddingVertical: 3,
  },
  photoLabelText: { color: '#fff', fontSize: 9, fontWeight: '600' },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: SCREEN_W, alignItems: 'center' },
  modalImg: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  modalMeta: { marginTop: 12, alignItems: 'center', gap: 4 },
  modalLabel: { ...Typography.subtitle, color: Colors.textPrimary, fontWeight: '700' },
  modalDate: { ...Typography.caption, color: Colors.textSecondary },
  closeBtn: {
    position: 'absolute', top: -48, right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
});
