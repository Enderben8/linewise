/**
 * @jest-environment node
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseTag } = require('./set-version') as {
  parseTag: (tag: string) => { name: string; code: number };
};

describe('parseTag', () => {
  it('turns a tag into a name and a rising version code', () => {
    expect(parseTag('v1.0.0')).toEqual({ name: '1.0.0', code: 10000 });
    expect(parseTag('v1.2.3')).toEqual({ name: '1.2.3', code: 10203 });
    expect(parseTag('2.10.7')).toEqual({ name: '2.10.7', code: 21007 });
    expect(parseTag('v1.0.1').code).toBeGreaterThan(parseTag('v1.0.0').code);
    expect(parseTag('v1.1.0').code).toBeGreaterThan(parseTag('v1.0.99').code);
  });

  it('ignores a pre-release suffix and rejects other tags', () => {
    expect(parseTag('v1.2.3-rc.1').name).toBe('1.2.3');
    expect(() => parseTag('latest')).toThrow(/version tag/);
    expect(() => parseTag('v1.100.0')).toThrow(/0-99/);
  });
});
