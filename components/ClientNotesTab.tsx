import { useState } from 'react';
import {
  Alert,
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
import { useNotes, CoachNote, NoteCategory, NewNote } from '@/hooks/useNotes';
import { Colors, Typography } from '@/constants/theme';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: { key: NoteCategory; label: string; color: string }[] = [
  { key: 'general', label: 'General', color: Colors.textSecondary },
  { key: 'goal', label: 'Goal', color: '#4CAF50' },
  { key: 'injury', label: 'Injury / Health', color: '#FF4D4D' },
  { key: 'preference', label: 'Preference', color: '#FFA500' },
  { key: 'behavior', label: 'Behavior', color: '#9C27B0' },
];

function getCat(key: NoteCategory) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split('T')[0];

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Form state ───────────────────────────────────────────────────────────────

type NoteFormState = {
  note_text: string;
  category: NoteCategory;
  date: string;
  is_pinned: boolean;
};

function blankForm(): NoteFormState {
  return { note_text: '', category: 'general', date: todayISO(), is_pinned: false };
}

function noteToForm(n: CoachNote): NoteFormState {
  return {
    note_text: n.note_text,
    category: n.category,
    date: n.date,
    is_pinned: n.is_pinned,
  };
}

// ─── Note Form (OUTSIDE parent — has TextInputs, prevents keyboard flicker) ──

function NoteForm({
  note,
  onSave,
  onCancel,
}: {
  note: CoachNote | null;
  onSave: (data: NoteFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<NoteFormState>(note ? noteToForm(note) : blankForm());

  const set = <K extends keyof NoteFormState>(field: K, val: NoteFormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const canSave = form.note_text.trim().length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={fm.handle} />
      <View style={fm.header}>
        <Text style={fm.title}>{note ? 'EDIT NOTE' : 'ADD NOTE'}</Text>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={fm.scroll}
        contentContainerStyle={fm.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Note text */}
        <Text style={fm.label}>NOTE</Text>
        <TextInput
          style={fm.textArea}
          value={form.note_text}
          onChangeText={(v) => set('note_text', v)}
          placeholder="Write your note here…"
          placeholderTextColor={Colors.textSecondary}
          multiline
          numberOfLines={5}
          autoFocus={!note}
          textAlignVertical="top"
        />

        {/* Category picker */}
        <Text style={[fm.label, { marginTop: 16 }]}>CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={fm.catRow}
        >
          {CATEGORIES.map((cat) => {
            const active = form.category === cat.key;
            return (
              <Pressable
                key={cat.key}
                style={[
                  fm.catBtn,
                  { borderColor: cat.color + '60' },
                  active && { backgroundColor: cat.color + '25', borderColor: cat.color },
                ]}
                onPress={() => set('category', cat.key)}
              >
                <Text style={[fm.catBtnText, { color: active ? cat.color : Colors.textSecondary }]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Date */}
        <Text style={[fm.label, { marginTop: 16 }]}>DATE</Text>
        <TextInput
          style={fm.input}
          value={form.date}
          onChangeText={(v) => set('date', v)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="numbers-and-punctuation"
        />

        {/* Pin toggle */}
        <Pressable
          style={fm.pinRow}
          onPress={() => set('is_pinned', !form.is_pinned)}
        >
          <Ionicons
            name={form.is_pinned ? 'pin' : 'pin-outline'}
            size={20}
            color={form.is_pinned ? Colors.accent : Colors.textSecondary}
          />
          <Text style={[fm.pinLabel, form.is_pinned && { color: Colors.accent }]}>
            {form.is_pinned ? 'Pinned to top' : 'Pin this note'}
          </Text>
        </Pressable>

        <Pressable
          style={[fm.saveBtn, !canSave && fm.saveBtnDisabled]}
          onPress={() => canSave && onSave(form)}
          disabled={!canSave}
        >
          <Text style={fm.saveBtnText}>{note ? 'UPDATE NOTE' : 'SAVE NOTE'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  onLongPress,
  expanded,
  onToggleExpand,
}: {
  note: CoachNote;
  onLongPress: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const cat = getCat(note.category);
  const isLong = note.note_text.length > 120;

  return (
    <Pressable
      style={({ pressed }) => [s.noteCard, note.is_pinned && s.noteCardPinned, pressed && { opacity: 0.75 }]}
      onPress={onToggleExpand}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      {/* Top row */}
      <View style={s.noteTop}>
        <View style={[s.catBadge, { backgroundColor: cat.color + '20', borderColor: cat.color + '50' }]}>
          <Text style={[s.catBadgeText, { color: cat.color }]}>{cat.label}</Text>
        </View>
        <View style={s.noteTopRight}>
          {note.is_pinned && (
            <Ionicons name="pin" size={13} color={Colors.accent} style={{ marginRight: 6 }} />
          )}
          <Text style={s.noteDate}>{fmtDate(note.date)}</Text>
        </View>
      </View>

      {/* Note text */}
      <Text
        style={s.noteText}
        numberOfLines={expanded ? undefined : 3}
      >
        {note.note_text}
      </Text>

      {/* Read more / less */}
      {isLong && (
        <Text style={s.readMore}>{expanded ? 'Read less' : 'Read more'}</Text>
      )}
    </Pressable>
  );
}

// ─── Main Notes Tab ───────────────────────────────────────────────────────────

export function ClientNotesTab({ clientId }: { clientId: string }) {
  const { notes, loading, addNote, updateNote, deleteNote, togglePin } = useNotes(clientId);

  const [showForm, setShowForm] = useState(false);
  const [editNote, setEditNote] = useState<CoachNote | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const openForm = (note: CoachNote | null) => {
    setEditNote(note);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleFormSave = (form: NoteFormState) => {
    setShowForm(false);
    const data: NewNote = {
      client_id: clientId,
      note_text: form.note_text.trim(),
      category: form.category,
      date: form.date,
      is_pinned: form.is_pinned,
    };
    if (editNote) {
      updateNote(editNote.id, data).catch(() =>
        Alert.alert('Error', 'Failed to update note')
      );
    } else {
      addNote(data).catch(() =>
        Alert.alert('Error', 'Failed to save note')
      );
    }
  };

  const handleLongPress = (note: CoachNote) => {
    Alert.alert(fmtDate(note.date), 'What would you like to do?', [
      { text: 'Edit', onPress: () => openForm(note) },
      {
        text: note.is_pinned ? 'Unpin' : 'Pin to top',
        onPress: () => togglePin(note.id, note.is_pinned),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete note?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteNote(note.id) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pinnedNotes = notes.filter((n) => n.is_pinned);
  const regularNotes = notes.filter((n) => !n.is_pinned);

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (!loading && notes.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <Ionicons name="document-text-outline" size={52} color={Colors.border} />
        <Text style={s.emptyTitle}>No Notes Yet</Text>
        <Text style={s.emptySub}>Tap + to add a private note about this client</Text>
        <Pressable style={s.emptyBtn} onPress={() => openForm(null)}>
          <Ionicons name="add" size={18} color={Colors.bg} />
          <Text style={s.emptyBtnText}>ADD FIRST NOTE</Text>
        </Pressable>

        <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
          <Pressable style={s.overlay} onPress={() => setShowForm(false)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <NoteForm key={formKey} note={editNote} onSave={handleFormSave} onCancel={() => setShowForm(false)} />
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Add button */}
      <Pressable style={s.addBtn} onPress={() => openForm(null)}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
        <Text style={s.addBtnText}>ADD NOTE</Text>
      </Pressable>

      {/* Pinned section */}
      {pinnedNotes.length > 0 && (
        <>
          <View style={s.sectionRow}>
            <Ionicons name="pin" size={12} color={Colors.accent} />
            <Text style={s.sectionTitle}>PINNED</Text>
          </View>
          {pinnedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              expanded={expandedIds.has(note.id)}
              onToggleExpand={() => toggleExpand(note.id)}
              onLongPress={() => handleLongPress(note)}
            />
          ))}
        </>
      )}

      {/* All notes section */}
      {regularNotes.length > 0 && (
        <>
          {pinnedNotes.length > 0 && (
            <Text style={[s.sectionTitle, { marginTop: 8 }]}>ALL NOTES</Text>
          )}
          {regularNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              expanded={expandedIds.has(note.id)}
              onToggleExpand={() => toggleExpand(note.id)}
              onLongPress={() => handleLongPress(note)}
            />
          ))}
        </>
      )}

      <Text style={s.tip}>Hold a note to edit, pin, or delete</Text>

      {/* Note form modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <Pressable style={s.overlay} onPress={() => setShowForm(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <NoteForm
              key={formKey}
              note={editNote}
              onSave={handleFormSave}
              onCancel={() => setShowForm(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  emptyBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 13, letterSpacing: 1 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.accent + '60',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: Colors.accent + '10',
  },
  addBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 10 },

  noteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteCardPinned: {
    borderColor: Colors.accent + '40',
    backgroundColor: Colors.accent + '08',
  },
  noteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  noteTopRight: { flexDirection: 'row', alignItems: 'center' },
  catBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  catBadgeText: { fontSize: 11, fontWeight: '700' },
  noteDate: { ...Typography.caption, color: Colors.textSecondary },
  noteText: { ...Typography.body, color: Colors.textPrimary, lineHeight: 22 },
  readMore: { ...Typography.caption, color: Colors.accent, marginTop: 6, fontWeight: '600' },
  tip: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 32,
  },
});

const fm = StyleSheet.create({
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  title: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 20, paddingTop: 12 },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  textArea: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    minHeight: 120,
    marginBottom: 4,
  },
  catRow: { gap: 8, paddingBottom: 4 },
  catBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catBtnText: { fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: Colors.textPrimary,
    fontSize: 15,
    marginBottom: 4,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
    marginBottom: 8,
  },
  pinLabel: { ...Typography.body, color: Colors.textSecondary },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14, letterSpacing: 1.2 },
});
