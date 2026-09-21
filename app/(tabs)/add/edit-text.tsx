import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TextEditor } from '../../../src/components/TextEditor';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { draftActions } from '../../../src/store/draftSlice';
import { addMemorization } from '../../../src/store/memorizationsSlice';

export default function AddEditTextScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const draft = useAppSelector((s) => s.draft);
  const defaultLanguage = useAppSelector((s) => s.settings.values.default_language);
  const items = useAppSelector((s) => s.memorizations.items);
  const existingTags = [...new Set(items.flatMap((m) => m.tags))];

  return (
    <TextEditor
      // A new draft (imported, scanned or shared while this screen is open) starts a fresh editor.
      key={`${draft.title}|${draft.body.length}`}
      initial={{
        title: draft.title,
        author: draft.author,
        language: defaultLanguage,
        type: 'text',
        body: draft.body,
        tags: [],
      }}
      existingTags={existingTags}
      saveLabel={t('editor.create')}
      onSave={(input) => {
        const id = dispatch(addMemorization(input));
        dispatch(draftActions.clearDraft());
        router.dismissAll();
        router.push(`/memorizations/${id}`);
      }}
    />
  );
}
