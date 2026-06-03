import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/macos/Tollé/design/logostoole-v3';
const out = path.join(root, 'kit');
const master = path.join(root, 'toole-master-light.png');
const masterDark = path.join(root, 'toole-master-dark.png');
const splash = path.join(root, 'toole-splash.png');

// Helper to render an iOS-style rounded white square with the logo
async function iconTile(size, displaySize) {
  const buf = await sharp(master)
    .resize(size, size, { fit: 'contain', background: '#FFFFFF' })
    .flatten({ background: '#FFFFFF' })
    .toBuffer();
  return await sharp(buf).resize(displaySize, displaySize).png().toBuffer();
}

async function build() {
  const W = 1800, H = 2400;

  // Layer collection
  const layers = [];

  // ====== ROW 1 : SOURCES ======
  // Master light on white panel
  layers.push({
    input: await sharp({ create: { width: 440, height: 440, channels: 4, background: '#FFFFFF' } })
      .composite([{ input: await sharp(master).resize(420, 420).toBuffer(), gravity: 'center' }])
      .png().toBuffer(),
    top: 80, left: 60,
  });
  // Master dark on dark panel
  layers.push({
    input: await sharp({ create: { width: 440, height: 440, channels: 4, background: '#0F172A' } })
      .composite([{ input: await sharp(masterDark).resize(420, 420).toBuffer(), gravity: 'center' }])
      .png().toBuffer(),
    top: 80, left: 540,
  });
  // Splash thumbnail
  layers.push({
    input: await sharp(splash).resize(220, 480, { fit: 'cover' }).png().toBuffer(),
    top: 80, left: 1020,
  });
  // Splash 2nd preview (1080x1920)
  layers.push({
    input: await sharp(splash).resize(220, 480, { fit: 'cover' }).png().toBuffer(),
    top: 80, left: 1280,
  });
  // Splash 3rd preview
  layers.push({
    input: await sharp(splash).resize(220, 480, { fit: 'cover' }).png().toBuffer(),
    top: 80, left: 1540,
  });

  // ====== ROW 2 : iOS app icons ======
  const iosRow = [
    { real: 1024, disp: 220 },
    { real: 180,  disp: 180 },
    { real: 120,  disp: 140 },
    { real: 87,   disp: 110 },
    { real: 60,   disp: 90  },
    { real: 40,   disp: 70  },
    { real: 29,   disp: 60  },
    { real: 20,   disp: 50  },
  ];
  let x = 60, y = 700;
  for (const it of iosRow) {
    layers.push({ input: await iconTile(it.real, it.disp), top: y + (220 - it.disp), left: x });
    x += it.disp + 30;
  }

  // ====== ROW 3 : Android mipmap ======
  const aRow = [
    { real: 192, disp: 220 },
    { real: 144, disp: 180 },
    { real: 96,  disp: 140 },
    { real: 72,  disp: 110 },
    { real: 48,  disp: 80  },
  ];
  x = 60; y = 1020;
  for (const it of aRow) {
    layers.push({ input: await iconTile(it.real, it.disp), top: y + (220 - it.disp), left: x });
    x += it.disp + 30;
  }

  // ====== ROW 4 : Adaptive icon Android (foreground + background) ======
  // FG transparent + circle mask preview
  const fg = await sharp(master).resize(660, 660, { fit:'contain', background:{r:0,g:0,b:0,alpha:0} }).toBuffer();
  const bgGreen = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#15803D' } }).png().toBuffer();
  const adaptiveFull = await sharp(bgGreen).composite([{ input: fg, gravity: 'center' }]).png().toBuffer();
  const adaptiveSquare = await sharp(adaptiveFull).resize(300, 300).png().toBuffer();
  // Round mask
  const circleSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><circle cx="150" cy="150" r="150" fill="white"/></svg>`);
  const adaptiveCircle = await sharp(adaptiveSquare).ensureAlpha().composite([{ input: await sharp(circleSvg).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer();
  const squircleSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" rx="80" ry="80" fill="white"/></svg>`);
  const adaptiveSquircle = await sharp(adaptiveSquare).ensureAlpha().composite([{ input: await sharp(squircleSvg).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer();
  layers.push({ input: adaptiveSquare, top: 1320, left: 60 });
  layers.push({ input: adaptiveCircle, top: 1320, left: 400 });
  layers.push({ input: adaptiveSquircle, top: 1320, left: 740 });

  // ====== ROW 5 : Splash variants ======
  const splashPreviewSizes = [
    { w: 200, h: 433, lbl: '720x1280' },
    { w: 240, h: 520, lbl: '1080x1920' },
    { w: 260, h: 563, lbl: '1242x2688' },
  ];
  x = 1100; y = 1280;
  for (const s of splashPreviewSizes) {
    layers.push({ input: await sharp(splash).resize(s.w, s.h, { fit:'cover' }).png().toBuffer(), top: y, left: x });
    x += s.w + 30;
  }

  // ====== ROW 6 : Favicons ======
  x = 60; y = 1980;
  for (const s of [16, 32, 192, 512]) {
    const buf = await sharp(master).resize(s, s, { fit:'contain', background:'#FFFFFF' }).flatten({background:'#FFFFFF'}).toBuffer();
    const disp = Math.min(150, s * 5);
    layers.push({ input: await sharp(buf).resize(Math.round(disp), Math.round(disp)).png().toBuffer(), top: y, left: x });
    x += Math.round(disp) + 40;
  }

  await sharp({ create: { width: W, height: H, channels: 4, background: '#1E293B' } })
    .composite(layers)
    .png()
    .toFile(path.join(out, 'CONTACT-SHEET.png'));

  console.log('Sheet built');
}

build().catch(e => { console.error(e); process.exit(1); });
