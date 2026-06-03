import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';
const svg = readFileSync('logostoole/android-adaptive-foreground.svg', 'utf8');
const r = new Resvg(svg, { background: 'rgba(0,0,0,0)', fitTo: { mode: 'width', value: 1024 } });
writeFileSync('logostoole/android-adaptive-foreground.png', r.render().asPng());

// Aussi rendre l'icon seul en 256/512 pour favicons
const iconSvg = readFileSync('logostoole/toole-icon.svg', 'utf8');
for (const size of [256, 512, 1024]) {
  const r2 = new Resvg(iconSvg, { background: 'rgba(0,0,0,0)', fitTo: { mode: 'width', value: size } });
  writeFileSync(`logostoole/toole-icon-${size}.png`, r2.render().asPng());
}
console.log('done');
