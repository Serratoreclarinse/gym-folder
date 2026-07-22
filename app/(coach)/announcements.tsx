import { useEffect, useMemo, useRef, useState } from 'react';
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
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { sendPushNotification } from '@/lib/pushNotifications';

// ── Constants ──────────────────────────────────────────────────────────────────

export const TYPE_CONFIG: Record<AnnouncementType, { label: string; color: string; icon: string }> = {
  emergency: { label: 'Emergency', color: '#E53935',  icon: 'warning-outline' },
  holiday:   { label: 'Holiday',   color: '#FF9800',  icon: 'sunny-outline' },
  general:   { label: 'General',   color: '#9E9E9E',  icon: 'megaphone-outline' },
  promo:     { label: 'Promo',     color: '#9C27B0',  icon: 'pricetag-outline' },
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
  const { colors } = useTheme();
  const af = useMemo(() => makeAfStyles(colors), [colors]);
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
          <Ionicons name="close" size={22} color={colors.textSecondary} />
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
                    <Ionicons name={tc.icon as any} size={12} color={active ? tc.color : colors.textSecondary} />
                    <Text style={[af.typeBtnText, { color: active ? tc.color : colors.textSecondary }]}>{tc.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Title */}
        <Text style={[af.lbl, !isEdit && { marginTop: 16 }]}>TITLE</Text>
        <TextInput
          style={[af.input, type === 'emergency' && { borderColor: colors.danger + '60' }]}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. No sessions this Saturday"
          placeholderTextColor={colors.textSecondary + '80'}
          autoCapitalize="sentences"
          returnKeyType="next"
        />

        {/* Message */}
        <Text style={[af.lbl, { marginTop: 14 }]}>MESSAGE</Text>
        <TextInput
          style={[af.input, af.textArea, type === 'emergency' && { borderColor: colors.danger + '60' }]}
          value={message}
          onChangeText={setMessage}
          placeholder="Write your announcement here…"
          placeholderTextColor={colors.textSecondary + '80'}
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
                        key={colors.id}
                        style={[af.clientRow, checked && af.clientRowChecked]}
                        onPress={() => toggleClient(c.id)}
                      >
                        <View style={[af.checkbox, checked && af.checkboxChecked]}>
                          {checked && <Ionicons name="checkmark" size={12} color={colors.bg} />}
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
            color={pinned ? colors.accent : colors.textSecondary}
          />
          <Text style={[af.pinLabel, pinned && { color: colors.accent }]}>
            {pinned ? 'Pinned — shows banner on Dashboard' : 'Pin to Dashboard'}
          </Text>
        </Pressable>

        {/* Emergency warning */}
        {type === 'emergency' && (
          <View style={af.emergencyHint}>
            <Ionicons name="information-circle-outline" size={14} color={colors.danger} />
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
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
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
            <Ionicons name="pin" size={13} color={colors.accent} style={{ marginRight: 6 }} />
          )}
          <Text style={s.cardDate}>{fmtDate(ann.created_at)}</Text>
        </View>
      </View>

      <Text style={s.cardTitle}>{ann.title}</Text>
      <Text style={s.cardMsg} numberOfLines={2}>{ann.message}</Text>

      <View style={s.cardFooter}>
        <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
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
  const { colors } = useTheme();
  const wm = useMemo(() => makeWmStyles(colors), [colors]);
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
          <Ionicons name="close" size={22} color={colors.textSecondary} />
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
            key={colors.id}
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
              <Ionicons name="logo-whatsapp" size={15} color={colors.phone ? '#25D366' : colors.textSecondary} />
              <Text style={[wm.sendBtnText, !c.phone && { color: colors.textSecondary }]}>Send</Text>
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
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
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
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />
        }
      >
        {announcements.length === 0 && !loading ? (
          <View style={s.empty}>
            <Ionicons name="megaphone-outline" size={52} color={colors.border} />
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
        <Ionicons name="add" size={28} color={colors.bg} />
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

function makeAfStyles(colors: ColorScheme) {
  return StyleSheet.create({
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center',
    marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 4,
  },
  title: { ...Typography.label, color: colors.textPrimary, fontSize: 14 },
  scroll: { flexGrow: 0 },
  content: { padding: 20, paddingTop: 12, paddingBottom: 44 },
  lbl: { ...Typography.label, color: colors.textSecondary, marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    borderColor: colors.border,
  },
  typeBtnText: { fontSize: 11, fontWeight: '700' },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.textPrimary, fontSize: 15, marginBottom: 4,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
  targetRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  targetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 11,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  targetBtnActive: { backgroundColor: colors.accent + '18', borderColor: colors.accent },
  targetBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  targetBtnTextActive: { color: colors.accent },
  clientList: {
    backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, overflow: 'hidden', marginTop: 10,
  },
  noClientsText: { ...Typography.body, color: colors.textSecondary, padding: 16 },
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  clientRowChecked: { backgroundColor: colors.accent + '08' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  clientRowName: { ...Typography.body, color: colors.textPrimary },
  pinRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border,
    marginTop: 12, marginBottom: 4,
  },
  pinLabel: { ...Typography.body, color: colors.textSecondary },
  emergencyHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.danger + '10', borderRadius: 10,
    padding: 10, marginBottom: 8,
  },
  emergencyHintText: { ...Typography.caption, color: colors.danger, flex: 1 },
  saveBtn: {
    backgroundColor: colors.accent, borderRadius: 13,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  saveBtnEmergency: { backgroundColor: colors.danger },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: colors.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1.2 },
});
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
  scroll: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 100 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: c.textSecondary, textAlign: 'center' },

  tip: { ...Typography.caption, color: c.textSecondary, textAlign: 'center', marginTop: 16 },

  card: {
    backgroundColor: c.surface, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
  },
  cardEmergency: { borderColor: c.danger + '50', backgroundColor: c.danger + '08' },
  cardPinned: { borderColor: c.accent + '40' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  cardTopRight: { flexDirection: 'row', alignItems: 'center' },
  cardDate: { ...Typography.caption, color: c.textSecondary },
  cardTitle: { ...Typography.body, color: c.textPrimary, fontWeight: '700', marginBottom: 4 },
  cardMsg: { ...Typography.caption, color: c.textSecondary, lineHeight: 18, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  cardTarget: { ...Typography.caption, color: c.textSecondary },

  fab: {
    position: 'absolute', bottom: 32, right: 20,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },

  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', paddingBottom: 16,
  },
  sheetTall: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
  },
});
}

