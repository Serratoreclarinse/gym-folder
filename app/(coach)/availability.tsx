import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAvailability, type DayAvailability, type AvailabilityBreak } from '@/hooks/useAvailability';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Every 30 min from 5:00 AM to 11:00 PM
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts: { value: string; label: string }[] = [];
  for (let h = 5; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue;
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      opts.push({ value, label: `${hour}:${String(m).padStart(2, '0')} ${ampm}` });
    }
  }
  return opts;
})();

function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Weekly availability grid ─────────────────────────────────────────────────
const GRID_H = 120;
const G_START = 5;  // 5 AM
const G_SPAN  = 18; // 5 AM → 11 PM

function timeToY(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return ((h + m / 60 - G_START) / G_SPAN) * GRID_H;
}

type BookedSlot = { start: string; end: string };

function WeeklyGrid({ days, bookedSlots }: { days: DayAvailability[]; bookedSlots: Record<number, BookedSlot[]> }) {
  const { colors } = useTheme();
  const gridSt = useMemo(() => makeGridSt(colors), [colors]);
  const COL_W = 34;
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        {/* Hour labels */}
        <View style={{ width: 28, height: GRID_H, position: 'relative' }}>
          {[5, 9, 13, 17, 21].map((h) => (
            <Text
              key={h}
              style={[gridSt.hourLbl, { top: ((h - G_START) / G_SPAN) * GRID_H - 5 }]}
            >
              {h >= 12 ? `${h === 12 ? 12 : h - 12}p` : `${h}a`}
            </Text>
          ))}
        </View>
        {/* Day columns */}
        {days.map((day) => {
          const active = day.is_active;
          const topY    = active ? Math.max(0, timeToY(day.start_time)) : 0;
          const bottomY = active ? Math.min(GRID_H, timeToY(day.end_time)) : 0;
          const barH    = Math.max(0, bottomY - topY);
          const booked  = bookedSlots[day.day_of_week] ?? [];

          return (
            <View key={day.day_of_week} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{
                width: COL_W, height: GRID_H,
                backgroundColor: colors.surface,
                borderRadius: 6, borderWidth: 1, borderColor: colors.border,
                overflow: 'hidden',
              }}>
                {active && barH > 0 && (
                  <View style={{
                    position: 'absolute', top: topY, height: barH, left: 2, right: 2,
                    backgroundColor: colors.success + '40',
                    borderRadius: 4, borderWidth: 1, borderColor: colors.success + '70',
                  }} />
                )}
                {booked.map((slot, i) => {
                  const sTop = Math.max(0, timeToY(slot.start));
                  const sH   = Math.max(4, Math.min(GRID_H - sTop, timeToY(slot.end) - sTop));
                  return (
                    <View key={i} style={{
                      position: 'absolute', top: sTop, height: sH, left: 2, right: 2,
                      backgroundColor: 'rgba(255,77,77,0.55)',
                      borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,77,77,0.85)',
                    }} />
                  );
                })}
              </View>
              <Text style={gridSt.dayLbl}>{DAYS_SHORT[day.day_of_week]}</Text>
            </View>
          );
        })}
      </View>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 8, marginLeft: 36 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#4CAF5066' }} />
          <Text style={gridSt.dayLbl}>Available</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(255,77,77,0.55)' }} />
          <Text style={gridSt.dayLbl}>Booked</Text>
        </View>
      </View>
    </View>
  );
}

