import { newProgress } from '../../scheduler';
import { folderNameIssue, listRows, MAX_FOLDER_NAME, summarizeFolder } from './folders';

const DAY = 86_400_000;
const NOW = 100 * DAY;

const text = (
  id: string,
  folderId: string | null,
  over: { tags?: string[]; due?: boolean } = {},
) => ({
  id,
  title: `Title ${id}`,
  author: '',
  tags: over.tags ?? [],
  folderId,
  progress: {
    ...newProgress(),
    // Reviewed once already, so it is either due today or in a few days (not "new").
    intervalIndex: 1,
    nextReviewAt: over.due ? NOW - DAY : NOW + 3 * DAY,
  },
});
const folder = (id: string, name = id) => ({ id, name });

describe('folderNameIssue', () => {
  const folders = [folder('f1', 'Poems'), folder('f2', 'Speeches')];

  it('accepts a new name and trims it', () => {
    expect(folderNameIssue('  Verses ', folders)).toBeNull();
  });

  it('refuses empty and over-long names', () => {
    expect(folderNameIssue('   ', folders)).toBe('empty');
    expect(folderNameIssue('x'.repeat(MAX_FOLDER_NAME), folders)).toBeNull();
    expect(folderNameIssue('x'.repeat(MAX_FOLDER_NAME + 1), folders)).toBe('tooLong');
  });

  it('refuses a name another folder has, whatever the case, but not the folder being renamed', () => {
    expect(folderNameIssue('poems ', folders)).toBe('duplicate');
    expect(folderNameIssue('POEMS', folders, 'f1')).toBeNull();
    expect(folderNameIssue('Speeches', folders, 'f1')).toBe('duplicate');
  });
});

describe('summarizeFolder', () => {
  it('counts the texts in the folder and those due today', () => {
    const items = [
      text('a', 'f1', { due: true }),
      text('b', 'f1'),
      text('c', 'f2', { due: true }),
      { ...text('d', 'f1'), progress: newProgress() }, // new, not "due"
    ];
    expect(summarizeFolder(folder('f1'), items, NOW)).toMatchObject({ count: 3, due: 1 });
    expect(summarizeFolder(folder('f3'), items, NOW)).toMatchObject({ count: 0, due: 0 });
  });
});

describe('listRows', () => {
  const folders = [folder('f1', 'Poems'), folder('f2', 'Speeches')];
  const items = [
    text('a', 'f1', { tags: ['love'] }),
    text('b', null, { tags: ['love'] }),
    text('c', 'f2'),
    text('d', null),
  ];
  const keys = (query: string, tag: string | null) =>
    listRows(items, folders, { query, tag, now: NOW }).map((r) => r.key);

  it('shows folders, then the texts in no folder', () => {
    expect(keys('', null)).toEqual(['folder:f1', 'folder:f2', 'b', 'd']);
  });

  it('searches every text, and folders by name', () => {
    expect(keys('title a', null)).toEqual(['a']);
    expect(keys('poem', null)).toEqual(['folder:f1']);
    expect(keys('   ', null)).toEqual(['folder:f1', 'folder:f2', 'b', 'd']);
  });

  it('filters every text by tag and hides folders', () => {
    expect(keys('', 'love')).toEqual(['a', 'b']);
  });
});
