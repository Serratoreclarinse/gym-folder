import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography } from '@/constants/theme';

const SCAN_SIZE = 240;
const CORNER = 28;
const CORNER_W = 3;
const OVERLAY = 'rgba(0,0,0,0.72)';

function isValidUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function QRScanModal({
  visible,
  clientName,
  expectedClientId,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  clientName: string;
  expectedClientId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setScanned(false); setError(null); };

  const handleClose = () => { reset(); onCancel(); };

  const handleScan = ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);

    const value = data.trim();

    // Must be "uuid:timeWindow" format
    const parts = value.split(':');
    if (parts.length !== 2) {
      setError('Invalid QR format. Ask the client to refresh their app.');
      return;
    }

    const [clientId, windowStr] = parts;
    const qrWindow = parseInt(windowStr, 10);

    if (!isValidUUID(clientId) || isNaN(qrWindow)) {
      setError('This QR code is not valid.');
      return;
    }

    // Reject expired QRs (5-min windows, 1 window tolerance)
    const currentWindow = Math.floor(Date.now() / 300_000);
    if (Math.abs(currentWindow - qrWindow) > 1) {
      setError('QR code has expired. Ask the client to show their current QR.');
      return;
    }

    // Must match the selected client
    if (clientId !== expectedClientId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(`Wrong QR code. Expected ${clientName}'s QR — ask them to open their app.`);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <View style={s.headerCenter}>
            <Ionicons name="qr-code-outline" size={16} color={Colors.accent} />
            <Text style={s.headerTitle}>SCAN TO CONFIRM</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Instruction */}
        <View style={s.instruction}>
          <Text style={s.instructionText}>
            Ask{' '}
            <Text style={s.clientHighlight}>{clientName}</Text>
            {' '}to open their QR code
          </Text>
        </View>

        {/* Camera / permission */}
        {!permission ? (
          <View style={s.cameraWrap}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : !permission.granted ? (
          <View style={[s.cameraWrap, s.permBox]}>
            <Ionicons name="camera-outline" size={52} color={Colors.border} />
            <Text style={s.permTitle}>Camera Access Required</Text>
            <Text style={s.permSub}>Allow camera so you can scan client QR codes.</Text>
            {permission.canAskAgain ? (
              <Pressable style={s.permBtn} onPress={requestPermission}>
                <Text style={s.permBtnText}>ALLOW CAMERA</Text>
              </Pressable>
            ) : (
              <Pressable style={s.permBtn} onPress={() => Linking.openSettings()}>
                <Text style={s.permBtnText}>OPEN SETTINGS</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={s.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleScan}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
            {/* Corner bracket overlay */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={s.overlayTop} />
              <View style={s.overlayMid}>
                <View style={s.overlaySide} />
                <View style={s.scanWindow}>
                  <View style={[s.corner, s.cTL]} />
                  <View style={[s.corner, s.cTR]} />
                  <View style={[s.corner, s.cBL]} />
                  <View style={[s.corner, s.cBR]} />
                  {scanned && !error && (
                    <View style={s.processingOverlay}>
                      <ActivityIndicator size="large" color={Colors.accent} />
                    </View>
                  )}
                </View>
                <View style={s.overlaySide} />
              </View>
              <View style={s.overlayBot} />
            </View>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.danger} />
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={reset}>
              <Text style={s.retryBtnText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        )}

        {/* Hint */}
        {!error && (
          <Text style={s.hint}>
            Point your camera at the client's QR code
          </Text>
        )}

        <Pressable style={s.cancelBtn} onPress={handleClose}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: { padding: 4, width: 44 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: { ...Typography.label, color: Colors.textPrimary, fontSize: 14 },

  instruction: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: 'center',
  },
  instructionText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 15,
  },
  clientHighlight: { color: Colors.textPrimary, fontWeight: '800' },

  cameraWrap: { flex: 1, backgroundColor: '#000' },
  permBox: {
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  permTitle: { ...Typography.subtitle, color: Colors.textPrimary, textAlign: 'center' },
  permSub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  permBtnText: { color: Colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  // Overlay
  overlayTop: { flex: 1, backgroundColor: OVERLAY },
  overlayMid: { flexDirection: 'row', height: SCAN_SIZE },
  overlaySide: { flex: 1, backgroundColor: OVERLAY },
  overlayBot: { flex: 1.3, backgroundColor: OVERLAY },
  scanWindow: { width: SCAN_SIZE, height: SCAN_SIZE },

  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: Colors.accent,
    borderWidth: CORNER_W,
  },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.danger + '12',
    borderTopWidth: 1,
    borderTopColor: Colors.danger + '30',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  errorText: { ...Typography.caption, color: Colors.danger, flex: 1, lineHeight: 18 },
  retryBtn: {
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  retryBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  hint: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: 10,
    backgroundColor: OVERLAY,
  },

  cancelBtn: { paddingVertical: 18, alignItems: 'center', backgroundColor: Colors.bg },
  cancelText: { ...Typography.body, color: Colors.textSecondary },
});
