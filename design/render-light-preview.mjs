import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';
const svg = readFileSync('logostoole/toole-logo-full-light.svg', 'utf8');
// Background sombre pour simuler la footer
const r = new Resvg(svg, { background: '#16132E', fitTo: { mode: 'width', value: 600 } });
writeFileSync('logostoole/toole-logo-full-light-preview.png', r.render().asPng());
