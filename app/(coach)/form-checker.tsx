import { useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
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

const CHECKLISTS: Record<string, string[]> = {
  squat:          ['Feet shoulder-width, toes out 15–30°','Knees track over 2nd/3rd toe','Depth at parallel or below','Chest up / torso upright','Heels flat on floor throughout','Core braced'],
  deadlift:       ['Back neutral — spine long, no rounding','Hip hinge initiated (not a squat)','Bar stays close to body throughout','Shoulders packed / lats engaged','Full lockout at top — hips through','Soft knee at start'],
  rdl:            ['Soft knee maintained throughout','Hinge at hips — sit hips back','Back stays neutral / long','Hamstring stretch felt at bottom','Bar close to legs throughout'],
  lunge:          ['Front knee tracks over ankle','Both knees near 90° at bottom','Torso upright / core braced','Back knee hovers — controlled descent','Front heel stays flat'],
  bulgariansplit: ['Front knee tracks over ankle','Front knee reaches ~90° at bottom','Torso angle matches goal (upright=quads, lean=glutes)','Rear foot resting on bench, not pushing','Control hip drop at bottom'],
  stepup:         ['Full foot planted on the box','Drive through heel of front foot','Torso upright — no forward lean','Control the descent back down','No pushing off with back foot'],
  hipthrust:      ['Upper back on bench edge (not neck)','Feet hip-width, ~6–8 inches from glutes','Knee at ~90° at the top','Full hip extension — squeeze glutes at top','Chin tucked — ribs down'],
  glutebridge:    ['Feet hip-width, heels close to glutes','Full hip extension at top','Squeeze glutes — hold 1 sec at top','Lower back neutral (no over-arch)','Controlled lowering'],
  hiphinge:       ['Weight in heels throughout','Hinge at hips — not at waist','Soft knee maintained','Back flat / neutral spine','Hamstring stretch felt at bottom'],
  goodmorning:    ['Bar on upper traps (not neck)','Soft knee, hinge at hips','Back neutral — no rounding','Hinge until ~45° from vertical','Drive hips forward to return'],
  calfraise:      ['Full plantarflexion — heels fully raised','Both heels rise evenly','Control the descent — no dropping','Slight knee bend is acceptable','Pause briefly at the top'],
  sidelunge:      ['Bent knee tracks over ankle (no cave)','Straight leg fully extended','Torso upright / chest up','Foot of bent leg flat on floor','Hips push back and to the side'],
  pushup:         ['Body in straight line — head to heels','Elbows 45–70° from torso (not flared)','Chest near/touches floor at bottom','Full arm extension at top','Core braced — hips don\'t sag or rise'],
  benchpress:     ['Shoulder blades retracted and depressed','Natural arch in lower back','Elbows 45–70° from torso','Bar touches lower chest at bottom','Wrists straight / neutral throughout'],
  ohpress:        ['Torso stays upright — no lumbar arch','Bar starts at upper chest / chin level','Wrists directly over elbows','Full lockout overhead','Core braced throughout'],
  dips:           ['Elbows reach 90° at bottom minimum','Forward lean for chest, upright for triceps','Shoulders don\'t shrug up','Controlled descent — no dropping','Full extension at top'],
  chestfly:       ['Slight, consistent elbow bend throughout','Arms wide — full chest stretch at bottom','Controlled arc back to centre','Shoulders stay back — no shrugging','Squeeze chest at top'],
  pullup:         ['Dead hang at bottom — full extension','Pull elbows down and back','Chin clears the bar at top','No kipping or momentum','Shoulder blades retract at top'],
  latpulldown:    ['Slight backward lean only (~15°)','Bar pulled to upper chest','Drive elbows down toward hips','Full stretch at top — arms extended','Shoulder blades depress and retract'],
  row:            ['Torso ~45° from vertical','Pull to lower ribcage / belly button','Drive elbows toward ceiling','Shoulder blades squeeze at top','Back stays neutral throughout'],
  seatedrow:      ['Torso upright — minimal lean','Pull handle to navel','Drive elbows behind body','Shoulder blades squeeze at end','No excessive swinging / rocking'],
  facepull:       ['Pull to face / nose height','Elbows high at end (external rotation)','Shoulder blades retract','Torso upright — no lean back','Controlled return'],
  lateralraise:   ['Raise to shoulder height only','Slight elbow bend throughout','Lead with elbows (not wrists)','No shrugging / traps taking over','Controlled descent'],
  frontraise:     ['Raise to shoulder height','Slight elbow bend maintained','Wrists neutral — don\'t bend','No swinging or momentum','Torso upright throughout'],
  bicepcurl:      ['Upper arms pinned to sides','Full extension at bottom','Squeeze at top — peak contraction','No elbow swinging forward','Wrists neutral (not bent)'],
  hammercurl:     ['Neutral grip (thumbs up) throughout','Upper arms pinned to sides','Full extension at bottom','No swinging / momentum','Controlled throughout'],
  tricepext:      ['Elbows pointing forward — not flared','Full extension at top','Deep stretch at bottom','Upper arms stay still','Controlled movement'],
  plank:          ['Body in straight line — head to heels','Hips level (not sagging or raised)','Core braced / glutes squeezed','Shoulders over wrists or elbows','Neutral neck — don\'t look up'],
  sideplank:      ['Hips elevated — not sagging','Straight line from head to feet','Supporting shoulder stable','No hip rotation forward/back','Breathe steadily'],
  deadbug:        ['Lower back pressed flat to floor','Arms straight up over shoulders','Legs at 90° tabletop at start','Extend opposite arm and leg together','Exhale as you extend'],
  free:           ['Full body visible in frame','Good lighting for detection','Observe overall posture','Check joint symmetry','Note any compensations'],
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
  const [showChecklist, setShowChecklist] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [checkStates, setCheckStates] = useState<('good' | 'bad' | null)[]>([]);

  function toggleCheck(idx: number) {
    setCheckStates((prev) => {
      const next = [...prev];
      const cur = next[idx] ?? null;
      next[idx] = cur === null ? 'good' : cur === 'good' ? 'bad' : null;
      return next;
    });
  }
  const insets = useSafeAreaInsets();

  const filteredPresets = PRESETS.filter((p) =>
    p.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handlePreset(p: typeof PRESETS[0]) {
    setPreset(p);
    setCheckStates([]);
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
          <Pressable style={[s.topBtn, showGrid && s.topBtnActive]} onPress={() => setShowGrid(g => !g)}>
            <Ionicons name="grid-outline" size={18} color={showGrid ? '#000' : '#fff'} />
          </Pressable>
          <Pressable style={[s.topBtn, showChecklist && s.topBtnActive]} onPress={() => setShowChecklist(c => !c)}>
            <Ionicons name="clipboard-outline" size={18} color={showChecklist ? '#000' : '#fff'} />
          </Pressable>
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

      {/* Rule-of-thirds gridlines overlay */}
      {showGrid && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={[s.gridLine, s.gridV, { left: '33.3%' }]} />
          <View style={[s.gridLine, s.gridV, { left: '66.6%' }]} />
          <View style={[s.gridLine, s.gridH, { top: '33.3%' }]} />
          <View style={[s.gridLine, s.gridH, { top: '66.6%' }]} />
          <View style={[s.gridLine, s.gridV, { left: '50%', opacity: 0.2 }]} />
          <View style={[s.gridLine, s.gridH, { top: '50%', opacity: 0.2 }]} />
        </View>
      )}

      {/* Live checklist overlay (left side) */}
      {showChecklist && (() => {
        const items = CHECKLISTS[preset.key] ?? [];
        const nGood = checkStates.filter((st) => st === 'good').length;
        const nBad  = checkStates.filter((st) => st === 'bad').length;
        return (
          <View style={[s.clPanel, { top: insets.top + 70 }]}>
            {/* Header row */}
            <View style={s.clPanelHeader}>
              <Text style={s.clPanelTitle}>Checklist</Text>
              <Pressable onPress={() => setCheckStates([])}>
                <Text style={s.clReset}>↺</Text>
              </Pressable>
            </View>
            {/* Score bar */}
            {(nGood + nBad) > 0 && (
              <View style={s.clScore}>
                <Text style={[s.clScoreNum, { color: '#4CAF50' }]}>{nGood}✓</Text>
                <Text style={[s.clScoreNum, { color: '#F44336' }]}>{nBad}✗</Text>
                <Text style={s.clScorePct}>{Math.round((nGood / items.length) * 100)}%</Text>
              </View>
            )}
            {/* Items */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              {items.map((item, idx) => {
                const st = checkStates[idx] ?? null;
                return (
                  <Pressable key={idx} style={s.clRow} onPress={() => toggleCheck(idx)}>
                    <View style={[
                      s.clDot,
                      st === 'good' && { backgroundColor: '#4CAF50' },
                      st === 'bad'  && { backgroundColor: '#F44336' },
                    ]}>
                      <Ionicons
                        name={st === 'good' ? 'checkmark' : st === 'bad' ? 'close' : 'remove'}
                        size={10}
                        color={st ? '#fff' : 'rgba(255,255,255,0.4)'}
                      />
                    </View>
                    <Text style={[
                      s.clRowText,
                      st === 'good' && { color: '#81C784' },
                      st === 'bad'  && { color: '#E57373' },
                    ]} numberOfLines={2}>{item}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        );
      })()}

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
    height: '72%',
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

  // Rule-of-thirds gridlines
  gridLine: { position: 'absolute' },
  gridV: { width: 1, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.25)' },
  gridH: { height: 1, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Live checklist panel
  clPanel: {
    position: 'absolute', left: 8,
    width: 168,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 12, padding: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  clPanelHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 5,
  },
  clPanelTitle: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  clReset: { color: '#FF9800', fontSize: 16, fontWeight: '700' },
  clScore: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 6, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  clScoreNum: { fontSize: 11, fontWeight: '800' },
  clScorePct: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', marginLeft: 'auto' },
  clRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 7, paddingVertical: 5,
  },
  clDot: {
    width: 18, height: 18, borderRadius: 9, flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  clRowText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '500',
    flex: 1, lineHeight: 14,
  },
});
