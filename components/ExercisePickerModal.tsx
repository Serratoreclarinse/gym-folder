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
import {
  GYM_MACHINES,
  MACHINE_CATEGORY_ORDER,
  MACHINE_DIFF_COLORS,
  type GymMachine,
} from '@/constants/machineLibrary';
import { useCustomExercises } from '@/hooks/useCustomExercises';
import { Colors, Typography } from '@/constants/theme';

type ViewMode = 'muscle' | 'machine';

// ── Add Custom Exercise form ──────────────────────────────────────────────────

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

// ── Machine accordion card ────────────────────────────────────────────────────

function MachineAccordion({
  machine,
  isOpen,
  onToggle,
  onSelect,
  query,
}: {
  machine: GymMachine;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (name: string) => void;
  query: string;
}) {
  const exercises = query
    ? machine.exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.primary.some((p) => p.toLowerCase().includes(query))
      )
    : machine.exercises;

  if (exercises.length === 0) return null;

  return (
    <View style={ma.card}>
      <Pressable style={ma.header} onPress={onToggle}>
        <View style={ma.iconBox}>
          <Ionicons name={machine.icon as any} size={16} color={Colors.accent} />
        </View>
        <Text style={ma.name}>{machine.name}</Text>
        <Text style={ma.count}>{exercises.length}</Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.textSecondary}
        />
      </Pressable>

      {isOpen && (
        <View style={ma.list}>
          {exercises.map((ex, idx) => (
            <Pressable
              key={ex.name}
              style={({ pressed }) => [
                ma.exRow,
                idx > 0 && { borderTopWidth: 1, borderTopColor: Colors.border },
                pressed && { backgroundColor: Colors.accent + '10' },
              ]}
              onPress={() => onSelect(ex.name)}
            >
              <View style={[ma.dot, { backgroundColor: MACHINE_DIFF_COLORS[ex.difficulty] }]} />
              <View style={{ flex: 1 }}>
                <Text style={ma.exName}>{ex.name}</Text>
                <Text style={ma.exMuscle}>{ex.primary.join(', ')}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
            </Pressable>
          ))}
        </View>
      )}
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
  const [mode, setMode] = useState<ViewMode>('muscle');
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'All' | 'Custom'>('All');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);

  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setSearch('');
      setMuscleFilter('All');
      setShowAddForm(false);
      setExpanded(new Set());
    }
  }, [visible]);

  const query = search.toLowerCase().trim();

  // ── Muscle mode data ──────────────────────────────────────────────────────
  const filteredResults = useMemo(() => {
    if (muscleFilter === 'Custom') {
      return customExercises
        .filter((e) => !query || e.name.toLowerCase().includes(query))
        .map((e) => ({ name: e.name, primary: e.muscle_group, secondary: [] as string[], isCustom: true }));
    }

    const libraryResults = EXERCISE_LIBRARY
      .filter((e) => {
        const matchesMuscle = muscleFilter === 'All' || e.muscle === muscleFilter;
        const matchesSearch = !query || e.name.toLowerCase().includes(query);
        return matchesMuscle && matchesSearch;
      })
      .map((e) => ({ name: e.name, primary: e.primary, secondary: e.secondary, isCustom: false }));

    const customResults = muscleFilter === 'All'
      ? customExercises
          .filter((e) => !query || e.name.toLowerCase().includes(query))
          .map((e) => ({ name: e.name, primary: e.muscle_group, secondary: [] as string[], isCustom: true }))
      : [];

    return [...customResults, ...libraryResults];
  }, [query, muscleFilter, customExercises]);

  // ── Machine mode data ─────────────────────────────────────────────────────
  const machinesByCategory = useMemo(() => {
    return MACHINE_CATEGORY_ORDER.map((cat) => {
      const machines = GYM_MACHINES.filter((m) => m.category === cat).filter((m) => {
        if (!query) return true;
        return m.exercises.some(
          (e) =>
            e.name.toLowerCase().includes(query) ||
            e.primary.some((p) => p.toLowerCase().includes(query)) ||
            m.name.toLowerCase().includes(query)
        );
      });
      return { cat, machines };
    }).filter((g) => g.machines.length > 0);
  }, [query]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelect(name: string) {
    onSelect(name);
    onClose();
  }

  const handleAddCustom = async (name: string, muscle: string) => {
    const { error } = await addExercise(name, muscle);
    if (error) { Alert.alert('Error', error); return; }
    setShowAddForm(false);
    handleSelect(name);
  };

  const muscleTabs: Array<'All' | 'Custom' | MuscleGroup> = ['All', 'Custom', ...MUSCLE_GROUPS];

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
            onPress={() => setShowAddForm(true)}
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

            {/* Mode toggle — By Muscle / By Machine */}
            <View style={s.modeRow}>
              <Pressable
                style={[s.modeBtn, mode === 'muscle' && s.modeBtnActive]}
                onPress={() => setMode('muscle')}
              >
                <Ionicons
                  name="body-outline"
                  size={13}
                  color={mode === 'muscle' ? Colors.bg : Colors.textSecondary}
                />
                <Text style={[s.modeLabel, mode === 'muscle' && s.modeLabelActive]}>By Muscle</Text>
              </Pressable>
              <Pressable
                style={[s.modeBtn, mode === 'machine' && s.modeBtnActive]}
                onPress={() => setMode('machine')}
              >
                <Ionicons
                  name="fitness-outline"
                  size={13}
                  color={mode === 'machine' ? Colors.bg : Colors.textSecondary}
                />
                <Text style={[s.modeLabel, mode === 'machine' && s.modeLabelActive]}>By Machine</Text>
              </Pressable>
            </View>

            {/* ── By Muscle view ── */}
            {mode === 'muscle' && (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.tabScroll}
                  contentContainerStyle={s.tabContent}
                >
                  {muscleTabs.map((tab) => (
                    <Pressable
                      key={tab}
                      style={[s.tab, muscleFilter === tab && s.tabActive]}
                      onPress={() => setMuscleFilter(tab)}
                    >
                      <Text style={[s.tabText, muscleFilter === tab && s.tabTextActive]}>{tab}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

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
                      <Pressable style={s.emptyAddBtn} onPress={() => setShowAddForm(true)}>
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
                      onPress={() => handleSelect(item.name)}
                    >
                      <View style={s.itemLeft}>
                        <Text style={s.itemName}>{item.name}</Text>
                        <View style={s.itemMeta}>
                          {item.isCustom && (
                            <View style={s.customBadge}>
                              <Text style={s.customBadgeText}>CUSTOM</Text>
                            </View>
                          )}
                          <Text style={s.itemPrimary}>{item.primary}</Text>
                        </View>
                        {item.secondary.length > 0 && (
                          <Text style={s.itemSecondary}>+{item.secondary.join(' · ')}</Text>
                        )}
                      </View>
                      <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
                    </Pressable>
                  )}
                />
              </>
            )}

            {/* ── By Machine view ── */}
            {mode === 'machine' && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={s.machineContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {machinesByCategory.length === 0 ? (
                  <View style={s.emptyContainer}>
                    <Ionicons name="search-outline" size={40} color={Colors.border} />
                    <Text style={s.emptyText}>No results found</Text>
                  </View>
                ) : (
                  machinesByCategory.map(({ cat, machines }) => (
                    <View key={cat} style={s.machineSection}>
                      <Text style={s.machineCatLabel}>{cat.toUpperCase()}</Text>
                      {machines.map((machine) => (
                        <MachineAccordion
                          key={machine.id}
                          machine={machine}
                          isOpen={expanded.has(machine.id)}
                          onToggle={() => toggleExpand(machine.id)}
                          onSelect={handleSelect}
                          query={query}
                        />
                      ))}
                    </View>
                  ))
                )}

                {/* Difficulty legend */}
                <View style={s.legend}>
                  {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
                    <View key={d} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: MACHINE_DIFF_COLORS[d] }]} />
                      <Text style={s.legendLabel}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
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

  modeRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 14, marginBottom: 12,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  modeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  modeLabel: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  modeLabelActive: { color: Colors.bg },

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
  itemPrimary: { ...Typography.caption, color: Colors.accent, fontWeight: '700' },
  itemSecondary: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1, fontSize: 11 },
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

  machineContent: { paddingHorizontal: 14, paddingBottom: 40 },
  machineSection: { marginBottom: 18 },
  machineCatLabel: {
    ...Typography.caption, color: Colors.textSecondary,
    fontWeight: '700', letterSpacing: 1.2,
    marginBottom: 8,
  },

  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 20,
    paddingVertical: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...Typography.caption, color: Colors.textSecondary },
});

const ma = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  iconBox: {
    width: 30, height: 30, borderRadius: 7,
    backgroundColor: Colors.accent + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  name: { flex: 1, ...Typography.body, color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  count: { ...Typography.caption, color: Colors.accent, fontWeight: '700', marginRight: 4 },
  list: { paddingHorizontal: 12, paddingBottom: 6 },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingRight: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 2, flexShrink: 0 },
  exName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  exMuscle: { ...Typography.caption, color: Colors.accent, marginTop: 1 },
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
