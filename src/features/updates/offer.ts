import Constants from 'expo-constants';
import { Linking } from 'react-native';
import i18n from '../../i18n';
import { confirmAction } from '../../lib/dialog';
import type { AvailableUpdate } from './version';

/** This build's version, stamped into app.json from the release tag. */
export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/**
 * Asks whether to download the update, and opens the APK in the browser if so; Android then offers to
 * install it over this version. Resolves true when the user chose to download.
 */
export async function offerUpdate(update: AvailableUpdate): Promise<boolean> {
  const download = await confirmAction({
    title: i18n.t('updates.availableTitle'),
    message: i18n.t('updates.availableBody', { version: update.version }),
    confirmLabel: i18n.t('updates.download'),
    cancelLabel: i18n.t('updates.notNow'),
  });
  if (download) await Linking.openURL(update.url);
  return download;
}
