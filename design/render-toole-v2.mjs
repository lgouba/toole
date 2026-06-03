import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';
function render(file, w, bg) {
  const r = new Resvg(readFileSync(file, 'utf8'), {
    background: bg || 'rgba(0,0,0,0)',
    fitTo: { mode: 'width', value: w },
    font: { loadSystemFonts: true },
  });
  return r.render().asPng();
}
writeFileSync('logostoole/toole-icon-preview.png', render('logostoole/toole-icon.svg', 512));
writeFileSync('logostoole/toole-logo-full-preview.png', render('logostoole/toole-logo-full.svg', 800));
writeFileSync('logostoole/android-adaptive-fg-preview.png', render('logostoole/android-adaptive-foreground.svg', 1024));
console.log('rendered');
