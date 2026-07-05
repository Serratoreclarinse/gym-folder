import { useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClientProgressPhotos, type ProgressPhoto } from '@/hooks/useProgressPhotos';
import { Colors, Typography } from '@/constants/theme';

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
  const { photos, loading } = useClientProgressPhotos(clientId);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);

  if (loading) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Loading…</Text>
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={s.empty}>
        <Ionicons name="camera-outline" size={52} color={Colors.border} />
        <Text style={s.emptyTitle}>No photos yet</Text>
        <Text style={s.emptySub}>Your client can send progress photos from their Records screen</Text>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <Text style={s.count}>{photos.length} photo{photos.length !== 1 ? 's' : ''} sent by client</Text>

      {/* Grid */}
      <View style={s.grid}>
        {photos.map((p) => (
          <Pressable key={p.id} onPress={() => setViewing(p)}>
            <Image source={{ uri: p.file_url }} style={s.thumb} resizeMode="cover" />
          </Pressable>
        ))}
      </View>

      {/* Fullscreen viewer */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={s.overlay}>
          <Pressable style={s.closeBtn} onPress={() => setViewing(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>

          {viewing && (
            <>
              <Image
                source={{ uri: viewing.file_url }}
                style={s.fullImg}
                resizeMode="contain"
              />
              <View style={s.caption}>
                <Text style={s.captionDate}>{fmtDate(viewing.sent_at)}</Text>
                {viewing.note ? (
                  <Text style={s.captionNote}>{viewing.note}</Text>
                ) : null}
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center: { padding: 40, alignItems: 'center' },
  muted: { ...Typography.body, color: Colors.textSecondary },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  wrap: { paddingTop: 8 },
  count: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 10, paddingHorizontal: PAD },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PAD,
    gap: GAP,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: 4, backgroundColor: Colors.surface },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    padding: 8,
  },
  fullImg: { width: SCREEN_W, height: SCREEN_H * 0.65 },
  caption: { marginTop: 16, alignItems: 'center', gap: 4, paddingHorizontal: 24 },
  captionDate: { ...Typography.caption, color: 'rgba(255,255,255,0.6)' },
  captionNote: { ...Typography.body, color: '#fff', textAlign: 'center' },
});
