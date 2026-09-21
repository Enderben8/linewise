/**
 * Signs release builds with a keystore given through environment variables, so the signing key
 * never lives in the repo (SPEC §1 rule 4). Without the variables, release builds fall back to the
 * debug key, which is fine for local testing but not for sharing.
 *
 *   LINEWISE_KEYSTORE_FILE       path to the .jks / .keystore file
 *   LINEWISE_KEYSTORE_PASSWORD   store password
 *   LINEWISE_KEY_ALIAS           key alias
 *   LINEWISE_KEY_PASSWORD        key password
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = 'LINEWISE_KEYSTORE_FILE';

function patch(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  const withConfig = gradle.replace(/signingConfigs \{\r?\n(\s*)debug \{/, (_m, indent) => {
    const i = indent;
    return [
      'signingConfigs {',
      `${i}release {`,
      `${i}    if (System.getenv('${MARKER}')) {`,
      `${i}        storeFile file(System.getenv('${MARKER}'))`,
      `${i}        storePassword System.getenv('LINEWISE_KEYSTORE_PASSWORD')`,
      `${i}        keyAlias System.getenv('LINEWISE_KEY_ALIAS')`,
      `${i}        keyPassword System.getenv('LINEWISE_KEY_PASSWORD')`,
      `${i}    }`,
      `${i}}`,
      `${i}debug {`,
    ].join('\n');
  });
  if (withConfig === gradle) throw new Error('withReleaseSigning: signingConfigs block not found');

  const buildTypes = withConfig.indexOf('buildTypes {');
  if (buildTypes === -1) throw new Error('withReleaseSigning: buildTypes block not found');
  const head = withConfig.slice(0, buildTypes);
  const tail = withConfig.slice(buildTypes);
  const patchedTail = tail.replace(
    /(\brelease \{[\s\S]*?)signingConfig signingConfigs\.debug/,
    `$1signingConfig System.getenv('${MARKER}') ? signingConfigs.release : signingConfigs.debug`,
  );
  if (patchedTail === tail) throw new Error('withReleaseSigning: release signingConfig not found');
  return head + patchedTail;
}

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patch(cfg.modResults.contents);
    return cfg;
  });
module.exports.patch = patch;
