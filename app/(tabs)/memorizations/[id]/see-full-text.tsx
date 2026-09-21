import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChunkList } from '../../../../src/components/ChunkList';
import { AppText, EmptyState, Screen } from '../../../../src/components/ui';
import { useAppSelector } from '../../../../src/store';

export default function SeeFullText() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mem = useAppSelector((s) => s.memorizations.items.find((m) => m.id === id));
  if (!mem) return <EmptyState title={t('detail.notFound')} />;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('detail.fullText') }} />
      <AppText variant="title">{mem.title}</AppText>
      {mem.author ? <AppText muted>{mem.author}</AppText> : null}
      <ChunkList chunks={mem.chunks} />
    </Screen>
  );
}
