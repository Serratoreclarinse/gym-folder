import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTemplates, Template } from '@/hooks/useTemplates';
import { Colors, Typography } from '@/constants/theme';

function TemplateCard({
  template,
  onPress,
  onLongPress,
}: {
  template: Template;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const exCount = template.exercises.length;
  const lastUsed = template.last_used_at
    ? new Date(template.last_used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Never used';
  const preview = template.exercises
    .slice(0, 3)
    .map((e) => e.exercise_name)
    .join(', ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{template.name}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{exCount} ex</Text>
        </View>
      </View>
      <Text style={styles.cardPreview} numberOfLines={1}>
        {preview ? (exCount > 3 ? `${preview}…` : preview) : 'No exercises yet'}
      </Text>
      <View style={styles.cardFooter}>
        <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
        <Text style={styles.lastUsed}>{lastUsed}</Text>
      </View>
    </Pressable>
  );
}

export default function TemplatesScreen() {
  const { templates, loading, refetch, deleteTemplate, duplicateTemplate } = useTemplates();

  useFocusEffect(useCallback(() => { refetch(); }, []));

  const handleLongPress = (tpl: Template) => {
    Alert.alert(tpl.name, 'What would you like to do?', [
      {
        text: 'Edit',
        onPress: () =>
          router.push({ pathname: '/(coach)/template-form', params: { templateId: tpl.id } }),
      },
      {
        text: 'Duplicate',
        onPress: () => duplicateTemplate(tpl),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete Template', `Delete "${tpl.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteTemplate(tpl.id) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      {!loading && templates.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="copy-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No Templates Yet</Text>
          <Text style={styles.emptySub}>
            Save common workout routines to quickly fill sessions
          </Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => router.push('/(coach)/template-form')}
          >
            <Text style={styles.emptyBtnText}>CREATE FIRST TEMPLATE</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TemplateCard
              template={item}
              onPress={() =>
                router.push({ pathname: '/(coach)/template-form', params: { templateId: item.id } })
              }
              onLongPress={() => handleLongPress(item)}
            />
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/(coach)/template-form')}>
        <Ionicons name="add" size={28} color={Colors.bg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: 20, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', flex: 1 },
  countBadge: {
    backgroundColor: Colors.accent + '18',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    marginLeft: 8,
  },
  countBadgeText: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
  cardPreview: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastUsed: { ...Typography.caption, color: Colors.textSecondary },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary, marginTop: 12 },
  emptySub: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  emptyBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
