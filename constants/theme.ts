import { rf } from './responsive';

export type ColorScheme = {
  accent: string;
  accentDim: string;
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  danger: string;
};

export const darkColors: ColorScheme = {
  accent: '#E8001D',
  accentDim: '#E8001D22',
  bg: '#0A0A0A',
  surface: '#141414',
  surfaceRaised: '#1C1C1C',
  border: '#2A2A2A',
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  danger: '#FF4D4D',
};

export const lightColors: ColorScheme = {
  accent: '#E8001D',
  accentDim: '#E8001D18',
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceRaised: '#F8F8F8',
  border: '#E0E0E0',
  textPrimary: '#0A0A0A',
  textSecondary: '#666666',
  danger: '#D32F2F',
};

// Static fallback — screens not yet migrated to useTheme() will keep using this (always dark)
export const Colors = darkColors;

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
