export type LandingThemePreset = 'ledger' | 'coast' | 'terracotta';

export type LandingThemeDefinition = {
  preset: LandingThemePreset;
  label: string;
  description: string;
  surface: string;
  panel: string;
  card: string;
  glow: string;
  accent: string;
  accentSoft: string;
  ink: string;
  muted: string;
  chipBg: string;
  chipText: string;
  border: string;
  buttonText: string;
};

export const LANDING_THEME_PRESETS: Record<LandingThemePreset, LandingThemeDefinition> = {
  ledger: {
    preset: 'ledger',
    label: 'Ivory Ledger',
    description: 'Calm premium neutrals for restaurants, salons, and trusted service brands.',
    surface: '#fffaf0',
    panel: '#fffdf8',
    card: '#f7efe4',
    glow: 'rgba(189, 168, 120, 0.24)',
    accent: '#1f2937',
    accentSoft: '#d9c7a3',
    ink: '#1f2937',
    muted: '#5f5a52',
    chipBg: 'rgba(31, 41, 55, 0.08)',
    chipText: '#1f2937',
    border: 'rgba(31, 41, 55, 0.12)',
    buttonText: '#fffaf0',
  },
  coast: {
    preset: 'coast',
    label: 'Coastal Mint',
    description: 'Fresh hospitality energy with brighter surfaces and a breezy dining feel.',
    surface: '#f6fffb',
    panel: '#ffffff',
    card: '#e6f7f0',
    glow: 'rgba(58, 180, 133, 0.22)',
    accent: '#0f766e',
    accentSoft: '#8edac5',
    ink: '#12302e',
    muted: '#466361',
    chipBg: 'rgba(15, 118, 110, 0.1)',
    chipText: '#0f766e',
    border: 'rgba(15, 118, 110, 0.16)',
    buttonText: '#f6fffb',
  },
  terracotta: {
    preset: 'terracotta',
    label: 'Terracotta Studio',
    description: 'Warm, expressive branding for beauty, grooming, and personality-led service spaces.',
    surface: '#fff7f2',
    panel: '#fffdfb',
    card: '#fde7dc',
    glow: 'rgba(218, 119, 84, 0.24)',
    accent: '#b45309',
    accentSoft: '#f0b08f',
    ink: '#3f2418',
    muted: '#7f5b4f',
    chipBg: 'rgba(180, 83, 9, 0.1)',
    chipText: '#92400e',
    border: 'rgba(180, 83, 9, 0.18)',
    buttonText: '#fff8f3',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeLandingTheme(value: unknown): LandingThemeDefinition {
  const preset =
    isRecord(value) &&
    typeof value.preset === 'string' &&
    Object.prototype.hasOwnProperty.call(LANDING_THEME_PRESETS, value.preset)
      ? (value.preset as LandingThemePreset)
      : 'ledger';
  return LANDING_THEME_PRESETS[preset];
}

export function linesToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function listToLines(value: unknown) {
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, 8)
    .join('\n');
}
