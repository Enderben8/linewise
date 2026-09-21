import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { AlignItem } from '../engine';
import { usesSpaces } from '../engine';
import { spacing, useTheme } from '../components/theme';
import { AppText, Card, Row } from '../components/ui';

/** Shows an alignment: correct words plain, missed words in red, wrong words with what was said, extra words struck through. */
export function DiffView({ items, lang }: { items: AlignItem[]; lang: string }) {
  const { t } = useTranslation();
  const { palette, fontScale } = useTheme();
  const glue = usesSpaces(lang) ? ' ' : '';
  const legend = (color: string, label: string) => (
    <Row key={label} style={{ gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </Row>
  );
  return (
    <Card>
      <Text
        style={{ fontSize: 17 * fontScale, lineHeight: 17 * fontScale * 1.7, color: palette.text }}
      >
        {items.map((it, i) => {
          const sep = i > 0 ? glue : '';
          if (it.op === 'match') {
            return (
              <Text key={i}>
                {sep}
                {it.target?.text}
              </Text>
            );
          }
          if (it.op === 'missed') {
            return (
              <Text key={i}>
                {sep}
                <Text style={{ color: palette.danger, fontWeight: '700' }}>{it.target?.text}</Text>
              </Text>
            );
          }
          if (it.op === 'wrong') {
            return (
              <Text key={i}>
                {sep}
                <Text style={{ color: palette.warning, textDecorationLine: 'line-through' }}>
                  {it.attempt?.text}
                </Text>
                <Text style={{ color: palette.danger, fontWeight: '700' }}> {it.target?.text}</Text>
              </Text>
            );
          }
          return (
            <Text key={i}>
              {sep}
              <Text style={{ color: palette.muted, textDecorationLine: 'line-through' }}>
                {it.attempt?.text}
              </Text>
            </Text>
          );
        })}
      </Text>
      <Row style={{ flexWrap: 'wrap', gap: spacing.md }}>
        {legend(palette.danger, t('diff.missed'))}
        {legend(palette.warning, t('diff.wrong'))}
        {legend(palette.muted, t('diff.extra'))}
      </Row>
    </Card>
  );
}
