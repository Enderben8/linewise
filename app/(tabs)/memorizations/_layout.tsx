import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackOptions } from '../../../src/components/useStackOptions';

export default function MemorizationsLayout() {
  const { t } = useTranslation();
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: t('tabs.memorizations') }} />
    </Stack>
  );
}
