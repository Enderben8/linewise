/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { staticChecks, cspChecks } = require('../scripts/check-offline') as {
  staticChecks: () => string[];
  cspChecks: (headers: string) => string[];
};

describe('offline guarantee (SPEC §1 rule 3)', () => {
  it('has no network dependencies, and no network calls but the update check', () => {
    expect(staticChecks()).toEqual([]);
  });

  it('the web app Content-Security-Policy only allows this site', () => {
    expect(cspChecks(readFileSync(join(__dirname, '..', 'public', '_headers'), 'utf8'))).toEqual(
      [],
    );
  });

  it('rejects a policy that lets the browser reach another host', () => {
    const headers =
      "/*\n  Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.example.com";
    expect(cspChecks(headers)).toEqual(['CSP connect-src allows "https://api.example.com"']);
    expect(cspChecks('/*\n  X-Frame-Options: DENY')).toEqual([
      'public/_headers has no Content-Security-Policy',
    ]);
  });
});
