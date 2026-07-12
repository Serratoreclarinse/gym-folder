import { useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FORM_CHECKER_URL = 'https://serratoreclarinse.github.io/gym-folder/form-checker.html';

const PRESETS = [
  // ── Lower body ──────────────────────────────────────────────────
  { key: 'squat',          label: 'Squat',         icon: 'fitness-outline',          angle: 'side',  focus: [23,24,25,26,27,28] },
  { key: 'deadlift',       label: 'Deadlift',       icon: 'barbell-outline',          angle: 'side',  focus: [11,12,23,24,25,26] },
  { key: 'rdl',            label: 'RDL',            icon: 'barbell-outline',          angle: 'side',  focus: [11,12,23,24,25,26,27,28] },
  { key: 'lunge',          label: 'Lunge',          icon: 'walk-outline',             angle: 'side',  focus: [23,24,25,26,27,28] },
  { key: 'bulgariansplit', label: 'Bulg. Split',    icon: 'walk-outline',             angle: 'side',  focus: [23,24,25,26,27,28] },
  { key: 'stepup',         label: 'Step Up',        icon: 'trending-up-outline',      angle: 'side',  focus: [23,24,25,26,27,28] },
  { key: 'hipthrust',      label: 'Hip Thrust',     icon: 'body-outline',             angle: 'side',  focus: [23,24,25,26,27,28] },
  { key: 'glutebridge',    label: 'Glute Bridge',   icon: 'body-outline',             angle: 'side',  focus: [23,24,25,26,27,28] },
  { key: 'hiphinge',       label: 'Hip Hinge',      icon: 'refresh-outline',          angle: 'side',  focus: [11,12,23,24,25,26] },
  { key: 'goodmorning',    label: 'Good Morning',   icon: 'sunny-outline',            angle: 'side',  focus: [11,12,23,24,25,26] },
  { key: 'calfraise',      label: 'Calf Raise',     icon: 'trending-up-outline',      angle: 'side',  focus: [25,26,27,28,29,30,31,32] },
  { key: 'sidelunge',      label: 'Side Lunge',     icon: 'swap-horizontal-outline',  angle: 'front', focus: [23,24,25,26,27,28] },
  // ── Upper push ─────────────────────────────────────────────────
  { key: 'pushup',         label: 'Push-up',        icon: 'body-outline',             angle: 'side',  focus: [11,12,13,14,15,16] },
  { key: 'benchpress',     label: 'Bench Press',    icon: 'barbell-outline',          angle: 'side',  focus: [11,12,13,14,15,16] },
  { key: 'ohpress',        label: 'OH Press',       icon: 'arrow-up-outline',         angle: 'front', focus: [11,12,13,14,15,16] },
  { key: 'dips',           label: 'Dips',           icon: 'chevron-down-outline',     angle: 'side',  focus: [11,12,13,14,15,16] },
  { key: 'chestfly',       label: 'Chest Fly',      icon: 'resize-outline',           angle: 'side',  focus: [11,12,13,14,15,16] },
  // ── Upper pull ─────────────────────────────────────────────────
  { key: 'pullup',         label: 'Pull-up',        icon: 'chevron-up-outline',       angle: 'front', focus: [11,12,13,14,15,16] },
  { key: 'latpulldown',    label: 'Lat Pulldown',   icon: 'arrow-down-outline',       angle: 'side',  focus: [11,12,13,14,15,16] },
  { key: 'row',            label: 'Bent Row',       icon: 'git-pull-request-outline', angle: 'side',  focus: [11,12,13,14] },
  { key: 'seatedrow',      label: 'Seated Row',     icon: 'arrow-forward-outline',    angle: 'side',  focus: [11,12,13,14] },
  { key: 'facepull',       label: 'Face Pull',      icon: 'arrow-back-outline',       angle: 'front', focus: [11,12,13,14] },
  // ── Shoulders ──────────────────────────────────────────────────
  { key: 'lateralraise',   label: 'Lateral Raise',  icon: 'swap-horizontal-outline',  angle: 'front', focus: [11,12,13,14] },
  { key: 'frontraise',     label: 'Front Raise',    icon: 'arrow-up-outline',         angle: 'side',  focus: [11,12,13,14,15,16] },
  // ── Arms ───────────────────────────────────────────────────────
  { key: 'bicepcurl',      label: 'Bicep Curl',     icon: 'hand-right-outline',       angle: 'side',  focus: [13,14,15,16] },
  { key: 'hammercurl',     label: 'Hammer Curl',    icon: 'hand-right-outline',       angle: 'side',  focus: [13,14,15,16] },
  { key: 'tricepext',      label: 'Tricep Ext.',    icon: 'hand-left-outline',        angle: 'side',  focus: [13,14,15,16] },
  // ── Core ───────────────────────────────────────────────────────
  { key: 'plank',          label: 'Plank',          icon: 'remove-outline',           angle: 'side',  focus: [11,12,23,24] },
  { key: 'sideplank',      label: 'Side Plank',     icon: 'remove-outline',           angle: 'front', focus: [11,12,23,24] },
  { key: 'deadbug',        label: 'Dead Bug',       icon: 'bug-outline',              angle: 'side',  focus: [11,12,13,14,15,16,23,24,25,26] },
  // ── Free ───────────────────────────────────────────────────────
  { key: 'free',           label: 'Free',           icon: 'grid-outline',             angle: '',      focus: [] },
];

export default function FormCheckerScreen() {
  const webViewRef = useRef<WebView>(null);
  const [preset, setPreset] = useState(PRESETS[0]);
  const [frozen, setFrozen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();

  const filteredPresets = PRESETS.filter((p) =>
    p.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handlePreset(p: typeof PRESETS[0]) {
    setPreset(p);
    webViewRef.current?.injectJavaScript(
      `window.setExercise(${JSON.stringify(p.key)}, ${JSON.stringify(p.focus)}, ${JSON.stringify(p.angle)}); true;`
    );
  }

  function handleFlip() {
    webViewRef.current?.injectJavaScript('window.flipCamera(); true;');
  }

  function handleFreeze() {
    webViewRef.current?.injectJavaScript('window.toggleFreeze(); true;');
    setFrozen((f) => !f);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <WebView
        ref={webViewRef}
        style={StyleSheet.absoluteFill}
        source={{ uri: FORM_CHECKER_URL }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        originWhitelist={['*']}
        mixedContentMode="always"
        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript(
            `window.setExercise(${JSON.stringify(PRESETS[0].key)}, ${JSON.stringify(PRESETS[0].focus)}, ${JSON.stringify(PRESETS[0].angle)}); true;`
          );
        }}
        onPermissionRequest={(e) => e.nativeEvent.request.grant(e.nativeEvent.request.resources)}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />

      {/* Top controls */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.topBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <View style={s.presetLabel}>
          <Text style={s.presetLabelText}>{preset.label}</Text>
          <Text style={s.presetLabelSub}>Pose Detection</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[s.topBtn, frozen && s.topBtnActive]}
            onPress={handleFreeze}
          >
            <Ionicons name={frozen ? 'play' : 'pause'} size={18} color={frozen ? '#000' : '#fff'} />
          </Pressable>
          <Pressable style={s.topBtn} onPress={handleFlip}>
            <Ionicons name="camera-reverse-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {[
          { color: 'rgba(100,181,246,0.9)', label: 'Torso' },
          { color: 'rgba(129,199,132,0.9)', label: 'L.Arm' },
          { color: 'rgba(255,213,79,0.9)',  label: 'R.Arm' },
          { color: 'rgba(255,138,101,0.9)', label: 'L.Leg' },
          { color: 'rgba(240,98,146,0.9)',  label: 'R.Leg' },
          { color: 'rgba(255,230,0,0.95)',  label: 'Focus' },
        ].map(({ color, label }) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Bottom exercise picker */}
      <Pressable
        style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}
        onPress={() => { setSearchQuery(''); setShowDropdown(true); }}
      >
        <Text style={s.bottomHint}>Exercise</Text>
        <View style={s.pickerRow}>
          <Ionicons name={preset.icon as any} size={16} color="#fff" />
          <Text style={s.pickerLabel}>{preset.label}</Text>
          <Ionicons name="chevron-up-outline" size={14} color="rgba(255,255,255,0.55)" />
        </View>
      </Pressable>

      {/* Exercise picker modal */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable style={s.ddOverlay} onPress={() => setShowDropdown(false)} />
        <View style={[s.ddSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.ddHandle} />
          <Text style={s.ddTitle}>Select Exercise</Text>
          <TextInput
            style={s.ddSearch}
            placeholder="Search..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          <FlatList
            data={filteredPresets}
            keyExtractor={(p) => p.key}
            keyboardShouldPersistTaps="handled"
            style={s.ddList}
            renderItem={({ item: p }) => {
              const active = p.key === preset.key;
              return (
                <Pressable
                  style={[s.ddItem, active && s.ddItemActive]}
                  onPress={() => { handlePreset(p); setShowDropdown(false); }}
                >
                  <Ionicons name={p.icon as any} size={17} color={active ? '#000' : '#fff'} />
                  <Text style={[s.ddItemText, active && s.ddItemTextActive]}>{p.label}</Text>
                  {active && <Ionicons name="checkmark" size={16} color="#000" style={{ marginLeft: 'auto' }} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: 10,
  },
  topBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  topBtnActive: { backgroundColor: '#fff' },
  presetLabel: { flex: 1 },
  presetLabelText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  presetLabelSub:  { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600' },

  legend: {
    position: 'absolute', top: 110, left: 12,
    flexDirection: 'column', gap: 5,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingTop: 10, paddingHorizontal: 16,
  },
  bottomHint: {
    color: 'rgba(255,255,255,0.4)', fontSize: 10,
    fontWeight: '600', letterSpacing: 0.4, marginBottom: 6,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  pickerLabel: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 },

  // Dropdown modal
  ddOverlay: { flex: 1 },
  ddSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 10, paddingHorizontal: 16,
    maxHeight: '70%',
  },
  ddHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 14,
  },
  ddTitle: {
    color: '#fff', fontSize: 17, fontWeight: '800',
    marginBottom: 12,
  },
  ddSearch: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: '#fff', fontSize: 15, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  ddList: { flex: 1 },
  ddItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  ddItemActive: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 10, marginHorizontal: -6,
  },
  ddItemText: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  ddItemTextActive: { color: '#000' },
});
