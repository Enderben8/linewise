import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { Chunk, Line } from '../engine';
import { spacing, useTheme } from './theme';
import { AppText, Card } from './ui';

export function LineText({ line }: { line: Line }) {
  const { palette } = useTheme();
  return (
    <AppText
      style={
        line.kind === 'speaker'
          ? { fontWeight: '700', color: palette.primary }
          : line.kind === 'action'
            ? { fontStyle: 'italic', color: palette.muted }
            : undefined
      }
    >
      {line.text}
    </AppText>
  );
}

/** Chunks as numbered cards. `limit` caps how many render (long texts). */
export function ChunkList({ chunks, limit }: { chunks: Chunk[]; limit?: number }) {
  const { t } = useTranslation();
  const shown = limit ? chunks.slice(0, limit) : chunks;
  return (
    <View style={{ gap: spacing.sm }}>
      {shown.map((chunk) => (
        <Card key={chunk.index} style={{ padding: spacing.md }}>
          <AppText variant="caption" muted>
            {t('editor.chunkN', { n: chunk.index + 1 })}
          </AppText>
          {chunk.lines.map((line, i) => (
            <LineText key={i} line={line} />
          ))}
        </Card>
      ))}
      {limit && chunks.length > limit ? (
        <AppText muted>{t('editor.previewMore', { count: chunks.length - limit })}</AppText>
      ) : null}
    </View>
  );
}
