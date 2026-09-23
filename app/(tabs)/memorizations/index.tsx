import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FolderCard, MemorizationCard } from '../../../src/components/MemorizationCard';
import { spacing, useTheme } from '../../../src/components/theme';
import { AppText, Button, Card, Chip, EmptyState, Field, Row } from '../../../src/components/ui';
import { listRows } from '../../../src/features/memorizations/folders';
import { backupDue } from '../../../src/features/memorizations/status';
import { useAppSelector } from '../../../src/store';

export default function MemorizationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const items = useAppSelector((s) => s.memorizations.items);
  const folders = useAppSelector((s) => s.memorizations.folders);
  const settings = useAppSelector((s) => s.settings.values);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const allTags = useMemo(
    () => [...new Set(items.flatMap((m) => m.tags))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const rows = useMemo(
    () => listRows(items, folders, { query, tag, now }),
    [items, folders, query, tag, now],
  );
  const folderNames = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);
  const filtering = query.trim() !== '' || tag !== null;
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
      {items.length > 0 || folders.length > 0 ? (
        <Row>
          <View style={{ flex: 1 }}>
            <Field
              testID="search-input"
              placeholder={t('list.search')}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
          <Button
            testID="new-folder"
            variant="secondary"
            label={t('folders.new')}
            onPress={() => router.push('/memorizations/folders/edit')}
          />
        </Row>
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
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.kind}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          items.length === 0 && folders.length === 0 ? (
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
        renderItem={({ item: row }) => (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            {row.kind === 'folder' ? (
              <FolderCard
                name={row.summary.folder.name}
                count={row.summary.count}
                due={row.summary.due}
                onPress={() =>
                  router.push({
                    pathname: '/memorizations/folders/[folderId]',
                    params: { folderId: row.summary.folder.id },
                  })
                }
              />
            ) : (
              <MemorizationCard
                item={row.item}
                folderName={
                  filtering && row.item.folderId ? folderNames.get(row.item.folderId) : undefined
                }
              />
            )}
          </View>
        )}
      />
    </View>
  );
}
