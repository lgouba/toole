import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';
const svg = readFileSync('source/icon-big.svg', 'utf8');
// Render à 150px comme sur le home Android
const r = new Resvg(svg, { background: 'transparent', fitTo: { mode: 'width', value: 150 } });
writeFileSync('source/icon-preview-150.png', r.render().asPng());
// Et 96px (taille app drawer)
const r2 = new Resvg(svg, { background: 'transparent', fitTo: { mode: 'width', value: 96 } });
writeFileSync('source/icon-preview-96.png', r2.render().asPng());
console.log('done');
