/**
 * @jest-environment node
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { patch } = require('./withReleaseSigning') as { patch: (gradle: string) => string };

const TEMPLATE = `android {
    defaultConfig {
        versionCode 1
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled true
        }
    }
}`;

describe('withReleaseSigning', () => {
  const out = patch(TEMPLATE);

  it('adds a release signing config that reads the keystore from the environment', () => {
    expect(out).toContain("storeFile file(System.getenv('LINEWISE_KEYSTORE_FILE'))");
    expect(out).toContain("storePassword System.getenv('LINEWISE_KEYSTORE_PASSWORD')");
    expect(out).toContain("keyAlias System.getenv('LINEWISE_KEY_ALIAS')");
    expect(out).toContain("keyPassword System.getenv('LINEWISE_KEY_PASSWORD')");
  });

  it('signs release with it when set, and only changes the release build type', () => {
    expect(out).toContain(
      "signingConfig System.getenv('LINEWISE_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    const debugType = out.slice(out.indexOf('debug {\n            signingConfig'));
    expect(debugType.startsWith('debug {\n            signingConfig signingConfigs.debug')).toBe(
      true,
    );
  });

  it('keeps no secret in the file and is idempotent', () => {
    expect(out).not.toMatch(/storePassword '(?!android')/);
    expect(patch(out)).toBe(out);
  });

  it('fails loudly when the template changes shape', () => {
    expect(() => patch('android { }')).toThrow(/signingConfigs block not found/);
    expect(() => patch('signingConfigs {\n debug {\n }\n}')).toThrow(/buildTypes block not found/);
  });
});
