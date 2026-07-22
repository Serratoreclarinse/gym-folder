import { useCallback, useMemo, useRef, useState } from 'react';
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
import { sendPushNotification } from '@/lib/pushNotifications';
import { ColorScheme, Typography } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const SCAN_SIZE = 260;
const CORNER_SIZE = 30;
const CORNER_WIDTH = 3;
const DEFAULT_DURATION = 60;

type ClientInfo = {
  id: string;
  name: string;
  packageId: string;
};

type ModalState =
  | { type: 'session-started'; clientName: string; duration: number }
  | { type: 'walkin'; client: ClientInfo; sessionsRemaining: number }
  | { type: 'already-active' }
  | { type: 'already-had-session'; clientName: string }
  | { type: 'error'; message: string }
  | { type: 'not-assigned' }
  | { type: 'no-sessions'; client: { id: string; name: string } }
  | { type: 'web-link'; url: string; isInBody: boolean }
  | { type: 'too-early'; clientName: string; scheduledTime: string; minutesUntil: number }
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

// ── Corner bracket overlay ────────────────────────────────────
function ScanOverlay({ processing, styles, accentColor }: { processing: boolean; styles: ReturnType<typeof makeStyles>; accentColor: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.overlayTop} />
      <View style={styles.overlayMiddle}>
        <View style={styles.overlaySide} />
        <View style={styles.scanWindow}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          {processing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={accentColor} />
            </View>
          )}
        </View>
        <View style={styles.overlaySide} />
      </View>
      <View style={styles.overlayBottom} />
    </View>
  );
}

