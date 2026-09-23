import type { ProgressState } from '../../scheduler';
import { matchesSearch, reviewStatus } from './status';

export const MAX_FOLDER_NAME = 60;

interface FolderLike {
  id: string;
  name: string;
}

interface TextLike {
  id: string;
  folderId: string | null;
  title: string;
  author: string;
  tags: string[];
  progress: ProgressState;
}

export type FolderNameIssue = 'empty' | 'tooLong' | 'duplicate';

/** Why a folder name cannot be saved, or `null` when it can. Names are compared without case. */
export function folderNameIssue(
  name: string,
  folders: FolderLike[],
  exceptId?: string,
): FolderNameIssue | null {
  const trimmed = name.trim();
  if (!trimmed) return 'empty';
  if (trimmed.length > MAX_FOLDER_NAME) return 'tooLong';
  const lower = trimmed.toLocaleLowerCase();
  if (folders.some((f) => f.id !== exceptId && f.name.trim().toLocaleLowerCase() === lower)) {
    return 'duplicate';
  }
  return null;
}

export interface FolderSummary<F> {
  folder: F;
  /** Texts in the folder. */
  count: number;
  /** Texts in the folder with a review due today (the same "due" as the review badge). */
  due: number;
}

export function summarizeFolder<F extends FolderLike>(
  folder: F,
  items: TextLike[],
  now: number,
): FolderSummary<F> {
  const inside = items.filter((m) => m.folderId === folder.id);
  return {
    folder,
    count: inside.length,
    due: inside.filter((m) => reviewStatus(m.progress, now).kind === 'due').length,
  };
}

export type ListRow<F, T> =
  | { kind: 'folder'; key: string; summary: FolderSummary<F> }
  | { kind: 'text'; key: string; item: T };

/**
 * Rows for the Memorize list. With no search and no tag it shows the folders, then the texts in no
 * folder. A search or a tag looks through every text, in a folder or not, and a search also finds
 * folders by name.
 */
export function listRows<F extends FolderLike, T extends TextLike>(
  items: T[],
  folders: F[],
  opts: { query: string; tag: string | null; now: number },
): ListRow<F, T>[] {
  const q = opts.query.trim().toLocaleLowerCase();
  const filtering = q !== '' || opts.tag !== null;
  const shownFolders = !filtering
    ? folders
    : opts.tag === null
      ? folders.filter((f) => f.name.toLocaleLowerCase().includes(q))
      : [];
  const texts = filtering
    ? items.filter((m) => matchesSearch(m, opts.query) && (!opts.tag || m.tags.includes(opts.tag)))
    : items.filter((m) => m.folderId === null);
  return [
    ...shownFolders.map((folder) => ({
      kind: 'folder' as const,
      key: `folder:${folder.id}`,
      summary: summarizeFolder(folder, items, opts.now),
    })),
    ...texts.map((item) => ({ kind: 'text' as const, key: item.id, item })),
  ];
}
