import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useClients } from '@/hooks/useClients';
import { Colors, Typography } from '@/constants/theme';

const todayISO = () => new Date().toISOString().split('T')[0];

function offsetISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function buildScheduledAt(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const upper = time.toUpperCase().trim();
  let h = 9, m = 0;
  if (upper.includes('AM') || upper.includes('PM')) {
    const [timePart, period] = upper.split(' ');
    const [hh, mm] = timePart.split(':').map(Number);
    h = period === 'PM' && hh !== 12 ? hh + 12 : period === 'AM' && hh === 12 ? 0 : hh;
    m = mm || 0;
  } else {
    const [hh, mm] = upper.split(':').map(Number);
    h = hh || 9; m = mm || 0;
  }
  return new Date(y, mo - 1, d, h, m, 0).toISOString();
}

export default function ScheduleSessionScreen() {
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ date?: string }>();
  const { clients } = useClients();

  const defaultDate = (() => {
    const today = todayISO();
    const d = params.date ?? offsetISO(1);
    return d > today ? d : offsetISO(1);
  })();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [sessionDate, setSessionDate] = useState(defaultDate);
  const [sessionTime, setSessionTime] = useState('9:00 AM');
  const [duration, setDuration] = useState<30 | 45 | 60>(60);
  const [sessionType, setSessionType] = useState<'gym' | 'home'>('gym');
  const [notes, setNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const shiftDate = (delta: number) => {
    const d = new Date(sessionDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const iso = d.toISOString().split('T')[0];
    if (iso > todayISO()) setSessionDate(iso);
  };

  const handleSave = async () => {
    if (!selectedClientId || !profile?.id) {
      Alert.alert('Missing', 'Please select a client.');
      return;
    }
    setSaving(true);

    const { data: pkgData } = await supabase
      .from('packages')
      .select('id')
      .eq('client_id', selectedClientId)
      .eq('coach_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const scheduledAt = buildScheduledAt(sessionDate, sessionTime);

    const { error } = await supabase.from('scheduled_sessions').insert({
      coach_id: profile.id,
      client_id: selectedClientId,
      package_id: pkgData?.id ?? null,
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      session_type: sessionType,
      notes: notes.trim() || null,
    });

    setSaving(false);

    if (error) { Alert.alert('Error', error.message); return; }
    router.back();
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>SCHEDULE SESSION</Text>

      {/* Client */}
      <Text style={styles.label}>CLIENT</Text>
      <Pressable style={styles.select} onPress={() => setPickerOpen((v) => !v)}>
        <Text style={[styles.selectText, !selectedClient && { color: Colors.textSecondary + '80' }]}>
          {selectedClient ? selectedClient.name : 'Select a client…'}
        </Text>
        <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.textSecondary} />
      </Pressable>
      {pickerOpen && (
        <View style={styles.dropdown}>
          <FlatList
            data={clients}
            keyExtractor={(c) => c.id}
            scrollEnabled={false}
            renderItem={({ item: c }) => (
              <Pressable
                style={[styles.dropItem, c.id === selectedClientId && styles.dropItemActive]}
                onPress={() => { setSelectedClientId(c.id); setPickerOpen(false); }}
              >
                <Text style={[styles.dropItemText, c.id === selectedClientId && { color: Colors.accent }]}>
                  {c.name}
                </Text>
                {c.id === selectedClientId && <Ionicons name="checkmark" size={14} color={Colors.accent} />}
              </Pressable>
            )}
          />
        </View>
      )}

      {/* Date */}
      <Text style={styles.label}>DATE</Text>
      <View style={styles.dateRow}>
        <Pressable style={styles.dateArrow} onPress={() => shiftDate(-1)}>
          <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.dateDisplay}>
          {new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })}
        </Text>
        <Pressable style={styles.dateArrow} onPress={() => shiftDate(1)}>
          <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.dateChips}>
        {[{ label: 'Tomorrow', offset: 1 }, { label: 'In 2 days', offset: 2 }, { label: 'In 3 days', offset: 3 }].map(
          ({ label, offset }) => {
            const iso = offsetISO(offset);
            const active = sessionDate === iso;
            return (
              <Pressable
                key={label}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => setSessionDate(iso)}
              >
                <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{label}</Text>
              </Pressable>
            );
          }
        )}
      </View>

      {/* Time */}
      <Text style={styles.label}>TIME</Text>
      <TextInput
        style={styles.input}
        value={sessionTime}
        onChangeText={setSessionTime}
        placeholder="e.g. 9:00 AM"
        placeholderTextColor={Colors.textSecondary + '60'}
        autoCorrect={false}
      />

      {/* Duration */}
      <Text style={styles.label}>DURATION</Text>
      <View style={styles.segRow}>
        {([30, 45, 60] as const).map((d) => (
          <Pressable
            key={d}
            style={[styles.seg, duration === d && styles.segActive]}
            onPress={() => setDuration(d)}
          >
            <Text style={[styles.segText, duration === d && styles.segTextActive]}>{d} min</Text>
          </Pressable>
        ))}
      </View>

      {/* Location */}
      <Text style={styles.label}>LOCATION</Text>
      <View style={styles.segRow}>
        {(['gym', 'home'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.seg, sessionType === t && styles.segActive]}
            onPress={() => setSessionType(t)}
          >
            <Text style={[styles.segText, sessionType === t && styles.segTextActive]}>
              {t === 'gym' ? 'Gym' : 'Home'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Notes */}
      <Text style={styles.label}>NOTES (OPTIONAL)</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. Focus on legs today"
        placeholderTextColor={Colors.textSecondary + '60'}
        multiline
        numberOfLines={3}
        autoCorrect={false}
      />

      <Pressable
        style={[styles.saveBtn, (!selectedClientId || saving) && { opacity: 0.4 }]}
        onPress={handleSave}
        disabled={!selectedClientId || saving}
      >
        <Ionicons name="calendar-outline" size={18} color={Colors.bg} />
        <Text style={styles.saveBtnText}>{saving ? 'Scheduling…' : 'Schedule Session'}</Text>
      </Pressable>
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20 },
  title: {
    ...Typography.label, color: Colors.textPrimary,
    fontWeight: '800', letterSpacing: 1.5, marginBottom: 24,
  },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8, marginTop: 20 },

  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  selectText: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  dropdown: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    marginTop: 4, maxHeight: 220, overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  dropItemActive: { backgroundColor: Colors.accent + '10' },
  dropItemText: { ...Typography.body, color: Colors.textPrimary },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 4,
  },
  dateArrow: { paddingHorizontal: 16, paddingVertical: 10 },
  dateDisplay: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  dateChips: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  dateChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dateChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  dateChipTextActive: { color: Colors.bg },

  input: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },

  segRow: { flexDirection: 'row', gap: 8 },
  seg: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  segActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  segText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  segTextActive: { color: Colors.bg },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, marginTop: 28,
  },
  saveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 16 },
});
