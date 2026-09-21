import { addDays, newProgress, startOfDay } from '../../scheduler';
import { backupDue, matchesSearch, parseTags, reviewStatus } from './status';

const now = new Date(2026, 4, 10, 12).getTime();

describe('reviewStatus', () => {
  it('reports new, due, upcoming and done', () => {
    expect(reviewStatus(newProgress(), now)).toEqual({ kind: 'new' });
    expect(
      reviewStatus({ ...newProgress(), intervalIndex: 2, nextReviewAt: startOfDay(now) }, now),
    ).toEqual({
      kind: 'due',
    });
    expect(
      reviewStatus({ ...newProgress(), intervalIndex: 2, nextReviewAt: addDays(now, 3) }, now),
    ).toEqual({ kind: 'upcoming', days: 3 });
    expect(reviewStatus({ ...newProgress(), intervalIndex: 7, nextReviewAt: null }, now)).toEqual({
      kind: 'done',
    });
  });
});

describe('backupDue', () => {
  const day = 86_400_000;
  it('nags after 30 days since the last backup', () => {
    const o = { enabled: true, lastBackupAt: now - 31 * day, oldestCreatedAt: now - 90 * day };
    expect(backupDue(o, now)).toBe(true);
    expect(backupDue({ ...o, lastBackupAt: now - 5 * day }, now)).toBe(false);
  });

  it('counts from the oldest text when never backed up, and can be turned off', () => {
    expect(
      backupDue({ enabled: true, lastBackupAt: null, oldestCreatedAt: now - 40 * day }, now),
    ).toBe(true);
    expect(
      backupDue({ enabled: true, lastBackupAt: null, oldestCreatedAt: now - 2 * day }, now),
    ).toBe(false);
    expect(backupDue({ enabled: true, lastBackupAt: null, oldestCreatedAt: null }, now)).toBe(
      false,
    );
    expect(
      backupDue({ enabled: false, lastBackupAt: null, oldestCreatedAt: now - 99 * day }, now),
    ).toBe(false);
  });
});

describe('tags and search', () => {
  it('parses tags without duplicates', () => {
    expect(parseTags('poetry, Poetry ,school\n exam,,')).toEqual(['poetry', 'school', 'exam']);
  });

  it('searches title, author and tags', () => {
    const m = { title: 'Sonnet 18', author: 'Shakespeare', tags: ['poetry'] };
    expect(matchesSearch(m, 'sonnet')).toBe(true);
    expect(matchesSearch(m, 'SHAKE')).toBe(true);
    expect(matchesSearch(m, 'poet')).toBe(true);
    expect(matchesSearch(m, 'xyz')).toBe(false);
    expect(matchesSearch(m, '  ')).toBe(true);
  });
});
