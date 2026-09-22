import { Stack, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { AppText, Button, EmptyState, Screen } from '../components/ui';
import type { GameId } from './ids';
import { isAvailableOn } from './registry';
import { useGameSetup, type GameSetup } from './useGameSetup';

interface Props {
  title: string;
  /** The game this screen runs. Games not offered on this platform show a message instead. */
  game?: GameId;
  /** Renders the game. Not called when the selection has no words (e.g. only action lines). */
  children: (setup: GameSetup) => ReactNode;
  /** Render inside a non-scrolling container (for screens that own a list). */
  scroll?: boolean;
}

/** Loads the memorization and selection from the route and handles the missing / empty cases. */
export function GameGate({ title, game, children, scroll = true }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const setup = useGameSetup();
  if (game && !isAvailableOn(game, Platform.OS)) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <EmptyState title={t('games.androidOnly')} body={t('games.androidOnlyBody')} />
        <Button label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!setup) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <EmptyState title={t('detail.notFound')} />
        <Button label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }
  if (setup.selectionWords === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <EmptyState title={t('games.nothingToPractise')} body={t('games.nothingToPractiseBody')} />
        <Button label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!scroll) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        {children(setup)}
      </>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <AppText variant="caption" muted>
        {setup.mem.title}
        {setup.selection.speaker ? ` · ${setup.selection.speaker}` : ''}
        {' · '}
        {setup.range[0] === setup.range[1]
          ? t('games.chunkOne', { n: setup.range[0] + 1 })
          : t('games.chunkRange', { from: setup.range[0] + 1, to: setup.range[1] + 1 })}
      </AppText>
      {children(setup)}
    </Screen>
  );
}
