/**
 * @jest-environment node
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { staticChecks } = require('../scripts/check-offline') as { staticChecks: () => string[] };

describe('offline guarantee (SPEC §1 rule 3)', () => {
  it('has no network dependencies, network calls or INTERNET permission', () => {
    expect(staticChecks()).toEqual([]);
  });
});
