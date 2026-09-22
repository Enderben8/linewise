// Copies the on-device text recognition files (Tesseract.js) into the web build, so scanning never
// loads anything from a CDN.  node scripts/copy-ocr-assets.js [dist=dist-web]
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, process.argv[2] || 'dist-web', 'ocr');

/** Tesseract language codes for Linewise's text languages (Arabic and Hebrew are not offered). */
const LANGS = ['eng', 'spa', 'fra', 'deu', 'tgl', 'por', 'nld', 'hin', 'chi_sim'];

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

// The worker script.
copy(
  path.join(root, 'node_modules/tesseract.js/dist/worker.min.js'),
  path.join(out, 'worker.min.js'),
);

// The WebAssembly cores. Tesseract loads *.wasm.js (the wasm is embedded), picking the SIMD variant
// the browser supports. Only the LSTM variants are needed, since the app runs workers in LSTM-only mode.
const coreDir = path.join(root, 'node_modules/tesseract.js-core');
for (const f of fs.readdirSync(coreDir)) {
  if (/-lstm\.wasm\.js$/.test(f)) copy(path.join(coreDir, f), path.join(out, 'core', f));
}

// Language data, preferring the smaller, faster "best_int" models.
for (const lang of LANGS) {
  const base = path.join(root, 'node_modules/@tesseract.js-data', lang);
  const dir = ['4.0.0_best_int', '4.0.0']
    .map((d) => path.join(base, d))
    .find((d) => fs.existsSync(d));
  if (!dir) throw new Error(`No Tesseract data for ${lang}`);
  copy(path.join(dir, `${lang}.traineddata.gz`), path.join(out, 'lang', `${lang}.traineddata.gz`));
}

console.log(`Copied OCR assets to ${path.relative(root, out)}`);
