import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

// ─── Exercise presets ──────────────────────────────────────────────────────────

const PRESETS = [
  { key: 'squat',    label: 'Squat',    icon: 'fitness-outline',  focus: [23, 24, 25, 26, 27, 28] },
  { key: 'deadlift', label: 'Deadlift', icon: 'barbell-outline',  focus: [11, 12, 23, 24, 25, 26] },
  { key: 'lunge',    label: 'Lunge',    icon: 'walk-outline',     focus: [23, 24, 25, 26, 27, 28] },
  { key: 'pushup',   label: 'Push-up',  icon: 'body-outline',     focus: [11, 12, 13, 14, 15, 16] },
  { key: 'plank',    label: 'Plank',    icon: 'remove-outline',   focus: [11, 12, 23, 24] },
  { key: 'ohpress',  label: 'OH Press', icon: 'arrow-up-outline', focus: [11, 12, 13, 14, 15, 16] },
  { key: 'row',      label: 'Row',      icon: 'git-pull-request-outline', focus: [11, 12, 13, 14] },
  { key: 'free',     label: 'Free',     icon: 'grid-outline',     focus: [] },
];

// ─── MediaPipe HTML ─────────────────────────────────────────────────────────────

function buildPoseHtml(focusJoints: number[]): string {
  const focusStr = JSON.stringify(focusJoints);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:100vw; height:100vh; overflow:hidden; background:#000; }
#video {
  position:absolute; top:0; left:0;
  width:100%; height:100%;
  object-fit:cover;
}
#canvas {
  position:absolute; top:0; left:0;
  width:100%; height:100%;
}
#status {
  position:absolute; top:50%; left:50%;
  transform:translate(-50%,-50%);
  color:#fff; font-family:-apple-system,sans-serif;
  font-size:14px; text-align:center;
  background:rgba(0,0,0,0.75); padding:20px 28px;
  border-radius:16px; line-height:1.6;
}
#fps {
  position:absolute; bottom:8px; right:8px;
  color:rgba(255,255,255,0.45); font-family:monospace;
  font-size:10px; background:rgba(0,0,0,0.35);
  padding:3px 7px; border-radius:6px;
}
</style>
</head>
<body>
<video id="video" autoplay playsinline muted></video>
<canvas id="canvas"></canvas>
<div id="status">Loading AI model...<br><span style="font-size:11px;opacity:0.65">First load takes ~5 seconds</span></div>
<div id="fps"></div>

<script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js" crossorigin="anonymous"></script>
<script>
var video     = document.getElementById('video');
var canvas    = document.getElementById('canvas');
var ctx       = canvas.getContext('2d');
var statusEl  = document.getElementById('status');
var fpsEl     = document.getElementById('fps');

var poseLandmarker = null;
var animFrameId    = null;
var lastVideoTime  = -1;
var frozen         = false;
var facing         = 'environment';
var fpsCount       = 0;
var lastFpsTs      = performance.now();
var focusJoints    = ${focusStr};

// ── Colors ─────────────────────────────────────────────────────────
var COLORS = {
  torso: 'rgba(100,181,246,0.9)',
  larm:  'rgba(129,199,132,0.9)',
  rarm:  'rgba(255,213,79,0.9)',
  lleg:  'rgba(255,138,101,0.9)',
  rleg:  'rgba(240,98,146,0.9)',
  focus: 'rgba(255,255,255,1)',
  joint: 'rgba(255,255,255,0.95)',
};

var SEGS = [
  {a:11,b:12,c:'torso'}, {a:11,b:23,c:'torso'}, {a:12,b:24,c:'torso'}, {a:23,b:24,c:'torso'},
  {a:11,b:13,c:'larm'},  {a:13,b:15,c:'larm'},
  {a:12,b:14,c:'rarm'},  {a:14,b:16,c:'rarm'},
  {a:23,b:25,c:'lleg'},  {a:25,b:27,c:'lleg'},  {a:27,b:29,c:'lleg'},  {a:27,b:31,c:'lleg'},
  {a:24,b:26,c:'rleg'},  {a:26,b:28,c:'rleg'},  {a:28,b:30,c:'rleg'},  {a:28,b:32,c:'rleg'},
];
var KEY_IDX = [11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32];

// ── Camera ─────────────────────────────────────────────────────────
async function startCamera(facingMode) {
  try {
    if (video.srcObject) video.srcObject.getTracks().forEach(function(t){ t.stop(); });
    var stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode, width: {ideal:640}, height: {ideal:480} },
      audio: false,
    });
    video.srcObject = stream;
    var mirror = facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    video.style.transform  = mirror;
    canvas.style.transform = mirror;
    await video.play();
  } catch(e) {
    statusEl.innerHTML = '⚠️ Camera error<br><span style="font-size:11px">' + e.message + '</span>';
    statusEl.style.display = 'block';
  }
}

