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
  dangerDim: string;
  warning: string;
  warningDim: string;
  success: string;
  successDim: string;
  overlay: string;
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
  dangerDim: '#FF4D4D22',
  warning: '#FF9800',
  warningDim: '#FF980025',
  success: '#4CAF50',
  successDim: '#4CAF5025',
  overlay: 'rgba(0,0,0,0.72)',
};

export const lightColors: ColorScheme = {
  accent: '#C8001A',
  accentDim: '#C8001A18',
  bg: '#EAEAEF',
  surface: '#F8F8FC',
  surfaceRaised: '#FFFFFF',
  border: '#D4D4DC',
  textPrimary: '#111111',
  textSecondary: '#5A5A6E',
  danger: '#C62828',
  dangerDim: '#C8282822',
  warning: '#E65100',
  warningDim: '#E6510020',
  success: '#2E7D32',
  successDim: '#2E7D3220',
  overlay: 'rgba(0,0,0,0.55)',
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
