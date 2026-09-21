/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import en from './i18n/locales/en.json';

const root = path.join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'locales'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

const source = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'src'))]
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

// testID="literal" and tabBarButtonTestID: 'literal' are exact ids; testID={`prefix-${x}`} are prefixes.
const literalIds = new Set<string>();
for (const m of source.matchAll(
  /(?:testID|tabBarButtonTestID)(?:=|:\s*)\{?["'`]([^"'`$]+)["'`]\}?/g,
)) {
  literalIds.add(m[1]);
}
const idPrefixes = [...source.matchAll(/testID=\{`([^`$]*)\$\{/g)].map((m) => m[1]);

const flows = fs
  .readdirSync(path.join(root, 'e2e'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => ({ name: f, text: fs.readFileSync(path.join(root, 'e2e', f), 'utf8') }));

const strings: string[] = [];
(function collect(tree: unknown) {
  for (const v of Object.values(tree as Record<string, unknown>)) {
    if (typeof v === 'string') strings.push(v);
    else collect(v);
  }
})(en);

// Text the flows type in themselves, or a score they compute, rather than a UI string.
const USER_TEXT = [
  'Twinkle, Twinkle, Little Star',
  'Sweet Poem',
  'Rose Poem',
  'Fixture Poem',
  'Roses are red.',
  '100%',
];

describe('Maestro flows match the app', () => {
  it('only use ids that exist as testIDs', () => {
    const missing: string[] = [];
    for (const { name, text } of flows) {
      for (const m of text.matchAll(/^\s*id:\s*'?([^'\n]+?)'?\s*$/gm)) {
        const id = m[1];
        if (id.includes('.*')) {
          // Regex ids: at least one testID must match.
          const re = new RegExp(`^${id}$`);
          const known = [...literalIds, ...idPrefixes.map((p) => `${p}x`)];
          if (!known.some((k) => re.test(k))) missing.push(`${name}: ${id}`);
        } else if (!literalIds.has(id) && !idPrefixes.some((p) => id.startsWith(p))) {
          missing.push(`${name}: ${id}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('only assert text that exists in the English strings', () => {
    const missing: string[] = [];
    const asPattern = (s: string) =>
      new RegExp(
        `^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\\\{\w+\\\}\\\}/g, '.+')}$`,
      );
    for (const { name, text } of flows) {
      for (const m of text.matchAll(/^\s*-\s*(?:assertVisible|tapOn):\s*'([^']+)'\s*$/gm)) {
        const asserted = m[1];
        if (/^(Delete|Enter)$/.test(asserted) || /\.json$/.test(asserted)) continue;
        if (USER_TEXT.includes(asserted)) continue;
        const found = asserted.includes('.*')
          ? strings.some((s) =>
              ['X', '1'].some((v) =>
                new RegExp(`^${asserted}$`).test(s.replace(/\{\{\w+\}\}/g, v)),
              ),
            )
          : strings.some((s) => asPattern(s).test(asserted));
        if (!found) missing.push(`${name}: ${asserted}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
