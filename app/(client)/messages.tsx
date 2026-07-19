import { useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const CELL_SIZE = Math.floor(Dimensions.get('window').width / 3);
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useChat } from '@/hooks/useChat';
import { useClientData } from '@/hooks/useClientData';
import { useAuth } from '@/context/AuthContext';
import { sendPushNotification } from '@/lib/pushNotifications';
import { supabase } from '@/lib/supabase';
import { Typography } from '@/constants/theme';
import type { ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtDay(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type Attachment = { url: string; type: 'image' | 'video' | 'file'; name?: string };

async function uploadAttachment(
  uri: string,
  mimeType: string,
  fileName: string,
  userId: string,
): Promise<string | null> {
  try {
    const ext = fileName.split('.').pop() ?? 'bin';
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    let uploadBody: FormData | Blob;
    let contentType = mimeType;
    if (Platform.OS === 'web') {
      const blob = await fetch(uri).then(r => r.blob());
      uploadBody = blob;
      contentType = blob.type || mimeType;
    } else {
      const fd = new FormData();
      fd.append('file', { uri, name: fileName, type: mimeType } as any);
      uploadBody = fd;
    }
    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(path, uploadBody, { contentType, upsert: false });
    if (error) { console.warn('[chat upload]', error.message); return null; }
    const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn('[chat upload]', e);
    return null;
  }
}

export default function ClientMessagesScreen() {
  const { pkg, coachInfo } = useClientData();
  const coachId = pkg?.coach_id ?? '';
  const coachName = coachInfo?.name ?? 'Coach';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { profile, user } = useAuth();

  const { messages, loading, sendMessage, editMessage, deleteMessage, myId } = useChat(coachId);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const isPickingRef = useRef(false);
  const pendingPickRef = useRef<(() => void) | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ uri: string; type: 'image' | 'video' | 'file'; name: string; mime: string } | null>(null);
  const [attachPickerVisible, setAttachPickerVisible] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const mediaItems = useMemo(
    () => messages.filter(m => m.attachment_type === 'image' || m.attachment_type === 'video' || m.attachment_type === 'file').reverse(),
    [messages],
  );
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [contextMsg, setContextMsg] = useState<{ msg: any; mine: boolean } | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: string } | null>(null);
  const [editText, setEditText] = useState('');
  const searchRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  const openSearch = () => { setMenuVisible(false); setSearchActive(true); setTimeout(() => searchRef.current?.focus(), 100); };
  const closeSearch = () => { setSearchActive(false); setSearchQuery(''); };

  if (!coachId) {
    return (
      <View style={s.noCoach}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
        <Text style={s.noCoachText}>No coach assigned yet.</Text>
        <Text style={s.noCoachSub}>Chat becomes available once your coach sets up your package.</Text>
      </View>
    );
  }

  // ── Attachment pickers ────────────────────────────────────────────────────

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
        videoMaxDuration: 120,
      });
      setAttachPickerVisible(false);
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';
        const mime = isVideo ? (asset.mimeType ?? 'video/mp4') : (asset.mimeType ?? 'image/jpeg');
        const name = asset.fileName ?? (isVideo ? 'video.mp4' : 'photo.jpg');
        setPendingAttachment({ uri: asset.uri, type: isVideo ? 'video' : 'image', name, mime });
      }
    } catch {
      setAttachPickerVisible(false);
      Alert.alert('Permission needed', 'Photo library access is required. Please enable it in your phone settings.');
    }
  };

  const pickFromCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        mediaTypes: ['images'],
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });
      setAttachPickerVisible(false);
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPendingAttachment({ uri: asset.uri, type: 'image', name: asset.fileName ?? 'photo.jpg', mime: asset.mimeType ?? 'image/jpeg' });
      }
    } catch {
      setAttachPickerVisible(false);
      Alert.alert('Permission needed', 'Camera access is required. Please enable it in your phone settings.');
    }
  };

  const pickDocument = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      setAttachPickerVisible(false);
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPendingAttachment({ uri: asset.uri, type: 'file', name: asset.name, mime: asset.mimeType ?? 'application/octet-stream' });
      }
    } catch (e: any) {
      setAttachPickerVisible(false);
      if (!e?.message?.includes('picking in progress')) {
        console.warn('[pickDocument]', e?.message);
      }
    } finally {
      isPickingRef.current = false;
    }
  };

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if ((!text.trim() && !pendingAttachment) || sending) return;
    setSending(true);
    const msg = text.trim();
    let attachment: Attachment | undefined;
    if (pendingAttachment) {
      const url = await uploadAttachment(pendingAttachment.uri, pendingAttachment.mime, pendingAttachment.name, user?.id ?? '');
      if (!url) {
        setSending(false);
        Alert.alert('Upload Failed', 'Could not upload the attachment. Please try again.');
        return;
      }
      attachment = { url, type: pendingAttachment.type, name: pendingAttachment.name };
      setPendingAttachment(null);
    }
    setText('');
    await sendMessage(msg, attachment);
    setSending(false);
    if (coachId) {
      sendPushNotification(coachId, {
        title: profile?.name ?? 'A client',
        body: attachment
          ? (attachment.type === 'image' ? '📷 Photo' : attachment.type === 'video' ? '🎬 Video' : `📎 ${attachment.name}`)
          : msg,
        data: { type: 'message', clientId: myId, clientName: profile?.name ?? '' },
      });
    }
  };

  // ── Build list items ──────────────────────────────────────────────────────

  type ListItem =
    | { type: 'day'; label: string }
    | { type: 'msg'; id: string; msg: (typeof messages)[0] };

  const filtered = searchQuery.trim()
    ? messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const items: ListItem[] = [];
  let lastDay = '';
  for (const msg of filtered) {
    const day = fmtDay(msg.created_at);
    if (day !== lastDay) { items.push({ type: 'day', label: day }); lastDay = day; }
    items.push({ type: 'msg', id: msg.id, msg });
  }

  const canSend = (text.trim().length > 0 || !!pendingAttachment) && !sending;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: (insets.top || 0) + 10 }]}>
        {searchActive ? (
          <>
            <Pressable onPress={closeSearch} hitSlop={12} style={s.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <TextInput
              ref={searchRef}
              style={[s.searchInput, { color: colors.textPrimary }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search messages…"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Pressable style={s.headerInfo} onPress={() => setInfoVisible(true)}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {coachName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.coachName} numberOfLines={1}>{coachName}</Text>
                <Text style={s.coachRole}>Tap for info</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={8} style={s.menuBtn}>
              <Ionicons name="ellipsis-vertical" size={22} color={colors.textPrimary} />
            </Pressable>
          </>
        )}
      </View>

      {/* ── Search result count ── */}
      {searchActive && searchQuery.trim().length > 0 && (
        <View style={[s.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[s.searchCount, { color: colors.textSecondary }]}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{searchQuery}"
          </Text>
        </View>
      )}

      {/* ── ⋮ Menu ── */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setMenuVisible(false)}>
          <View style={s.menuOverlay}>
            <Pressable>
              <View style={[s.menuSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable style={s.menuItem} onPress={() => { setMenuVisible(false); setInfoVisible(true); }}>
                  <Ionicons name="person-outline" size={18} color={colors.textPrimary} />
                  <Text style={[s.menuItemText, { color: colors.textPrimary }]}>Coach Info</Text>
                </Pressable>
                <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
                <Pressable style={s.menuItem} onPress={openSearch}>
                  <Ionicons name="search-outline" size={18} color={colors.textPrimary} />
                  <Text style={[s.menuItemText, { color: colors.textPrimary }]}>Search Messages</Text>
                </Pressable>
                <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
                <Pressable style={s.menuItem} onPress={() => { setMenuVisible(false); setGalleryVisible(true); }}>
                  <Ionicons name="images-outline" size={18} color={colors.textPrimary} />
                  <Text style={[s.menuItemText, { color: colors.textPrimary }]}>Media</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Coach Info Modal ── */}
      <Modal visible={infoVisible} transparent animationType="slide" onRequestClose={() => setInfoVisible(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }} onPress={() => setInfoVisible(false)}>
          <Pressable>
            <View style={[s.infoSheet, { backgroundColor: colors.surface }]}>
              <View style={[s.infoAvatar, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' }]}>
                <Text style={[s.infoAvatarText, { color: colors.accent }]}>
                  {coachName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
              <Text style={[s.infoName, { color: colors.textPrimary }]}>{coachName}</Text>
              <Text style={[s.infoRole, { color: colors.textSecondary }]}>Your Personal Trainer</Text>
              <View style={[s.infoDivider, { backgroundColor: colors.border }]} />
              <Text style={[s.infoNote, { color: colors.textSecondary }]}>
                All messages are private between you and your coach.
              </Text>
              <Pressable
                style={[s.infoClose, { backgroundColor: colors.accent }]}
                onPress={() => setInfoVisible(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Messages ── */}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.type === 'day' ? item.label : item.id}
        contentContainerStyle={s.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          if (item.type === 'day') {
            return (
              <View style={s.dayRow}>
                <View style={s.dayLine} />
                <Text style={s.dayLabel}>{item.label}</Text>
                <View style={s.dayLine} />
              </View>
            );
          }
          const mine = item.msg.sender_id === myId;
          return (
            <BubbleItem
              msg={item.msg}
              mine={mine}
              colors={colors}
              s={s}
              onImagePress={setFullscreenImg}
              onLongPress={() => setContextMsg({ msg: item.msg, mine })}
            />
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
              <Text style={s.emptyText}>Send your coach a message!</Text>
            </View>
          ) : null
        }
      />

      {/* ── Pending attachment preview ── */}
      {pendingAttachment && (
        <View style={[s.pendingBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {pendingAttachment.type === 'image' ? (
            <Image source={{ uri: pendingAttachment.uri }} style={s.pendingThumb} resizeMode="cover" />
          ) : (
            <View style={[s.pendingThumb, { backgroundColor: colors.accent + '18', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name={pendingAttachment.type === 'video' ? 'videocam-outline' : 'document-outline'} size={28} color={colors.accent} />
            </View>
          )}
          <Text style={[s.pendingName, { color: colors.textPrimary }]} numberOfLines={1}>{pendingAttachment.name}</Text>
          <Pressable onPress={() => setPendingAttachment(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* ── Input row ── */}
      <View style={[s.inputRow, { paddingBottom: (insets.bottom || 0) + 12 }]}>
        <Pressable style={s.attachBtn} onPress={() => setAttachPickerVisible(true)} hitSlop={8}>
          <Ionicons name="attach" size={24} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder={`Message ${coachName}…`}
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[s.sendBtn, { backgroundColor: canSend ? colors.accent : colors.surface, borderColor: colors.border }]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {sending
            ? <ActivityIndicator size="small" color={colors.bg} />
            : <Ionicons name="send" size={18} color={canSend ? colors.bg : colors.textSecondary} />}
        </Pressable>
      </View>

      {/* ── Attachment picker sheet ── */}
      <Modal
        visible={attachPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachPickerVisible(false)}
        onDismiss={() => { pendingPickRef.current?.(); pendingPickRef.current = null; }}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setAttachPickerVisible(false)}>
          <View style={s.sheetBg}>
            <Pressable>
              <View style={[s.sheet, { backgroundColor: colors.surface }]}>
                <Text style={[s.sheetTitle, { color: colors.textSecondary }]}>Send Attachment</Text>
                <View style={s.sheetRow}>
                  <SheetOption icon="image-outline" label="Gallery" color={colors.success} onPress={pickFromGallery} colors={colors} />
                  <SheetOption icon="camera-outline" label="Camera" color="#2196F3" onPress={pickFromCamera} colors={colors} />
                  <SheetOption icon="document-outline" label="File" color={colors.warning} onPress={pickDocument} colors={colors} />
                </View>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Fullscreen image viewer ── */}
      {fullscreenImg && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setFullscreenImg(null)}>
          <Pressable style={s.fullscreen} onPress={() => setFullscreenImg(null)}>
            <Image source={{ uri: fullscreenImg }} style={s.fullscreenImg} resizeMode="contain" />
            <Pressable style={s.fullscreenClose} onPress={() => setFullscreenImg(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Media Gallery ── */}
      <Modal visible={galleryVisible} animationType="slide" onRequestClose={() => setGalleryVisible(false)}>
        <View style={[s.galleryRoot, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
          <View style={[s.galleryHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setGalleryVisible(false)} hitSlop={12} style={s.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={[s.galleryTitle, { color: colors.textPrimary }]}>Media & Files</Text>
            <Text style={[s.gallerySubtitle, { color: colors.textSecondary }]}>{mediaItems.length} item{mediaItems.length !== 1 ? 's' : ''}</Text>
          </View>
          {mediaItems.length === 0 ? (
            <View style={s.galleryEmpty}>
              <Ionicons name="images-outline" size={52} color={colors.border} />
              <Text style={[s.galleryEmptyText, { color: colors.textSecondary }]}>No photos, videos, or files yet</Text>
            </View>
          ) : (
            <FlatList
              data={mediaItems}
              numColumns={3}
              keyExtractor={m => m.id}
              contentContainerStyle={s.galleryGrid}
              renderItem={({ item }) => {
                const isVideo = item.attachment_type === 'video';
                const isFile = item.attachment_type === 'file';
                return (
                  <Pressable
                    style={s.galleryCell}
                    onPress={() => {
                      if (isFile) {
                        WebBrowser.openBrowserAsync(item.attachment_url!);
                      } else if (isVideo) {
                        Linking.openURL(item.attachment_url!);
                      } else {
                        setGalleryVisible(false);
                        setTimeout(() => setFullscreenImg(item.attachment_url!), 300);
                      }
                    }}
                  >
                    {isFile ? (
                      <View style={[s.galleryCellInner, { backgroundColor: colors.surface }]}>
                        <Ionicons name="document-outline" size={28} color={colors.accent} />
                        <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 4 }} numberOfLines={2}>
                          {item.attachment_name ?? 'File'}
                        </Text>
                      </View>
                    ) : isVideo ? (
                      <View style={[s.galleryCellInner, { backgroundColor: colors.surface }]}>
                        <Ionicons name="videocam" size={32} color={colors.textSecondary} />
                        <View style={s.galleryPlayBadge}>
                          <Ionicons name="play" size={9} color="#fff" />
                        </View>
                      </View>
                    ) : (
                      <Image source={{ uri: item.attachment_url! }} style={s.galleryCellInner} resizeMode="cover" />
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
      {/* ── Message context menu ── */}
      <Modal visible={!!contextMsg} transparent animationType="fade" onRequestClose={() => setContextMsg(null)}>
        <Pressable style={s.ctxOverlay} onPress={() => setContextMsg(null)}>
          <Pressable>
            <View style={[s.ctxSheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: (insets.bottom || 0) + 8 }]}>
              {contextMsg?.mine && Date.now() - new Date(contextMsg.msg.created_at).getTime() < 3600000 && (
                <Pressable
                  style={s.ctxItem}
                  onPress={() => {
                    setEditText(contextMsg.msg.content ?? '');
                    setEditingMsg({ id: contextMsg.msg.id });
                    setContextMsg(null);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
                  <Text style={[s.ctxItemText, { color: colors.textPrimary }]}>Edit Message</Text>
                </Pressable>
              )}
              {contextMsg?.mine && Date.now() - new Date(contextMsg.msg.created_at).getTime() < 3600000 && (
                <View style={[s.ctxDivider, { backgroundColor: colors.border }]} />
              )}
              <Pressable
                style={s.ctxItem}
                onPress={() => { deleteMessage(contextMsg!.msg.id, false); setContextMsg(null); }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={[s.ctxItemText, { color: colors.danger }]}>Delete for Me</Text>
              </Pressable>
              {contextMsg?.mine && Date.now() - new Date(contextMsg.msg.created_at).getTime() < 3600000 && (
                <>
                  <View style={[s.ctxDivider, { backgroundColor: colors.border }]} />
                  <Pressable
                    style={s.ctxItem}
                    onPress={() => {
                      const id = contextMsg.msg.id;
                      setContextMsg(null);
                      Alert.alert(
                        'Delete for Everyone?',
                        'This message will be removed for both you and your coach.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(id, true) },
                        ],
                      );
                    }}
                  >
                    <Ionicons name="trash-bin-outline" size={20} color={colors.danger} />
                    <Text style={[s.ctxItemText, { color: colors.danger }]}>Delete for Everyone</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Edit message modal ── */}
      <Modal visible={!!editingMsg} transparent animationType="fade" onRequestClose={() => setEditingMsg(null)}>
        <Pressable style={s.editOverlay} onPress={() => setEditingMsg(null)}>
          <Pressable>
            <View style={[s.editSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.editTitle, { color: colors.textPrimary }]}>Edit Message</Text>
              <TextInput
                style={[s.editInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
                maxLength={2000}
                placeholderTextColor={colors.textSecondary}
              />
              <View style={s.editActions}>
                <Pressable style={[s.editBtn, { borderColor: colors.border }]} onPress={() => setEditingMsg(null)}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.editBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                  onPress={() => { editMessage(editingMsg!.id, editText); setEditingMsg(null); }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function BubbleItem({ msg, mine, colors, s, onImagePress, onLongPress }: {
  msg: any; mine: boolean; colors: any; s: any;
  onImagePress: (url: string) => void;
  onLongPress: () => void;
}) {
  const isDeletedForMe = (mine && msg.deleted_for_sender) || (!mine && msg.deleted_for_receiver);

  if (isDeletedForMe) {
    return (
      <View style={[s.bubbleWrap, mine ? s.bubbleWrapMine : s.bubbleWrapTheirs]}>
        <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs, { opacity: 0.55 }]}>
          <Text style={{ fontStyle: 'italic', fontSize: 13, color: mine ? 'rgba(255,255,255,0.8)' : colors.textSecondary }}>
            🚫 Message deleted
          </Text>
        </View>
      </View>
    );
  }

  const isImage = msg.attachment_type === 'image';
  const isVideo = msg.attachment_type === 'video';
  const isFile  = msg.attachment_type === 'file';
  const hasAttachment = !!msg.attachment_url;

  return (
    <Pressable
      style={[s.bubbleWrap, mine ? s.bubbleWrapMine : s.bubbleWrapTheirs]}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={[
        s.bubble,
        mine ? s.bubbleMine : s.bubbleTheirs,
        hasAttachment && !msg.content && s.bubbleMediaOnly,
      ]}>
        {isImage && (
          <Pressable onPress={() => onImagePress(msg.attachment_url)}>
            <Image source={{ uri: msg.attachment_url }} style={s.attachImg} resizeMode="cover" />
          </Pressable>
        )}
        {isVideo && (
          <Pressable style={s.videoThumb} onPress={() => onImagePress(msg.attachment_url)}>
            <View style={s.videoPlay}>
              <Ionicons name="play" size={28} color="#fff" />
            </View>
            <Text style={s.videoLabel}>🎬 Video</Text>
          </Pressable>
        )}
        {isFile && (
          <Pressable
            style={[s.fileCard, { backgroundColor: mine ? 'rgba(0,0,0,0.15)' : colors.bg }]}
            onPress={() => msg.attachment_url && WebBrowser.openBrowserAsync(msg.attachment_url)}
          >
            <Ionicons name="document-outline" size={28} color={mine ? '#fff' : colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[s.fileName, { color: mine ? '#fff' : colors.textPrimary }]} numberOfLines={2}>
                {msg.attachment_name ?? 'File'}
              </Text>
              <Text style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.6)' : colors.textSecondary, marginTop: 2 }}>
                Tap to open
              </Text>
            </View>
          </Pressable>
        )}
        {!!msg.content && (
          <Text style={[s.bubbleText, mine ? s.bubbleTextMine : s.bubbleTextTheirs]}>
            {msg.content}
          </Text>
        )}
        {msg.is_edited && (
          <Text style={{ fontSize: 9, fontStyle: 'italic', color: mine ? 'rgba(255,255,255,0.5)' : colors.textSecondary, marginTop: 1 }}>
            edited
          </Text>
        )}
        <View style={[s.bubbleMeta, mine ? s.bubbleMetaMine : s.bubbleMetaTheirs]}>
          <Text style={[s.bubbleTime, mine ? s.bubbleTimeMine : s.bubbleTimeTheirs]}>
            {fmtTime(msg.created_at)}
          </Text>
          {mine && (
            <Ionicons
              name={msg.read_at ? 'checkmark-done' : 'checkmark'}
              size={13}
              color={msg.read_at ? '#fff' : 'rgba(255,255,255,0.5)'}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function SheetOption({ icon, label, color, onPress, colors }: {
  icon: any; label: string; color: string; onPress: () => void; colors: any;
}) {
  return (
    <Pressable
      style={({ pressed }) => [{ alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
    >
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: color + '18', justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    noCoach: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
    noCoachText: { ...Typography.subtitle, color: c.textPrimary, textAlign: 'center', marginTop: 12 },
    noCoachSub: { ...Typography.body, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },

    header: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 12, paddingVertical: 10,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    backBtn: { paddingRight: 2 },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    menuBtn: { paddingLeft: 4 },
    searchInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
    searchBar: { paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1 },
    searchCount: { fontSize: 12, fontWeight: '600' },
    menuOverlay: { flex: 1, alignItems: 'flex-end', paddingTop: 56, paddingRight: 12 },
    menuSheet: { borderRadius: 10, borderWidth: 1, minWidth: 190, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    menuItemText: { fontSize: 14, fontWeight: '600' },
    menuDivider: { height: 1 },
    infoSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, alignItems: 'center', gap: 8 },
    infoAvatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    infoAvatarText: { fontSize: 24, fontWeight: '800' },
    infoName: { ...Typography.subtitle, fontWeight: '800', fontSize: 20 },
    infoRole: { ...Typography.caption, fontSize: 13 },
    infoDivider: { height: 1, width: '100%', marginVertical: 12 },
    infoNote: { ...Typography.caption, textAlign: 'center', lineHeight: 18 },
    infoClose: { marginTop: 12, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10, width: '100%', alignItems: 'center' },
    avatar: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: c.accent + '22', borderWidth: 1.5, borderColor: c.accent + '55',
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    avatarText: { fontSize: 13, fontWeight: '800', color: c.accent },
    coachName: { ...Typography.body, color: c.textPrimary, fontWeight: '700', fontSize: 16 },
    coachRole: { ...Typography.caption, color: c.textSecondary },

    list: { padding: 12, paddingBottom: 4, flexGrow: 1, justifyContent: 'flex-end' },

    dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
    dayLine: { flex: 1, height: 1, backgroundColor: c.border },
    dayLabel: { ...Typography.caption, color: c.textSecondary, fontSize: 11 },

    bubbleWrap: { marginBottom: 3 },
    bubbleWrapMine: { alignItems: 'flex-end' },
    bubbleWrapTheirs: { alignItems: 'flex-start' },

    bubble: {
      maxWidth: '80%', borderRadius: 18, overflow: 'hidden',
      paddingHorizontal: 12, paddingVertical: 8,
    },
    bubbleMediaOnly: { paddingHorizontal: 0, paddingVertical: 0, paddingBottom: 0 },
    bubbleMine: {
      backgroundColor: c.accent,
      borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
      backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border,
      borderBottomLeftRadius: 4,
    },

    attachImg: { width: 220, height: 220, borderRadius: 14 },
    videoThumb: {
      width: 220, height: 140, backgroundColor: '#000',
      borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 6,
    },
    videoPlay: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: 'rgba(255,255,255,0.25)',
      justifyContent: 'center', alignItems: 'center',
    },
    videoLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
    fileCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14,
      minWidth: 180,
    },
    fileName: { ...Typography.caption, flex: 1, fontWeight: '600', fontSize: 13 },

    bubbleText: { fontSize: 15, lineHeight: 21 },
    bubbleTextMine: { color: '#fff' },
    bubbleTextTheirs: { color: c.textPrimary },

    bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    bubbleMetaMine: { justifyContent: 'flex-end', paddingHorizontal: 2, paddingBottom: 2 },
    bubbleMetaTheirs: { justifyContent: 'flex-end', paddingHorizontal: 2, paddingBottom: 2 },
    bubbleTime: { fontSize: 10 },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
    bubbleTimeTheirs: { color: c.textSecondary },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
    emptyText: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },

    pendingBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1,
    },
    pendingThumb: { width: 44, height: 44, borderRadius: 8 },
    pendingName: { flex: 1, fontSize: 13, fontWeight: '600' },

    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 8,
      paddingHorizontal: 10, paddingVertical: 10,
      backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border,
    },
    attachBtn: { paddingBottom: 10 },
    input: {
      flex: 1, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
      borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
      color: c.textPrimary, fontSize: 15, maxHeight: 120,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: 21,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    },

    sheetBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    sheetTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 20 },
    sheetRow: { flexDirection: 'row', justifyContent: 'space-around' },

    fullscreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    fullscreenImg: { width: '100%', height: '85%' },
    fullscreenClose: {
      position: 'absolute', top: 52, right: 20,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
    },

    galleryRoot: { flex: 1 },
    galleryHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1,
    },
    galleryTitle: { flex: 1, ...Typography.subtitle },
    gallerySubtitle: { ...Typography.caption },
    galleryEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
    galleryEmptyText: { ...Typography.body },
    galleryGrid: { padding: 1 },
    galleryCell: { width: CELL_SIZE, height: CELL_SIZE, padding: 1 },
    galleryCellInner: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.surface } as any,
    galleryPlayBadge: {
      position: 'absolute', bottom: 6, right: 6, width: 22, height: 22, borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center',
    },

    ctxOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
    ctxSheet: {
      borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1,
      overflow: 'hidden',
    },
    ctxItem: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 20, paddingVertical: 16,
    },
    ctxItemText: { fontSize: 15, fontWeight: '600' },
    ctxDivider: { height: 1 },

    editOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.overlay, padding: 20 },
    editSheet: {
      width: '100%', borderRadius: 16, borderWidth: 1,
      padding: 20, gap: 14,
    },
    editTitle: { fontSize: 16, fontWeight: '700' },
    editInput: {
      borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 15, minHeight: 80, maxHeight: 180, textAlignVertical: 'top',
    },
    editActions: { flexDirection: 'row', gap: 10 },
    editBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    },
  });
}