function makeGridSt(colors: ColorScheme) {
  return StyleSheet.create({
  hourLbl: {
    position: 'absolute',
    fontSize: 9,
    color: colors.textSecondary,
  },
  dayLbl: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function AvailabilityScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const { availability, loading, refetch, saveDay } = useAvailability();
  const [days, setDays]           = useState<DayAvailability[]>([]);
  const [expandedDay, setExpanded] = useState<number | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Record<number, BookedSlot[]>>({});
  const [timePicker, setTimePicker] = useState<{
    dow: number;
    field: 'start' | 'end' | 'bk_start' | 'bk_end';
    bkIdx?: number;
  } | null>(null);

  // Sync local state whenever hook data refreshes
  useEffect(() => {
    if (availability.length > 0) setDays(availability);
  }, [availability]);

  // Fetch this week's booked sessions
  useEffect(() => {
    if (!profile?.id) return;
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    supabase
      .from('scheduled_sessions')
      .select('scheduled_at, duration_minutes')
      .eq('coach_id', profile.id)
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', weekLater.toISOString())
      .in('status', ['pending', 'client_confirmed'])
      .then(({ data }) => {
        if (!data) return;
        const slots: Record<number, BookedSlot[]> = {};
        data.forEach((s: any) => {
          const dt  = new Date(s.scheduled_at);
          const dow = dt.getDay();
          const start = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
          const endDt = new Date(dt.getTime() + (s.duration_minutes ?? 60) * 60000);
          const end   = `${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`;
          if (!slots[dow]) slots[dow] = [];
          slots[dow].push({ start, end });
        });
        setBookedSlots(slots);
      });
  }, [profile?.id]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const apply = (updated: DayAvailability) => {
    setDays((prev) => prev.map((d) => d.day_of_week === updated.day_of_week ? updated : d));
    saveDay(updated); // fire-and-forget; fetchAll refreshes state
  };

  const dayByDow = (dow: number) => days.find((d) => d.day_of_week === dow);

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const handleToggle = (dow: number, on: boolean) => {
    const day = dayByDow(dow);
    if (!day) return;
    apply({ ...day, is_active: on });
    if (on && expandedDay === null) setExpanded(dow);
    if (!on && expandedDay === dow) setExpanded(null);
  };

  // ── Time picker select ─────────────────────────────────────────────────────
  const handleTimeSelect = (value: string) => {
    if (!timePicker) return;
    const { dow, field, bkIdx } = timePicker;
    const day = dayByDow(dow);
    if (!day) return;

    if (field === 'start') {
      if (value >= day.end_time) {
        Alert.alert('Invalid time', 'Start time must be before end time.');
        setTimePicker(null);
        return;
      }
      apply({ ...day, start_time: value });
    } else if (field === 'end') {
      if (value <= day.start_time) {
        Alert.alert('Invalid time', 'End time must be after start time.');
        setTimePicker(null);
        return;
      }
      apply({ ...day, end_time: value });
    } else if (bkIdx !== undefined) {
      const newBreaks = day.breaks.map((b, i) => {
        if (i !== bkIdx) return b;
        return field === 'bk_start'
          ? { ...b, start_time: value }
          : { ...b, end_time: value };
      });
      apply({ ...day, breaks: newBreaks });
    }

    setTimePicker(null);
  };

  const pickerCurrentValue = (() => {
    if (!timePicker) return '';
    const day = dayByDow(timePicker.dow);
    if (!day) return '';
    if (timePicker.field === 'start') return day.start_time;
    if (timePicker.field === 'end') return day.end_time;
    const br = day.breaks[timePicker.bkIdx ?? 0];
    return timePicker.field === 'bk_start' ? br?.start_time ?? '' : br?.end_time ?? '';
  })();

  // ── Slot duration & max clients ────────────────────────────────────────────
  const handleDuration  = (dow: number, mins: number) => {
    const day = dayByDow(dow);
    if (day) apply({ ...day, slot_duration: mins });
  };

  const handleMaxStep   = (dow: number, delta: number) => {
    const day = dayByDow(dow);
    if (!day) return;
    apply({ ...day, max_clients: Math.max(1, Math.min(20, day.max_clients + delta)) });
  };

  // ── Breaks ─────────────────────────────────────────────────────────────────
  const handleAddBreak  = (dow: number) => {
    const day = dayByDow(dow);
    if (!day) return;
    const newBr: AvailabilityBreak = { id: '', availability_id: day.id ?? '', start_time: '12:00', end_time: '13:00' };
    apply({ ...day, breaks: [...day.breaks, newBr] });
  };

  const handleRemoveBr  = (dow: number, idx: number) => {
    const day = dayByDow(dow);
    if (!day) return;
    apply({ ...day, breaks: day.breaks.filter((_, i) => i !== idx) });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading && days.length === 0) {
    return (
      <View style={st.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const hasAnyActive = days.some((d) => d.is_active);

  return (
    <>
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
      >
        {!hasAnyActive && (
          <View style={st.emptyBanner}>
            <Ionicons name="calendar-outline" size={40} color={colors.border} />
            <Text style={st.emptyTitle}>No availability set</Text>
            <Text style={st.emptySub}>Toggle on the days you're available to start accepting sessions</Text>
          </View>
        )}

        {/* ── Weekly schedule ──────────────────────────────────── */}
        <Text style={st.sectionLabel}>WEEKLY SCHEDULE</Text>

        {days.map((day) => {
          const isExp = expandedDay === day.day_of_week;
          return (
            <View key={day.day_of_week} style={[st.dayCard, day.is_active && st.dayCardOn]}>
              {/* Row header */}
              <Pressable
                style={st.dayRow}
                onPress={() => {
                  if (!day.is_active) return;
                  setExpanded(isExp ? null : day.day_of_week);
                }}
              >
                <View style={st.dayLeft}>
                  <Text style={[st.dayName, day.is_active && st.dayNameOn]}>
                    {DAYS[day.day_of_week]}
                  </Text>
                  {day.is_active && (
                    <Text style={st.dayTime}>{fmt12(day.start_time)} – {fmt12(day.end_time)}</Text>
                  )}
                </View>
                <View style={st.dayRight}>
                  {day.is_active && (
                    <Ionicons
                      name={isExp ? 'chevron-up' : 'chevron-down'}
                      size={16} color={colors.textSecondary}
                      style={{ marginRight: 10 }}
                    />
                  )}
                  <Switch
                    value={day.is_active}
                    onValueChange={(v) => handleToggle(day.day_of_week, v)}
                    trackColor={{ false: colors.border, true: colors.accent + '50' }}
                    thumbColor={day.is_active ? colors.accent : colors.textSecondary}
                  />
                </View>
              </Pressable>

              {/* Expanded settings */}
              {isExp && day.is_active && (
                <View style={st.expanded}>
                  {/* Start / End */}
                  <View style={st.timeRow}>
                    <View style={st.timeCol}>
                      <Text style={st.fieldLbl}>START TIME</Text>
                      <Pressable
                        style={st.timeBtn}
                        onPress={() => setTimePicker({ dow: day.day_of_week, field: 'start' })}
                      >
                        <Text style={st.timeTxt}>{fmt12(day.start_time)}</Text>
                        <Ionicons name="chevron-down" size={14} color={colors.accent} />
                      </Pressable>
                    </View>
                    <Text style={st.dash}>–</Text>
                    <View style={st.timeCol}>
                      <Text style={st.fieldLbl}>END TIME</Text>
                      <Pressable
                        style={st.timeBtn}
                        onPress={() => setTimePicker({ dow: day.day_of_week, field: 'end' })}
                      >
                        <Text style={st.timeTxt}>{fmt12(day.end_time)}</Text>
                        <Ionicons name="chevron-down" size={14} color={colors.accent} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Slot duration */}
                  <Text style={st.fieldLbl}>SLOT DURATION</Text>
                  <View style={st.durationRow}>
                    {[30, 45, 60, 90].map((mins) => (
                      <Pressable
                        key={mins}
                        style={[st.durBtn, day.slot_duration === mins && st.durBtnOn]}
                        onPress={() => handleDuration(day.day_of_week, mins)}
                      >
                        <Text style={[st.durTxt, day.slot_duration === mins && st.durTxtOn]}>
                          {mins}m
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Max clients */}
                  <View style={st.maxRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.fieldLbl}>MAX CLIENTS / SLOT</Text>
                      <Text style={st.fieldHint}>Simultaneous clients per time slot</Text>
                    </View>
                    <View style={st.stepper}>
                      <Pressable style={st.stepBtn} onPress={() => handleMaxStep(day.day_of_week, -1)}>
                        <Text style={st.stepTxt}>−</Text>
                      </Pressable>
                      <Text style={st.stepVal}>{day.max_clients}</Text>
                      <Pressable style={st.stepBtn} onPress={() => handleMaxStep(day.day_of_week, 1)}>
                        <Text style={st.stepTxt}>+</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Breaks */}
                  <View style={st.breaksHead}>
                    <Text style={st.fieldLbl}>BREAKS</Text>
                    <Pressable style={st.addBrk} onPress={() => handleAddBreak(day.day_of_week)}>
                      <Ionicons name="add" size={14} color={colors.accent} />
                      <Text style={st.addBrkTxt}>Add</Text>
                    </Pressable>
                  </View>
                  {day.breaks.length === 0 ? (
                    <Text style={st.noBreaks}>No breaks configured</Text>
                  ) : (
                    day.breaks.map((br, idx) => (
                      <View key={idx} style={st.brkRow}>
                        <Pressable
                          style={st.brkBtn}
                          onPress={() => setTimePicker({ dow: day.day_of_week, field: 'bk_start', bkIdx: idx })}
                        >
                          <Text style={st.brkTxt}>{fmt12(br.start_time)}</Text>
                        </Pressable>
                        <Text style={st.dash}>–</Text>
                        <Pressable
                          style={st.brkBtn}
                          onPress={() => setTimePicker({ dow: day.day_of_week, field: 'bk_end', bkIdx: idx })}
                        >
                          <Text style={st.brkTxt}>{fmt12(br.end_time)}</Text>
                        </Pressable>
                        <Pressable onPress={() => handleRemoveBr(day.day_of_week, idx)} hitSlop={8}>
                          <Ionicons name="close-circle" size={20} color={colors.danger} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* ── Weekly overview grid ─────────────────────────────── */}
        {hasAnyActive && (
          <>
            <Text style={[st.sectionLabel, { marginTop: 28 }]}>WEEKLY OVERVIEW</Text>
            <View style={st.gridCard}>
              <WeeklyGrid days={days} bookedSlots={bookedSlots} />
              <View style={st.gridLegend}>
                <View style={[st.legendDot, { backgroundColor: colors.success }]} />
                <Text style={st.legendTxt}>Available</Text>
                <View style={[st.legendDot, { backgroundColor: colors.border, marginLeft: 14 }]} />
                <Text style={st.legendTxt}>Off</Text>
              </View>
            </View>
          </>
        )}

        {/* ── Blocked dates link ───────────────────────────────── */}
        <Text style={[st.sectionLabel, { marginTop: 28 }]}>BLOCKED DATES</Text>
        <Pressable
          style={({ pressed }) => [st.blockedBtn, pressed && { opacity: 0.75 }]}
          onPress={() => router.push('/(coach)/blocked-dates')}
        >
          <Ionicons name="ban-outline" size={20} color={colors.textPrimary} />
          <Text style={st.blockedTxt}>Manage Blocked Dates</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
      </ScrollView>

      {/* ── Time picker bottom sheet ─────────────────────────── */}
      <Modal
        visible={!!timePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePicker(null)}
      >
        <Pressable style={st.overlay} onPress={() => setTimePicker(null)}>
          <View style={st.sheet}>
            <View style={st.sheetHeader}>
              <Text style={st.sheetTitle}>Select Time</Text>
              <Pressable onPress={() => setTimePicker(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item.value}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const sel = item.value === pickerCurrentValue;
                return (
                  <Pressable
                    style={[st.pickOpt, sel && st.pickOptSel]}
                    onPress={() => handleTimeSelect(item.value)}
                  >
                    <Text style={[st.pickOptTxt, sel && st.pickOptTxtSel]}>{item.label}</Text>
                    {sel && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
  scroll: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyBanner: {
    alignItems: 'center', gap: 8, paddingVertical: 28, marginBottom: 24,
    backgroundColor: c.surface, borderRadius: 16,
    borderWidth: 1, borderColor: c.border,
  },
  emptyTitle: { ...Typography.subtitle, color: c.textPrimary, marginTop: 6 },
  emptySub:  { ...Typography.body, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 20 },

  sectionLabel: { ...Typography.label, color: c.textSecondary, marginBottom: 12 },

  // Day card
  dayCard:   { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 8, overflow: 'hidden' },
  dayCardOn: { borderColor: c.accent + '30' },
  dayRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  dayLeft:   { flex: 1 },
  dayRight:  { flexDirection: 'row', alignItems: 'center' },
  dayName:   { ...Typography.body, color: c.textSecondary, fontWeight: '600' },
  dayNameOn: { color: c.textPrimary },
  dayTime:   { ...Typography.caption, color: c.accent, marginTop: 2 },

  // Expanded
  expanded: { paddingHorizontal: 14, paddingBottom: 16, borderTopWidth: 1, borderTopColor: c.border },
  timeRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 14, marginBottom: 16 },
  timeCol:  { flex: 1 },
  dash:     { ...Typography.body, color: c.textSecondary, marginBottom: 10 },
  fieldLbl: { ...Typography.label, color: c.textSecondary, fontSize: 10, marginBottom: 6 },
  fieldHint:{ ...Typography.caption, fontSize: 11, color: c.textSecondary, marginTop: 2 },
  timeBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  timeTxt:  { ...Typography.body, color: c.textPrimary, fontWeight: '500' },

  // Duration
  durationRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  durBtn:  { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center', backgroundColor: c.bg },
  durBtnOn:{ backgroundColor: c.accent + '18', borderColor: c.accent + '60' },
  durTxt:  { ...Typography.caption, color: c.textSecondary, fontWeight: '600' },
  durTxtOn:{ color: c.accent },

  // Max clients stepper
  maxRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  stepTxt: { fontSize: 18, fontWeight: '600', color: c.textPrimary },
  stepVal: { ...Typography.subtitle, color: c.textPrimary, fontWeight: '700', minWidth: 38, textAlign: 'center' },

  // Breaks
  breaksHead:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addBrk:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addBrkTxt: { color: c.accent, fontSize: 13, fontWeight: '600' },
  noBreaks:  { ...Typography.caption, color: c.textSecondary, fontStyle: 'italic', marginBottom: 6 },
  brkRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  brkBtn:    { flex: 1, backgroundColor: c.bg, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' },
  brkTxt:    { ...Typography.caption, color: c.textPrimary, fontWeight: '500' },

  // Grid
  gridCard:   { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14 },
  gridLegend: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendTxt:  { ...Typography.caption, color: c.textSecondary, marginLeft: 5 },

  // Blocked dates link
  blockedBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border },
  blockedTxt: { ...Typography.body, color: c.textPrimary, fontWeight: '500', flex: 1 },

  // Modal
  overlay:    { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet:      { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 36 },
  sheetHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { ...Typography.subtitle, color: c.textPrimary },
  pickOpt:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, marginBottom: 2 },
  pickOptSel: { backgroundColor: c.accent + '18' },
  pickOptTxt: { ...Typography.body, color: c.textPrimary },
  pickOptTxtSel: { color: c.accent, fontWeight: '600' },
});
}