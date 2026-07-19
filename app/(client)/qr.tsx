import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/theme';

export default function ClientQRScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [timeWindow, setTimeWindow] = useState(() => Math.floor(Date.now() / 300_000));
  const [secondsLeft, setSecondsLeft] = useState(() => 300 - Math.floor((Date.now() % 300_000) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setTimeWindow(Math.floor(now / 300_000));
      setSecondsLeft(300 - Math.floor((now % 300_000) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!profile?.id) return null;

  const qrValue = `${profile.id}:${timeWindow}`;
  const [firstName] = (profile.name ?? '').split(' ');

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <View style={s.top}>
        <Text style={[s.greeting, { color: colors.textSecondary }]}>Hello,</Text>
        <Text style={[s.name, { color: colors.textPrimary }]}>{profile.name ?? 'Member'}</Text>
      </View>

      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.qrWrap}>
          <QRCode value={qrValue} size={210} color="#000" backgroundColor="#fff" />
        </View>
        <Text style={[s.instruction, { color: colors.textSecondary }]}>
          Show this QR code to your coach
        </Text>
        <View style={[s.hint, { backgroundColor: colors.accent + '12', borderColor: colors.accent + '30' }]}>
          <Text style={[s.hintText, { color: colors.accent }]}>
            Refreshes in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32 },

  top: { width: '100%', marginBottom: 32 },
  greeting: { ...Typography.caption, fontSize: 14, letterSpacing: 0.5 },
  name: { ...Typography.title, fontSize: 26, fontWeight: '800', marginTop: 2 },

  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  qrWrap: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  instruction: { ...Typography.body, textAlign: 'center', fontSize: 14 },
  hint: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hintText: { ...Typography.caption, fontWeight: '600', fontSize: 12 },
});
