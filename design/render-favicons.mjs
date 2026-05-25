import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';
const svg = readFileSync('source/icon-big.svg', 'utf8');
for (const size of [256, 512]) {
  const r = new Resvg(svg, { background: 'transparent', fitTo: { mode: 'width', value: size } });
  writeFileSync(`source/favicon-${size}.png`, r.render().asPng());
}
console.log('done');
