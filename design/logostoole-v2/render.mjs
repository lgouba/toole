import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/macos/Tollé/design/logostoole-v2';
const livreurSvg = fs.readFileSync(path.join(root, 'livreur-flat.svg'), 'utf8');
const livreurInner = livreurSvg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

function lighten(svg, lift = 0.35) {
  return svg.replace(/#([0-9a-fA-F]{6})/g, (m, hex) => {
    const r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min){h=s=0;} else {
      const d=max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}
      h/=6;
    }
    l = Math.min(1, Math.max(l, 0.45) + lift);
    s = Math.min(1, s * 0.85);
    function hue2rgb(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    const R=Math.round(hue2rgb(p,q,h+1/3)*255);
    const G=Math.round(hue2rgb(p,q,h)*255);
    const B=Math.round(hue2rgb(p,q,h-1/3)*255);
    return '#'+[R,G,B].map(x=>x.toString(16).padStart(2,'0')).join('');
  });
}

const livreurLightInner = lighten(livreurInner, 0.35);

// 1) LOGO WORDMARK
const wordmark = fs.readFileSync(path.join(root, 'logo-wordmark.svg'), 'utf8');
fs.writeFileSync(path.join(root, 'preview-logo.png'),
  new Resvg(wordmark, { background: '#FFFFFF', fitTo: { mode: 'width', value: 1600 } }).render().asPng());

// 2) APP ICON
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bgI" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#ECFDF5"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="230" fill="url(#bgI)"/>
  <g transform="translate(152,212) scale(1.2)">
    <svg viewBox="0 0 600 500" width="600" height="500">${livreurInner}</svg>
  </g>
</svg>`;
fs.writeFileSync(path.join(root, 'app-icon.svg'), appIcon);
fs.writeFileSync(path.join(root, 'preview-icon.png'),
  new Resvg(appIcon, { fitTo: { mode: 'width', value: 1024 } }).render().asPng());

// 3) SPLASH
const splashW = 1242, splashH = 2688;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${splashW} ${splashH}">
  <defs>
    <linearGradient id="bgS" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0E3B26"/>
      <stop offset="1" stop-color="#072117"/>
    </linearGradient>
    <linearGradient id="progress" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#86EFAC"/>
      <stop offset="1" stop-color="#22C55E"/>
    </linearGradient>
  </defs>
  <rect width="${splashW}" height="${splashH}" fill="url(#bgS)"/>

  <g transform="translate(120,800) scale(1.67)">
    <svg viewBox="0 0 600 500" width="600" height="500">${livreurLightInner}</svg>
  </g>

  <text x="${splashW/2}" y="2080" text-anchor="middle"
        font-family="Avenir Next, Helvetica Neue, sans-serif"
        font-weight="800" font-style="italic"
        font-size="220" fill="#FFFFFF" letter-spacing="-4">Toolé</text>

  <text x="${splashW/2}" y="2170" text-anchor="middle"
        font-family="Avenir Next, Helvetica Neue, sans-serif"
        font-weight="500" font-size="48" fill="#86EFAC" letter-spacing="6">Rapide. Fiable. Proche.</text>

  <rect x="${splashW/2 - 180}" y="2480" width="360" height="10" rx="5" fill="#1F4A36"/>
  <rect x="${splashW/2 - 180}" y="2480" width="220" height="10" rx="5" fill="url(#progress)"/>
</svg>`;
fs.writeFileSync(path.join(root, 'splash.svg'), splash);
fs.writeFileSync(path.join(root, 'preview-splash.png'),
  new Resvg(splash, { fitTo: { mode: 'width', value: 720 } }).render().asPng());

console.log('OK');
