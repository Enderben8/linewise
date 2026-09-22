import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Share, View } from 'react-native';
import { ProgressRings } from '../../../../src/components/ProgressRings';
import { ReviewBadge } from '../../../../src/components/ReviewBadge';
import { SelectionPicker } from '../../../../src/components/SelectionPicker';
import { spacing, useTheme } from '../../../../src/components/theme';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  Row,
  Screen,
} from '../../../../src/components/ui';
import { rowToState } from '../../../../src/db/repo';
import { confirmAction } from '../../../../src/lib/dialog';
import { GROUP_ORDER, gamesFor } from '../../../../src/games/registry';
import { clampSelection, speakersOf, type ChunkSelection } from '../../../../src/games/setup';
import { selectionToParams } from '../../../../src/games/useGameSetup';
import { innerRing, outerRing } from '../../../../src/scheduler';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { removeMemorization } from '../../../../src/store/memorizationsSlice';

export default function MemorizationDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { palette } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mem = useAppSelector((s) => s.memorizations.items.find((m) => m.id === id));
  const chunkCount = mem?.chunks.length ?? 0;
  const [selection, setSelection] = useState<ChunkSelection>({ mode: 'all', from: 0, to: 0 });
  const speakers = useMemo(() => (mem?.type === 'script' ? speakersOf(mem.chunks) : []), [mem]);

  if (!mem) {
    return (
      <Screen>
        <EmptyState title={t('detail.notFound')} />
        <Button label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const state = rowToState(mem.progress);
  const sel = clampSelection(selection, chunkCount);
  const open = (path: string) =>
    router.push({ pathname: `/memorizations/[id]/${path}`, params: { id: mem.id } });
  const openGame = (game: string, usesSelection: boolean) =>
    router.push({
      pathname: `/memorizations/[id]/${game}`,
      params: usesSelection ? selectionToParams(mem.id, sel) : { id: mem.id },
    });

  const confirmDelete = async () => {
    const ok = await confirmAction({
      title: t('detail.deleteTitle'),
      message: t('detail.deleteBody', { title: mem.title }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    dispatch(removeMemorization(mem.id));
    router.back();
  };

  const shareText = () =>
    Share.share({
      title: mem.title,
      message: `${mem.title}${mem.author ? ` - ${mem.author}` : ''}\n\n${mem.body}`,
    });

  const noChunks = chunkCount === 0;
  // On the web, Share needs the browser's share sheet, which many desktop browsers lack.
  const canShare = Platform.OS !== 'web' || typeof navigator.share === 'function';

  return (
    <Screen>
      <Stack.Screen options={{ title: mem.title }} />
      <Card>
        <Row style={{ gap: spacing.lg }}>
          <ProgressRings size={84} outer={outerRing(state)} inner={innerRing(state)} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="title" numberOfLines={3}>
              {mem.title}
            </AppText>
            {mem.author ? <AppText muted>{mem.author}</AppText> : null}
            <ReviewBadge progress={mem.progress} />
          </View>
        </Row>
        <AppText variant="caption" muted>
          {t('detail.ringsHelp')}
        </AppText>
        {mem.tags.length > 0 ? (
          <Row style={{ flexWrap: 'wrap' }}>
            {mem.tags.map((tag) => (
              <Chip key={tag} label={tag} />
            ))}
          </Row>
        ) : null}
      </Card>

      <Row style={{ flexWrap: 'wrap' }}>
        <Button
          variant="secondary"
          label={t('detail.fullText')}
          onPress={() => open('see-full-text')}
        />
        <Button variant="secondary" label={t('detail.edit')} onPress={() => open('edit-text')} />
        <Button variant="secondary" label={t('detail.stats')} onPress={() => open('stats')} />
        <Button
          variant="secondary"
          label={t('detail.reminders')}
          onPress={() => open('notifications')}
        />
      </Row>

      {noChunks ? (
        <EmptyState title={t('detail.noChunks')} />
      ) : (
        <>
          <AppText variant="heading">{t('detail.whatToPractise')}</AppText>
          <SelectionPicker
            value={sel}
            chunkCount={chunkCount}
            speakers={speakers}
            onChange={setSelection}
          />

          {GROUP_ORDER.map((group) => (
            <View key={group} style={{ gap: spacing.sm }}>
              <View>
                <AppText variant="heading">{t(`groups.${group}`)}</AppText>
                <AppText variant="caption" muted>
                  {t(`groups.${group}Help`)}
                </AppText>
              </View>
              {gamesFor(mem.type)
                .filter((g) => g.group === group)
                .map((g) => {
                  const best = mem.progress.solidifyScores[g.id];
                  return (
                    <Card
                      key={g.id}
                      testID={`game-${g.id}`}
                      onPress={() => openGame(g.id, g.usesSelection)}
                    >
                      <Row style={{ gap: spacing.md }}>
                        <Ionicons name={g.icon} size={26} color={palette.primary} />
                        <View style={{ flex: 1 }}>
                          <AppText variant="label">{t(`games.${g.id}.name`)}</AppText>
                          <AppText variant="caption" muted>
                            {t(`games.${g.id}.blurb`)}
                          </AppText>
                        </View>
                        {best !== undefined ? (
                          <AppText variant="label" color={palette.primary}>
                            {Math.round(best * 100)}%
                          </AppText>
                        ) : null}
                      </Row>
                    </Card>
                  );
                })}
            </View>
          ))}
        </>
      )}

      {canShare ? <Button variant="ghost" label={t('detail.share')} onPress={shareText} /> : null}
      <Button
        variant="danger"
        testID="delete-memorization"
        label={t('detail.delete')}
        onPress={confirmDelete}
      />
    </Screen>
  );
}
