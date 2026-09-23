import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Button, Card, EmptyState, Row, Screen } from '../../../../src/components/ui';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { moveMemorizations } from '../../../../src/store/memorizationsSlice';

/** Chooses the one folder a text is in, or none. */
export default function ChooseFolderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { palette } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mem = useAppSelector((s) => s.memorizations.items.find((m) => m.id === id));
  const folders = useAppSelector((s) => s.memorizations.folders);
  if (!mem) return <EmptyState title={t('detail.notFound')} />;

  const choose = (folderId: string | null) => {
    dispatch(moveMemorizations([mem.id], folderId));
    router.back();
  };

  const options = [
    { id: null, name: t('folders.none') },
    ...folders.map((f) => ({ id: f.id as string | null, name: f.name })),
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: t('detail.folder') }} />
      <AppText>{t('folders.chooseHelp', { title: mem.title })}</AppText>
      <View style={{ gap: spacing.sm }}>
        {options.map((o) => {
          const on = mem.folderId === o.id;
          return (
            <Card
              key={o.id ?? 'none'}
              testID={`choose-folder-${o.id === null ? 'none' : o.name}`}
              onPress={() => choose(o.id)}
            >
              <Row style={{ gap: spacing.md }}>
                <Ionicons
                  name={on ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={on ? palette.primary : palette.muted}
                />
                <Ionicons
                  name={o.id === null ? 'document-text-outline' : 'folder-outline'}
                  size={22}
                  color={palette.text}
                />
                <AppText variant="label" numberOfLines={2} style={{ flex: 1 }}>
                  {o.name}
                </AppText>
              </Row>
            </Card>
          );
        })}
      </View>
      <Button
        testID="choose-new-folder"
        variant="secondary"
        label={t('folders.new')}
        onPress={() =>
          router.push({
            pathname: '/memorizations/folders/edit',
            params: { memorizationId: mem.id },
          })
        }
      />
    </Screen>
  );
}
