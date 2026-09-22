import { downloadText, pickBrowserFile } from '../../lib/browserFiles.web';
import { readAllTables } from './apply';
import { backupFileName, buildBackup, parseBackup, type ParseResult } from './backup';

/** Downloads linewise-backup-YYYY-MM-DD.json. The browser saves it to the Downloads folder. */
export async function exportBackup(_dialogTitle: string): Promise<boolean> {
  const now = Date.now();
  downloadText(
    backupFileName(now),
    JSON.stringify(buildBackup(readAllTables(), now)),
    'application/json',
  );
  return true;
}

export type PickBackupResult =
  { status: 'cancelled' } | { status: 'error' } | ({ status: 'read' } & ParseResult);

export async function pickBackup(): Promise<PickBackupResult> {
  try {
    const file = await pickBrowserFile('.json,application/json');
    if (!file) return { status: 'cancelled' };
    return { status: 'read', ...parseBackup(await file.text()) };
  } catch {
    return { status: 'error' };
  }
}
