import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ProgressRings } from '../../../src/components/ProgressRings';
import { ReviewBadge } from '../../../src/components/ReviewBadge';
import { spacing, useTheme } from '../../../src/components/theme';
import { AppText, Button, Card, Chip, EmptyState, Field, Row } from '../../../src/components/ui';
import { rowToState } from '../../../src/db/repo';
import { backupDue, matchesSearch } from '../../../src/features/memorizations/status';
import { innerRing, outerRing } from '../../../src/scheduler';
import { useAppSelector } from '../../../src/store';

export default function MemorizationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const items = useAppSelector((s) => s.memorizations.items);
  const settings = useAppSelector((s) => s.settings.values);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const allTags = useMemo(
    () => [...new Set(items.flatMap((m) => m.tags))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const filtered = useMemo(
    () => items.filter((m) => matchesSearch(m, query) && (!tag || m.tags.includes(tag))),
    [items, query, tag],
  );
  const showBackupNudge = backupDue(
    {
      enabled: settings.backup_reminder_enabled,
      lastBackupAt: settings.last_backup_at,
      oldestCreatedAt: items.length ? Math.min(...items.map((m) => m.createdAt)) : null,
    },
    now,
  );

  const header = (
    <View style={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.sm }}>
      {showBackupNudge ? (
        <Card style={{ borderColor: palette.accent }}>
          <AppText variant="label">{t('list.backupNudgeTitle')}</AppText>
          <AppText muted>{t('list.backupNudgeBody')}</AppText>
          <Button
            label={t('list.backupNow')}
            variant="secondary"
            onPress={() => router.push('/settings/backup')}
          />
        </Card>
      ) : null}
      {items.length > 0 ? (
        <Field
          testID="search-input"
          placeholder={t('list.search')}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
      ) : null}
      {allTags.length > 0 ? (
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label={t('list.allTags')} selected={tag === null} onPress={() => setTag(null)} />
          {allTags.map((name) => (
            <Chip
              key={name}
              label={name}
              selected={tag === name}
              onPress={() => setTag(tag === name ? null : name)}
            />
          ))}
        </Row>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlashList
        data={filtered}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          items.length === 0 ? (
            <View style={{ gap: spacing.lg, alignItems: 'center' }}>
              <EmptyState title={t('list.emptyTitle')} body={t('list.emptyBody')} />
              <Button
                testID="empty-add"
                label={t('list.addFirst')}
                onPress={() => router.push('/add')}
              />
            </View>
          ) : (
            <EmptyState title={t('list.noMatches')} />
          )
        }
        renderItem={({ item }) => {
          const state = rowToState(item.progress);
          return (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
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
            </View>
          );
        }}
      />
    </View>
  );
}
