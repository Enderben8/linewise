import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing, useTheme } from '../../../../../src/components/theme';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  Row,
  Screen,
} from '../../../../../src/components/ui';
import { matchesSearch } from '../../../../../src/features/memorizations/status';
import { useAppDispatch, useAppSelector } from '../../../../../src/store';
import { moveMemorizations } from '../../../../../src/store/memorizationsSlice';

/** Tick several texts at once to put them in a folder; untick to take them out. */
export default function PickTextsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { palette } = useTheme();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const folders = useAppSelector((s) => s.memorizations.folders);
  const items = useAppSelector((s) => s.memorizations.items);
  const folder = folders.find((f) => f.id === folderId);
  const [picked, setPicked] = useState(
    () => new Set(items.filter((m) => m.folderId === folderId).map((m) => m.id)),
  );
  const [query, setQuery] = useState('');
  const folderNames = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);
  const shown = useMemo(() => items.filter((m) => matchesSearch(m, query)), [items, query]);

  if (!folder) return <EmptyState title={t('folders.notFound')} />;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    const leaving = items.filter((m) => m.folderId === folder.id && !picked.has(m.id));
    dispatch(moveMemorizations([...picked], folder.id));
    dispatch(
      moveMemorizations(
        leaving.map((m) => m.id),
        null,
      ),
    );
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('folders.chooseTexts') }} />
      <AppText>{t('folders.pickHelp', { name: folder.name })}</AppText>
      {items.length === 0 ? (
        <EmptyState title={t('list.emptyTitle')} />
      ) : (
        <>
          <Field
            placeholder={t('list.search')}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <View style={{ gap: spacing.sm }}>
            {shown.map((m) => {
              const on = picked.has(m.id);
              const elsewhere =
                m.folderId && m.folderId !== folder.id ? folderNames.get(m.folderId) : undefined;
              return (
                <Card key={m.id} testID={`pick-${m.title}`} onPress={() => toggle(m.id)}>
                  <Row style={{ gap: spacing.md }}>
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={26}
                      color={on ? palette.primary : palette.muted}
                      accessibilityLabel={on ? t('folders.picked') : t('folders.notPicked')}
                    />
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" numberOfLines={2}>
                        {m.title}
                      </AppText>
                      {elsewhere ? (
                        <AppText variant="caption" muted numberOfLines={1}>
                          {t('folders.inFolder', { name: elsewhere })}
                        </AppText>
                      ) : null}
                    </View>
                  </Row>
                </Card>
              );
            })}
            {shown.length === 0 ? <EmptyState title={t('list.noMatches')} /> : null}
          </View>
        </>
      )}
      <Button
        testID="save-picked"
        label={t('folders.savePicked', { count: picked.size })}
        onPress={save}
      />
    </Screen>
  );
}
