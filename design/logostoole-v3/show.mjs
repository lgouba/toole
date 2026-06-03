import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/macos/Tollé/design/logostoole-v3';
const out = path.join(root, 'previews');
fs.mkdirSync(out, { recursive: true });

const master = path.join(root, 'toole-master-light-clean.png');
const masterDark = path.join(root, 'toole-master-dark-clean.png');
const splash = path.join(root, 'toole-splash.png');

// 1) iOS icons row at real-device-pixel sizes side by side
async function iosRow() {
  const sizes = [180, 152, 120, 87, 60, 40, 29];
  const padding = 20, labelH = 30;
  const tiles = [];
  let totalW = padding;
  for (const s of sizes) {
    const buf = await sharp(master).resize(s, s, { fit:'contain', background:'#FFFFFF' }).flatten({background:'#FFFFFF'}).toBuffer();
    tiles.push({ buf, size: s, x: totalW });
    totalW += s + padding;
  }
  const H = 180 + labelH + padding * 2;
  const layers = tiles.map(t => ({ input: t.buf, top: padding + (180 - t.size), left: t.x }));
  await sharp({ create: { width: totalW, height: H, channels: 4, background: '#1E293B' } })
    .composite(layers)
    .png()
    .toFile(path.join(out, '1-ios-icons.png'));
}

// 2) Android adaptive icon — 3 masques côte à côte sur fond gris
async function androidAdaptive() {
  const W = 1200, H = 480, tile = 360, pad = 40;
  const bg = await sharp({ create:{ width: 1024, height: 1024, channels:4, background:'#FFFFFF'}}).png().toBuffer();
  const fg = await sharp(master).resize(660, 660, { fit:'contain', background:{r:0,g:0,b:0,alpha:0} }).toBuffer();
  const full = await sharp(bg).composite([{ input: fg, gravity:'center'}]).png().toBuffer();
  const square = await sharp(full).resize(tile, tile).png().toBuffer();

  const circleMask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}"><circle cx="${tile/2}" cy="${tile/2}" r="${tile/2}" fill="white"/></svg>`)).png().toBuffer();
  const squircleMask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}"><rect width="${tile}" height="${tile}" rx="${tile*0.27}" ry="${tile*0.27}" fill="white"/></svg>`)).png().toBuffer();
  const circle = await sharp(square).ensureAlpha().composite([{input: circleMask, blend:'dest-in'}]).png().toBuffer();
  const squircle = await sharp(square).ensureAlpha().composite([{input: squircleMask, blend:'dest-in'}]).png().toBuffer();

  await sharp({ create:{ width: W, height: H, channels:4, background:'#1E293B'}})
    .composite([
      { input: square,   top: 60, left: 60 },
      { input: squircle, top: 60, left: 60 + tile + pad },
      { input: circle,   top: 60, left: 60 + (tile+pad)*2 },
    ])
    .png()
    .toFile(path.join(out, '2-android-adaptive.png'));
}

// 3) Splash preview à grosse taille
async function splashPreview() {
  await sharp(splash).resize(720, 1560, { fit:'cover'}).png().toFile(path.join(out, '3-splash.png'));
}

// 4) Master light / dark côte à côte
async function masters() {
  const tile = 600, pad = 40;
  const lightPanel = await sharp({ create:{width: tile, height: tile, channels: 4, background:'#FFFFFF'}})
    .composite([{ input: await sharp(master).resize(tile-40, tile-40).toBuffer(), gravity:'center'}])
    .png().toBuffer();
  const darkPanel = await sharp({ create:{width: tile, height: tile, channels:4, background:'#0F172A'}})
    .composite([{ input: await sharp(masterDark).resize(tile-40, tile-40).toBuffer(), gravity:'center'}])
    .png().toBuffer();
  await sharp({create:{width: tile*2 + pad*3, height: tile + pad*2, channels:4, background:'#1E293B'}})
    .composite([
      { input: lightPanel, top: pad, left: pad },
      { input: darkPanel,  top: pad, left: pad*2 + tile },
    ])
    .png()
    .toFile(path.join(out, '0-masters.png'));
}

await masters();
await iosRow();
await androidAdaptive();
await splashPreview();
console.log('Previews built');
