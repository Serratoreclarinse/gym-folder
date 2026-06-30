import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useClients } from '@/hooks/useClients';
import { saveInBodyLink } from '@/hooks/useClientFiles';
import { Colors, Typography } from '@/constants/theme';

const SCAN_SIZE = 260;
const CORNER_SIZE = 30;
const CORNER_WIDTH = 3;

type ScannedClient = {
  id: string;
  name: string;
  packageId: string;
  sessionsRemaining: number;
};

type ModalState =
  | { type: 'confirm'; client: ScannedClient; wasLast: boolean; scanTime: Date }
  | { type: 'error'; message: string }
  | { type: 'no-sessions'; client: ScannedClient }
  | { type: 'web-link'; url: string; isInBody: boolean }
  | null;

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function isWebUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://');
}

function isInBodyUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('inbody') || lower.includes('lookin.body');
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }) + '  ·  ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ── Corner bracket overlay ────────────────────────────────────
function ScanOverlay({ processing }: { processing: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top */}
      <View style={styles.overlayTop} />
      {/* Middle row */}
      <View style={styles.overlayMiddle}>
        <View style={styles.overlaySide} />
        {/* Transparent scan window */}
        <View style={styles.scanWindow}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          {processing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={Colors.accent} />
            </View>
          )}
        </View>
        <View style={styles.overlaySide} />
      </View>
      {/* Bottom */}
      <View style={styles.overlayBottom} />
    </View>
  );
}

