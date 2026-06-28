import { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useClientFiles, ClientFile, FileCategory } from '@/hooks/useClientFiles';
import { Colors, Typography } from '@/constants/theme';

// ── Constants ──────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const CONTENT_PAD = 20;
const GRID_GAP = 3;
const GRID_COLS = 3;
const ITEM_SIZE = (SCREEN_W - CONTENT_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const VIEWER_IMG_H = SCREEN_H * 0.62;

const CAT_CONFIG: Record<FileCategory, { label: string; icon: string; color: string }> = {
  inbody:   { label: 'InBody',    icon: 'body-outline',     color: '#4CAF50' },
  progress: { label: 'Progress',  icon: 'camera-outline',   color: '#2196F3' },
  document: { label: 'Documents', icon: 'document-outline', color: '#FF9800' },
};

const CATS: FileCategory[] = ['inbody', 'progress', 'document'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const todayISO = () => new Date().toISOString().split('T')[0];

// ── Upload Form — defined at module scope to prevent keyboard flicker ──────────

function UploadForm({
  imageUri,
  uploading,
  onPickGallery,
  onPickCamera,
  onSave,
  onCancel,
}: {
  imageUri: string | null;
  uploading: boolean;
  onPickGallery: () => void;
  onPickCamera: () => void;
  onSave: (cat: FileCategory, label: string, date: string) => void;
  onCancel: () => void;
}) {
  const [cat, setCat] = useState<FileCategory>('inbody');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayISO());

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={uf.handle} />
      <View style={uf.header}>
        <Text style={uf.title}>UPLOAD FILE</Text>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={uf.scroll}
        contentContainerStyle={uf.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Category */}
        <Text style={uf.lbl}>CATEGORY</Text>
        <View style={uf.catRow}>
          {CATS.map((c) => {
            const cfg = CAT_CONFIG[c];
            const active = cat === c;
            return (
              <Pressable
                key={c}
                style={[
                  uf.catBtn,
                  { borderColor: cfg.color + '60' },
                  active && { backgroundColor: cfg.color + '22', borderColor: cfg.color },
                ]}
                onPress={() => setCat(c)}
              >
                <Ionicons name={cfg.icon as any} size={14} color={active ? cfg.color : Colors.textSecondary} />
                <Text style={[uf.catBtnText, { color: active ? cfg.color : Colors.textSecondary }]}>
                  {cfg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Photo source / preview */}
        <Text style={[uf.lbl, { marginTop: 18 }]}>PHOTO</Text>
        {imageUri ? (
          <View style={uf.previewWrap}>
            <Image source={{ uri: imageUri }} style={uf.preview} resizeMode="cover" />
            <Pressable style={uf.changeBtn} onPress={onPickGallery}>
              <Text style={uf.changeBtnText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <View style={uf.srcRow}>
            <Pressable style={uf.srcBtn} onPress={onPickCamera}>
              <Ionicons name="camera-outline" size={22} color={Colors.accent} />
              <Text style={uf.srcBtnText}>Camera</Text>
            </Pressable>
            <Pressable style={uf.srcBtn} onPress={onPickGallery}>
              <Ionicons name="image-outline" size={22} color={Colors.accent} />
              <Text style={uf.srcBtnText}>Gallery</Text>
            </Pressable>
          </View>
        )}

        {/* Label */}
        <Text style={[uf.lbl, { marginTop: 18 }]}>LABEL (optional)</Text>
        <TextInput
          style={uf.input}
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Week 4, Pre-cut, Baseline…"
          placeholderTextColor={Colors.textSecondary + '80'}
          autoCapitalize="sentences"
          returnKeyType="next"
        />

        {/* Date */}
        <Text style={[uf.lbl, { marginTop: 14 }]}>DATE</Text>
        <TextInput
          style={uf.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textSecondary + '80'}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          returnKeyType="done"
        />

        {/* Upload button */}
        <Pressable
          style={[uf.saveBtn, (!imageUri || uploading) && uf.saveBtnDisabled]}
          onPress={() => imageUri && !uploading && onSave(cat, label, date)}
          disabled={!imageUri || uploading}
        >
          <Text style={uf.saveBtnText}>{uploading ? 'UPLOADING…' : 'UPLOAD FILE'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Photo grid item — at module scope to preserve error state across renders ───

function PhotoGridItem({ file, onPress }: { file: ClientFile; onPress: () => void }) {
  const [error, setError] = useState(false);
  return (
    <Pressable
      style={({ pressed }) => [s.gridItem, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      {error ? (
        <View style={s.gridError}>
          <Ionicons name="image-outline" size={20} color={Colors.textSecondary} />
        </View>
      ) : (
        <Image
          source={{ uri: file.file_url }}
          style={s.gridThumb}
          resizeMode="cover"
          onError={() => setError(true)}
        />
      )}
      {file.label ? (
        <View style={s.gridLabelBar}>
          <Text style={s.gridLabelText} numberOfLines={1}>{file.label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── Document list row — at module scope ───────────────────────────────────────

function DocumentRow({ file, onPress }: { file: ClientFile; onPress: () => void }) {
  const [error, setError] = useState(false);
  return (
    <Pressable
      style={({ pressed }) => [s.docRow, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      {error ? (
        <View style={s.docThumbError}>
          <Ionicons name="image-outline" size={18} color={Colors.textSecondary} />
        </View>
      ) : (
        <Image
          source={{ uri: file.file_url }}
          style={s.docThumb}
          resizeMode="cover"
          onError={() => setError(true)}
        />
      )}
      <View style={s.docInfo}>
        <Text style={s.docLabel} numberOfLines={1}>{file.label ?? 'Document'}</Text>
        <Text style={s.docDate}>{fmtDate(file.date)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
    </Pressable>
  );
}

// ── Full-screen image viewer — at module scope ────────────────────────────────

function ImageViewer({
  files,
  startIndex,
  onClose,
  onDelete,
}: {
  files: ClientFile[];
  startIndex: number;
  onClose: () => void;
  onDelete: (file: ClientFile) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const listRef = useRef<FlatList>(null);
  const current = files[currentIndex];

  const handleDelete = () => {
    if (!current) return;
    Alert.alert('Delete File', 'Remove this file permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { onDelete(current); onClose(); },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header */}
      <View style={vw.header}>
        <Pressable onPress={onClose} hitSlop={14}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <Text style={vw.counter}>
          {files.length > 1 ? `${currentIndex + 1} / ${files.length}` : ''}
        </Text>
        <Pressable onPress={handleDelete} hitSlop={14}>
          <Ionicons name="trash-outline" size={22} color={Colors.danger} />
        </Pressable>
      </View>

      {/* Paged image list */}
      <FlatList
        ref={listRef}
        data={files}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(f) => f.id}
        initialScrollIndex={startIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setCurrentIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={vw.slide}>
            {imgErrors[item.id] ? (
              <View style={vw.errorWrap}>
                <Ionicons name="image-outline" size={52} color={Colors.border} />
                <Text style={vw.errorText}>File not found</Text>
              </View>
            ) : (
              <Image
                source={{ uri: item.file_url }}
                style={vw.image}
                resizeMode="contain"
                onError={() => setImgErrors((prev) => ({ ...prev, [item.id]: true }))}
              />
            )}
          </View>
        )}
      />

      {/* Caption */}
      {current && (
        <View style={vw.caption}>
          <Text style={vw.captionDate}>{fmtDate(current.date)}</Text>
          {current.label ? <Text style={vw.captionLabel}>{current.label}</Text> : null}
          {files.length > 1 && (
            <Text style={vw.swipeHint}>Swipe to compare</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

export function ClientFilesTab({ clientId }: { clientId: string }) {
  const { files, loading, uploadFile, deleteFile } = useClientFiles(clientId);

  const [filterCat, setFilterCat] = useState<FileCategory>('inbody');
  const [showUpload, setShowUpload] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerStartIdx, setViewerStartIdx] = useState(0);

  const filtered = files.filter((f) => f.category === filterCat);

  const openUpload = () => {
    setImageUri(null);
    setFormKey((k) => k + 1);
    setShowUpload(true);
  };

  const pickGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to upload files.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const pickCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSave = async (cat: FileCategory, label: string, date: string) => {
    if (!imageUri) return;
    setUploading(true);
    const { error } = await uploadFile(imageUri, cat, label, '', date);
    setUploading(false);
    if (error) {
      Alert.alert('Upload failed', error);
    } else {
      setShowUpload(false);
      setFilterCat(cat);
    }
  };

  const handleDelete = async (file: ClientFile) => {
    const { error } = await deleteFile(file);
    if (error) Alert.alert('Error', error);
  };

  const openViewer = (index: number) => {
    setViewerStartIdx(index);
    setViewerVisible(true);
  };

  return (
    <>
      {/* Category filter */}
      <View style={s.filterRow}>
        {CATS.map((c) => {
          const cfg = CAT_CONFIG[c];
          const active = filterCat === c;
          const count = files.filter((f) => f.category === c).length;
          return (
            <Pressable
              key={c}
              style={[
                s.filterBtn,
                active && { backgroundColor: cfg.color + '18', borderColor: cfg.color },
              ]}
              onPress={() => setFilterCat(c)}
            >
              <Text style={[s.filterBtnText, { color: active ? cfg.color : Colors.textSecondary }]}>
                {cfg.label}{count > 0 ? ` (${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Add file button */}
      <Pressable style={s.addBtn} onPress={openUpload}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
        <Text style={s.addBtnText}>ADD FILE</Text>
      </Pressable>

      {/* Content */}
      {loading ? (
        <Text style={s.loadingText}>Loading…</Text>
      ) : filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name={CAT_CONFIG[filterCat].icon as any} size={52} color={Colors.border} />
          <Text style={s.emptyTitle}>No {CAT_CONFIG[filterCat].label} files yet</Text>
          <Text style={s.emptySub}>Tap ADD FILE to upload</Text>
        </View>
      ) : filterCat === 'document' ? (
        <View>
          {filtered.map((f) => (
            <DocumentRow
              key={f.id}
              file={f}
              onPress={() => openViewer(filtered.indexOf(f))}
            />
          ))}
        </View>
      ) : (
        <View style={s.grid}>
          {filtered.map((f, idx) => (
            <PhotoGridItem
              key={f.id}
              file={f}
              onPress={() => openViewer(idx)}
            />
          ))}
        </View>
      )}

      {/* Upload modal */}
      <Modal
        visible={showUpload}
        animationType="slide"
        transparent
        onRequestClose={() => !uploading && setShowUpload(false)}
      >
        <Pressable style={s.overlay} onPress={() => !uploading && setShowUpload(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <UploadForm
              key={formKey}
              imageUri={imageUri}
              uploading={uploading}
              onPickGallery={pickGallery}
              onPickCamera={pickCamera}
              onSave={handleSave}
              onCancel={() => setShowUpload(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fullscreen viewer */}
      <Modal
        visible={viewerVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerVisible(false)}
      >
        <ImageViewer
          files={filtered}
          startIndex={viewerStartIdx}
          onClose={() => setViewerVisible(false)}
          onDelete={handleDelete}
        />
      </Modal>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const uf = StyleSheet.create({
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 4,
  },
  title: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },
  scroll: { flexGrow: 0 },
  content: { padding: 20, paddingTop: 12, paddingBottom: 44 },
  lbl: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  catRow: { flexDirection: 'row', gap: 8 },
  catBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 10,
  },
  catBtnText: { fontSize: 11, fontWeight: '700' },
  srcRow: { flexDirection: 'row', gap: 12 },
  srcBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.accent + '50', borderRadius: 14,
    paddingVertical: 20, backgroundColor: Colors.accent + '08',
  },
  srcBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
  previewWrap: {
    borderRadius: 12, overflow: 'hidden',
    height: 180, position: 'relative',
  },
  preview: { width: '100%', height: '100%' },
  changeBtn: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  changeBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15, marginBottom: 4,
  },
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 13,
    paddingVertical: 15, alignItems: 'center', marginTop: 22,
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1.2 },
});

const vw = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  counter: { color: '#fff', fontSize: 15, fontWeight: '600' },
  slide: {
    width: SCREEN_W, height: VIEWER_IMG_H,
    justifyContent: 'center', alignItems: 'center',
  },
  image: { width: SCREEN_W, height: VIEWER_IMG_H },
  errorWrap: { alignItems: 'center', gap: 10 },
  errorText: { color: Colors.textSecondary, fontSize: 14 },
  caption: { padding: 24, paddingBottom: 48, alignItems: 'center', gap: 4 },
  captionDate: { color: '#fff', fontSize: 16, fontWeight: '700' },
  captionLabel: { color: Colors.textSecondary, fontSize: 14 },
  swipeHint: { color: Colors.textSecondary, fontSize: 12, marginTop: 6 },
});

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnText: { fontSize: 11, fontWeight: '700' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.accent + '60', borderRadius: 12,
    paddingVertical: 12, marginBottom: 16, backgroundColor: Colors.accent + '10',
  },
  addBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  loadingText: { color: Colors.textSecondary, textAlign: 'center', paddingTop: 40 },
  emptyWrap: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 8 },
  emptySub: { ...Typography.body, color: Colors.textSecondary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  gridItem: {
    width: ITEM_SIZE, height: ITEM_SIZE,
    borderRadius: 8, overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  gridThumb: { width: '100%', height: '100%' },
  gridError: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  gridLabelBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 5, paddingVertical: 3,
  },
  gridLabelText: { color: '#fff', fontSize: 9, fontWeight: '600' },

  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  docThumb: { width: 58, height: 58, borderRadius: 8 },
  docThumbError: {
    width: 58, height: 58, borderRadius: 8,
    backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  docInfo: { flex: 1 },
  docLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  docDate: { ...Typography.caption, color: Colors.textSecondary },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', paddingBottom: 16,
  },
});
