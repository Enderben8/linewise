import { isNewer, parseRelease, parseVersion, type Release } from './version';

const SITE = 'https://github.com/Enderben8/linewise/releases/';
const apk = (name: string) => ({
  name,
  browser_download_url: `${SITE}download/v1.2.0/${name}`,
});

describe('parseVersion', () => {
  it('reads a release tag', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('v1.2.3-rc.1')).toEqual([1, 2, 3]);
  });

  it('refuses anything else', () => {
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('isNewer', () => {
  it('compares each part as a number', () => {
    expect(isNewer('v1.1.2', '1.1.1')).toBe(true);
    expect(isNewer('v1.2.0', '1.1.9')).toBe(true);
    expect(isNewer('v2.0.0', '1.9.9')).toBe(true);
    expect(isNewer('v1.10.0', '1.9.0')).toBe(true);
  });

  it('is false for the same or an older version, or an unreadable one', () => {
    expect(isNewer('v1.1.2', '1.1.2')).toBe(false);
    expect(isNewer('v1.0.9', '1.1.0')).toBe(false);
    expect(isNewer('nightly', '1.1.2')).toBe(false);
    expect(isNewer('v1.1.3', 'unknown')).toBe(false);
  });
});

describe('parseRelease', () => {
  const release: Release = {
    tag_name: 'v1.2.0',
    html_url: `${SITE}tag/v1.2.0`,
    assets: [apk('linewise-v1.2.0.apk.sha256'), apk('linewise-v1.2.0.apk')],
  };

  it('offers the release APK, not its checksum file', () => {
    expect(parseRelease(release, '1.1.2', SITE)).toEqual({
      version: '1.2.0',
      url: `${SITE}download/v1.2.0/linewise-v1.2.0.apk`,
    });
  });

  it('falls back to the release page when there is no APK', () => {
    expect(parseRelease({ ...release, assets: [] }, '1.1.2', SITE)).toEqual({
      version: '1.2.0',
      url: `${SITE}tag/v1.2.0`,
    });
  });

  it('ignores a release that is not newer, or has no readable tag', () => {
    expect(parseRelease(release, '1.2.0', SITE)).toBeNull();
    expect(parseRelease(release, '1.3.0', SITE)).toBeNull();
    expect(parseRelease({ ...release, tag_name: undefined }, '1.1.2', SITE)).toBeNull();
  });

  it('refuses a download from anywhere but the releases page', () => {
    const elsewhere = {
      ...release,
      assets: [{ name: 'linewise.apk', browser_download_url: 'https://example.test/linewise.apk' }],
    };
    expect(parseRelease(elsewhere, '1.1.2', SITE)).toBeNull();
    expect(
      parseRelease({ ...release, html_url: 'https://example.test/', assets: [] }, '1.1.2', SITE),
    ).toBeNull();
  });
});
