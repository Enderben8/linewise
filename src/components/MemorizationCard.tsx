import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { rowToState, type MemorizationWithProgress } from '../db/repo';
import { innerRing, outerRing } from '../scheduler';
import { ProgressRings } from './ProgressRings';
import { ReviewBadge } from './ReviewBadge';
import { spacing, useTheme } from './theme';
import { AppText, Card, Chip, Row } from './ui';

/** One text in a list: rings, title, author, review badge and tags. Opens the text when tapped. */
export function MemorizationCard({
  item,
  folderName,
}: {
  item: MemorizationWithProgress;
  /** Shown when the list mixes texts from different folders, as search results do. */
  folderName?: string;
}) {
  const router = useRouter();
  const { palette } = useTheme();
  const state = rowToState(item.progress);
  return (
    <Card
      testID={`memorization-${item.title}`}
      onPress={() => router.push(`/memorizations/${item.id}`)}
    >
      <Row style={{ gap: spacing.lg }}>
        <ProgressRings outer={outerRing(state)} inner={innerRing(state)} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="heading" numberOfLines={2}>
            {item.title}
          </AppText>
          {item.author ? (
            <AppText muted numberOfLines={1}>
              {item.author}
            </AppText>
          ) : null}
          {folderName ? (
            <Row style={{ gap: 4 }}>
              <Ionicons name="folder-outline" size={14} color={palette.muted} />
              <AppText variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
                {folderName}
              </AppText>
            </Row>
          ) : null}
          <ReviewBadge progress={item.progress} />
        </View>
      </Row>
      {item.tags.length > 0 ? (
        <Row style={{ flexWrap: 'wrap' }}>
          {item.tags.map((name) => (
            <Chip key={name} label={name} />
          ))}
        </Row>
      ) : null}
    </Card>
  );
}

/** A folder in the Memorize list: name, how many texts, and how many are due today. */
export function FolderCard({
  name,
  count,
  due,
  onPress,
}: {
  name: string;
  count: number;
  due: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  return (
    <Card testID={`folder-${name}`} onPress={onPress}>
      <Row style={{ gap: spacing.lg }}>
        <Ionicons name="folder" size={40} color={palette.primary} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="heading" numberOfLines={2}>
            {name}
          </AppText>
          <AppText muted>{t('folders.textCount', { count })}</AppText>
          {due > 0 ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: palette.accent,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}
            >
              <AppText variant="caption" color={palette.onAccent} style={{ fontWeight: '600' }}>
                {t('folders.dueCount', { count: due })}
              </AppText>
            </View>
          ) : null}
        </View>
      </Row>
    </Card>
  );
}
