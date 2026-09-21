/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import { parseBackup, summarize } from './backup';

// The Maestro restore flow imports this file, so it must stay a valid backup.
describe('e2e backup fixture', () => {
  it('is a valid Linewise backup', () => {
    const text = fs.readFileSync(
      path.join(__dirname, '../../../e2e/fixtures/linewise-backup-test.json'),
      'utf8',
    );
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(summarize(parsed.backup)).toMatchObject({
        memorizations: 1,
        titles: ['Fixture Poem'],
      });
    }
  });
});
