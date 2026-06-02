import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';

function render(svg, width, height, bg) {
  const r = new Resvg(svg, {
    background: bg || 'rgba(0,0,0,0)',
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true },
  });
  return r.render().asPng();
}

// 1) Icon carré 1024 (iOS + Android)
const iconSvg = readFileSync('source-v2/icon.svg', 'utf8');
writeFileSync('source-v2/icon.png', render(iconSvg, 1024));
writeFileSync('source-v2/favicon-512.png', render(iconSvg, 512));
writeFileSync('source-v2/favicon-256.png', render(iconSvg, 256));
console.log('✓ icon.png 1024');
console.log('✓ favicon 512 + 256');