// ── Init ───────────────────────────────────────────────────────────
async function init() {
  try {
    await startCamera(facing);
    statusEl.style.display = 'block';

    var V = window.vision;
    var fs = await V.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    poseLandmarker = await V.PoseLandmarker.createFromOptions(fs, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

    statusEl.style.display = 'none';
    requestAnimationFrame(detectFrame);
  } catch(e) {
    statusEl.innerHTML = '⚠️ Could not load model<br><span style="font-size:11px;opacity:0.7">' + (e && e.message ? e.message : 'Check internet connection') + '</span>';
  }
}

// ── Detection loop ─────────────────────────────────────────────────
function detectFrame() {
  if (frozen) return;
  if (video.readyState >= 2) {
    canvas.width  = video.videoWidth  || window.innerWidth;
    canvas.height = video.videoHeight || window.innerHeight;

    if (video.currentTime !== lastVideoTime && poseLandmarker) {
      lastVideoTime = video.currentTime;
      var res = poseLandmarker.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (res.landmarks && res.landmarks.length > 0) drawPose(res.landmarks[0]);

      fpsCount++;
      var now = performance.now();
      if (now - lastFpsTs >= 1000) {
        fpsEl.textContent = fpsCount + ' fps';
        fpsCount = 0; lastFpsTs = now;
      }
    }
  }
  animFrameId = requestAnimationFrame(detectFrame);
}

function drawPose(lm) {
  ctx.lineCap = 'round';

  // Segments
  for (var i = 0; i < SEGS.length; i++) {
    var s = SEGS[i];
    var pa = lm[s.a], pb = lm[s.b];
    if (!pa || !pb) continue;
    if ((pa.visibility||1) < 0.35 || (pb.visibility||1) < 0.35) continue;
    var isFocus = focusJoints.indexOf(s.a) !== -1 && focusJoints.indexOf(s.b) !== -1;
    ctx.beginPath();
    ctx.strokeStyle = isFocus ? 'rgba(255,230,0,0.95)' : COLORS[s.c];
    ctx.lineWidth   = isFocus ? 4 : 2.5;
    ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
    ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
    ctx.stroke();
  }

  // Joints
  for (var j = 0; j < KEY_IDX.length; j++) {
    var idx = KEY_IDX[j];
    var p = lm[idx];
    if (!p || (p.visibility||1) < 0.35) continue;
    var x = p.x * canvas.width;
    var y = p.y * canvas.height;
    var isFocusJoint = focusJoints.indexOf(idx) !== -1;
    ctx.beginPath();
    ctx.arc(x, y, isFocusJoint ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isFocusJoint ? 'rgba(255,230,0,0.95)' : COLORS.joint;
    ctx.fill();
  }
}

// ── Commands from React Native ─────────────────────────────────────
window.flipCamera = async function() {
  facing = facing === 'environment' ? 'user' : 'environment';
  await startCamera(facing);
  lastVideoTime = -1;
  if (!frozen && poseLandmarker) requestAnimationFrame(detectFrame);
};

window.toggleFreeze = function() {
  frozen = !frozen;
  if (!frozen && poseLandmarker) { lastVideoTime = -1; requestAnimationFrame(detectFrame); }
};

window.setFocusJoints = function(joints) {
  focusJoints = joints;
};

init();
</script>
</body>
</html>`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FormCheckerScreen() {
  const webViewRef = useRef<WebView>(null);
  const [preset, setPreset]   = useState(PRESETS[0]);
  const [frozen, setFrozen]   = useState(false);
  const [htmlKey, setHtmlKey] = useState(0);
  const [html, setHtml]       = useState(() => buildPoseHtml(PRESETS[0].focus));

  function handlePreset(p: typeof PRESETS[0]) {
    setPreset(p);
    webViewRef.current?.injectJavaScript(
      `window.setFocusJoints(${JSON.stringify(p.focus)}); true;`
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

      {/* WebView — full screen AI camera */}
      <WebView
        key={htmlKey}
        ref={webViewRef}
        style={StyleSheet.absoluteFill}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        originWhitelist={['*']}
        mixedContentMode="always"
        onPermissionRequest={(e) => e.nativeEvent.request.grant(e.nativeEvent.request.resources)}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />

      {/* Top controls */}
      <View style={s.topBar}>
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
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: 'rgba(100,181,246,0.9)' }]} />
          <Text style={s.legendText}>Torso</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: 'rgba(129,199,132,0.9)' }]} />
          <Text style={s.legendText}>L.Arm</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: 'rgba(255,213,79,0.9)' }]} />
          <Text style={s.legendText}>R.Arm</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: 'rgba(255,138,101,0.9)' }]} />
          <Text style={s.legendText}>L.Leg</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: 'rgba(240,98,146,0.9)' }]} />
          <Text style={s.legendText}>R.Leg</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: 'rgba(255,230,0,0.95)' }]} />
          <Text style={s.legendText}>Focus</Text>
        </View>
      </View>

      {/* Bottom exercise selector */}
      <View style={s.bottomBar}>
        <Text style={s.bottomHint}>Select exercise to highlight key joints</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.presetRow}
        >
          {PRESETS.map((p) => {
            const active = p.key === preset.key;
            return (
              <Pressable
                key={p.key}
                style={[s.presetBtn, active && s.presetBtnActive]}
                onPress={() => handlePreset(p)}
              >
                <Ionicons name={p.icon as any} size={15} color={active ? '#000' : '#fff'} />
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

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 14, paddingBottom: 10,
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
  presetLabelSub: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600' },

  legend: {
    position: 'absolute', top: 110, left: 12,
    flexDirection: 'column', gap: 5,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingTop: 10, paddingBottom: 28,
  },
  bottomHint: {
    color: 'rgba(255,255,255,0.45)', fontSize: 10,
    fontWeight: '600', textAlign: 'center',
    letterSpacing: 0.4, marginBottom: 10,
  },
  presetRow: { paddingHorizontal: 14, gap: 8 },
  presetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  presetBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  presetText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  presetTextActive: { color: '#000' },
});
