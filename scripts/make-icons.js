// Draws the Linewise icon set from the Wren mascot (same shapes as src/components/Mascot.tsx).
// Run with: node scripts/make-icons.js   (needs the `sharp` dev dependency)
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');
const TEAL = '#0F3D3E';

const BODY = '#E9A93A';
const BELLY = '#FFF1CF';
const DARK = '#1D2B2B';
const BEAK = '#E4572E';

/** Wren drawn in a 120x120 box. `mono` gives a one-colour silhouette with the eyes cut out. */
function wren({ mono = false } = {}) {
  const body = mono ? '#FFFFFF' : BODY;
  const parts = [
    `<ellipse cx="22" cy="72" rx="11" ry="20" fill="${body}" transform="rotate(15 20 60)"/>`,
    `<ellipse cx="98" cy="72" rx="11" ry="20" fill="${body}" transform="rotate(-15 100 60)"/>`,
    `<circle cx="60" cy="64" r="40" fill="${body}"/>`,
    `<path d="M52 26 C54 14 60 12 62 22 C64 12 72 14 68 27 Z" fill="${body}"/>`,
    `<path d="M48 104 L48 112 M44 112 L52 112 M72 104 L72 112 M68 112 L76 112" stroke="${mono ? '#FFFFFF' : BEAK}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  ];
  if (mono) {
    // Eyes and beak as holes so the silhouette still reads as a bird.
    return `<mask id="m"><rect width="120" height="120" fill="white"/>
      <circle cx="46" cy="55" r="6" fill="black"/><circle cx="74" cy="55" r="6" fill="black"/>
      <path d="M54 66 L66 66 L60 76 Z" fill="black"/></mask>
      <g mask="url(#m)">${parts.join('')}</g>`;
  }
  return [
    parts[0],
    parts[1],
    parts[2],
    `<ellipse cx="60" cy="78" rx="26" ry="22" fill="${BELLY}"/>`,
    parts[3],
    `<circle cx="46" cy="55" r="6" fill="#FFFFFF"/><circle cx="74" cy="55" r="6" fill="#FFFFFF"/>`,
    `<circle cx="46" cy="56" r="3.2" fill="${DARK}"/><circle cx="74" cy="56" r="3.2" fill="${DARK}"/>`,
    `<path d="M54 66 L66 66 L60 76 Z" fill="${BEAK}"/>`,
    parts[4],
  ].join('');
}

function svg(size, inner) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`,
  );
}

/** Places the 120-unit Wren so it is `fraction` of the canvas wide, centred. */
function placed(size, fraction, options) {
  const scale = (size * fraction) / 120;
  const offset = (size - 120 * scale) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})">${wren(options)}</g>`;
}

async function write(name, size, inner) {
  await sharp(svg(size, inner)).png().toFile(path.join(OUT, name));
  console.log('wrote', name);
}

async function main() {
  const bg = (size) => `<rect width="${size}" height="${size}" fill="${TEAL}"/>`;
  // Full icon (legacy launchers, store-less installs, notifications shade fallbacks).
  await write('icon.png', 1024, bg(1024) + placed(1024, 0.7));
  // Adaptive icon layers: the launcher masks to a circle or squircle and keeps ~66% visible.
  await write('android-icon-background.png', 1024, bg(1024));
  await write('android-icon-foreground.png', 1024, placed(1024, 0.6));
  await write('android-icon-monochrome.png', 1024, placed(1024, 0.6, { mono: true }));
  await write('splash-icon.png', 1024, placed(1024, 0.9));
  await write('favicon.png', 256, bg(256) + placed(256, 0.8));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
