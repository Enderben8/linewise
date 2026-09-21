import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TextEditor } from '../../../../src/components/TextEditor';
import { EmptyState } from '../../../../src/components/ui';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { editMemorization } from '../../../../src/store/memorizationsSlice';

export default function EditText() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useAppSelector((s) => s.memorizations.items);
  const mem = items.find((m) => m.id === id);
  if (!mem) return <EmptyState title={t('detail.notFound')} />;
  const existingTags = [...new Set(items.flatMap((m) => m.tags))];
  return (
    <>
      <Stack.Screen options={{ title: t('detail.edit') }} />
      <TextEditor
        initial={{
          title: mem.title,
          author: mem.author,
          language: mem.language,
          type: mem.type,
          body: mem.body,
          tags: mem.tags,
        }}
        existingTags={existingTags}
        saveLabel={t('editor.save')}
        editingExisting
        onSave={(input) => {
          dispatch(editMemorization(mem.id, input));
          router.back();
        }}
      />
    </>
  );
}
