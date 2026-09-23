import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../src/components/theme';
import { AppText, Button, EmptyState, Field, Screen } from '../../../../src/components/ui';
import { folderNameIssue, MAX_FOLDER_NAME } from '../../../../src/features/memorizations/folders';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import {
  addFolder,
  editFolderName,
  moveMemorizations,
} from '../../../../src/store/memorizationsSlice';

/**
 * Names a new folder, or renames one (`folderId`). A new folder made from a text's folder chooser
 * (`memorizationId`) takes that text; one made from the list goes on to choosing its texts.
 */
export default function FolderEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { palette } = useTheme();
  const { folderId, memorizationId } = useLocalSearchParams<{
    folderId?: string;
    memorizationId?: string;
  }>();
  const folders = useAppSelector((s) => s.memorizations.folders);
  const existing = folderId ? folders.find((f) => f.id === folderId) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [tried, setTried] = useState(false);

  if (folderId && !existing) return <EmptyState title={t('folders.notFound')} />;

  const issue = folderNameIssue(name, folders, folderId);
  const messages = {
    empty: t('folders.issueEmpty'),
    tooLong: t('folders.issueTooLong', { max: MAX_FOLDER_NAME }),
    duplicate: t('folders.issueDuplicate'),
  };

  const save = () => {
    setTried(true);
    if (issue) return;
    const clean = name.trim();
    if (existing) {
      dispatch(editFolderName(existing.id, clean));
      router.back();
      return;
    }
    const id = dispatch(addFolder(clean));
    if (memorizationId) {
      dispatch(moveMemorizations([memorizationId], id));
      // Back past the folder chooser, to the text itself.
      router.dismissTo({ pathname: '/memorizations/[id]', params: { id: memorizationId } });
      return;
    }
    router.replace({
      pathname: '/memorizations/folders/[folderId]/pick',
      params: { folderId: id },
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('folders.renameTitle') : t('folders.new') }} />
      <Field
        testID="folder-name-input"
        label={t('folders.name')}
        placeholder={t('folders.namePlaceholder')}
        value={name}
        onChangeText={setName}
        maxLength={MAX_FOLDER_NAME + 20}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {/* An empty name only counts as a problem once the user tries to save it. */}
      {issue && (tried || issue !== 'empty') ? (
        <AppText color={palette.danger}>{messages[issue]}</AppText>
      ) : null}
      <Button
        testID="save-folder"
        label={existing ? t('common.save') : t('folders.create')}
        onPress={save}
      />
    </Screen>
  );
}
