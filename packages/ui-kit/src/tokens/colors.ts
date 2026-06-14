export const colors = {
  // Brand
  primary: '#FF6B00',       // TruckOrange — primary CTAs
  primaryDark: '#CC5500',
  primaryLight: '#FF8C33',

  secondary: '#1A1A2E',     // Deep Navy — headings, nav
  secondaryLight: '#16213E',

  accent: '#00D4AA',        // Teal — success, confirmed
  accentDark: '#00A884',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // SLA / tracking
  slaOnTime: '#22C55E',
  slaAtRisk: '#F59E0B',
  slaDelayed: '#EF4444',

  // Grays
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F9FAFB',
  bgCard: '#FFFFFF',
  bgOverlay: 'rgba(0,0,0,0.5)',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textInverse: '#FFFFFF',
  textDisabled: '#9CA3AF',

  // Cargo type badges
  cargoGeneral: '#3B82F6',
  cargoFragile: '#8B5CF6',
  cargoHazmat: '#EF4444',
  cargoTemp: '#06B6D4',
  cargoLiquid: '#0EA5E9',
  cargoOversized: '#F97316',

  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof colors;
