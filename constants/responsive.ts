import { Dimensions, PixelRatio } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// Base design width — mid-range Android (390dp)
const BASE_W = 390;
const scale = W / BASE_W;

/** Scale a layout value (padding, margin, radius, icon size) */
export const rs = (size: number): number => Math.round(size * scale);

/** Scale a font size — slightly less aggressive so text doesn't blow up on tablets */
export const rf = (size: number): number =>
  Math.round(size * Math.min(scale, 1.18) * (1 / PixelRatio.getFontScale()));

/** Horizontal screen padding — 5% of width, clamped between 16 and 24 */
export const HP = Math.round(Math.min(Math.max(W * 0.05, 16), 24));

/** Screen dimensions */
export const SW = W;
export const SH = H;
