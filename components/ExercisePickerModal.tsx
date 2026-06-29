import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { EXERCISE_LIBRARY, MUSCLE_GROUPS, MuscleGroup } from '@/constants/exerciseLibrary';
import { useCustomExercises } from '@/hooks/useCustomExercises';
import { Colors, Typography } from '@/constants/theme';

// ── Add Custom Exercise form — at module scope (has TextInput) ────────────────

function AddCustomForm({
  initialName,
  onAdd,
  onCancel,
}: {
  initialName: string;
  onAdd: (name: string, muscle: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<MuscleGroup>('Chest');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Enter an exercise name.'); return; }
    setSaving(true);
    await onAdd(name.trim(), muscle);
    setSaving(false);
  };

  return (
    <View style={af.container}>
      <Text style={af.title}>ADD CUSTOM EXERCISE</Text>

      <Text style={af.label}>NAME</Text>
      <TextInput
        style={af.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Cable Pull Through"
        placeholderTextColor={Colors.textSecondary + '80'}
        autoFocus
        returnKeyType="done"
      />

      <Text style={[af.label, { marginTop: 14 }]}>MUSCLE GROUP</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        <View style={af.chipRow}>
          {MUSCLE_GROUPS.map((m) => (
            <Pressable
              key={m}
              style={[af.chip, muscle === m && af.chipActive]}
              onPress={() => setMuscle(m)}
            >
              <Text style={[af.chipText, muscle === m && af.chipTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={af.btnRow}>
        <Pressable style={af.cancelBtn} onPress={onCancel}>
          <Text style={af.cancelBtnText}>CANCEL</Text>
        </Pressable>
        <Pressable
          style={[af.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={af.saveBtnText}>{saving ? 'SAVING…' : 'SAVE'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main picker modal ─────────────────────────────────────────────────────────

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}) {
  const { exercises: customExercises, addExercise } = useCustomExercises();
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'All' | 'Custom'>('All');
  const [showAddForm, setShowAddForm] = useState(false);

  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setSearch('');
      setMuscleFilter('All');
      setShowAddForm(false);
    }
  }, [visible]);

  const filteredResults = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (muscleFilter === 'Custom') {
      return customExercises
        .filter((e) => !q || e.name.toLowerCase().includes(q))
        .map((e) => ({ name: e.name, muscle: e.muscle_group, isCustom: true }));
    }

    const libraryResults = EXERCISE_LIBRARY
      .filter((e) => {
        const matchesMuscle = muscleFilter === 'All' || e.muscle === muscleFilter;
        const matchesSearch = !q || e.name.toLowerCase().includes(q);
        return matchesMuscle && matchesSearch;
      })
      .map((e) => ({ name: e.name, muscle: e.muscle, isCustom: false }));

    const customResults = muscleFilter === 'All'
      ? customExercises
          .filter((e) => !q || e.name.toLowerCase().includes(q))
          .map((e) => ({ name: e.name, muscle: e.muscle_group, isCustom: true }))
      : [];

    return [...customResults, ...libraryResults];
  }, [search, muscleFilter, customExercises]);

  const handleAddCustom = async (name: string, muscle: string) => {
    const { error } = await addExercise(name, muscle);
    if (error) { Alert.alert('Error', error); return; }
    setShowAddForm(false);
    onSelect(name);
    onClose();
  };

  const tabs: Array<'All' | 'Custom' | MuscleGroup> = ['All', 'Custom', ...MUSCLE_GROUPS];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={s.headerTitle}>EXERCISE LIBRARY</Text>
          <Pressable
            style={s.addBtn}
            onPress={() => { setShowAddForm(true); }}
            hitSlop={12}
          >
            <Ionicons name="add" size={20} color={Colors.accent} />
            <Text style={s.addBtnText}>CUSTOM</Text>
          </Pressable>
        </View>

        {showAddForm ? (
          <AddCustomForm
            initialName={search}
            onAdd={handleAddCustom}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <>
            {/* Search */}
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={s.searchIcon} />
              <TextInput
                ref={searchRef}
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search exercises…"
                placeholderTextColor={Colors.textSecondary + '80'}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* Muscle tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.tabScroll}
              contentContainerStyle={s.tabContent}
            >
              {tabs.map((tab) => (
                <Pressable
                  key={tab}
                  style={[s.tab, muscleFilter === tab && s.tabActive]}
                  onPress={() => setMuscleFilter(tab)}
                >
                  <Text style={[s.tabText, muscleFilter === tab && s.tabTextActive]}>{tab}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Exercise list */}
            <FlatList
              data={filteredResults}
              keyExtractor={(item) => `${item.isCustom ? 'c' : 'l'}-${item.name}`}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
              contentContainerStyle={s.listContent}
              ListEmptyComponent={
                <View style={s.emptyContainer}>
                  <Ionicons name="barbell-outline" size={40} color={Colors.border} />
                  <Text style={s.emptyText}>No exercises found</Text>
                  <Pressable
                    style={s.emptyAddBtn}
                    onPress={() => setShowAddForm(true)}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
                    <Text style={s.emptyAddBtnText}>
                      Add "{search || 'custom exercise'}"
                    </Text>
                  </Pressable>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [s.item, pressed && { opacity: 0.6 }]}
                  onPress={() => { onSelect(item.name); onClose(); }}
                >
                  <View style={s.itemLeft}>
                    <Text style={s.itemName}>{item.name}</Text>
                    <View style={s.itemMeta}>
                      {item.isCustom && (
                        <View style={s.customBadge}>
                          <Text style={s.customBadgeText}>CUSTOM</Text>
                        </View>
                      )}
                      <Text style={s.itemMuscle}>{item.muscle}</Text>
                    </View>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
                </Pressable>
              )}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { padding: 4, minWidth: 36 },
  headerTitle: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { color: Colors.accent, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 14, paddingHorizontal: 12,
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { marginRight: 2 },
  searchInput: {
    flex: 1, paddingVertical: 11,
    color: Colors.textPrimary, fontSize: 15,
  },

  tabScroll: { flexGrow: 0 },
  tabContent: { paddingHorizontal: 14, gap: 8, paddingBottom: 10 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: Colors.bg },

  listContent: { paddingHorizontal: 14, paddingBottom: 40 },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  itemLeft: { flex: 1, marginRight: 12 },
  itemName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  itemMuscle: { ...Typography.caption, color: Colors.textSecondary },
  customBadge: {
    backgroundColor: Colors.accent + '20', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  customBadgeText: { color: Colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  emptyContainer: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyText: { ...Typography.body, color: Colors.textSecondary },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.accent + '50',
    backgroundColor: Colors.accent + '10', marginTop: 8,
  },
  emptyAddBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
});

const af = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { ...Typography.label, color: Colors.textPrimary, fontSize: 14, marginBottom: 20 },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: Colors.textPrimary, fontSize: 15,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: Colors.bg },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.accent, alignItems: 'center',
  },
  saveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});
