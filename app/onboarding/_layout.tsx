import { Stack } from 'expo-router';
import { useTheme } from '../../src/components/theme';

export default function OnboardingLayout() {
  const { palette } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="demo" />
    </Stack>
  );
}
