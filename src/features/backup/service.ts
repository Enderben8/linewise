import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { readAllTables } from './apply';
import { backupFileName, buildBackup, parseBackup, type ParseResult } from './backup';

/** Writes linewise-backup-YYYY-MM-DD.json to the cache and opens the Android share sheet. Returns false when sharing is unavailable. */
export async function exportBackup(dialogTitle: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const now = Date.now();
  const file = new File(Paths.cache, backupFileName(now));
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(buildBackup(readAllTables(), now)));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle,
    UTI: 'public.json',
  });
  return true;
}

export type PickBackupResult =
  { status: 'cancelled' } | { status: 'error' } | ({ status: 'read' } & ParseResult);

/** Lets the user choose a backup file and checks that it is a Linewise backup we can read. */
export async function pickBackup(): Promise<PickBackupResult> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.[0]) return { status: 'cancelled' };
    const text = await new File(res.assets[0].uri).text();
    return { status: 'read', ...parseBackup(text) };
  } catch {
    return { status: 'error' };
  }
}
