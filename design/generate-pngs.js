/**
 * Convertit les SVG sources en PNG aux tailles requises par les apps.
 * Usage : node generate-pngs.js
 *
 * Génère :
 *  - icon.png             1024x1024  (iOS app icon, Android legacy)
 *  - adaptive-icon.png    1024x1024  (Android adaptive foreground, padding inclus)
 *  - splash-icon.png      1242x2436  (splash screen Expo)
 *  - favicon.png          512x512    (web)
 *  - logo-horizontal.png  1600x480   (header landing, signature email)
 *  - logo-horizontal@2x.png 3200x960 (retina haute-def)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'output');
mkdirSync(out, { recursive: true });

function render(svgPath, outName, width) {
  const svg = readFileSync(svgPath, 'utf8');
  const resvg = new Resvg(svg, {
    background: 'rgba(0,0,0,0)',
    fitTo: { mode: 'width', value: width },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'Helvetica',
    },
  });
  const png = resvg.render().asPng();
  writeFileSync(join(out, outName), png);
  console.log(`  ✓ ${outName}  (${width}px wide)`);
}

console.log('Generating PNGs...\n');

// App icon iOS / Android legacy (square avec coins arrondis)
render(join(here, 'assets/icon-square.svg'), 'icon.png', 1024);

// Adaptive icon Android (juste le foreground, doit avoir du padding interne
// car Android applique des masques. On utilise la version full avec un peu
// plus d'espace.)
render(join(here, 'assets/icon-square-full.svg'), 'adaptive-icon.png', 1024);

// Splash screen Expo (Expo redimensionne, on génère carré 1242x1242 puis on
// peut crop côté Expo via splash.image)
render(join(here, 'assets/icon-square.svg'), 'splash-icon.png', 1242);

// Favicon web
render(join(here, 'assets/icon-square.svg'), 'favicon.png', 512);

// Logo horizontal landing
render(join(here, 'assets/logo-horizontal.svg'), 'logo-horizontal.png', 1600);
render(join(here, 'assets/logo-horizontal.svg'), 'logo-horizontal@2x.png', 3200);

console.log('\n✓ Done. Files in design/output/');
