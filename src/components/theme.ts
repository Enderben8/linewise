import { useColorScheme } from 'react-native';
import { useAppSelector } from '../store';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  success: string;
  danger: string;
  warning: string;
  hidden: string;
}

const light: Palette = {
  bg: '#F6F4EE',
  surface: '#FFFFFF',
  surfaceAlt: '#ECE9DF',
  border: '#D9D5C6',
  text: '#1D2B2B',
  muted: '#5F6B6B',
  primary: '#0F5257',
  onPrimary: '#FFFFFF',
  accent: '#E9A93A',
  onAccent: '#2A1D00',
  success: '#2E7D4F',
  danger: '#B3372F',
  warning: '#A66A00',
  hidden: '#C9D6D6',
};

const dark: Palette = {
  bg: '#0E1717',
  surface: '#172424',
  surfaceAlt: '#1F3030',
  border: '#2E4444',
  text: '#EAF1F0',
  muted: '#9DB0AE',
  primary: '#5CC0C4',
  onPrimary: '#04292B',
  accent: '#F2B84B',
  onAccent: '#2A1D00',
  success: '#6CC58C',
  danger: '#F0857D',
  warning: '#F0B860',
  hidden: '#3A5252',
};

export function useTheme() {
  const scheme = useColorScheme();
  const fontScale = useAppSelector((s) => s.settings.values.font_size);
  return { palette: scheme === 'dark' ? dark : light, fontScale };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;
