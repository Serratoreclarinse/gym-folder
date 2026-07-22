import { useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClientProgressPhotos, type ProgressPhoto } from '@/hooks/useProgressPhotos';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const PAD = 20;
const GAP = 3;
const COLS = 3;
const THUMB = (SCREEN_W - PAD * 2 - GAP * (COLS - 1)) / COLS;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function ClientPhotosTab({ clientId }: { clientId: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { photos, loading } = useClientProgressPhotos(clientId);

  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState<string[]>([]);
  const [comparePhotos, setComparePhotos] = useState<[ProgressPhoto, ProgressPhoto] | null>(null);

  function toggleSelect(photo: ProgressPhoto) {
    setCompareSelected((prev) => {
      if (prev.includes(photo.id)) return prev.filter((id) => id !== photo.id);
      if (prev.length >= 2) return prev;
      return [...prev, photo.id];
    });
  }

  if (loading) {
    return <View style={s.center}><Text style={s.muted}>Loading…</Text></View>;
  }

  if (photos.length === 0) {
    return (
      <View style={s.empty}>
        <Ionicons name="camera-outline" size={52} color={colors.border} />
        <Text style={s.emptyTitle}>No photos yet</Text>
        <Text style={s.emptySub}>Client sends progress photos from their Records screen</Text>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {/* Toolbar */}
      <View style={s.toolbar}>
        <Text style={s.count}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</Text>
        {photos.length >= 2 && (
          <Pressable
            style={[s.compareToggle, compareMode && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
            onPress={() => { setCompareMode((v) => !v); setCompareSelected([]); setComparePhotos(null); }}
          >
            <Ionicons name="git-compare-outline" size={14} color={colors.accent} />
            <Text style={s.compareToggleText}>{compareMode ? 'Cancel' : 'Compare'}</Text>
          </Pressable>
        )}
      </View>

      {compareMode && (
        <Text style={s.compareHint}>
          {compareSelected.length === 0 ? 'Tap 2 photos to compare'
            : compareSelected.length === 1 ? 'Select 1 more'
            : 'Ready — tap View'}
        </Text>
      )}

      <View style={s.grid}>
        {photos.map((p) => {
          const isSelected = compareSelected.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => compareMode ? toggleSelect(p) : setViewing(p)}
              style={s.thumbWrap}
            >
              <Image source={{ uri: p.file_url }} style={s.thumb} resizeMode="cover" />
              {compareMode && (
                <View style={[s.checkCircle, isSelected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                  {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {compareMode && compareSelected.length === 2 && (
        <Pressable style={s.compareBtn} onPress={() => {
          const p1 = photos.find((p) => p.id === compareSelected[0])!;
          const p2 = photos.find((p) => p.id === compareSelected[1])!;
          setComparePhotos([p1, p2]);
        }}>
          <Ionicons name="git-compare-outline" size={16} color="#fff" />
          <Text style={s.compareBtnText}>VIEW COMPARISON</Text>
        </Pressable>
      )}

      {/* Fullscreen photo viewer */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={s.overlay}>
          <Pressable style={s.closeBtn} onPress={() => setViewing(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          {viewing && (
            <>
              <Image source={{ uri: viewing.file_url }} style={s.fullImg} resizeMode="contain" />
              <View style={s.caption}>
                <Text style={s.captionDate}>{fmtDate(viewing.sent_at)}</Text>
                {viewing.note ? <Text style={s.captionNote}>{viewing.note}</Text> : null}
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Comparison modal */}
      <Modal
        visible={!!comparePhotos}
        transparent
        animationType="fade"
        onRequestClose={() => { setComparePhotos(null); setCompareSelected([]); setCompareMode(false); }}
      >
        <View style={s.compareOverlay}>
          <Pressable style={s.closeBtn} onPress={() => { setComparePhotos(null); setCompareSelected([]); setCompareMode(false); }}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Text style={s.compareTitle}>BEFORE / AFTER</Text>
          {comparePhotos && (
            <View style={s.compareSplit}>
              <View style={s.compareHalf}>
                <Image source={{ uri: comparePhotos[0].file_url }} style={s.compareImg} resizeMode="cover" />
                <Text style={s.compareDate}>{fmtDate(comparePhotos[0].sent_at)}</Text>
              </View>
              <View style={s.splitDivider} />
              <View style={s.compareHalf}>
                <Image source={{ uri: comparePhotos[1].file_url }} style={s.compareImg} resizeMode="cover" />
                <Text style={s.compareDate}>{fmtDate(comparePhotos[1].sent_at)}</Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    wrap: { paddingTop: 8 },
    center: { padding: 40, alignItems: 'center' },
    muted: { ...Typography.body, color: c.textSecondary },

    empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 10 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary },
    emptySub: { ...Typography.body, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },

    toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, marginBottom: 8 },
    count: { ...Typography.caption, color: c.textSecondary },
    compareToggle: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: c.border, borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 6,
    },
    compareToggleText: { ...Typography.caption, color: c.accent, fontWeight: '600' },
    compareHint: { ...Typography.caption, color: c.textSecondary, paddingHorizontal: PAD, marginBottom: 8 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: PAD, gap: GAP },
    thumbWrap: { position: 'relative' },
    thumb: { width: THUMB, height: THUMB, borderRadius: 4, backgroundColor: c.surface },
    checkCircle: {
      position: 'absolute', top: 4, right: 4,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1.5, borderColor: '#fff',
      alignItems: 'center', justifyContent: 'center',
    },

    compareBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.accent, borderRadius: 12, marginHorizontal: PAD,
      paddingVertical: 12, justifyContent: 'center', marginTop: 12,
    },
    compareBtnText: { ...Typography.label, color: '#fff', letterSpacing: 1 },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
    closeBtn: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
    fullImg: { width: SCREEN_W, height: SCREEN_H * 0.65 },
    caption: { marginTop: 16, alignItems: 'center', gap: 4, paddingHorizontal: 24 },
    captionDate: { ...Typography.caption, color: 'rgba(255,255,255,0.6)' },
    captionNote: { ...Typography.body, color: '#fff', textAlign: 'center' },

    compareOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    compareTitle: { ...Typography.label, color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginBottom: 12 },
    compareSplit: { flexDirection: 'row', width: SCREEN_W, gap: 2 },
    compareHalf: { flex: 1, alignItems: 'center' },
    compareImg: { width: (SCREEN_W - 2) / 2, height: SCREEN_W * 0.7 },
    splitDivider: { width: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
    compareDate: { ...Typography.caption, color: 'rgba(255,255,255,0.5)', marginTop: 6, textAlign: 'center' },
  });
}
