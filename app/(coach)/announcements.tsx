import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAnnouncements,
  Announcement,
  AnnouncementType,
  AnnouncementTarget,
  NewAnnouncement,
} from '@/hooks/useAnnouncements';
import { useClients } from '@/hooks/useClients';
import { Colors, Typography } from '@/constants/theme';
import { sendPushNotification } from '@/lib/pushNotifications';

// ── Constants ──────────────────────────────────────────────────────────────────

export const TYPE_CONFIG: Record<AnnouncementType, { label: string; color: string; icon: string }> = {
  emergency: { label: 'Emergency', color: Colors.danger,        icon: 'warning-outline' },
  holiday:   { label: 'Holiday',   color: '#FF9800',            icon: 'sunny-outline' },
  general:   { label: 'General',   color: Colors.textSecondary, icon: 'megaphone-outline' },
  promo:     { label: 'Promo',     color: '#9C27B0',            icon: 'pricetag-outline' },
};

const TYPES: AnnouncementType[] = ['emergency', 'holiday', 'general', 'promo'];

export function isEditable(ann: Announcement): boolean {
  if (ann.type !== 'emergency') return true;
  return Date.now() - new Date(ann.created_at).getTime() < 24 * 60 * 60 * 1000;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Announcement Form — defined at module scope to prevent keyboard flicker ───

type FormState = {
  title: string;
  message: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  is_pinned: boolean;
  selectedIds: string[];
};

type ClientOption = { id: string; name: string };

function AnnouncementForm({
  initial,
  clients,
  isEdit,
  saving,
  onSave,
  onCancel,
}: {
  initial?: Partial<FormState>;
  clients: ClientOption[];
  isEdit: boolean;
  saving: boolean;
  onSave: (form: FormState) => void;
  onCancel: () => void;
}) {
  const [title, setTitle]       = useState(initial?.title ?? '');
  const [message, setMessage]   = useState(initial?.message ?? '');
  const [type, setType]         = useState<AnnouncementType>(initial?.type ?? 'general');
  const [target, setTarget]     = useState<AnnouncementTarget>(initial?.target ?? 'all');
  const [pinned, setPinned]     = useState(initial?.is_pinned ?? false);
  const [selectedIds, setIds]   = useState<string[]>(initial?.selectedIds ?? []);

  const canSave =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    (target === 'all' || selectedIds.length > 0);

  const toggleClient = (id: string) =>
    setIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const cfg = TYPE_CONFIG[type];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={af.handle} />
      <View style={af.header}>
        <Text style={af.title}>{isEdit ? 'EDIT ANNOUNCEMENT' : 'NEW ANNOUNCEMENT'}</Text>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={af.scroll}
        contentContainerStyle={af.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type — only editable for new announcements */}
        {!isEdit && (
          <>
            <Text style={af.lbl}>TYPE</Text>
            <View style={af.typeRow}>
              {TYPES.map((t) => {
                const tc = TYPE_CONFIG[t];
                const active = type === t;
                return (
                  <Pressable
                    key={t}
                    style={[af.typeBtn, { borderColor: tc.color + '50' }, active && { backgroundColor: tc.color + '20', borderColor: tc.color }]}
                    onPress={() => setType(t)}
                  >
                    <Ionicons name={tc.icon as any} size={12} color={active ? tc.color : Colors.textSecondary} />
                    <Text style={[af.typeBtnText, { color: active ? tc.color : Colors.textSecondary }]}>{tc.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Title */}
        <Text style={[af.lbl, !isEdit && { marginTop: 16 }]}>TITLE</Text>
        <TextInput
          style={[af.input, type === 'emergency' && { borderColor: Colors.danger + '60' }]}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. No sessions this Saturday"
          placeholderTextColor={Colors.textSecondary + '80'}
          autoCapitalize="sentences"
          returnKeyType="next"
        />

        {/* Message */}
        <Text style={[af.lbl, { marginTop: 14 }]}>MESSAGE</Text>
        <TextInput
          style={[af.input, af.textArea, type === 'emergency' && { borderColor: Colors.danger + '60' }]}
          value={message}
          onChangeText={setMessage}
          placeholder="Write your announcement here…"
          placeholderTextColor={Colors.textSecondary + '80'}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Target — only editable for new announcements */}
        {!isEdit && (
          <>
            <Text style={[af.lbl, { marginTop: 14 }]}>SEND TO</Text>
            <View style={af.targetRow}>
              {(['all', 'specific'] as AnnouncementTarget[]).map((t) => (
                <Pressable
                  key={t}
                  style={[af.targetBtn, target === t && af.targetBtnActive]}
                  onPress={() => setTarget(t)}
                >
                  <Text style={[af.targetBtnText, target === t && af.targetBtnTextActive]}>
                    {t === 'all' ? 'All Clients' : 'Specific Clients'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {target === 'specific' && (
              <View style={af.clientList}>
                {clients.length === 0 ? (
                  <Text style={af.noClientsText}>No clients found</Text>
                ) : (
                  clients.map((c) => {
                    const checked = selectedIds.includes(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        style={[af.clientRow, checked && af.clientRowChecked]}
                        onPress={() => toggleClient(c.id)}
                      >
                        <View style={[af.checkbox, checked && af.checkboxChecked]}>
                          {checked && <Ionicons name="checkmark" size={12} color={Colors.bg} />}
                        </View>
                        <Text style={af.clientRowName}>{c.name}</Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}

        {/* Pin toggle */}
        <Pressable style={af.pinRow} onPress={() => setPinned((p) => !p)}>
          <Ionicons
            name={pinned ? 'pin' : 'pin-outline'}
            size={20}
            color={pinned ? Colors.accent : Colors.textSecondary}
          />
          <Text style={[af.pinLabel, pinned && { color: Colors.accent }]}>
            {pinned ? 'Pinned — shows banner on Dashboard' : 'Pin to Dashboard'}
          </Text>
        </Pressable>

        {/* Emergency warning */}
        {type === 'emergency' && (
          <View style={af.emergencyHint}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.danger} />
            <Text style={af.emergencyHintText}>Emergency notices cannot be edited after 24 hours.</Text>
          </View>
        )}

        {/* Save */}
        <Pressable
          style={[
            af.saveBtn,
            type === 'emergency' && af.saveBtnEmergency,
            (!canSave || saving) && af.saveBtnDisabled,
          ]}
          onPress={() => canSave && !saving && onSave({ title, message, type, target, is_pinned: pinned, selectedIds })}
          disabled={!canSave || saving}
        >
          <Text style={af.saveBtnText}>{saving ? 'POSTING…' : 'POST ANNOUNCEMENT'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Announcement Card — at module scope ───────────────────────────────────────

function AnnouncementCard({
  ann,
  onLongPress,
}: {
  ann: Announcement;
  onLongPress: () => void;
}) {
  const cfg = TYPE_CONFIG[ann.type];
  return (
    <Pressable
      style={({ pressed }) => [
        s.card,
        ann.type === 'emergency' && s.cardEmergency,
        ann.is_pinned && s.cardPinned,
        pressed && { opacity: 0.75 },
      ]}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={s.cardTop}>
        <View style={[s.badge, { backgroundColor: cfg.color + '20', borderColor: cfg.color + '50' }]}>
          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
        </View>
        <View style={s.cardTopRight}>
          {ann.is_pinned && (
            <Ionicons name="pin" size={13} color={Colors.accent} style={{ marginRight: 6 }} />
          )}
          <Text style={s.cardDate}>{fmtDate(ann.created_at)}</Text>
        </View>
      </View>

      <Text style={s.cardTitle}>{ann.title}</Text>
      <Text style={s.cardMsg} numberOfLines={2}>{ann.message}</Text>

      <View style={s.cardFooter}>
        <Ionicons name="people-outline" size={12} color={Colors.textSecondary} />
        <Text style={s.cardTarget}>
          {ann.target === 'all'
            ? 'All Clients'
            : `${ann.recipients.length} client${ann.recipients.length !== 1 ? 's' : ''}`}
        </Text>
      </View>
    </Pressable>
  );
}

// ── WhatsApp Notify Modal — at module scope ───────────────────────────────────

function WhatsAppModal({
  announcement,
  clients,
  onClose,
}: {
  announcement: Announcement | null;
  clients: { id: string; name: string; phone: string | null }[];
  onClose: () => void;
}) {
  if (!announcement) return null;

  const targets =
    announcement.target === 'all'
      ? clients
      : clients.filter((c) => announcement.recipients.includes(c.id));

  const cfg = TYPE_CONFIG[announcement.type];

  const sendWA = (phone: string | null, name: string) => {
    if (!phone) {
      Alert.alert('No phone number', `${name} has no phone number saved.`);
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const header = `[${cfg.label.toUpperCase()}] ${announcement.title}`;
    const msg = `${header}\n\n${announcement.message}`;
    Linking.openURL(
      `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`,
    ).catch(() => Alert.alert('WhatsApp not found', 'Make sure WhatsApp is installed.'));
  };

  return (
    <View style={wm.wrap}>
      <View style={wm.handle} />
      <View style={wm.header}>
        <Text style={wm.title}>NOTIFY VIA WHATSAPP</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Announcement preview */}
      <View style={[wm.annCard, { borderColor: cfg.color + '40' }]}>
        <View style={[wm.annBadge, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[wm.annBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={wm.annTitle}>{announcement.title}</Text>
        <Text style={wm.annMsg} numberOfLines={2}>{announcement.message}</Text>
      </View>

      <Text style={wm.sub}>
        {targets.length === 0
          ? 'No clients found'
          : `Tap "Send" to open WhatsApp for each client (one at a time)`}
      </Text>

      <ScrollView style={wm.list} showsVerticalScrollIndicator={false}>
        {targets.map((c) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [wm.clientRow, pressed && { opacity: 0.7 }]}
            onPress={() => sendWA(c.phone, c.name)}
          >
            <View style={wm.avatar}>
              <Text style={wm.avatarText}>
                {c.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View style={wm.clientInfo}>
              <Text style={wm.clientName}>{c.name}</Text>
              <Text style={wm.clientPhone}>{c.phone ?? 'No phone'}</Text>
            </View>
            <View style={[wm.sendBtn, !c.phone && wm.sendBtnDim]}>
              <Ionicons name="logo-whatsapp" size={15} color={c.phone ? '#25D366' : Colors.textSecondary} />
              <Text style={[wm.sendBtnText, !c.phone && { color: Colors.textSecondary }]}>Send</Text>
            </View>
          </Pressable>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function AnnouncementsScreen() {
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const {
    announcements, loading, refetch,
    createAnnouncement, updateAnnouncement, deleteAnnouncement, togglePin,
  } = useAnnouncements();
  const { clients } = useClients();

  const [showForm, setShowForm]     = useState(false);
  const [formKey, setFormKey]       = useState(0);
  const [editAnn, setEditAnn]       = useState<Announcement | null>(null);
  const [formPreset, setFormPreset] = useState<AnnouncementType | null>(null);
  const [saving, setSaving]         = useState(false);
  const [showWA, setShowWA]         = useState(false);
  const [waAnn, setWaAnn]           = useState<Announcement | null>(null);
  const presetHandled               = useRef(false);

  // Auto-open form when navigated with a preset type (e.g. emergency from dashboard)
  useEffect(() => {
    if (preset && !presetHandled.current) {
      presetHandled.current = true;
      const t = (['emergency', 'holiday', 'general', 'promo'] as AnnouncementType[]).includes(
        preset as AnnouncementType,
      )
        ? (preset as AnnouncementType)
        : null;
      if (t) {
        setFormPreset(t);
        setEditAnn(null);
        setFormKey((k) => k + 1);
        setShowForm(true);
      }
    }
  }, []);

  const openForm = (ann: Announcement | null) => {
    setEditAnn(ann);
    setFormPreset(null);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const formInitial: Partial<FormState> | undefined = editAnn
    ? {
        title: editAnn.title,
        message: editAnn.message,
        type: editAnn.type,
        target: editAnn.target,
        is_pinned: editAnn.is_pinned,
        selectedIds: editAnn.recipients,
      }
    : formPreset
    ? { type: formPreset }
    : undefined;

  const handleSave = async (form: FormState) => {
    setSaving(true);

    if (editAnn) {
      const { error } = await updateAnnouncement(editAnn.id, {
        title: form.title,
        message: form.message,
        is_pinned: form.is_pinned,
      });
      setSaving(false);
      if (error) { Alert.alert('Error', error); return; }
      setShowForm(false);
    } else {
      const payload: NewAnnouncement = {
        title: form.title,
        message: form.message,
        type: form.type,
        target: form.target,
        is_pinned: form.is_pinned,
        recipientIds: form.selectedIds,
      };
      const { error, announcement } = await createAnnouncement(payload);
      setSaving(false);
      if (error) { Alert.alert('Error', error); return; }
      setShowForm(false);
      if (announcement) {
        const typeEmoji: Record<AnnouncementType, string> = {
          emergency: '⚠️', holiday: '🌴', general: '📢', promo: '🎁',
        };
        const recipientIds = form.target === 'all'
          ? clients.map((c) => c.id)
          : form.selectedIds;
        await Promise.all(
          recipientIds.map((clientId) =>
            sendPushNotification(clientId, {
              title: `${typeEmoji[form.type]} ${form.title}`,
              body: form.message,
            })
          )
        );
        setWaAnn(announcement);
        setShowWA(true);
      }
    }
  };

  const handleLongPress = (ann: Announcement) => {
    const editable = isEditable(ann);
    const options: any[] = [];
    if (editable) options.push({ text: 'Edit', onPress: () => openForm(ann) });
    options.push(
      {
        text: ann.is_pinned ? 'Unpin from Dashboard' : 'Pin to Dashboard',
        onPress: () => togglePin(ann.id, ann.is_pinned),
      },
      {
        text: 'Notify via WhatsApp',
        onPress: () => { setWaAnn(ann); setShowWA(true); },
      },
      {
        text: 'Delete',
        style: 'destructive' as const,
        onPress: () =>
          Alert.alert('Delete Announcement', `Delete "${ann.title}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
              const { error } = await deleteAnnouncement(ann.id);
              if (error) Alert.alert('Error', error);
            }},
          ]),
      },
      { text: 'Cancel', style: 'cancel' as const },
    );
    Alert.alert(ann.title, undefined, options);
  };

  const clientOptions: ClientOption[] = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={Colors.accent} />
        }
      >
        {announcements.length === 0 && !loading ? (
          <View style={s.empty}>
            <Ionicons name="megaphone-outline" size={52} color={Colors.border} />
            <Text style={s.emptyTitle}>No announcements yet</Text>
            <Text style={s.emptySub}>Tap + to post an update to your clients</Text>
          </View>
        ) : (
          announcements.map((ann) => (
            <AnnouncementCard
              key={ann.id}
              ann={ann}
              onLongPress={() => handleLongPress(ann)}
            />
          ))
        )}
        <Text style={s.tip}>Hold a card to edit, pin, notify, or delete</Text>
      </ScrollView>

      {/* FAB */}
      <Pressable style={s.fab} onPress={() => openForm(null)}>
        <Ionicons name="add" size={28} color={Colors.bg} />
      </Pressable>

      {/* Form modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setShowForm(false)}
      >
        <Pressable style={s.overlay} onPress={() => !saving && setShowForm(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <AnnouncementForm
              key={formKey}
              initial={formInitial}
              clients={clientOptions}
              isEdit={!!editAnn}
              saving={saving}
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* WhatsApp modal */}
      <Modal
        visible={showWA}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWA(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowWA(false)}>
          <Pressable style={s.sheetTall} onPress={() => {}}>
            <WhatsAppModal
              announcement={waAnn}
              clients={clients}
              onClose={() => setShowWA(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const af = StyleSheet.create({
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center',
    marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 4,
  },
  title: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },
  scroll: { flexGrow: 0 },
  content: { padding: 20, paddingTop: 12, paddingBottom: 44 },
  lbl: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    borderColor: Colors.border,
  },
  typeBtnText: { fontSize: 11, fontWeight: '700' },
  input: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15, marginBottom: 4,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
  targetRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  targetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 11,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
  },
  targetBtnActive: { backgroundColor: Colors.accent + '18', borderColor: Colors.accent },
  targetBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  targetBtnTextActive: { color: Colors.accent },
  clientList: {
    backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden', marginTop: 10,
  },
  noClientsText: { ...Typography.body, color: Colors.textSecondary, padding: 16 },
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  clientRowChecked: { backgroundColor: Colors.accent + '08' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  clientRowName: { ...Typography.body, color: Colors.textPrimary },
  pinRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border,
    marginTop: 12, marginBottom: 4,
  },
  pinLabel: { ...Typography.body, color: Colors.textSecondary },
  emergencyHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.danger + '10', borderRadius: 10,
    padding: 10, marginBottom: 8,
  },
  emergencyHintText: { ...Typography.caption, color: Colors.danger, flex: 1 },
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 13,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  saveBtnEmergency: { backgroundColor: Colors.danger },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1.2 },
});

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 100 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },

  tip: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 16 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  cardEmergency: { borderColor: Colors.danger + '50', backgroundColor: Colors.danger + '08' },
  cardPinned: { borderColor: Colors.accent + '40' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  cardTopRight: { flexDirection: 'row', alignItems: 'center' },
  cardDate: { ...Typography.caption, color: Colors.textSecondary },
  cardTitle: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 4 },
  cardMsg: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  cardTarget: { ...Typography.caption, color: Colors.textSecondary },

  fab: {
    position: 'absolute', bottom: 32, right: 20,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', paddingBottom: 16,
  },
  sheetTall: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
  },
});

const wm = StyleSheet.create({
  wrap: { flex: 1 },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  title: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },
  annCard: {
    marginHorizontal: 20, backgroundColor: Colors.bg, borderRadius: 12,
    padding: 12, borderWidth: 1, marginBottom: 12,
  },
  annBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  annBadgeText: { fontSize: 10, fontWeight: '800' },
  annTitle: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 4 },
  annMsg: { ...Typography.caption, color: Colors.textSecondary },
  sub: { ...Typography.caption, color: Colors.textSecondary, paddingHorizontal: 20, marginBottom: 8 },
  list: { flex: 1, paddingHorizontal: 20 },
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bg, borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accent + '18', borderWidth: 1, borderColor: Colors.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: Colors.accent },
  clientInfo: { flex: 1 },
  clientName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 1 },
  clientPhone: { ...Typography.caption, color: Colors.textSecondary },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#25D36618', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#25D36640',
  },
  sendBtnDim: { backgroundColor: Colors.border + '30', borderColor: Colors.border },
  sendBtnText: { fontSize: 12, fontWeight: '700', color: '#25D366' },
});
