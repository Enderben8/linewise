import { Fragment } from 'react';
import { Text, View } from 'react-native';
import { usesSpaces } from '../engine';
import { spacing, useTheme } from '../components/theme';
import type { TokenLine } from './tokens';

// Fully transparent (alpha 0) text is treated as "no colour" by Android and shows through, so use alpha 1.
const INVISIBLE = '#00000001';

export type WordState = 'shown' | 'hidden' | 'current' | 'currentHidden' | 'ok' | 'wrong' | 'dim';

interface Props {
  lines: TokenLine[];
  lang: string;
  state: (index: number) => WordState;
  onPressWord?: (index: number) => void;
  /** Text to show in place of a hidden word (defaults to the word itself, made invisible). */
  size?: number;
}

/** Renders tokenised lines with per-word state: hidden words keep their width so the text does not reflow. */
export function MaskedLines({ lines, lang, state, onPressWord, size = 18 }: Props) {
  const { palette, fontScale } = useTheme();
  const glue = usesSpaces(lang) ? ' ' : '';
  const fontSize = size * fontScale;
  return (
    <View style={{ gap: spacing.xs }}>
      {lines.map((line) => (
        <Text
          key={line.start}
          style={{
            fontSize,
            lineHeight: fontSize * 1.7,
            color: palette.text,
            marginTop: line.chunkStart && line.start > 0 ? spacing.md : 0,
            textAlign: 'auto',
          }}
        >
          {line.tokens.map((tok, i) => {
            const idx = line.start + i;
            const s = state(idx);
            const style =
              s === 'hidden'
                ? { color: INVISIBLE, backgroundColor: palette.hidden, borderRadius: 4 }
                : s === 'currentHidden'
                  ? { color: INVISIBLE, backgroundColor: palette.accent, borderRadius: 4 }
                  : s === 'current'
                    ? { backgroundColor: palette.accent, color: palette.onAccent, borderRadius: 4 }
                    : s === 'ok'
                      ? { color: palette.success, fontWeight: '600' as const }
                      : s === 'wrong'
                        ? {
                            color: palette.danger,
                            fontWeight: '600' as const,
                            textDecorationLine: 'underline' as const,
                          }
                        : s === 'dim'
                          ? { color: palette.muted }
                          : undefined;
            return (
              <Fragment key={i}>
                {i > 0 ? glue : ''}
                <Text style={style} onPress={onPressWord ? () => onPressWord(idx) : undefined}>
                  {tok.text}
                </Text>
              </Fragment>
            );
          })}
        </Text>
      ))}
    </View>
  );
}
