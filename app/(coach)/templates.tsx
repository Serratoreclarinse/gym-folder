import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
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
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

function TemplateCard({
  template,
  onPress,
  onLongPress,
  colors,
  styles,
}: {
  template: Template;
  onPress: () => void;
  onLongPress: () => void;
  colors: ColorScheme;
  styles: ReturnType<typeof makeStyles>;
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
        <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
        <Text style={styles.lastUsed}>{lastUsed}</Text>
      </View>
    </Pressable>
  );
}

export default function TemplatesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
          <Ionicons name="copy-outline" size={52} color={colors.border} />
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
              colors={colors}
              styles={styles}
              onPress={() =>
                router.push({ pathname: '/(coach)/template-form', params: { templateId: item.id } })
              }
              onLongPress={() => handleLongPress(item)}
            />
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/(coach)/template-form')}>
        <Ionicons name="add" size={28} color={colors.bg} />
      </Pressable>
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1 },
    list: { padding: 20, paddingBottom: 100 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    cardName: { ...Typography.body, color: c.textPrimary, fontWeight: '700', flex: 1 },
    countBadge: {
      backgroundColor: c.accent + '18',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: c.accent + '40',
      marginLeft: 8,
    },
    countBadgeText: { color: c.accent, fontSize: 11, fontWeight: '800' },
    cardPreview: { ...Typography.caption, color: c.textSecondary, marginBottom: 10 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    lastUsed: { ...Typography.caption, color: c.textSecondary },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 8,
    },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
    emptySub: {
      ...Typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: 4,
    },
    emptyBtn: {
      marginTop: 12,
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 13,
    },
    emptyBtnText: { color: c.bg, fontWeight: '800', fontSize: 13, letterSpacing: 1 },
    fab: {
      position: 'absolute',
      bottom: 32,
      right: 24,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 8,
    },
  });
}
