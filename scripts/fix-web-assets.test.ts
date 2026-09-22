/**
 * @jest-environment node
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fixWebAssets } = require('./fix-web-assets') as { fixWebAssets: (dist: string) => void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { webBuildChecks } = require('./check-offline') as {
  webBuildChecks: (dist: string) => string[];
};

const JS = '_expo/static/js/web';
const WASM = 'expo-sqlite/web/wa-sqlite/wa-sqlite.7ca566fbbc2ec2a172c5aefa63a20f4b.wasm';
const md5 = (text: string) => createHash('md5').update(text).digest('hex');

let dist: string;

function write(file: string, text: string) {
  mkdirSync(dirname(join(dist, file)), { recursive: true });
  writeFileSync(join(dist, file), text);
}
const read = (file: string) => readFileSync(join(dist, file), 'utf8');

/** Writes a bundle named the way Expo names them, after the md5 of its contents. */
function bundle(name: string, text: string) {
  const file = `${JS}/${name}-${md5(text)}.js`;
  write(file, text);
  return file;
}

/** A small Expo web export: index.html loads the entry, which loads the SQLite worker. */
function exportSite() {
  write(`assets/node_modules/${WASM}`, '\0asm');
  const worker = bundle('worker', `c.exports="/assets/node_modules/${WASM}"`);
  const entry = bundle('entry', `new Worker("/${worker}")`);
  const chunk = bundle('index', 'console.log("lazy route")');
  write('index.html', `<script src="/${entry}" defer></script>`);
  write('sw.js', 'self.addEventListener("fetch", () => {})');
  return { worker, entry, chunk };
}

beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'dist-web-'));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  rmSync(dist, { recursive: true, force: true });
  jest.restoreAllMocks();
});

describe('fixWebAssets', () => {
  it('moves library assets out of node_modules, which Cloudflare Pages does not upload', () => {
    exportSite();
    fixWebAssets(dist);
    expect(existsSync(join(dist, 'assets/node_modules'))).toBe(false);
    expect(read(`assets/vendor/${WASM}`)).toBe('\0asm');
  });

  it('renames every bundle it edits, and the bundles that load them', () => {
    const { worker, entry, chunk } = exportSite();
    fixWebAssets(dist);

    const newEntry = /src="\/([^"]+)"/.exec(read('index.html'))![1];
    const newWorker = /new Worker\("\/([^"]+)"\)/.exec(read(newEntry))![1];
    expect(read(newWorker)).toBe(`c.exports="/assets/vendor/${WASM}"`);
    // A browser that cached the old worker or entry under their names never sees them again.
    expect(newWorker).not.toBe(worker);
    expect(newEntry).not.toBe(entry);
    expect(existsSync(join(dist, worker))).toBe(false);
    expect(existsSync(join(dist, entry))).toBe(false);
    // Bundles it did not touch keep their names, so browsers keep their cached copies.
    expect(existsSync(join(dist, chunk))).toBe(true);
    expect(webBuildChecks(dist)).toEqual([]);
  });
});

describe('webBuildChecks', () => {
  it('fails a build where a bundle was edited but kept its name', () => {
    const { chunk } = exportSite();
    fixWebAssets(dist);
    write(chunk, 'console.log("edited after export")');
    expect(webBuildChecks(dist)).toEqual([
      `${chunk} was edited after export but kept its name; browsers keep the old copy`,
    ]);
  });

  it('fails a build that still has a node_modules folder', () => {
    exportSite();
    const problems = webBuildChecks(dist);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/is under node_modules, which Cloudflare Pages does not upload$/);
  });
});
