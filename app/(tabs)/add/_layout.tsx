import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackOptions } from '../../../src/components/useStackOptions';

export default function AddLayout() {
  const { t } = useTranslation();
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: t('add.title') }} />
      <Stack.Screen name="edit-text" options={{ title: t('add.editTitle') }} />
      <Stack.Screen name="camera-recognition" options={{ title: t('add.cameraTitle') }} />
    </Stack>
  );
}
