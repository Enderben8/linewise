import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { LIMITS } from '../config';
import type { MemorizationInput } from '../db/repo';
import { parseBody, validateScript, type BodyType } from '../engine';
import { hasCapitals, LANGUAGES } from '../features/settings/defaults';
import { parseTags } from '../features/memorizations/status';
import { guessTitle, utf8Bytes, validateInput } from '../features/memorizations/validate';
import { ChunkList } from './ChunkList';
import { spacing, useTheme } from './theme';
import { AppText, Button, Card, Chip, Field, Row, Screen } from './ui';

interface Props {
  initial: MemorizationInput;
  existingTags: string[];
  saveLabel: string;
  onSave: (input: MemorizationInput) => void;
  /** Warn the user that saving resets Fill in the Blank choices and flags recordings as out of date. */
  editingExisting?: boolean;
}

export function TextEditor({ initial, existingTags, saveLabel, onSave, editingExisting }: Props) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [title, setTitle] = useState(initial.title);
  // Until the user edits the title, it follows the first line of the text.
  const [titleEdited, setTitleEdited] = useState(initial.title.trim() !== '');
  const [author, setAuthor] = useState(initial.author);
  const [language, setLanguage] = useState(initial.language);
  const [type, setType] = useState<BodyType>(initial.type);
  const [body, setBody] = useState(initial.body);
  const [tagText, setTagText] = useState(initial.tags.join(', '));
  const [submitted, setSubmitted] = useState(false);

  const deferredBody = useDeferredValue(body);
  const chunks = useMemo(() => parseBody(deferredBody, type), [deferredBody, type]);
  const issues = useMemo(
    () => (type === 'script' ? validateScript(deferredBody) : []),
    [deferredBody, type],
  );
  const errors = validateInput({ title, body });
  const bytes = utf8Bytes(body);
  const tags = parseTags(tagText);

  const save = () => {
    setSubmitted(true);
    if (errors.length) return;
    onSave({ title: title.trim(), author: author.trim(), language, type, body, tags });
  };

  const addTag = (tag: string) => {
    if (!tags.some((x) => x.toLowerCase() === tag.toLowerCase()))
      setTagText([...tags, tag].join(', '));
  };
  const suggestions = existingTags.filter(
    (x) => !tags.some((y) => y.toLowerCase() === x.toLowerCase()),
  );

  return (
    <Screen>
      <Field
        testID="body-input"
        label={t('editor.body')}
        value={body}
        onChangeText={(text) => {
          setBody(text);
          if (!titleEdited) setTitle(guessTitle(text));
        }}
        placeholder={t('editor.bodyPlaceholder')}
        multiline
        textAlignVertical="top"
        style={{ minHeight: 180 }}
        hint={t('editor.size', {
          used: Math.ceil(bytes / 1024),
          max: Math.floor(LIMITS.maxBodyBytes / 1024),
        })}
      />
      {submitted && errors.includes('BODY_REQUIRED') ? (
        <AppText color={palette.danger}>{t('editor.errors.bodyRequired')}</AppText>
      ) : null}
      {errors.includes('BODY_TOO_LARGE') ? (
        <AppText color={palette.danger}>
          {t('editor.errors.bodyTooLarge', { max: Math.floor(LIMITS.maxBodyBytes / 1024) })}
        </AppText>
      ) : null}

      <Field
        testID="title-input"
        label={t('editor.title')}
        value={title}
        onChangeText={(v) => {
          setTitleEdited(true);
          setTitle(v);
        }}
      />
      {submitted && errors.includes('TITLE_REQUIRED') ? (
        <AppText color={palette.danger}>{t('editor.errors.titleRequired')}</AppText>
      ) : null}
      <Field label={t('editor.author')} value={author} onChangeText={setAuthor} />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="label" muted>
          {t('editor.type')}
        </AppText>
        <Row>
          <Chip
            testID="type-text"
            label={t('editor.typeText')}
            selected={type === 'text'}
            onPress={() => setType('text')}
          />
          <Chip
            testID="type-script"
            label={t('editor.typeScript')}
            selected={type === 'script'}
            onPress={() => setType('script')}
          />
        </Row>
        {type === 'script' ? (
          <AppText variant="caption" muted>
            {hasCapitals(language) ? t('editor.scriptHelp') : t('editor.scriptHelpNoCase')}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="label" muted>
          {t('editor.language')}
        </AppText>
        <Row style={{ flexWrap: 'wrap' }}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l.code}
              label={l.name}
              selected={language === l.code}
              onPress={() => setLanguage(l.code)}
            />
          ))}
        </Row>
      </View>

      <Field
        label={t('editor.tags')}
        hint={t('editor.tagsHint')}
        value={tagText}
        onChangeText={setTagText}
        autoCapitalize="none"
      />
      {suggestions.length > 0 ? (
        <Row style={{ flexWrap: 'wrap' }}>
          {suggestions.slice(0, 12).map((s) => (
            <Chip key={s} label={`+ ${s}`} onPress={() => addTag(s)} />
          ))}
        </Row>
      ) : null}

      {issues.length > 0 ? (
        <Card style={{ borderColor: palette.warning }}>
          <AppText variant="label" color={palette.warning}>
            {t('editor.scriptWarnings')}
          </AppText>
          {issues.slice(0, 8).map((issue, i) => (
            <AppText key={i}>{t(`editor.issues.${issue.code}`, { line: issue.line })}</AppText>
          ))}
          {issues.length > 8 ? (
            <AppText muted>{t('editor.previewMore', { count: issues.length - 8 })}</AppText>
          ) : null}
        </Card>
      ) : null}

      {editingExisting ? (
        <AppText variant="caption" muted>
          {t('editor.editWarning')}
        </AppText>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">{t('editor.previewTitle', { count: chunks.length })}</AppText>
        {chunks.length === 0 ? <AppText muted>{t('editor.previewEmpty')}</AppText> : null}
        <ChunkList chunks={chunks} limit={30} />
      </View>

      <Button testID="save-text" label={saveLabel} onPress={save} />
    </Screen>
  );
}
