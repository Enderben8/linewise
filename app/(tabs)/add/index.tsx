import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { spacing, useTheme } from '../../../src/components/theme';
import { AppText, Card, Row, Screen } from '../../../src/components/ui';
import { pickTextFile } from '../../../src/features/import/pickFile';
import { notify } from '../../../src/lib/dialog';
import { useAppDispatch } from '../../../src/store';
import { draftActions } from '../../../src/store/draftSlice';

function Option({
  icon,
  title,
  body,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  onPress: () => void;
  testID: string;
}) {
  const { palette } = useTheme();
  return (
    <Card testID={testID} onPress={onPress}>
      <Row style={{ gap: spacing.lg }}>
        <Ionicons name={icon} size={30} color={palette.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{title}</AppText>
          <AppText muted>{body}</AppText>
        </View>
      </Row>
    </Card>
  );
}

export default function AddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);

  const importFile = async () => {
    if (busy) return;
    setBusy(true);
    const res = await pickTextFile();
    setBusy(false);
    if (res.status === 'ok') {
      dispatch(draftActions.setDraft({ title: res.title, body: res.body }));
      router.push('/add/edit-text');
    } else if (res.status === 'too-large') {
      notify(t('add.fileTooLargeTitle'), t('add.fileTooLargeBody'));
    } else if (res.status === 'error') {
      notify(t('add.fileErrorTitle'), res.message);
    }
  };

  return (
    <Screen>
      <AppText muted>{t('add.intro')}</AppText>
      <Option
        testID="add-type"
        icon="create-outline"
        title={t('add.typeTitle')}
        body={t('add.typeBody')}
        onPress={() => {
          dispatch(draftActions.clearDraft());
          router.push('/add/edit-text');
        }}
      />
      <Option
        testID="add-file"
        icon="document-text-outline"
        title={t('add.fileTitle')}
        body={t('add.fileBody')}
        onPress={importFile}
      />
      <Option
        testID="add-camera"
        icon="camera-outline"
        title={t('add.cameraOptionTitle')}
        body={t('add.cameraOptionBody')}
        onPress={() => router.push('/add/camera-recognition')}
      />
      {/* Browsers cannot receive text shared from other apps. */}
      {Platform.OS !== 'web' ? (
        <AppText variant="caption" muted>
          {t('add.shareHint')}
        </AppText>
      ) : null}
    </Screen>
  );
}