function makeWmStyles(colors: ColorScheme) {
  return StyleSheet.create({
  wrap: { flex: 1 },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  title: { ...Typography.label, color: colors.textPrimary, fontSize: 14 },
  annCard: {
    marginHorizontal: 20, backgroundColor: colors.bg, borderRadius: 12,
    padding: 12, borderWidth: 1, marginBottom: 12,
  },
  annBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  annBadgeText: { fontSize: 10, fontWeight: '800' },
  annTitle: { ...Typography.body, color: colors.textPrimary, fontWeight: '700', marginBottom: 4 },
  annMsg: { ...Typography.caption, color: colors.textSecondary },
  sub: { ...Typography.caption, color: colors.textSecondary, paddingHorizontal: 20, marginBottom: 8 },
  list: { flex: 1, paddingHorizontal: 20 },
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg, borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent + '18', borderWidth: 1, borderColor: colors.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: colors.accent },
  clientInfo: { flex: 1 },
  clientName: { ...Typography.body, color: colors.textPrimary, fontWeight: '600', marginBottom: 1 },
  clientPhone: { ...Typography.caption, color: colors.textSecondary },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#25D36618', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#25D36640',
  },
  sendBtnDim: { backgroundColor: colors.border + '30', borderColor: colors.border },
  sendBtnText: { fontSize: 12, fontWeight: '700', color: '#25D366' },
});
}