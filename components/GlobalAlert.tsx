import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/theme';
import type { ColorScheme } from '@/constants/theme';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertConfig = {
  title: string;
  message?: string;
  buttons: AlertButton[];
};

// Module-level setter — imperative bridge
let _show: ((cfg: AlertConfig) => void) | null = null;

export function _registerGlobalAlert(fn: (cfg: AlertConfig) => void) {
  _show = fn;
}

// Drop-in for Alert.alert — also used to monkey-patch below
export function showAppAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
) {
  const btns: AlertButton[] = buttons?.length ? buttons : [{ text: 'OK' }];
  _show?.({ title, message, buttons: btns });
}

// ── Component ────────────────────────────────────────────────
export function GlobalAlert() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [cfg, setCfg] = useState<AlertConfig | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    _registerGlobalAlert(setCfg);
  }, []);

  useEffect(() => {
    if (cfg) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [cfg]);

  const dismiss = (onPress?: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setCfg(null);
      onPress?.();
    });
  };

  if (!cfg) return null;

  const cancelBtn  = cfg.buttons.find((b) => b.style === 'cancel');
  const otherBtns  = cfg.buttons.filter((b) => b.style !== 'cancel');
  const orderedBtns = [...otherBtns, ...(cancelBtn ? [cancelBtn] : [])];

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[
          styles.card,
          {
            transform: [{
              scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }),
            }],
          },
        ]}>
          <Text style={styles.title}>{cfg.title}</Text>
          {cfg.message ? <Text style={styles.message}>{cfg.message}</Text> : null}

          <View style={[
            styles.btnRow,
            orderedBtns.length > 2 && styles.btnCol,
          ]}>
            {orderedBtns.map((btn, i) => {
              const isCancel      = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.btn,
                    orderedBtns.length <= 2 && styles.btnFlex,
                    orderedBtns.length > 2  && styles.btnFull,
                    isCancel      && styles.btnCancel,
                    isDestructive && styles.btnDestructive,
                    !isCancel && !isDestructive && styles.btnDefault,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => dismiss(btn.onPress)}
                >
                  <Text style={[
                    styles.btnText,
                    isCancel      && styles.btnTextCancel,
                    isDestructive && styles.btnTextDestructive,
                  ]}>
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    card: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      paddingTop: 28,
      paddingHorizontal: 24,
      paddingBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 12,
    },
    title: {
      fontFamily: 'Montserrat_800ExtraBold',
      fontSize: 16,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: 10,
    },
    message: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    btnRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    btnCol: {
      flexDirection: 'column',
      gap: 8,
    },
    btn: {
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnFlex: { flex: 1 },
    btnFull: { width: '100%' },
    btnDefault: {
      backgroundColor: c.accent,
    },
    btnCancel: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: c.border,
    },
    btnDestructive: {
      backgroundColor: c.danger,
    },
    btnText: {
      fontFamily: 'Montserrat_700Bold',
      fontSize: 13,
      color: c.bg,
      letterSpacing: 0.5,
    },
    btnTextCancel: {
      fontFamily: 'Inter_500Medium',
      color: c.textSecondary,
    },
    btnTextDestructive: {
      fontFamily: 'Montserrat_700Bold',
      color: '#fff',
    },
  });
}
