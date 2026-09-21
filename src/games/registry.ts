import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { GAME_GROUP, type GameGroup, type GameId } from './ids';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface GameInfo {
  id: GameId;
  group: GameGroup;
  icon: IconName;
  /** Only offered for scripts. */
  scriptOnly?: boolean;
  /** Needs the selection picker (My Recordings works on the whole text). */
  usesSelection: boolean;
}

const info = (
  id: GameId,
  icon: IconName,
  extra: Partial<Pick<GameInfo, 'scriptOnly' | 'usesSelection'>> = {},
): GameInfo => ({ id, group: GAME_GROUP[id], icon, usesSelection: true, ...extra });

export const GAMES: GameInfo[] = [
  info('tap-to-reveal', 'hand-left-outline'),
  info('slider', 'options-outline'),
  info('listen', 'headset-outline'),
  info('my-recordings', 'mic-outline', { usesSelection: false }),
  info('first-letter', 'text-outline'),
  info('fill-in-the-blank', 'ellipsis-horizontal-outline'),
  info('sentence-scramble', 'swap-vertical-outline'),
  info('type-it', 'keypad-outline'),
  info('multiple-choice', 'list-outline'),
  info('speak', 'chatbubble-ellipses-outline'),
  info('run-scene', 'people-outline', { scriptOnly: true }),
];

export const GROUP_ORDER: GameGroup[] = ['practice', 'solidify', 'evaluate'];

export function gamesFor(type: 'text' | 'script'): GameInfo[] {
  return GAMES.filter((g) => !g.scriptOnly || type === 'script');
}
