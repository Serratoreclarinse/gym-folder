import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { Typography, type ColorScheme } from '@/constants/theme';
import {
  GYM_MACHINES,
  MACHINE_CATEGORY_ORDER,
  MACHINE_DIFF_COLORS,
  type GymMachine,
  type MachineDifficulty,
} from '@/constants/machineLibrary';
import { EXERCISE_LIBRARY, MUSCLE_GROUPS, type MuscleGroup } from '@/constants/exerciseLibrary';

type Tab = 'machine' | 'muscle';

export default function ExerciseLibraryScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>('machine');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const query = search.trim().toLowerCase();

  const machinesByCategory = useMemo(() => {
    return MACHINE_CATEGORY_ORDER.map((cat) => {
      const machines = GYM_MACHINES.filter((m) => m.category === cat).map((m) => {
        const exercises = query
          ? m.exercises.filter(
              (e) =>
                e.name.toLowerCase().includes(query) ||
                e.primary.some((p) => p.toLowerCase().includes(query)) ||
                e.secondary.some((sec) => sec.toLowerCase().includes(query))
            )
          : m.exercises;
        return { ...m, exercises };
      }).filter((m) => m.exercises.length > 0);
      return { cat, machines };
    }).filter((g) => g.machines.length > 0);
  }, [query]);

  const muscleGroups = useMemo(() => {
    return MUSCLE_GROUPS.map((mg) => {
      const exercises = EXERCISE_LIBRARY.filter(
        (e) =>
          e.muscle === mg &&
          (query
            ? e.name.toLowerCase().includes(query) ||
              e.primary.toLowerCase().includes(query) ||
              e.secondary.some((s) => s.toLowerCase().includes(query))
            : true)
      );
      return { mg, exercises };
    }).filter((g) => g.exercises.length > 0);
  }, [query]);

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <View style={s.root}>
      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.textSecondary} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search exercises, muscles…"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Tab toggle */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tabBtn, tab === 'machine' && s.tabBtnActive]}
          onPress={() => setTab('machine')}
        >
          <Ionicons
            name="fitness-outline"
            size={15}
            color={tab === 'machine' ? colors.bg : colors.textSecondary}
          />
          <Text style={[s.tabLabel, tab === 'machine' && s.tabLabelActive]}>By Machine</Text>
        </Pressable>
        <Pressable
          style={[s.tabBtn, tab === 'muscle' && s.tabBtnActive]}
          onPress={() => setTab('muscle')}
        >
          <Ionicons
            name="body-outline"
            size={15}
            color={tab === 'muscle' ? colors.bg : colors.textSecondary}
          />
          <Text style={[s.tabLabel, tab === 'muscle' && s.tabLabelActive]}>By Muscle</Text>
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {tab === 'machine' ? (
          <>
            {machinesByCategory.length === 0 ? (
              <EmptyState colors={colors} s={s} />
            ) : (
              machinesByCategory.map(({ cat, machines }) => (
                <View key={cat} style={s.section}>
                  <Text style={s.sectionLabel}>{cat.toUpperCase()}</Text>
                  {machines.map((machine) => (
                    <MachineCard
                      key={machine.id}
                      machine={machine}
                      isOpen={expanded.has(machine.id)}
                      onToggle={() => toggleExpand(machine.id)}
                      colors={colors}
                      s={s}
                    />
                  ))}
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {muscleGroups.length === 0 ? (
              <EmptyState colors={colors} s={s} />
            ) : (
              muscleGroups.map(({ mg, exercises }) => (
                <View key={mg} style={s.section}>
                  <Text style={s.sectionLabel}>{mg.toUpperCase()}</Text>
                  <View style={s.card}>
                    {exercises.map((ex, idx) => (
                      <View key={ex.name} style={[s.muscleRow, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                        <Text style={s.muscleName}>{ex.name}</Text>
                        <Text style={s.musclePrimary}>{ex.primary}</Text>
                        {ex.secondary.length > 0 && (
                          <Text style={s.muscleSecondary}>+{ex.secondary.join(', ')}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Legend */}
        <View style={s.legend}>
          {(['beginner', 'intermediate', 'advanced'] as MachineDifficulty[]).map((d) => (
            <View key={d} style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: MACHINE_DIFF_COLORS[d] }]} />
              <Text style={s.legendLabel}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyState({ colors, s }: { colors: any; s: any }) {
  return (
    <View style={s.empty}>
      <Ionicons name="search-outline" size={40} color={colors.border} />
      <Text style={s.emptyText}>No results found</Text>
    </View>
  );
}

function MachineCard({
  machine,
  isOpen,
  onToggle,
  colors,
  s,
}: {
  machine: GymMachine;
  isOpen: boolean;
  onToggle: () => void;
  colors: any;
  s: any;
}) {
  return (
    <View style={s.card}>
      <Pressable style={s.machineHeader} onPress={onToggle}>
        <View style={s.machineIconBox}>
          <Ionicons name={machine.icon as any} size={18} color={colors.accent} />
        </View>
        <Text style={s.machineName}>{machine.name}</Text>
        <Text style={s.machineCount}>{machine.exercises.length}</Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {isOpen && (
        <View style={s.exerciseList}>
          {machine.exercises.map((ex, idx) => (
            <View
              key={ex.name}
              style={[s.exerciseRow, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <View style={s.exerciseLeft}>
                <View style={[s.dot, { backgroundColor: MACHINE_DIFF_COLORS[ex.difficulty] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.exerciseName}>{ex.name}</Text>
                  <Text style={s.exercisePrimary}>{ex.primary.join(', ')}</Text>
                  {ex.secondary.length > 0 && (
                    <Text style={s.exerciseSecondary}>+{ex.secondary.join(', ')}</Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, marginHorizontal: 16, marginTop: 12, marginBottom: 8,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: c.textPrimary, fontSize: 14 },

    tabRow: {
      flexDirection: 'row', gap: 8,
      marginHorizontal: 16, marginBottom: 12,
    },
    tabBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, borderRadius: 10,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    tabBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
    tabLabel: { ...Typography.body, color: c.textSecondary, fontWeight: '600' },
    tabLabelActive: { color: c.bg },

    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingBottom: 40 },

    section: { marginBottom: 20 },
    sectionLabel: {
      ...Typography.caption, color: c.textSecondary,
      fontWeight: '700', letterSpacing: 1.2,
      marginBottom: 8,
    },

    card: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      overflow: 'hidden', marginBottom: 8,
    },
    machineHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 13,
    },
    machineIconBox: {
      width: 34, height: 34, borderRadius: 8,
      backgroundColor: c.accent + '18',
      justifyContent: 'center', alignItems: 'center',
    },
    machineName: { flex: 1, ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    machineCount: {
      ...Typography.caption, color: c.accent,
      fontWeight: '700', marginRight: 4,
    },

    exerciseList: { paddingHorizontal: 14, paddingBottom: 8 },
    exerciseRow: { paddingVertical: 10 },
    exerciseLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    exerciseName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 1 },
    exercisePrimary: { ...Typography.caption, color: c.accent },
    exerciseSecondary: { ...Typography.caption, color: c.textSecondary, marginTop: 1 },

    dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },

    muscleRow: { paddingVertical: 10 },
    muscleName: { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 1 },
    musclePrimary: { ...Typography.caption, color: c.accent },
    muscleSecondary: { ...Typography.caption, color: c.textSecondary, marginTop: 1 },

    legend: {
      flexDirection: 'row', justifyContent: 'center', gap: 20,
      paddingVertical: 16,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendLabel: { ...Typography.caption, color: c.textSecondary },

    empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
    emptyText: { ...Typography.body, color: c.textSecondary },
  });
}
