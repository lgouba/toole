import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';
const svg = readFileSync('source/icon-big.svg', 'utf8');
const r = new Resvg(svg, { background: 'transparent', fitTo: { mode: 'width', value: 256 } });
writeFileSync('source/icon-big-256.png', r.render().asPng());
