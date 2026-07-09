import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAvailability } from '@/hooks/useAvailability';
import { useSessions } from '@/hooks/useSessions';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

// Defined outside parent to prevent TextInput keyboard flicker
function BlockForm({
  startDate, endDate, reason,
  onChangeStart, onChangeEnd, onChangeReason,
  onSave, onCancel, colors, styles,
}: {
  startDate: string; endDate: string; reason: string;
  onChangeStart: (v: string) => void;
  onChangeEnd:   (v: string) => void;
  onChangeReason:(v: string) => void;
  onSave:   () => void;
  onCancel: () => void;
  colors: ColorScheme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.fsWrap}>
      <Text style={styles.fsLbl}>START DATE</Text>
      <TextInput
        style={styles.fsInput}
        value={startDate}
        onChangeText={onChangeStart}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        autoFocus
      />
      <Text style={styles.fsLbl}>END DATE</Text>
      <TextInput
        style={styles.fsInput}
        value={endDate}
        onChangeText={onChangeEnd}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Text style={styles.fsLbl}>REASON (optional)</Text>
      <TextInput
        style={[styles.fsInput, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
        value={reason}
        onChangeText={onChangeReason}
        placeholder="e.g. Vacation, Holiday, Sick day…"
        placeholderTextColor={colors.textSecondary}
        multiline
        autoCapitalize="sentences"
      />
      <View style={styles.fsBtns}>
        <Pressable style={styles.fsCancelBtn} onPress={onCancel}>
          <Text style={styles.fsCancelTxt}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.fsSaveBtn} onPress={onSave}>
          <Text style={styles.fsSaveTxt}>Block Dates</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Defined outside parent to prevent TextInput keyboard flicker
function TimeBlockForm({
  date, startTime, endTime, notes,
  onChangeDate, onChangeStart, onChangeEnd, onChangeNotes,
  onSave, onCancel, colors, styles,
}: {
  date: string; startTime: string; endTime: string; notes: string;
  onChangeDate:  (v: string) => void;
  onChangeStart: (v: string) => void;
  onChangeEnd:   (v: string) => void;
  onChangeNotes: (v: string) => void;
  onSave:   () => void;
  onCancel: () => void;
  colors: ColorScheme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.fsWrap}>
      <Text style={styles.fsLbl}>DATE</Text>
      <TextInput
        style={styles.fsInput}
        value={date}
        onChangeText={onChangeDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        autoFocus
      />
      <Text style={styles.fsLbl}>START TIME</Text>
      <TextInput
        style={styles.fsInput}
        value={startTime}
        onChangeText={onChangeStart}
        placeholder="HH:MM (e.g. 09:00)"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
      <Text style={styles.fsLbl}>END TIME</Text>
      <TextInput
        style={styles.fsInput}
        value={endTime}
        onChangeText={onChangeEnd}
        placeholder="HH:MM (e.g. 12:00)"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
      <Text style={styles.fsLbl}>NOTES (optional)</Text>
      <TextInput
        style={[styles.fsInput, { height: 60, textAlignVertical: 'top', paddingTop: 10 }]}
        value={notes}
        onChangeText={onChangeNotes}
        placeholder="e.g. Busy with another commitment…"
        placeholderTextColor={colors.textSecondary}
        multiline
        autoCapitalize="sentences"
      />
      <View style={styles.fsBtns}>
        <Pressable style={styles.fsCancelBtn} onPress={onCancel}>
          <Text style={styles.fsCancelTxt}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.fsSaveBtn} onPress={onSave}>
          <Text style={styles.fsSaveTxt}>Block Hours</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type TimeBlock = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function formatRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12    = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function BlockedDatesScreen() {
  const { colors }  = useTheme();
  const styles      = useMemo(() => makeStyles(colors), [colors]);
  const { profile } = useAuth();
  const { blockedDates, loading, refetch, addBlockedDate, removeBlockedDate } = useAvailability();
  const { sessions } = useSessions();

  // ── Date-range block form state ──────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey]   = useState(0);
  const [startDate, setStart]   = useState('');
  const [endDate,   setEnd]     = useState('');
  const [reason,    setReason]  = useState('');

  // ── Hourly time block state ───────────────────────────────────────────────
  const [timeBlocks,    setTimeBlocks]    = useState<TimeBlock[]>([]);
  const [tbLoading,     setTbLoading]     = useState(false);
  const [showTimeForm,  setShowTimeForm]  = useState(false);
  const [tfKey,         setTfKey]         = useState(0);
  const [tfDate,        setTfDate]        = useState('');
  const [tfStart,       setTfStart]       = useState('');
  const [tfEnd,         setTfEnd]         = useState('');
  const [tfNotes,       setTfNotes]       = useState('');

  const fetchTimeBlocks = useCallback(async () => {
    if (!profile?.id) return;
    setTbLoading(true);
    const { data } = await supabase
      .from('coach_blocked_dates')
      .select('id, date, start_time, end_time, notes')
      .eq('coach_id', profile.id)
      .not('start_time', 'is', null)
      .order('date')
      .order('start_time');
    setTimeBlocks((data ?? []) as TimeBlock[]);
    setTbLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchTimeBlocks(); }, [fetchTimeBlocks]);

  const openForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setStart(today);
    setEnd(today);
    setReason('');
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format (e.g. 2025-12-25).');
      return;
    }
    if (startDate > endDate) {
      Alert.alert('Invalid range', 'Start date must be on or before end date.');
      return;
    }

    const sessionsInRange = sessions.filter(
      (s) => s.session_date >= startDate && s.session_date <= endDate,
    );

    const doBlock = async () => {
      setShowForm(false);
      await addBlockedDate(startDate, endDate, reason);
    };

    if (sessionsInRange.length > 0) {
      Alert.alert(
        'Sessions exist in this range',
        `You have ${sessionsInRange.length} session${sessionsInRange.length !== 1 ? 's' : ''} during these dates. Block anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block Anyway', style: 'destructive', onPress: doBlock },
        ],
      );
    } else {
      await doBlock();
    }
  };

  const handleRemove = (id: string, label: string) => {
    Alert.alert('Remove Block', `Remove the block for ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeBlockedDate(id) },
    ]);
  };

  const openTimeForm = () => {
    setTfDate(new Date().toISOString().split('T')[0]);
    setTfStart('');
    setTfEnd('');
    setTfNotes('');
    setTfKey((k) => k + 1);
    setShowTimeForm(true);
  };

  const handleSaveTimeBlock = async () => {
    if (!DATE_RE.test(tfDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format (e.g. 2025-12-25).');
      return;
    }
    if (!TIME_RE.test(tfStart) || !TIME_RE.test(tfEnd)) {
      Alert.alert('Invalid time', 'Use HH:MM format (e.g. 09:00, 14:30).');
      return;
    }
    if (tfStart >= tfEnd) {
      Alert.alert('Invalid range', 'Start time must be before end time.');
      return;
    }
    await supabase.from('coach_blocked_dates').insert({
      coach_id:   profile!.id,
      date:       tfDate,
      type:       'leave',
      notes:      tfNotes.trim() || null,
      created_by: profile!.id,
      start_time: tfStart,
      end_time:   tfEnd,
    });
    setShowTimeForm(false);
    fetchTimeBlocks();
  };

  const handleRemoveTimeBlock = (id: string, label: string) => {
    Alert.alert('Remove Block', `Remove the hour block for ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('coach_blocked_dates').delete().eq('id', id);
          setTimeBlocks((prev) => prev.filter((x) => x.id !== id));
        },
      },
    ]);
  };

  const todayISO = new Date().toISOString().split('T')[0];

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading || tbLoading}
            onRefresh={() => { refetch(); fetchTimeBlocks(); }}
            tintColor={colors.accent}
          />
        }
      >
        {/* Full empty state when both sections have nothing */}
        {blockedDates.length === 0 && timeBlocks.length === 0 && !loading && !tbLoading && (
          <View style={styles.empty}>
            <Ionicons name="ban-outline" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No blocks set</Text>
            <Text style={styles.emptySub}>
              Use the calendar+ button to block full days, or the clock+ button to block specific hours
            </Text>
          </View>
        )}

        {/* ── DATE RANGE BLOCKS ─────────────────────────────── */}
        {blockedDates.length > 0 && (
          <>
            <Text style={styles.sectionHead}>FULL-DAY BLOCKS</Text>
            {blockedDates.map((bd) => {
              const isPast = bd.end_date < todayISO;
              const label  = formatRange(bd.start_date, bd.end_date);
              return (
                <View
                  key={bd.id}
                  style={[styles.card, isPast ? styles.cardPast : styles.cardActive]}
                >
                  <View style={[styles.cardIcon, { backgroundColor: (isPast ? colors.textSecondary : colors.danger) + '15' }]}>
                    <Ionicons name="ban-outline" size={18} color={isPast ? colors.textSecondary : colors.danger} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardLabel, isPast && { color: colors.textSecondary }]}>{label}</Text>
                    {bd.reason ? <Text style={styles.cardReason}>{bd.reason}</Text> : null}
                    {isPast && <Text style={styles.pastTag}>PAST</Text>}
                  </View>
                  <Pressable onPress={() => handleRemove(bd.id, label)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {/* ── HOURLY TIME BLOCKS ────────────────────────────── */}
        {timeBlocks.length > 0 && (
          <>
            <Text style={[styles.sectionHead, { marginTop: blockedDates.length > 0 ? 24 : 0 }]}>
              BLOCKED HOURS
            </Text>
            {timeBlocks.map((tb) => {
              const isPast     = tb.date < todayISO;
              const dateLabel  = formatDate(tb.date);
              const timeLabel  = `${formatTime(tb.start_time)} – ${formatTime(tb.end_time)}`;
              return (
                <View
                  key={tb.id}
                  style={[styles.card, isPast ? styles.cardPast : styles.cardTimeActive]}
                >
                  <View style={[styles.cardIcon, { backgroundColor: (isPast ? colors.textSecondary : colors.accent) + '15' }]}>
                    <Ionicons name="time-outline" size={18} color={isPast ? colors.textSecondary : colors.accent} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardLabel, isPast && { color: colors.textSecondary }]}>{dateLabel}</Text>
                    <Text style={styles.cardReason}>{timeLabel}</Text>
                    {tb.notes ? <Text style={styles.cardReason}>{tb.notes}</Text> : null}
                    {isPast && <Text style={styles.pastTag}>PAST</Text>}
                  </View>
                  <Pressable onPress={() => handleRemoveTimeBlock(tb.id, `${dateLabel} (${timeLabel})`)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* FAB: block specific hours */}
      <Pressable style={[styles.fab, styles.fabSecond]} onPress={openTimeForm}>
        <Ionicons name="time-outline" size={22} color={colors.bg} />
      </Pressable>

      {/* FAB: block full days */}
      <Pressable style={styles.fab} onPress={openForm}>
        <Ionicons name="calendar-outline" size={22} color={colors.bg} />
      </Pressable>

      {/* Modal: full-day date range block */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Block Full Days</Text>
            <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <BlockForm
            key={formKey}
            startDate={startDate} endDate={endDate} reason={reason}
            onChangeStart={setStart} onChangeEnd={setEnd} onChangeReason={setReason}
            onSave={handleSave} onCancel={() => setShowForm(false)}
            colors={colors} styles={styles}
          />
        </View>
      </Modal>

      {/* Modal: hourly time block */}
      <Modal visible={showTimeForm} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Block Specific Hours</Text>
            <Pressable onPress={() => setShowTimeForm(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <TimeBlockForm
            key={tfKey}
            date={tfDate} startTime={tfStart} endTime={tfEnd} notes={tfNotes}
            onChangeDate={setTfDate} onChangeStart={setTfStart} onChangeEnd={setTfEnd} onChangeNotes={setTfNotes}
            onSave={handleSaveTimeBlock} onCancel={() => setShowTimeForm(false)}
            colors={colors} styles={styles}
          />
        </View>
      </Modal>
    </>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    // BlockForm styles
    fsWrap:      { padding: 20, paddingBottom: 40 },
    fsLbl:       { ...Typography.label, color: c.textSecondary, marginBottom: 6, marginTop: 14 },
    fsInput:     { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: c.textPrimary, fontSize: 15 },
    fsBtns:      { flexDirection: 'row', gap: 10, marginTop: 24 },
    fsCancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 13, alignItems: 'center' },
    fsCancelTxt: { color: c.textSecondary, fontWeight: '700', fontSize: 14 },
    fsSaveBtn:   { flex: 1, borderRadius: 12, backgroundColor: c.accent, paddingVertical: 13, alignItems: 'center' },
    fsSaveTxt:   { color: c.bg, fontWeight: '800', fontSize: 14 },

    // Screen styles
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 100 },

    empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 12 },
    emptySub:   { ...Typography.body, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 20 },

    sectionHead: { ...Typography.label, color: c.textSecondary, fontWeight: '700', letterSpacing: 1, marginBottom: 10, fontSize: 11 },

    card:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1 },
    cardActive:     { borderColor: c.danger + '30' },
    cardTimeActive: { borderColor: c.accent + '30' },
    cardPast:       { borderColor: c.border, opacity: 0.55 },
    cardIcon:   { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    cardInfo:   { flex: 1 },
    cardLabel:  { ...Typography.body, color: c.textPrimary, fontWeight: '600', marginBottom: 2 },
    cardReason: { ...Typography.caption, color: c.textSecondary },
    pastTag:    { ...Typography.label, fontSize: 9, color: c.textSecondary, marginTop: 3 },

    fab: {
      position: 'absolute', bottom: 32, right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center',
      shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    },
    fabSecond: { bottom: 100 },
    modalHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    modalTitle: { ...Typography.subtitle, color: c.textPrimary },
  });
}
