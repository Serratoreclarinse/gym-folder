import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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

const TIME_SLOTS = [
  '5:00 AM', '5:30 AM', '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM',
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM',
] as const;
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useClients } from '@/hooks/useClients';
import { sendPushNotification } from '@/lib/pushNotifications';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const [timePickerOpen, setTimePickerOpen] = useState(false);
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
    const timeUpper = sessionTime.toUpperCase().trim();
    const validTime = /^(1[0-2]|[1-9]):[0-5][0-9]\s*(AM|PM)$/.test(timeUpper) ||
      /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeUpper);
    if (!validTime) {
      Alert.alert('Invalid time', 'Enter a valid time, e.g. 9:00 AM or 14:30');
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

    const { data: sessionData, error } = await supabase.from('scheduled_sessions').insert({
      coach_id: profile.id,
      client_id: selectedClientId,
      package_id: pkgData?.id ?? null,
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      session_type: sessionType,
      notes: notes.trim() || null,
    }).select('id').single();

    setSaving(false);

    if (error) { Alert.alert('Error', error.message); return; }

    const formattedDate = new Date(scheduledAt).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    const formattedTime = new Date(scheduledAt).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });

    await Promise.all([
      sendPushNotification(selectedClientId, {
        title: '📅 Session Scheduled',
        body: `Your coach scheduled a session on ${formattedDate} at ${formattedTime} (${duration} min${sessionType === 'home' ? ' · Home' : ''}).`,
      }),
      supabase.from('messages').insert({
        sender_id: profile.id,
        receiver_id: selectedClientId,
        content: `Session scheduled for ${formattedDate} at ${formattedTime} (${duration} min${sessionType === 'home' ? ' · Home' : ''})`,
        attachment_type: 'session_invite',
        metadata: {
          session_id: sessionData?.id ?? null,
          scheduled_at: scheduledAt,
          duration_minutes: duration,
          session_type: sessionType,
        },
      }),
    ]);

    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.closeRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>SCHEDULE SESSION</Text>

      {/* Client */}
      <Text style={styles.label}>CLIENT</Text>
      <Pressable style={styles.select} onPress={() => setPickerOpen((v) => !v)}>
        <Text style={[styles.selectText, !selectedClient && { color: colors.textSecondary + '80' }]}>
          {selectedClient ? selectedClient.name : 'Select a client…'}
        </Text>
        <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textSecondary} />
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
                <Text style={[styles.dropItemText, c.id === selectedClientId && { color: colors.accent }]}>
                  {c.name}
                </Text>
                {c.id === selectedClientId && <Ionicons name="checkmark" size={14} color={colors.accent} />}
              </Pressable>
            )}
          />
        </View>
      )}

      {/* Date */}
      <Text style={styles.label}>DATE</Text>
      <View style={styles.dateRow}>
        <Pressable style={styles.dateArrow} onPress={() => shiftDate(-1)}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.dateDisplay}>
          {new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })}
        </Text>
        <Pressable style={styles.dateArrow} onPress={() => shiftDate(1)}>
          <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
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
      <Pressable style={styles.select} onPress={() => setTimePickerOpen((v) => !v)}>
        <Text style={styles.selectText}>{sessionTime || '9:00 AM'}</Text>
        <Ionicons name={timePickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textSecondary} />
      </Pressable>
      {timePickerOpen && (
        <View style={[styles.dropdown, { maxHeight: 200 }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {TIME_SLOTS.map((slot) => {
              const active = sessionTime.trim().toUpperCase() === slot.toUpperCase();
              return (
                <Pressable
                  key={slot}
                  style={[styles.dropItem, active && styles.dropItemActive]}
                  onPress={() => { setSessionTime(slot); setTimePickerOpen(false); }}
                >
                  <Text style={[styles.dropItemText, active && { color: colors.accent }]}>{slot}</Text>
                  {active && <Ionicons name="checkmark" size={14} color={colors.accent} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
      <TextInput
        style={[styles.input, { marginTop: 6 }]}
        value={sessionTime}
        onChangeText={(v) => { setSessionTime(v); setTimePickerOpen(false); }}
        placeholder="or type: 9:00 AM / 14:30"
        placeholderTextColor={colors.textSecondary + '60'}
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
        placeholderTextColor={colors.textSecondary + '60'}
        multiline
        numberOfLines={3}
        autoCorrect={false}
      />

      <Pressable
        style={[styles.saveBtn, (!selectedClientId || saving) && { opacity: 0.4 }]}
        onPress={handleSave}
        disabled={!selectedClientId || saving}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.bg} />
        <Text style={styles.saveBtnText}>{saving ? 'Scheduling…' : 'Schedule Session'}</Text>
      </Pressable>
      <View style={{ height: 48 }} />
    </ScrollView>
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    closeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20 },
    title: {
      ...Typography.label, color: c.textPrimary,
      fontWeight: '800', letterSpacing: 1.5, marginBottom: 24,
    },
    label: { ...Typography.label, color: c.textSecondary, marginBottom: 8, marginTop: 20 },

    select: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 14, paddingVertical: 13,
    },
    selectText: { ...Typography.body, color: c.textPrimary, flex: 1 },
    dropdown: {
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border,
      marginTop: 4, maxHeight: 220, overflow: 'hidden',
    },
    dropItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 13,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    dropItemActive: { backgroundColor: c.accent + '10' },
    dropItemText: { ...Typography.body, color: c.textPrimary },

    dateRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border,
      paddingVertical: 4,
    },
    dateArrow: { paddingHorizontal: 16, paddingVertical: 10 },
    dateDisplay: { ...Typography.body, color: c.textPrimary, fontWeight: '600' },
    dateChips: { flexDirection: 'row', gap: 8, marginTop: 8 },
    dateChip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    dateChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    dateChipText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    dateChipTextActive: { color: c.bg },

    input: {
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 14, paddingVertical: 13, color: c.textPrimary, fontSize: 15,
    },
    inputMulti: { height: 80, textAlignVertical: 'top' },

    segRow: { flexDirection: 'row', gap: 8 },
    seg: {
      flex: 1, paddingVertical: 10, borderRadius: 10,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center',
    },
    segActive: { backgroundColor: c.accent, borderColor: c.accent },
    segText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
    segTextActive: { color: c.bg },

    saveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 15, marginTop: 28,
    },
    saveBtnText: { color: c.bg, fontWeight: '800', fontSize: 16 },
  });
}
