/**
 * @jest-environment node
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { siteUrl } = require('./set-homepage') as {
  siteUrl: (subdomain: string, domains: { name: string; status: string }[]) => string;
};

describe('siteUrl', () => {
  it('uses the pages.dev address when there is no custom domain', () => {
    expect(siteUrl('linewise-5ds.pages.dev', [])).toBe('https://linewise-5ds.pages.dev/');
  });

  it('prefers a custom domain once it is active', () => {
    const domain = { name: 'linewise.example', status: 'active' };
    expect(siteUrl('linewise-5ds.pages.dev', [domain])).toBe('https://linewise.example/');
    expect(siteUrl('linewise-5ds.pages.dev', [{ ...domain, status: 'pending' }])).toBe(
      'https://linewise-5ds.pages.dev/',
    );
  });
});
