import { useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

// ─── Exercise presets ──────────────────────────────────────────────────────────

type Preset = {
  key: string;
  label: string;
  icon: string;
  lines: { label: string; pos: number; color: string }[];
};

const PRESETS: Preset[] = [
  {
    key: 'free',
    label: 'Free',
    icon: 'grid-outline',
    lines: [
      { label: 'Line 1', pos: 0.20, color: '#64B5F6' },
      { label: 'Line 2', pos: 0.40, color: '#81C784' },
      { label: 'Line 3', pos: 0.60, color: '#FFD54F' },
      { label: 'Line 4', pos: 0.78, color: '#FF8A65' },
    ],
  },
  {
    key: 'squat',
    label: 'Squat',
    icon: 'fitness-outline',
    lines: [
      { label: 'Shoulder', pos: 0.18, color: '#64B5F6' },
      { label: 'Hip',      pos: 0.38, color: '#81C784' },
      { label: 'Knee',     pos: 0.62, color: '#FFD54F' },
      { label: 'Ankle',    pos: 0.78, color: '#FF8A65' },
    ],
  },
  {
    key: 'deadlift',
    label: 'Deadlift',
    icon: 'barbell-outline',
    lines: [
      { label: 'Shoulder', pos: 0.18, color: '#64B5F6' },
      { label: 'Hip',      pos: 0.46, color: '#81C784' },
      { label: 'Knee',     pos: 0.60, color: '#FFD54F' },
      { label: 'Foot',     pos: 0.80, color: '#FF8A65' },
    ],
  },
  {
    key: 'lunge',
    label: 'Lunge',
    icon: 'walk-outline',
    lines: [
      { label: 'Shoulder', pos: 0.18, color: '#64B5F6' },
      { label: 'Hip',      pos: 0.38, color: '#81C784' },
      { label: 'Knee',     pos: 0.64, color: '#FFD54F' },
      { label: 'Foot',     pos: 0.80, color: '#FF8A65' },
    ],
  },
  {
    key: 'plank',
    label: 'Plank',
    icon: 'remove-outline',
    lines: [
      { label: 'Head',     pos: 0.30, color: '#64B5F6' },
      { label: 'Shoulder', pos: 0.40, color: '#81C784' },
      { label: 'Hip',      pos: 0.52, color: '#FFD54F' },
      { label: 'Feet',     pos: 0.65, color: '#FF8A65' },
    ],
  },
  {
    key: 'pushup',
    label: 'Push-up',
    icon: 'body-outline',
    lines: [
      { label: 'Head',     pos: 0.28, color: '#64B5F6' },
      { label: 'Shoulder', pos: 0.38, color: '#81C784' },
      { label: 'Hip',      pos: 0.50, color: '#FFD54F' },
      { label: 'Feet',     pos: 0.65, color: '#FF8A65' },
    ],
  },
];

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function FormCheckerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [presetKey, setPresetKey] = useState('squat');
  const [frozen, setFrozen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];

  // Line positions stored as fraction of screen height (0–1)
  const lineStartRef = useRef(preset.lines.map((l) => l.pos));
  const linePosRef   = useRef(preset.lines.map((l) => l.pos));
  const [linePositions, setLinePositions] = useState(preset.lines.map((l) => l.pos));

  function applyPreset(p: Preset) {
    const positions = p.lines.map((l) => l.pos);
    lineStartRef.current = [...positions];
    linePosRef.current   = [...positions];
    setLinePositions(positions);
    setPresetKey(p.key);
  }

  // PanResponder per line
  const pans = useRef(
    [0, 1, 2, 3].map((idx) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          lineStartRef.current[idx] = linePosRef.current[idx];
        },
        onPanResponderMove: (_, gs) => {
          const next = Math.max(0.04, Math.min(0.94, lineStartRef.current[idx] + gs.dy / H));
          linePosRef.current[idx] = next;
          setLinePositions((prev) => {
            const arr = [...prev];
            arr[idx] = next;
            return arr;
          });
        },
      })
    )
  ).current;

  // ── Permission gate ────────────────────────────────────────────────────────

  if (!permission) return <View style={s.bg} />;

  if (!permission.granted) {
    return (
      <View style={s.permWrap}>
        <Ionicons name="camera-outline" size={52} color="#555" />
        <Text style={s.permTitle}>Camera Access Required</Text>
        <Text style={s.permSub}>Used for form analysis guide</Text>
        <Pressable style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>Allow Camera</Text>
        </Pressable>
        <Pressable style={s.permBack} onPress={() => router.back()}>
          <Text style={s.permBackText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const svgH = H;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        active={!frozen}
      />

      {/* SVG overlay */}
      <Svg
        width={W}
        height={svgH}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {/* Grid */}
        {showGrid && [0.25, 0.5, 0.75].map((f) => (
          <Line
            key={`gv${f}`}
            x1={W * f} y1={0} x2={W * f} y2={svgH}
            stroke="rgba(255,255,255,0.15)" strokeWidth={1}
          />
        ))}
        {showGrid && [0.2, 0.4, 0.6, 0.8].map((f) => (
          <Line
            key={`gh${f}`}
            x1={0} y1={svgH * f} x2={W} y2={svgH * f}
            stroke="rgba(255,255,255,0.10)" strokeWidth={1}
          />
        ))}

        {/* Vertical center */}
        <Line
          x1={W / 2} y1={0} x2={W / 2} y2={svgH}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={1}
          strokeDasharray="8,8"
        />

        {/* Horizontal guide lines */}
        {linePositions.map((pos, i) => {
          const y = svgH * pos;
          const color = preset.lines[i].color;
          const label = preset.lines[i].label;
          return (
            <Line
              key={`line${i}`}
              x1={0} y1={y} x2={W} y2={y}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="12,6"
              strokeOpacity={0.85}
            />
          );
        })}

        {/* Line labels — left side */}
        {linePositions.map((pos, i) => {
          const y = svgH * pos - 6;
          const color = preset.lines[i].color;
          const label = preset.lines[i].label;
          return (
            <SvgText
              key={`lbl${i}`}
              x={10}
              y={y}
              fontSize={10}
              fontWeight="700"
              fill={color}
              fillOpacity={0.9}
            >
              {label.toUpperCase()}
            </SvgText>
          );
        })}
      </Svg>

      {/* Drag handles — right side of each line */}
      {linePositions.map((pos, i) => {
        const y = H * pos;
        const color = preset.lines[i].color;
        return (
          <View
            key={`handle${i}`}
            style={[s.dragHandle, { top: y - 14, backgroundColor: color + 'CC' }]}
            {...pans[i].panHandlers}
          >
            <Ionicons name="reorder-two-outline" size={12} color="#000" />
          </View>
        );
      })}

      {/* Top controls */}
      <View style={s.topBar}>
        <Pressable style={s.topBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Text style={s.topTitle}>{preset.label} Guide</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[s.topBtn, showGrid && s.topBtnActive]}
            onPress={() => setShowGrid((g) => !g)}
          >
            <Ionicons name="grid-outline" size={18} color={showGrid ? '#000' : '#fff'} />
          </Pressable>
          <Pressable
            style={[s.topBtn, frozen && s.topBtnActive]}
            onPress={() => setFrozen((f) => !f)}
          >
            <Ionicons name={frozen ? 'play' : 'pause'} size={18} color={frozen ? '#000' : '#fff'} />
          </Pressable>
          <Pressable style={s.topBtn} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
            <Ionicons name="camera-reverse-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Bottom preset bar */}
      <View style={s.bottomBar}>
        <Text style={s.bottomHint}>Drag lines ↕ to align with body</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.presetRow}
        >
          {PRESETS.map((p) => {
            const active = p.key === presetKey;
            return (
              <Pressable
                key={p.key}
                style={[s.presetBtn, active && s.presetBtnActive]}
                onPress={() => applyPreset(p)}
              >
                <Ionicons name={p.icon as any} size={16} color={active ? '#000' : '#fff'} />
                <Text style={[s.presetText, active && s.presetTextActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bg: { flex: 1, backgroundColor: '#000' },

  // Drag handles
  dragHandle: {
    position: 'absolute',
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 10,
  },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBtnActive: { backgroundColor: '#fff' },
  topTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.60)',
    paddingTop: 10,
    paddingBottom: 28,
  },
  bottomHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  presetRow: { paddingHorizontal: 14, gap: 8 },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  presetBtnActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  presetText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  presetTextActive: { color: '#000' },

  // Permission screen
  permWrap: { flex: 1, backgroundColor: '#0f0f13', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  permTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  permSub: { color: '#888', fontSize: 13, textAlign: 'center' },
  permBtn: { backgroundColor: '#7C3AED', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12, marginTop: 8 },
  permBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  permBack: { marginTop: 4 },
  permBackText: { color: '#666', fontSize: 13 },
});
