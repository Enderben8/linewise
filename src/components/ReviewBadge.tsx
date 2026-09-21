import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { ProgressRow } from '../db/schema';
import { rowToState } from '../db/repo';
import { reviewStatus } from '../features/memorizations/status';
import { useTheme } from './theme';
import { AppText } from './ui';

export function ReviewBadge({ progress }: { progress: ProgressRow }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [now] = useState(() => Date.now());
  const status = reviewStatus(rowToState(progress), now);
  const map = {
    new: { text: t('status.new'), bg: palette.surfaceAlt, fg: palette.text },
    due: { text: t('status.due'), bg: palette.accent, fg: palette.onAccent },
    upcoming: {
      text: status.kind === 'upcoming' ? t('status.inDays', { count: status.days }) : '',
      bg: palette.surfaceAlt,
      fg: palette.muted,
    },
    done: { text: t('status.done'), bg: palette.success, fg: palette.surface },
  }[status.kind];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: map.bg,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <AppText variant="caption" color={map.fg} style={{ fontWeight: '600' }}>
        {map.text}
      </AppText>
    </View>
  );
}
