export const Colors = {
  accent: '#E8001D',
  accentDim: '#E8001D22',
  bg: '#0A0A0A',
  surface: '#141414',
  surfaceRaised: '#1C1C1C',
  border: '#2A2A2A',
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  danger: '#FF4D4D',
} as const;

export const Typography = {
  hero: { fontSize: 36, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' as const },
  subtitle: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.8 },
} as const;
