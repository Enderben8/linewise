import type { NativeStackNavigationOptions } from 'expo-router';
import { useTheme } from './theme';

export function useStackOptions(): NativeStackNavigationOptions {
  const { palette } = useTheme();
  return {
    headerStyle: { backgroundColor: palette.surface },
    headerTintColor: palette.text,
    headerTitleStyle: { fontWeight: '700' },
    contentStyle: { backgroundColor: palette.bg },
    headerShadowVisible: false,
  };
}
