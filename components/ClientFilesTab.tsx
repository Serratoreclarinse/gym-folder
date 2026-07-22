import { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useClientFiles, ClientFile, FileCategory } from '@/hooks/useClientFiles';
import { ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

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

// ── Upload Form ────────────────────────────────────────────────────────────────

function UploadForm({
  fileUri,
  uploading,
  onPickGallery,
  onPickCamera,
  onPickDocument,
  onSave,
  onCancel,
}: {
  fileUri: string | null;
  uploading: boolean;
  onPickGallery: () => void;
  onPickCamera: () => void;
  onPickDocument: () => void;
  onSave: (cat: FileCategory, label: string, date: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const uf = useMemo(() => makeUfStyles(colors), [colors]);
  const [cat, setCat] = useState<FileCategory>('inbody');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayISO());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isDocument = cat === 'document';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={uf.handle} />
      <View style={uf.header}>
        <Text style={uf.title}>UPLOAD FILE</Text>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
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
                <Ionicons name={cfg.icon as any} size={14} color={active ? cfg.color : colors.textSecondary} />
                <Text style={[uf.catBtnText, { color: active ? cfg.color : colors.textSecondary }]}>
                  {cfg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* File / photo source */}
        <Text style={[uf.lbl, { marginTop: 18 }]}>{isDocument ? 'FILE' : 'PHOTO'}</Text>
        {fileUri ? (
          isDocument ? (
            <View style={uf.docPreview}>
              <Ionicons name="document-text-outline" size={36} color="#FF9800" />
              <Text style={uf.docPreviewText}>Document selected</Text>
              <Pressable onPress={onPickDocument} style={uf.changeDocBtn}>
                <Text style={uf.changeDocBtnText}>Change File</Text>
              </Pressable>
            </View>
          ) : (
            <View style={uf.previewWrap}>
              <Image source={{ uri: fileUri }} style={uf.preview} resizeMode="cover" />
              <Pressable style={uf.changeBtn} onPress={onPickGallery}>
                <Text style={uf.changeBtnText}>Change</Text>
              </Pressable>
            </View>
          )
        ) : isDocument ? (
          <Pressable style={uf.docPickBtn} onPress={onPickDocument}>
            <Ionicons name="folder-open-outline" size={24} color={colors.accent} />
            <Text style={uf.srcBtnText}>Pick File (PDF, Doc…)</Text>
          </Pressable>
        ) : (
          <View style={uf.srcRow}>
            <Pressable style={uf.srcBtn} onPress={onPickCamera}>
              <Ionicons name="camera-outline" size={22} color={colors.accent} />
              <Text style={uf.srcBtnText}>Camera</Text>
            </Pressable>
            <Pressable style={uf.srcBtn} onPress={onPickGallery}>
              <Ionicons name="image-outline" size={22} color={colors.accent} />
              <Text style={uf.srcBtnText}>Gallery</Text>
            </Pressable>
          </View>
        )}

        {/* Label */}
        <Text style={[uf.lbl, { marginTop: 18 }]}>LABEL (optional)</Text>
        <View style={uf.inputRow}>
          <Ionicons name="tag-outline" size={15} color={colors.textSecondary} />
          <TextInput
            style={[uf.input, { color: colors.textPrimary }]}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Week 4, Pre-cut, Baseline…"
            placeholderTextColor={colors.textSecondary + '80'}
          />
        </View>

        {/* Date */}
        <Text style={[uf.lbl, { marginTop: 14 }]}>DATE</Text>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={new Date(date + 'T00:00:00')}
            mode="date"
            display="compact"
            onChange={(_, selected) => {
              if (selected) setDate(selected.toISOString().split('T')[0]);
            }}
            style={{ alignSelf: 'flex-start', marginLeft: -8 }}
          />
        ) : (
          <>
            <Pressable style={uf.datePressable} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={uf.datePressableText}>{fmtDate(date)}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(date + 'T00:00:00')}
                mode="date"
                display="default"
                onChange={(_, selected) => {
                  setShowDatePicker(false);
                  if (selected) setDate(selected.toISOString().split('T')[0]);
                }}
              />
            )}
          </>
        )}

        {/* Upload button */}
        <Pressable
          style={[uf.saveBtn, (!fileUri || uploading) && uf.saveBtnDisabled]}
          onPress={() => fileUri && !uploading && onSave(cat, label, date)}
          disabled={!fileUri || uploading}
        >
          <Text style={uf.saveBtnText}>{uploading ? 'UPLOADING…' : 'UPLOAD FILE'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Photo Grid Item ────────────────────────────────────────────────────────────

function PhotoGridItem({ file, onPress }: { file: ClientFile; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const cfg = CAT_CONFIG[file.category];
  return (
    <Pressable style={s.gridItem} onPress={onPress}>
      <Image source={{ uri: file.file_url }} style={s.gridImg} resizeMode="cover" />
      {file.label && (
        <View style={s.gridLabelWrap}>
          <Text style={s.gridLabel} numberOfLines={1}>{file.label}</Text>
        </View>
      )}
      <View style={[s.gridCatDot, { backgroundColor: cfg.color }]} />
    </Pressable>
  );
}

// ── Document Row ───────────────────────────────────────────────────────────────

function DocumentRow({ file, onDelete }: { file: ClientFile; onDelete: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const isPdf = file.file_type === 'pdf';

  const handleOpen = async () => {
    if (isPdf || file.file_type === 'link') {
      try { await Linking.openURL(file.file_url); } catch { /* noop */ }
    }
  };

  return (
    <Pressable style={s.docRow} onPress={handleOpen} onLongPress={onDelete}>
      <View style={[s.docIconWrap, { backgroundColor: '#FF980020' }]}>
        {isPdf ? (
          <Ionicons name="document-text" size={24} color="#FF9800" />
        ) : (
          <Ionicons name="attach-outline" size={24} color="#FF9800" />
        )}
      </View>
      <View style={s.docMeta}>
        <Text style={s.docLabel} numberOfLines={1}>{file.label || 'Untitled'}</Text>
        <Text style={s.docDate}>{fmtDate(file.date)}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

// ── Link Row ───────────────────────────────────────────────────────────────────

function LinkRow({ file, onDelete }: { file: ClientFile; onDelete: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const handleOpen = async () => {
    try { await Linking.openURL(file.file_url); } catch { /* noop */ }
  };

  return (
    <Pressable style={s.docRow} onPress={handleOpen} onLongPress={onDelete}>
      <View style={[s.docIconWrap, { backgroundColor: '#4CAF5020' }]}>
        <Ionicons name="link-outline" size={22} color="#4CAF50" />
      </View>
      <View style={s.docMeta}>
        <Text style={s.docLabel} numberOfLines={1}>{file.label || 'InBody Link'}</Text>
        <Text style={s.docDate}>{fmtDate(file.date)}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

// ── Image Viewer ───────────────────────────────────────────────────────────────

function ImageViewer({
  file,
  visible,
  onClose,
  onDelete,
}: {
  file: ClientFile | null;
  visible: boolean;
  onClose: () => void;
  onDelete: (file: ClientFile) => void;
}) {
  const { colors } = useTheme();
  const vw = useMemo(() => makeVwStyles(colors), [colors]);

  if (!file) return null;

  const handleDelete = () => {
    Alert.alert('Delete file?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(file) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={vw.container}>
        {/* Header */}
        <View style={vw.header}>
          <Pressable onPress={onClose} style={vw.closeBtn} hitSlop={12}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </Pressable>
          <View style={vw.headerMeta}>
            <Text style={vw.headerLabel} numberOfLines={1}>{file.label || 'File'}</Text>
            <Text style={vw.headerDate}>{fmtDate(file.date)}</Text>
          </View>
          <Pressable onPress={handleDelete} style={vw.deleteBtn} hitSlop={12}>
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </Pressable>
        </View>

        {/* Image */}
        <Image
          source={{ uri: file.file_url }}
          style={vw.img}
          resizeMode="contain"
        />

        {/* Category chip */}
        <View style={vw.footer}>
          <View style={[vw.catChip, { backgroundColor: CAT_CONFIG[file.category].color + '22' }]}>
            <Ionicons
              name={CAT_CONFIG[file.category].icon as any}
              size={13}
              color={CAT_CONFIG[file.category].color}
            />
            <Text style={[vw.catChipText, { color: CAT_CONFIG[file.category].color }]}>
              {CAT_CONFIG[file.category].label}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ClientFilesTab({ clientId }: { clientId: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { files, loading, uploadFile, deleteFile } = useClientFiles(clientId);

  const [filterCat, setFilterCat] = useState<FileCategory | 'all'>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string>('image/jpeg');
  const [uploading, setUploading] = useState(false);
  const [viewerFile, setViewerFile] = useState<ClientFile | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);

  // ── Media pickers ──────────────────────────────────────────────────────────

  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo library access in Settings.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled) {
      setFileUri(result.assets[0].uri);
      setFileMimeType('image/jpeg');
    }
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow camera access in Settings.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled) {
      setFileUri(result.assets[0].uri);
      setFileMimeType('image/jpeg');
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             '*/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setFileUri(asset.uri);
      setFileMimeType(asset.mimeType ?? 'application/octet-stream');
    }
  };

  // ── Upload / delete ────────────────────────────────────────────────────────

  const openUpload = () => {
    setFileUri(null);
    setFileMimeType('image/jpeg');
    setShowUpload(true);
  };

  const closeUpload = () => {
    Keyboard.dismiss();
    setShowUpload(false);
  };

  const handleSave = async (cat: FileCategory, label: string, date: string) => {
    if (!fileUri) return;
    setUploading(true);
    const { error } = await uploadFile(fileUri, cat, label, '', date, fileMimeType);
    setUploading(false);
    if (error) {
      Alert.alert('Upload failed', error);
    } else {
      closeUpload();
      setFilterCat(cat);
    }
  };

  const handleDelete = async (file: ClientFile) => {
    const { error } = await deleteFile(file);
    if (error) Alert.alert('Delete failed', error);
    if (viewerVisible) setViewerVisible(false);
  };

  // ── Filtered lists ─────────────────────────────────────────────────────────

  const filteredPhotos = files.filter(
    (f) => f.file_type === 'image' && (filterCat === 'all' || f.category === filterCat),
  );
  const filteredDocs = files.filter(
    (f) => f.file_type === 'pdf' && (filterCat === 'all' || f.category === filterCat),
  );
  const filteredLinks = files.filter(
    (f) => f.file_type === 'link' && (filterCat === 'all' || f.category === filterCat),
  );

  const totalCount = files.filter((f) => filterCat === 'all' || f.category === filterCat).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}
      >
        <Pressable
          style={[s.filterBtn, filterCat === 'all' && s.filterBtnActive]}
          onPress={() => setFilterCat('all')}
        >
          <Text style={[s.filterBtnText, filterCat === 'all' && s.filterBtnTextActive]}>
            All ({files.length})
          </Text>
        </Pressable>
        {CATS.map((c) => {
          const cfg = CAT_CONFIG[c];
          const count = files.filter((f) => f.category === c).length;
          const active = filterCat === c;
          return (
            <Pressable
              key={c}
              style={[
                s.filterBtn,
                { borderColor: cfg.color + '50' },
                active && { backgroundColor: cfg.color + '22', borderColor: cfg.color },
              ]}
              onPress={() => setFilterCat(c)}
            >
              <Ionicons name={cfg.icon as any} size={12} color={active ? cfg.color : colors.textSecondary} />
              <Text style={[s.filterBtnText, active && { color: cfg.color }]}>
                {cfg.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Photo grid */}
        {filteredPhotos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>PHOTOS</Text>
            <View style={s.grid}>
              {filteredPhotos.map((f) => (
                <PhotoGridItem
                  key={f.id}
                  file={f}
                  onPress={() => { setViewerFile(f); setViewerVisible(true); }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Documents */}
        {filteredDocs.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>DOCUMENTS</Text>
            {filteredDocs.map((f) => (
              <DocumentRow
                key={f.id}
                file={f}
                onDelete={() => Alert.alert('Delete file?', 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDelete(f) },
                ])}
              />
            ))}
          </View>
        )}

        {/* Links */}
        {filteredLinks.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>LINKS</Text>
            {filteredLinks.map((f) => (
              <LinkRow
                key={f.id}
                file={f}
                onDelete={() => Alert.alert('Delete link?', 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDelete(f) },
                ])}
              />
            ))}
          </View>
        )}

        {/* Empty state */}
        {!loading && totalCount === 0 && (
          <View style={s.empty}>
            <Ionicons name="folder-open-outline" size={44} color={colors.textSecondary + '60'} />
            <Text style={s.emptyTitle}>No files yet</Text>
            <Text style={s.emptySubtitle}>Tap + to upload the first file</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Upload FAB */}
      <Pressable style={s.fab} onPress={openUpload}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Upload sheet */}
      <Modal
        visible={showUpload}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeUpload}
      >
        <View style={[s.sheet, { backgroundColor: colors.surface }]}>
          <UploadForm
            fileUri={fileUri}
            uploading={uploading}
            onPickGallery={pickGallery}
            onPickCamera={pickCamera}
            onPickDocument={pickDocument}
            onSave={handleSave}
            onCancel={closeUpload}
          />
        </View>
      </Modal>

      {/* Image viewer */}
      <ImageViewer
        file={viewerFile}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        onDelete={handleDelete}
      />
    </View>
  );
}

// ── Style factories ────────────────────────────────────────────────────────────

function makeUfStyles(c: ColorScheme) {
  return StyleSheet.create({
    handle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: c.border, alignSelf: 'center', marginTop: 10, marginBottom: 6,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, color: c.textPrimary },
    scroll: { maxHeight: SCREEN_H * 0.78 },
    content: { padding: 20, paddingBottom: 40 },
    lbl: {
      fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
      color: c.textSecondary, marginBottom: 8,
    },
    catRow: { flexDirection: 'row', gap: 8 },
    catBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1, borderColor: c.border,
    },
    catBtnText: { fontSize: 12, fontWeight: '600' },
    srcRow: { flexDirection: 'row', gap: 10 },
    srcBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, borderRadius: 12,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised,
    },
    srcBtnText: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
    docPickBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      paddingVertical: 18, borderRadius: 12,
      borderWidth: 1.5, borderColor: c.accent + '60',
      borderStyle: 'dashed', backgroundColor: c.accent + '08',
    },
    docPreview: {
      alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 18, borderRadius: 12,
      backgroundColor: '#FF980010', borderWidth: 1, borderColor: '#FF980030',
    },
    docPreviewText: { fontSize: 13, fontWeight: '500', color: c.textSecondary },
    changeDocBtn: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: c.surfaceRaised },
    changeDocBtnText: { fontSize: 12, fontWeight: '600', color: c.accent },
    previewWrap: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
    preview: { width: '100%', height: 180, borderRadius: 12 },
    changeBtn: {
      position: 'absolute', bottom: 8, right: 8,
      backgroundColor: '#000a', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
    },
    changeBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    inputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.surfaceRaised, borderRadius: 10,
      borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 10,
    },
    input: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
    datePressable: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: 8, borderWidth: 1, borderColor: c.accent + '50',
      backgroundColor: c.accent + '10', alignSelf: 'flex-start',
    },
    datePressableText: { fontSize: 14, fontWeight: '600', color: c.accent },
    saveBtn: {
      marginTop: 24, paddingVertical: 15, borderRadius: 12,
      backgroundColor: c.accent, alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5, color: '#fff' },
  });
}

function makeVwStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', justifyContent: 'space-between' },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: Platform.OS === 'ios' ? 56 : 20,
      paddingHorizontal: 16, paddingBottom: 12,
      backgroundColor: '#000c',
    },
    closeBtn: { padding: 8 },
    headerMeta: { flex: 1, marginHorizontal: 10 },
    headerLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
    headerDate: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
    deleteBtn: { padding: 8 },
    img: { width: SCREEN_W, height: VIEWER_IMG_H, alignSelf: 'center' },
    footer: { paddingHorizontal: 20, paddingBottom: 40, flexDirection: 'row' },
    catChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    },
    catChipText: { fontSize: 12, fontWeight: '600' },
  });
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    filterBar: { paddingHorizontal: CONTENT_PAD, paddingVertical: 12, gap: 8 },
    filterBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 20, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.surfaceRaised,
    },
    filterBtnActive: { backgroundColor: c.accent + '22', borderColor: c.accent },
    filterBtnText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    filterBtnTextActive: { color: c.accent },
    scrollContent: { paddingHorizontal: CONTENT_PAD },
    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
      color: c.textSecondary, marginBottom: 10, marginTop: 4,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
    gridItem: {
      width: ITEM_SIZE, height: ITEM_SIZE,
      borderRadius: 8, overflow: 'hidden',
      backgroundColor: c.surfaceRaised,
    },
    gridImg: { width: '100%', height: '100%' },
    gridLabelWrap: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: '#000a', paddingHorizontal: 5, paddingVertical: 3,
    },
    gridLabel: { fontSize: 9, color: '#fff', fontWeight: '600' },
    gridCatDot: {
      position: 'absolute', top: 5, right: 5,
      width: 7, height: 7, borderRadius: 4,
    },
    docRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 14,
      backgroundColor: c.surfaceRaised, borderRadius: 12, marginBottom: 8,
      borderWidth: 1, borderColor: c.border,
    },
    docIconWrap: {
      width: 44, height: 44, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    docMeta: { flex: 1 },
    docLabel: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
    docDate: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
    sheet: { flex: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
    fab: {
      position: 'absolute', bottom: 24, right: 24,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
    },
    empty: {
      alignItems: 'center', justifyContent: 'center',
      paddingTop: 80, gap: 10,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
    emptySubtitle: { fontSize: 13, color: c.textSecondary + '80' },
  });
}
