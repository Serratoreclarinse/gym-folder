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

const GUIDES = {
  side: {
    title: 'Side View',
    subtitle: 'Stand directly to the side of the client',
    dos: [
      'Stand 6–8 ft (2–2.5 m) away',
      'Camera at hip / mid-torso height',
      'Full body visible — head to feet',
      'Client faces left or right (perpendicular to camera)',
      'Good lighting — avoid filming into a bright light',
    ],
    donts: [
      "Don't film from the front or a diagonal angle",
      "Don't stand too close — body gets cut off",
      "Don't hold the camera above shoulder height",
    ],
  },
  front: {
    title: 'Front View',
    subtitle: 'Stand directly in front of the client',
    dos: [
      'Stand 6–8 ft (2–2.5 m) away',
      'Camera at chest / shoulder height',
      'Full body visible — head to feet',
      'Client faces the camera directly',
      'Good lighting — avoid filming into a bright light',
    ],
    donts: [
      "Don't film from the side or a diagonal angle",
      "Don't stand too close — body gets cut off",
      "Don't hold the camera too low (knee level)",
    ],
  },
  '': {
    title: 'Free Mode',
    subtitle: 'No specific angle required',
    dos: [
      'Keep full body in frame if possible',
      'Good lighting improves detection accuracy',
    ],
    donts: [],
  },
} as const;

const EXERCISE_TIPS: Record<string, string> = {
  hipthrust:    'Client is lying on their back — film from the side at ground / hip level',
  glutebridge:  'Client is on the floor — lower the camera closer to ground level',
  deadbug:      'Client is lying on their back — film from the side at floor level',
  plank:        'Hip alignment (shoulder → hip → ankle) must all be visible from the side',
  benchpress:   'Client is on bench — film from the side so the elbow depth is visible',
  pushup:       'The full body line from head to ankle must be visible from the side',
  row:          'Client is hinged forward — film from the side to see back angle',
  latpulldown:  'Film from the side — torso and elbow path both visible',
  calfraise:    'Film from the side — heel lift must be clearly visible',
};

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
  const [showGuide, setShowGuide] = useState(false);
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
          <Pressable style={s.topBtn} onPress={() => setShowGuide(true)}>
            <Ionicons name="videocam-outline" size={18} color="#fff" />
          </Pressable>
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

      {/* Camera guide modal */}
      <Modal
        visible={showGuide}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGuide(false)}
      >
        {(() => {
          const guide = GUIDES[preset.angle as keyof typeof GUIDES] ?? GUIDES[''];
          const tip   = EXERCISE_TIPS[preset.key];
          return (
            <>
              <Pressable style={s.ddOverlay} onPress={() => setShowGuide(false)} />
              <View style={[s.ddSheet, s.guideSheet, { paddingBottom: insets.bottom + 20 }]}>
                <View style={s.ddHandle} />

                {/* Header */}
                <View style={s.guideHeader}>
                  <View style={s.guideCamIcon}>
                    <Ionicons name="videocam" size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.guideTitle}>Camera Guide</Text>
                    <Text style={s.guideSub}>{preset.label} · {guide.title}</Text>
                  </View>
                  <Pressable onPress={() => setShowGuide(false)}>
                    <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                </View>

                {/* Angle badge */}
                <View style={[
                  s.guideBadge,
                  { backgroundColor: preset.angle === 'front' ? '#2196F318' : '#FF980018',
                    borderColor:      preset.angle === 'front' ? '#2196F360' : '#FF980060' },
                ]}>
                  <Ionicons
                    name={preset.angle === 'front' ? 'person-outline' : 'swap-horizontal-outline'}
                    size={13}
                    color={preset.angle === 'front' ? '#64B5F6' : '#FFB74D'}
                  />
                  <Text style={[s.guideBadgeText,
                    { color: preset.angle === 'front' ? '#64B5F6' : '#FFB74D' }]}>
                    {guide.subtitle}
                  </Text>
                </View>

                {/* Exercise-specific tip */}
                {tip && (
                  <View style={s.guideTipBox}>
                    <Ionicons name="information-circle-outline" size={15} color="#64B5F6" />
                    <Text style={s.guideTipText}>{tip}</Text>
                  </View>
                )}

                {/* Do's */}
                <Text style={s.guideSection}>DO</Text>
                {guide.dos.map((item, i) => (
                  <View key={i} style={s.guideRow}>
                    <View style={[s.guideDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={s.guideRowText}>{item}</Text>
                  </View>
                ))}

                {/* Don'ts */}
                {guide.donts.length > 0 && (
                  <>
                    <Text style={[s.guideSection, { marginTop: 14 }]}>AVOID</Text>
                    {guide.donts.map((item, i) => (
                      <View key={i} style={s.guideRow}>
                        <View style={[s.guideDot, { backgroundColor: '#F44336' }]} />
                        <Text style={s.guideRowText}>{item}</Text>
                      </View>
                    ))}
                  </>
                )}

                {/* Accuracy note */}
                <View style={s.guideAccNote}>
                  <Ionicons name="analytics-outline" size={13} color="rgba(255,255,255,0.4)" />
                  <Text style={s.guideAccText}>
                    Correct camera position greatly improves AI detection accuracy.
                  </Text>
                </View>
              </View>
            </>
          );
        })()}
      </Modal>

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

  // Camera guide modal
  guideSheet: { maxHeight: '80%' },
  guideHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
  },
  guideCamIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  guideTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  guideSub:   { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  guideBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  guideBadgeText: { fontSize: 13, fontWeight: '700', flex: 1 },
  guideTipBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#64B5F610', borderWidth: 1, borderColor: '#64B5F630',
    borderRadius: 10, padding: 10, marginBottom: 14,
  },
  guideTipText: { color: '#64B5F6', fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  guideSection: {
    color: 'rgba(255,255,255,0.35)', fontSize: 10,
    fontWeight: '800', letterSpacing: 1, marginBottom: 8,
  },
  guideRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9,
  },
  guideDot: { width: 7, height: 7, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  guideRowText: { color: '#fff', fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 },
  guideAccNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 18, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  guideAccText: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '500', flex: 1 },
});
