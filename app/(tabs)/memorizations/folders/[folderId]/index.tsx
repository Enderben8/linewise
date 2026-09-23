import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { MemorizationCard } from '../../../../../src/components/MemorizationCard';
import { spacing } from '../../../../../src/components/theme';
import { AppText, Button, EmptyState, Row, Screen } from '../../../../../src/components/ui';
import { confirmAction } from '../../../../../src/lib/dialog';
import { useAppDispatch, useAppSelector } from '../../../../../src/store';
import { removeFolder } from '../../../../../src/store/memorizationsSlice';

export default function FolderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const folder = useAppSelector((s) => s.memorizations.folders.find((f) => f.id === folderId));
  const items = useAppSelector((s) => s.memorizations.items);

  if (!folder) {
    return (
      <Screen>
        <EmptyState title={t('folders.notFound')} />
        <Button label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const inside = items.filter((m) => m.folderId === folder.id);
  const chooseTexts = () =>
    router.push({
      pathname: '/memorizations/folders/[folderId]/pick',
      params: { folderId: folder.id },
    });

  const confirmDelete = async () => {
    const ok = await confirmAction({
      title: t('folders.deleteTitle'),
      message: t('folders.deleteBody', { name: folder.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    dispatch(removeFolder(folder.id));
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: folder.name }} />
      <AppText muted>{t('folders.textCount', { count: inside.length })}</AppText>
      <Row style={{ flexWrap: 'wrap' }}>
        <Button
          testID="folder-choose-texts"
          label={t('folders.chooseTexts')}
          onPress={chooseTexts}
        />
        <Button
          testID="folder-rename"
          variant="secondary"
          label={t('folders.rename')}
          onPress={() =>
            router.push({
              pathname: '/memorizations/folders/edit',
              params: { folderId: folder.id },
            })
          }
        />
      </Row>
      {inside.length === 0 ? (
        <EmptyState title={t('folders.empty')} body={t('folders.emptyBody')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {inside.map((item) => (
            <MemorizationCard key={item.id} item={item} />
          ))}
        </View>
      )}
      <Button
        testID="delete-folder"
        variant="danger"
        label={t('folders.delete')}
        onPress={confirmDelete}
      />
    </Screen>
  );
}
