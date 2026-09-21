import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackOptions } from '../../../src/components/useStackOptions';

export default function SettingsLayout() {
  const { t } = useTranslation();
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: t('tabs.settings') }} />
      <Stack.Screen name="voices" options={{ title: t('voices.title') }} />
      <Stack.Screen name="backup" options={{ title: t('backup.title') }} />
      <Stack.Screen name="faq" options={{ title: t('faq.title') }} />
    </Stack>
  );
}
