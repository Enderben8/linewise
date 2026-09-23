/**
 * @jest-environment node
 */
import { getTableColumns, getTableName } from 'drizzle-orm';
import { migrations } from './migrations';
import { folders, memorizations, progress, recordings, sessions, settings } from './schema';

// Node's built-in SQLite, so the real migration SQL runs against a real engine in tests.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

function freshDb(upTo = Infinity) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const entry of migrations.journal.entries.filter((e) => e.idx <= upTo)) {
    const sql = (migrations.migrations as Record<string, string>)[
      `m${String(entry.idx).padStart(4, '0')}`
    ];
    for (const statement of sql.split('--> statement-breakpoint')) db.exec(statement);
  }
  return db;
}

describe('migrations', () => {
  it('journal entries are in order and each has SQL', () => {
    const { entries } = migrations.journal;
    expect(entries.map((e) => e.idx)).toEqual(entries.map((_, i) => i));
    for (let i = 1; i < entries.length; i++)
      expect(entries[i].when).toBeGreaterThan(entries[i - 1].when);
    for (const e of entries) {
      expect(Object.keys(migrations.migrations)).toContain(`m${String(e.idx).padStart(4, '0')}`);
    }
  });

  it('creates every table with exactly the columns the Drizzle schema declares', () => {
    const db = freshDb();
    for (const table of [settings, folders, memorizations, progress, sessions, recordings]) {
      const name = getTableName(table);
      const actual = (db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[])
        .map((c) => c.name)
        .sort();
      const declared = Object.values(getTableColumns(table))
        .map((c) => c.name)
        .sort();
      expect({ table: name, columns: actual }).toEqual({ table: name, columns: declared });
    }
  });

  it('cascades deletes from a memorization to its progress, sessions and recordings', () => {
    const db = freshDb();
    db.exec(`
      INSERT INTO memorizations (id, title, body, body_hash, chunks, tags, created_at, updated_at)
        VALUES ('m1', 't', 'b', 'h', '[]', '[]', 1, 1);
      INSERT INTO progress (memorization_id, solidify_scores, hidden_words, voice_overrides, updated_at)
        VALUES ('m1', '{}', '[]', '{}', 1);
      INSERT INTO sessions (id, memorization_id, game, chunk_start, chunk_end, accuracy, coverage, weighted_score, created_at)
        VALUES ('s1', 'm1', 'type-it', 0, 0, 1, 1, 1, 1);
      INSERT INTO recordings (id, memorization_id, name, file_uri, duration_sec, body_hash, created_at)
        VALUES ('r1', 'm1', 'n', 'file:///x.m4a', 3, 'h', 1);
      DELETE FROM memorizations WHERE id = 'm1';
    `);
    for (const table of ['progress', 'sessions', 'recordings']) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
  });

  it('adds folders to a database from before folders without losing texts', () => {
    const db = freshDb(0);
    db.exec(`
      INSERT INTO memorizations (id, title, body, body_hash, chunks, tags, created_at, updated_at)
        VALUES ('m1', 'Old text', 'b', 'h', '[]', '[]', 1, 1);
    `);
    const sql = (migrations.migrations as Record<string, string>).m0001;
    for (const statement of sql.split('--> statement-breakpoint')) db.exec(statement);
    expect(db.prepare('SELECT id, title, folder_id FROM memorizations').all()).toEqual([
      { id: 'm1', title: 'Old text', folder_id: null },
    ]);
  });

  it('leaves texts in no folder when their folder is deleted, and refuses unknown folders', () => {
    const db = freshDb();
    db.exec(`
      INSERT INTO folders (id, name, created_at, updated_at) VALUES ('f1', 'Poems', 1, 1);
      INSERT INTO memorizations (id, title, body, body_hash, chunks, tags, created_at, updated_at, folder_id)
        VALUES ('m1', 't', 'b', 'h', '[]', '[]', 1, 1, 'f1');
      DELETE FROM folders WHERE id = 'f1';
    `);
    expect(db.prepare('SELECT folder_id FROM memorizations').get()).toEqual({ folder_id: null });
    expect(() => db.exec(`UPDATE memorizations SET folder_id = 'nope' WHERE id = 'm1'`)).toThrow(
      /FOREIGN KEY/,
    );
  });
});