export default function QRScannerScreen() {
  const { profile } = useAuth();
  const { clients } = useClients();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  // Reset scanner every time this tab comes into focus
  useFocusEffect(useCallback(() => {
    setScanned(false);
    setProcessing(false);
    setModalState(null);
  }, []));

  const closeModal = () => {
    setModalState(null);
    setScanned(false);
    setProcessing(false);
    setSelectedClientId('');
  };

  const handleSaveLink = async (url: string) => {
    if (!selectedClientId || !profile?.id) return;
    setSavingLink(true);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await saveInBodyLink(selectedClientId, profile.id, url, 'InBody Result', today);
    setSavingLink(false);
    if (error) {
      Alert.alert('Error', 'Could not save link to client files.');
      return;
    }
    Linking.openURL(url);
    closeModal();
  };

  const handleScan = async ({ data }: { type: string; data: string }) => {
    if (scanned || processing || !profile?.id) return;
    setScanned(true);
    setProcessing(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const value = data.trim();

    // URL QR (e.g. InBody result link) — handle before UUID check
    if (isWebUrl(value)) {
      setProcessing(false);
      setSelectedClientId('');
      setModalState({ type: 'web-link', url: value, isInBody: isInBodyUrl(value) });
      return;
    }

    // Parse rotating QR format: "userId:timeWindow"
    const parts = value.split(':');
    if (parts.length !== 2) {
      setProcessing(false);
      setModalState({ type: 'error', message: 'Invalid QR format. Ask client to refresh their app.' });
      return;
    }
    const [clientId, windowStr] = parts;
    const qrWindow = parseInt(windowStr, 10);

    if (!isValidUUID(clientId) || isNaN(qrWindow)) {
      setProcessing(false);
      setModalState({ type: 'error', message: 'This QR code is not valid.' });
      return;
    }

    // Reject QRs older than 1 window (~60s tolerance for clock drift)
    const currentWindow = Math.floor(Date.now() / 300000);
    if (Math.abs(currentWindow - qrWindow) > 1) {
      setProcessing(false);
      setModalState({ type: 'error', message: 'QR code has expired. Ask client to show their current QR.' });
      return;
    }

    // Fetch active package for this client under this coach (RLS ensures scope)
    const { data: pkg, error } = await supabase
      .from('packages')
      .select(`
        id,
        sessions_remaining,
        client:profiles!packages_client_id_fkey ( id, name )
      `)
      .eq('client_id', clientId)
      .eq('coach_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !pkg) {
      setProcessing(false);
      setModalState({
        type: 'error',
        message: 'Client not found or not assigned to you.',
      });
      return;
    }

    const client = pkg.client as unknown as { id: string; name: string };
    const remaining = pkg.sessions_remaining as number;

    // 0 sessions — do not deduct
    if (remaining <= 0) {
      setProcessing(false);
      setModalState({
        type: 'no-sessions',
        client: { id: client.id, name: client.name, packageId: pkg.id, sessionsRemaining: 0 },
      });
      return;
    }

    // Log session — trigger auto-increments sessions_used
    const today = new Date().toISOString().split('T')[0];
    const { error: insertError } = await supabase.from('workout_sessions').insert({
      package_id: pkg.id,
      client_id: clientId,
      coach_id: profile.id,
      session_date: today,
      duration_minutes: 60,
      exercises: [],
      notes: 'QR check-in',
    });

    if (insertError) {
      setProcessing(false);
      setModalState({ type: 'error', message: insertError.message });
      return;
    }

    // Mark any pending/confirmed scheduled session for this client today as completed
    await supabase
      .from('scheduled_sessions')
      .update({ status: 'completed' })
      .eq('client_id', clientId)
      .eq('coach_id', profile.id)
      .gte('scheduled_at', `${today}T00:00:00`)
      .lte('scheduled_at', `${today}T23:59:59`)
      .in('status', ['pending', 'client_confirmed']);

    setProcessing(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setModalState({
      type: 'confirm',
      client: {
        id: client.id,
        name: client.name,
        packageId: pkg.id,
        sessionsRemaining: remaining - 1,
      },
      wasLast: remaining === 1,
      scanTime: new Date(),
    });
  };

  // ── Permission not yet determined ───────────────────────────
  if (!permission) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  // ── Permission denied ────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="camera-outline" size={60} color={Colors.border} />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>
          Allow camera access so you can scan client QR codes.
        </Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>ALLOW CAMERA</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.permBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.permBtnText}>OPEN SETTINGS</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── Camera view ──────────────────────────────────────────────
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      <ScanOverlay processing={processing} />

      {/* Labels */}
      <View style={styles.labelTop} pointerEvents="none">
        <Text style={styles.labelTitle}>SCAN CLIENT QR CODE</Text>
        <Text style={styles.labelSub}>Point camera at the client's QR code</Text>
      </View>

      {/* ── MODAL: Confirm (success) ──────────────────────────── */}
      <Modal visible={modalState?.type === 'confirm'} transparent animationType="fade">
        {modalState?.type === 'confirm' && (() => {
          const { client, wasLast, scanTime } = modalState;
          return (
            <View style={styles.modalBg}>
              <View style={styles.modalCard}>
                {/* Header */}
                <View style={[styles.modalHeader, wasLast && styles.modalHeaderWarning]}>
                  <Ionicons
                    name={wasLast ? 'warning-outline' : 'checkmark-circle-outline'}
                    size={28}
                    color={wasLast ? '#FFA500' : Colors.accent}
                  />
                  <Text style={[styles.modalHeaderText, wasLast && { color: '#FFA500' }]}>
                    {wasLast ? 'Last Session Used!' : 'Check-In Successful'}
                  </Text>
                </View>

                {/* Client avatar + name */}
                <View style={styles.clientRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(client.name)}</Text>
                  </View>
                  <View>
                    <Text style={styles.clientName}>{client.name}</Text>
                    <Text style={styles.scanTimeText}>{formatDateTime(scanTime)}</Text>
                  </View>
                </View>

                {/* Sessions remaining */}
                <View style={[styles.sessionsBadge, wasLast && styles.sessionsBadgeWarning]}>
                  <Text style={[styles.sessionsCount, wasLast && { color: '#FFA500' }]}>
                    {client.sessionsRemaining}
                  </Text>
                  <Text style={[styles.sessionsLabel, wasLast && { color: '#FFA500' }]}>
                    {client.sessionsRemaining === 1 ? 'SESSION' : 'SESSIONS'} REMAINING
                  </Text>
                </View>

                {wasLast && (
                  <Text style={styles.renewalNote}>
                    This client needs to renew their package.
                  </Text>
                )}

                {/* Actions */}
                <View style={styles.modalBtns}>
                  {wasLast && (
                    <Pressable
                      style={styles.secondaryModalBtn}
                      onPress={() => {
                        closeModal();
                        router.push(`/(coach)/client/${client.id}`);
                      }}
                    >
                      <Text style={styles.secondaryModalBtnText}>View Client</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.primaryModalBtn} onPress={closeModal}>
                    <Text style={styles.primaryModalBtnText}>
                      {wasLast ? 'GOT IT' : 'SCAN NEXT'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* ── MODAL: No sessions ───────────────────────────────── */}
      <Modal visible={modalState?.type === 'no-sessions'} transparent animationType="fade">
        {modalState?.type === 'no-sessions' && (
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, styles.modalHeaderDanger]}>
                <Ionicons name="close-circle-outline" size={28} color={Colors.danger} />
                <Text style={[styles.modalHeaderText, { color: Colors.danger }]}>
                  No Sessions Remaining
                </Text>
              </View>

              <View style={styles.clientRow}>
                <View style={[styles.avatar, styles.avatarDanger]}>
                  <Text style={[styles.avatarText, { color: Colors.danger }]}>
                    {initials(modalState.client.name)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.clientName}>{modalState.client.name}</Text>
                  <Text style={styles.scanTimeText}>0 sessions left</Text>
                </View>
              </View>

              <Text style={styles.errorNote}>
                This client's package is exhausted. No session was deducted.{'\n'}Please ask them to renew.
              </Text>

              <View style={styles.modalBtns}>
                <Pressable
                  style={styles.secondaryModalBtn}
                  onPress={() => {
                    closeModal();
                    router.push(`/(coach)/client/${modalState.client.id}`);
                  }}
                >
                  <Text style={styles.secondaryModalBtnText}>View Client</Text>
                </Pressable>
                <Pressable style={[styles.primaryModalBtn, { backgroundColor: Colors.danger }]} onPress={closeModal}>
                  <Text style={styles.primaryModalBtnText}>CLOSE</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* ── MODAL: Error ──────────────────────────────────────── */}
      <Modal visible={modalState?.type === 'error'} transparent animationType="fade">
        {modalState?.type === 'error' && (
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, styles.modalHeaderDanger]}>
                <Ionicons name="alert-circle-outline" size={28} color={Colors.danger} />
                <Text style={[styles.modalHeaderText, { color: Colors.danger }]}>
                  Invalid QR Code
                </Text>
              </View>

              <Text style={styles.errorNote}>{modalState.message}</Text>

              <View style={styles.modalBtns}>
                <Pressable style={[styles.primaryModalBtn, { backgroundColor: Colors.danger }]} onPress={closeModal}>
                  <Text style={styles.primaryModalBtnText}>TRY AGAIN</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* ── MODAL: Web / InBody link ──────────────────────────── */}
      <Modal visible={modalState?.type === 'web-link'} transparent animationType="fade">
        {modalState?.type === 'web-link' && (() => {
          const { url, isInBody } = modalState;
          const accentColor = '#4CAF50';
          return (
            <View style={styles.modalBg}>
              <View style={styles.modalCard}>
                {/* Header */}
                <View style={[styles.modalHeader, { backgroundColor: accentColor + '12' }]}>
                  <Ionicons name="link-outline" size={28} color={accentColor} />
                  <Text style={[styles.modalHeaderText, { color: accentColor }]}>
                    {isInBody ? 'InBody Result Detected' : 'Web Link Detected'}
                  </Text>
                </View>

                {/* URL preview */}
                <View style={styles.urlRow}>
                  <Text style={styles.urlText} numberOfLines={2}>{url}</Text>
                </View>

                {/* Client picker */}
                <View style={styles.pickerSection}>
                  <Text style={styles.pickerLabel}>SAVE TO CLIENT</Text>
                  <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                    {clients.map((c) => {
                      const sel = selectedClientId === c.id;
                      const ini = c.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.cpRow, sel && { backgroundColor: accentColor + '12', borderColor: accentColor + '50' }]}
                          onPress={() => setSelectedClientId(c.id)}
                        >
                          <View style={[styles.cpAvatar, sel && { backgroundColor: accentColor + '20', borderColor: accentColor }]}>
                            <Text style={[styles.cpAvatarText, sel && { color: accentColor }]}>{ini}</Text>
                          </View>
                          <Text style={[styles.cpName, sel && { color: accentColor }]}>{c.name}</Text>
                          {sel && <Ionicons name="checkmark-circle" size={18} color={accentColor} />}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Action buttons */}
                <View style={styles.modalBtns}>
                  <Pressable style={styles.secondaryModalBtn} onPress={() => { Linking.openURL(url); closeModal(); }}>
                    <Text style={styles.secondaryModalBtnText}>Open Only</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryModalBtn, { backgroundColor: accentColor }, (!selectedClientId || savingLink) && { opacity: 0.4 }]}
                    disabled={!selectedClientId || savingLink}
                    onPress={() => handleSaveLink(url)}
                  >
                    <Text style={styles.primaryModalBtnText}>
                      {savingLink ? 'SAVING…' : 'SAVE & OPEN'}
                    </Text>
                  </Pressable>
                </View>

                <Pressable style={{ paddingBottom: 16, alignItems: 'center' }} onPress={closeModal}>
                  <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.65)';

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  centerScreen: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },

  // Permission screen
  permTitle: { ...Typography.subtitle, color: Colors.textPrimary, textAlign: 'center', marginTop: 8 },
  permSub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  permBtnText: { color: Colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },

  // Scan overlay
  overlayTop: { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayMiddle: { flexDirection: 'row', height: SCAN_SIZE },
  overlaySide: { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayBottom: { flex: 1.4, backgroundColor: OVERLAY_COLOR },
  scanWindow: { width: SCAN_SIZE, height: SCAN_SIZE },

  // Corner brackets
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: Colors.accent,
    borderWidth: CORNER_WIDTH,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Labels on camera
  labelTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: OVERLAY_COLOR,
  },
  labelTitle: {
    ...Typography.label,
    color: Colors.accent,
    letterSpacing: 2,
    marginBottom: 6,
  },
  labelSub: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },

  // Modal
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 18,
    backgroundColor: Colors.accent + '12',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderWarning: { backgroundColor: '#FFA50012' },
  modalHeaderDanger: { backgroundColor: Colors.danger + '12' },
  modalHeaderText: { ...Typography.subtitle, color: Colors.accent },

  // Client row
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent + '18',
    borderWidth: 2,
    borderColor: Colors.accent + '50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDanger: {
    backgroundColor: Colors.danger + '18',
    borderColor: Colors.danger + '50',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: Colors.accent },
  clientName: { ...Typography.subtitle, color: Colors.textPrimary, marginBottom: 2 },
  scanTimeText: { ...Typography.caption, color: Colors.textSecondary },

  // Sessions badge
  sessionsBadge: {
    margin: 18,
    alignItems: 'center',
    backgroundColor: Colors.accent + '10',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
    paddingVertical: 16,
  },
  sessionsBadgeWarning: {
    backgroundColor: '#FFA50010',
    borderColor: '#FFA50030',
  },
  sessionsCount: {
    fontSize: 52,
    fontWeight: '800',
    color: Colors.accent,
    lineHeight: 58,
  },
  sessionsLabel: {
    ...Typography.label,
    color: Colors.accent,
    letterSpacing: 1.5,
  },

  renewalNote: {
    ...Typography.caption,
    color: '#FFA500',
    textAlign: 'center',
    paddingHorizontal: 18,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  errorNote: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    padding: 18,
    lineHeight: 22,
  },

  // Modal buttons
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    padding: 18,
    paddingTop: 8,
  },
  primaryModalBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryModalBtnText: { color: Colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  secondaryModalBtn: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryModalBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },

  // Web-link / InBody modal
  urlRow: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: Colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  urlText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  pickerSection: {
    marginHorizontal: 16,
    marginBottom: 4,
  },
  pickerLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  pickerList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
  cpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 0,
  },
  cpAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cpAvatarText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  cpName: { flex: 1, ...Typography.body, color: Colors.textPrimary },
});
