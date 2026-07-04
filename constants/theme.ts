import { rf } from './responsive';

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
  hero:     { fontSize: rf(34), fontFamily: 'Montserrat_800ExtraBold', letterSpacing: -0.5 },
  title:    { fontSize: rf(22), fontFamily: 'Montserrat_700Bold' },
  heading:  { fontSize: rf(18), fontFamily: 'Montserrat_700Bold' },
  subtitle: { fontSize: rf(16), fontFamily: 'Montserrat_600SemiBold' },
  body:     { fontSize: rf(15), fontFamily: 'Inter_400Regular' },
  bodyMed:  { fontSize: rf(15), fontFamily: 'Inter_500Medium' },
  caption:  { fontSize: rf(13), fontFamily: 'Inter_400Regular' },
  label:    { fontSize: rf(11), fontFamily: 'Montserrat_600SemiBold', letterSpacing: 1.2 },
} as const;