export default function QRScannerScreen() {
  const { profile } = useAuth();
  const { clients } = useClients();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [startingWalkin, setStartingWalkin] = useState(false);
  // Sync ref prevents duplicate scans before state re-render
  const handlingRef = useRef(false);

  // Reset scanner every time this tab comes into focus
  useFocusEffect(useCallback(() => {
    handlingRef.current = false;
    setScanned(false);
    setProcessing(false);
    setModalState(null);
  }, []));

  const closeModal = () => {
    handlingRef.current = false;
    setModalState(null);
    setScanned(false);
    setProcessing(false);
    setSelectedClientId('');
  };

  const goToDashboard = () => {
    closeModal();
    router.push('/(coach)');
  };

  // ── Create workout_sessions + active_sessions rows ────────────
  const startActiveSession = async (
    clientId: string,
    packageId: string,
    duration: number,
    notes: string | null,
  ): Promise<{ error: string | null }> => {
    const today = new Date().toISOString().split('T')[0];

    // Check for a pre-planned session from schedule-session
    const { data: planned } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('coach_id', profile!.id)
      .eq('client_id', clientId)
      .eq('session_date', today)
      .eq('status', 'planned')
      .maybeSingle();

    let sessionId: string;

    if (planned) {
      // Activate the pre-planned session
      await supabase.from('workout_sessions').update({
        package_id: packageId,
        duration_minutes: duration,
        status: 'confirmed',
        ...(notes ? { notes } : {}),
      }).eq('id', planned.id);
      sessionId = planned.id;
    } else {
      // No pre-plan — create a new empty session
      const { data: sessionData, error: sessionErr } = await supabase
        .from('workout_sessions')
        .insert({
          coach_id: profile!.id,
          client_id: clientId,
          package_id: packageId,
          session_date: today,
          duration_minutes: duration,
          exercises: [],
          notes,
        })
        .select('id')
        .single();

      if (sessionErr || !sessionData) {
        return { error: sessionErr?.message ?? 'Failed to create session.' };
      }
      sessionId = sessionData.id;
    }

    const { error: activeErr } = await supabase.from('active_sessions').insert({
      coach_id: profile!.id,
      client_id: clientId,
      session_id: sessionId,
      start_time: new Date().toISOString(),
      original_duration: duration,
      current_duration: duration,
      is_active: true,
      is_paused: false,
    });

    if (activeErr) {
      // Roll back only if we created a new (empty) session
      if (!planned) {
        await supabase.from('workout_sessions').delete().eq('id', sessionId);
      }
      return { error: activeErr.message };
    }

    return { error: null };
  };

  // ── Walk-in confirmation ──────────────────────────────────────
  const handleConfirmWalkin = async () => {
    if (modalState?.type !== 'walkin') return;
    const { client } = modalState;

    setStartingWalkin(true);
    const { error } = await startActiveSession(client.id, client.packageId, DEFAULT_DURATION, null);
    setStartingWalkin(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    await sendPushNotification(client.id, {
      title: '🏃 Session Started!',
      body: "Your walk-in session has begun. Let's go!",
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalState({ type: 'session-started', clientName: client.name, duration: DEFAULT_DURATION });
  };

  // ── Save InBody link ──────────────────────────────────────────
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

  // ── Main scan handler ─────────────────────────────────────────
  const handleScan = async ({ data }: { type: string; data: string }) => {
    if (handlingRef.current || !profile?.id) return;
    handlingRef.current = true;
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

    // Fetch active package for this client under this coach
    const { data: pkg, error: pkgErr } = await supabase
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

    if (pkgErr) {
      setProcessing(false);
      setModalState({ type: 'error', message: pkgErr.message });
      return;
    }

    if (!pkg) {
      setProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setModalState({ type: 'not-assigned' });
      return;
    }

    const client = pkg.client as unknown as { id: string; name: string };
    const remaining = pkg.sessions_remaining as number;

    if (remaining <= 0) {
      setProcessing(false);
      setModalState({ type: 'no-sessions', client: { id: client.id, name: client.name } });
      return;
    }

    // Prevent starting a second session while one is already live
    const { data: existingActive } = await supabase
      .from('active_sessions')
      .select('id')
      .eq('coach_id', profile.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existingActive) {
      setProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setModalState({ type: 'already-active' });
      return;
    }

    // Prevent logging a second session for the same client on the same day
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    const { data: sessionToday } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('client_id', clientId)
      .eq('session_date', todayISO)
      .neq('status', 'absent')
      .limit(1)
      .maybeSingle();

    if (sessionToday) {
      setProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setModalState({ type: 'already-had-session', clientName: (pkg.client as any)?.name ?? 'Client' });
      return;
    }

    // Look for today's scheduled session for this client
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const { data: scheduled } = await supabase
      .from('scheduled_sessions')
      .select('id, scheduled_at, duration_minutes, notes')
      .eq('client_id', clientId)
      .eq('coach_id', profile.id)
      .gte('scheduled_at', todayStart)
      .lte('scheduled_at', todayEnd)
      .in('status', ['pending', 'client_confirmed'])
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!scheduled) {
      // No scheduled session today — ask coach to confirm walk-in
      setProcessing(false);
      setModalState({
        type: 'walkin',
        client: { id: client.id, name: client.name, packageId: pkg.id },
        sessionsRemaining: remaining,
      });
      return;
    }

    // Block scan if more than 30 minutes before scheduled time
    const scheduledAt = new Date(scheduled.scheduled_at);
    const minutesUntil = (scheduledAt.getTime() - now.getTime()) / 60000;
    if (minutesUntil > 30) {
      setProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const scheduledTime = scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      setModalState({ type: 'too-early', clientName: client.name, scheduledTime, minutesUntil: Math.round(minutesUntil) });
      return;
    }

    // Scheduled session found — start the active timer automatically
    const duration = scheduled.duration_minutes ?? DEFAULT_DURATION;
    const notes = (scheduled.notes as string | null) ?? null;

    const { error: startErr } = await startActiveSession(client.id, pkg.id, duration, notes);

    if (startErr) {
      setProcessing(false);
      setModalState({ type: 'error', message: startErr });
      return;
    }

    // Mark scheduled session as confirmed (client arrived)
    await supabase
      .from('scheduled_sessions')
      .update({ status: 'client_confirmed', client_confirmed_at: now.toISOString() })
      .eq('id', scheduled.id);

    await sendPushNotification(client.id, {
      title: '🏃 Session Started!',
      body: `Your session with Coach ${profile.name ?? 'your coach'} has begun. Let's go!`,
    });

    setProcessing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setModalState({ type: 'session-started', clientName: client.name, duration });
  };

  // ── Permission not yet determined ─────────────────────────────
  if (!permission) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ── Permission denied ─────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="camera-outline" size={60} color={colors.border} />
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

  // ── Camera view ───────────────────────────────────────────────
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      <ScanOverlay processing={processing} styles={styles} accentColor={colors.accent} />

      {/* Labels */}
      <View style={styles.labelTop} pointerEvents="none">
        <Text style={styles.labelTitle}>SCAN CLIENT QR CODE</Text>
        <Text style={styles.labelSub}>Point camera at the client's QR code</Text>
      </View>

      {/* ── MODAL: Session started (scheduled) ───────────────── */}
      <Modal visible={modalState?.type === 'session-started'} transparent animationType="fade">
        {modalState?.type === 'session-started' && (
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Ionicons name="play-circle-outline" size={28} color={colors.accent} />
                <Text style={styles.modalHeaderText}>SESSION STARTED</Text>
              </View>

              <View style={styles.clientRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(modalState.clientName)}</Text>
                </View>
                <View>
                  <Text style={styles.clientName}>{modalState.clientName}</Text>
                  <Text style={styles.scanTimeText}>
                    Timer running · {modalState.duration} min
                  </Text>
                </View>
              </View>

              <Text style={styles.infoNote}>
                The session timer is now running. Head to the dashboard to manage the workout.
              </Text>

              <View style={styles.modalBtns}>
                <Pressable style={styles.secondaryModalBtn} onPress={closeModal}>
                  <Text style={styles.secondaryModalBtnText}>Stay Here</Text>
                </Pressable>
                <Pressable style={styles.primaryModalBtn} onPress={goToDashboard}>
                  <Text style={styles.primaryModalBtnText}>OPEN SESSION</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* ── MODAL: Walk-in (no scheduled session today) ───────── */}
      <Modal visible={modalState?.type === 'walkin'} transparent animationType="fade">
        {modalState?.type === 'walkin' && (
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, styles.modalHeaderWarning]}>
                <Ionicons name="walk-outline" size={28} color={colors.warning} />
                <Text style={[styles.modalHeaderText, { color: colors.warning }]}>
                  Walk-In Detected
                </Text>
              </View>

              <View style={styles.clientRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(modalState.client.name)}</Text>
                </View>
                <View>
                  <Text style={styles.clientName}>{modalState.client.name}</Text>
                  <Text style={styles.scanTimeText}>
                    {modalState.sessionsRemaining} session{modalState.sessionsRemaining !== 1 ? 's' : ''} remaining
                  </Text>
                </View>
              </View>

              <Text style={styles.infoNote}>
                No session is scheduled for today. Start a {DEFAULT_DURATION}-minute walk-in session?
              </Text>

              <View style={styles.modalBtns}>
                <Pressable style={styles.secondaryModalBtn} onPress={closeModal}>
                  <Text style={styles.secondaryModalBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryModalBtn, startingWalkin && { opacity: 0.5 }]}
                  disabled={startingWalkin}
                  onPress={handleConfirmWalkin}
                >
                  <Text style={styles.primaryModalBtnText}>
                    {startingWalkin ? 'STARTING…' : 'START SESSION'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* ── MODAL: Already active session ─────────────────────── */}
      <Modal visible={modalState?.type === 'already-active'} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, styles.modalHeaderWarning]}>
              <Ionicons name="timer-outline" size={28} color={colors.warning} />
              <Text style={[styles.modalHeaderText, { color: colors.warning }]}>
                Session Already Running
              </Text>
            </View>
            <Text style={styles.infoNote}>
              You already have an active session in progress. End or cancel it first before starting a new one.
            </Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.secondaryModalBtn} onPress={closeModal}>
                <Text style={styles.secondaryModalBtnText}>Stay Here</Text>
              </Pressable>
              <Pressable style={styles.primaryModalBtn} onPress={goToDashboard}>
                <Text style={styles.primaryModalBtnText}>VIEW SESSION</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Client already had session today ───────────── */}
      <Modal visible={modalState?.type === 'already-had-session'} transparent animationType="fade">
        {modalState?.type === 'already-had-session' && (
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, styles.modalHeaderWarning]}>
                <Ionicons name="ban-outline" size={28} color={colors.warning} />
                <Text style={[styles.modalHeaderText, { color: colors.warning }]}>
                  Session Already Done
                </Text>
              </View>
              <Text style={styles.infoNote}>
                {modalState.clientName} already has a session logged for today. Only 1 session per client per day is allowed.
              </Text>
              <View style={styles.modalBtns}>
                <Pressable style={styles.primaryModalBtn} onPress={closeModal}>
                  <Text style={styles.primaryModalBtnText}>OK</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* ── MODAL: No sessions remaining ──────────────────────── */}
      <Modal visible={modalState?.type === 'no-sessions'} transparent animationType="fade">
        {modalState?.type === 'no-sessions' && (
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, styles.modalHeaderDanger]}>
                <Ionicons name="close-circle-outline" size={28} color={colors.danger} />
                <Text style={[styles.modalHeaderText, { color: colors.danger }]}>
                  No Sessions Remaining
                </Text>
              </View>

              <View style={styles.clientRow}>
                <View style={[styles.avatar, styles.avatarDanger]}>
                  <Text style={[styles.avatarText, { color: colors.danger }]}>
                    {initials(modalState.client.name)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.clientName}>{modalState.client.name}</Text>
                  <Text style={styles.scanTimeText}>0 sessions left</Text>
                </View>
              </View>

              <Text style={styles.infoNote}>
                This client's package is exhausted. No session was deducted.{'\n'}Please ask them to renew.
              </Text>

              <View style={styles.modalBtns}>
                <Pressable
                  style={styles.secondaryModalBtn}
                  onPress={() => {
                    const id = modalState.client.id;
                    closeModal();
                    router.push(`/(coach)/client/${id}`);
                  }}
                >
                  <Text style={styles.secondaryModalBtnText}>View Client</Text>
                </Pressable>
                <Pressable style={[styles.primaryModalBtn, { backgroundColor: colors.danger }]} onPress={closeModal}>
                  <Text style={styles.primaryModalBtnText}>CLOSE</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* ── MODAL: Too early to scan ─────────────────────────────── */}
      <Modal visible={modalState?.type === 'too-early'} transparent animationType="fade">
        {modalState?.type === 'too-early' && (
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, styles.modalHeaderWarning]}>
                <Ionicons name="time-outline" size={28} color={colors.warning} />
                <Text style={[styles.modalHeaderText, { color: colors.warning }]}>
                  Too Early
                </Text>
              </View>
              <Text style={styles.infoNote}>
                {modalState.clientName}'s session is scheduled at {modalState.scheduledTime}.{'\n\n'}
                QR scan is only allowed 30 minutes before the session starts.{'\n\n'}
                Please try again in {modalState.minutesUntil - 30} min.
              </Text>
              <View style={styles.modalBtns}>
                <Pressable
                  style={[styles.primaryModalBtn, { backgroundColor: colors.warning }]}
                  onPress={closeModal}
                >
                  <Text style={styles.primaryModalBtnText}>OK</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* ── MODAL: Not assigned ────────────────────────────────── */}
      <Modal visible={modalState?.type === 'not-assigned'} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, styles.modalHeaderDanger]}>
              <Ionicons name="person-remove-outline" size={28} color={colors.danger} />
              <Text style={[styles.modalHeaderText, { color: colors.danger }]}>
                Not Your Client
              </Text>
            </View>
            <Text style={styles.infoNote}>
              This client is not assigned to you.{'\n\n'}
              They may be registered under a different coach.
            </Text>
            <View style={styles.modalBtns}>
              <Pressable
                style={[styles.primaryModalBtn, { backgroundColor: colors.danger }]}
                onPress={closeModal}
              >
                <Text style={styles.primaryModalBtnText}>TRY AGAIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Error ───────────────────────────────────────── */}
      <Modal visible={modalState?.type === 'error'} transparent animationType="fade">
        {modalState?.type === 'error' && (
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, styles.modalHeaderDanger]}>
                <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
                <Text style={[styles.modalHeaderText, { color: colors.danger }]}>
                  Invalid QR Code
                </Text>
              </View>

              <Text style={styles.infoNote}>{modalState.message}</Text>

              <View style={styles.modalBtns}>
                <Pressable style={[styles.primaryModalBtn, { backgroundColor: colors.danger }]} onPress={closeModal}>
                  <Text style={styles.primaryModalBtnText}>TRY AGAIN</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* ── MODAL: Web / InBody link ───────────────────────────── */}
      <Modal visible={modalState?.type === 'web-link'} transparent animationType="fade">
        {modalState?.type === 'web-link' && (() => {
          const { url, isInBody } = modalState;
          const accentColor = colors.success;
          return (
            <View style={styles.modalBg}>
              <View style={styles.modalCard}>
                <View style={[styles.modalHeader, { backgroundColor: accentColor + '12' }]}>
                  <Ionicons name="link-outline" size={28} color={accentColor} />
                  <Text style={[styles.modalHeaderText, { color: accentColor }]}>
                    {isInBody ? 'InBody Result Detected' : 'Web Link Detected'}
                  </Text>
                </View>

                <View style={styles.urlRow}>
                  <Text style={styles.urlText} numberOfLines={2}>{url}</Text>
                </View>

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
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Cancel</Text>
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

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    cameraContainer: { flex: 1, backgroundColor: '#000' },
    centerScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 14,
      backgroundColor: c.bg,
    },

    // Permission screen
    permTitle: { ...Typography.subtitle, color: c.textPrimary, textAlign: 'center', marginTop: 8 },
    permSub: { ...Typography.body, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
    permBtn: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 32,
      marginTop: 8,
    },
    permBtnText: { color: c.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },

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
      borderColor: c.accent,
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
      color: c.accent,
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
      backgroundColor: c.surface,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 18,
      backgroundColor: c.accent + '12',
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalHeaderWarning: { backgroundColor: c.warning + '12' },
    modalHeaderDanger: { backgroundColor: c.danger + '12' },
    modalHeaderText: { ...Typography.subtitle, color: c.accent },

    // Client row
    clientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.accent + '18',
      borderWidth: 2,
      borderColor: c.accent + '50',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarDanger: {
      backgroundColor: c.danger + '18',
      borderColor: c.danger + '50',
    },
    avatarText: { fontSize: 18, fontWeight: '800', color: c.accent },
    clientName: { ...Typography.subtitle, color: c.textPrimary, marginBottom: 2 },
    scanTimeText: { ...Typography.caption, color: c.textSecondary },

    infoNote: {
      ...Typography.body,
      color: c.textSecondary,
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
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryModalBtnText: { color: c.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
    secondaryModalBtn: {
      flex: 1,
      backgroundColor: c.bg,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    secondaryModalBtnText: { color: c.textPrimary, fontSize: 13, fontWeight: '600' },

    // Web-link / InBody modal
    urlRow: {
      margin: 16,
      marginBottom: 8,
      backgroundColor: c.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
    },
    urlText: {
      ...Typography.caption,
      color: c.textSecondary,
      fontFamily: 'monospace',
    },
    pickerSection: {
      marginHorizontal: 16,
      marginBottom: 4,
    },
    pickerLabel: {
      ...Typography.label,
      color: c.textSecondary,
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    pickerList: {
      maxHeight: 220,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
    },
    cpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: 0,
    },
    cpAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cpAvatarText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
    cpName: { flex: 1, ...Typography.body, color: c.textPrimary },
    cpSelected: { color: c.success },
  });
}
