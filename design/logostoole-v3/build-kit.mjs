import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/macos/Tollé/design/logostoole-v3';
const out = path.join(root, 'kit');
fs.mkdirSync(out, { recursive: true });

const master = path.join(root, 'toole-master-light-clean.png');
const masterDark = path.join(root, 'toole-master-dark-clean.png');
const splash = path.join(root, 'toole-splash.png');

// --- iOS app icons ---
const iosSizes = [
  { size: 1024, name: 'icon-1024.png' },
  { size: 180,  name: 'icon-180.png' },
  { size: 167,  name: 'icon-167.png' },
  { size: 152,  name: 'icon-152.png' },
  { size: 120,  name: 'icon-120.png' },
  { size: 87,   name: 'icon-87.png'  },
  { size: 80,   name: 'icon-80.png'  },
  { size: 60,   name: 'icon-60.png'  },
  { size: 58,   name: 'icon-58.png'  },
  { size: 40,   name: 'icon-40.png'  },
  { size: 29,   name: 'icon-29.png'  },
  { size: 20,   name: 'icon-20.png'  },
];

// Apple requires opaque icons (no transparency) → composite on white
async function mkIos(size, name) {
  fs.mkdirSync(path.join(out, 'ios'), { recursive: true });
  await sharp({
    create: { width: size, height: size, channels: 4, background: '#FFFFFF' }
  })
  .composite([{ input: await sharp(master).resize(size, size, { fit: 'contain' }).toBuffer() }])
  .png()
  .toFile(path.join(out, 'ios', name));
}

// --- Android mipmap ---
const androidSizes = [
  { size: 48,  dir: 'mipmap-mdpi' },
  { size: 72,  dir: 'mipmap-hdpi' },
  { size: 96,  dir: 'mipmap-xhdpi' },
  { size: 144, dir: 'mipmap-xxhdpi' },
  { size: 192, dir: 'mipmap-xxxhdpi' },
];

async function mkAndroid(size, dir) {
  const dest = path.join(out, 'android', dir);
  fs.mkdirSync(dest, { recursive: true });
  // ic_launcher (round corners visual handled by OS)
  await sharp(master).resize(size, size, { fit: 'contain', background: '#FFFFFF' })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(dest, 'ic_launcher.png'));
}

// --- Android adaptive icon ---
// foreground = master at 432x432 inside 1024 transparent canvas (66% safe zone)
// background = solid green
async function mkAdaptive() {
  const dest = path.join(out, 'android', 'mipmap-anydpi-v26');
  fs.mkdirSync(dest, { recursive: true });
  // foreground: 1024x1024 transparent, master scaled to ~660px centered (so safe zone = 432)
  const fg = await sharp(master).resize(660, 660, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } })
    .composite([{ input: fg, gravity: 'center' }])
    .png()
    .toFile(path.join(dest, 'ic_launcher_foreground.png'));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#FFFFFF' } })
    .png()
    .toFile(path.join(dest, 'ic_launcher_background.png'));
}

// --- Favicons ---
const favSizes = [16, 32, 192, 512];
async function mkFavicons() {
  const dest = path.join(out, 'favicon');
  fs.mkdirSync(dest, { recursive: true });
  for (const s of favSizes) {
    await sharp(master).resize(s, s, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
      .png()
      .toFile(path.join(dest, `favicon-${s}.png`));
  }
}

// --- Splash screens (compose master on green gradient if needed; we already have toole-splash.png) ---
const splashSizes = [
  // iOS
  { w: 1125, h: 2436, name: 'splash-1125x2436.png' },
  { w: 1242, h: 2688, name: 'splash-1242x2688.png' },
  { w: 1536, h: 2048, name: 'splash-1536x2048-ipad.png' },
  // Android
  { w: 720,  h: 1280, name: 'splash-720x1280.png' },
  { w: 1080, h: 1920, name: 'splash-1080x1920.png' },
  { w: 1600, h: 2560, name: 'splash-1600x2560.png' },
];

async function mkSplashes() {
  const dest = path.join(out, 'splash');
  fs.mkdirSync(dest, { recursive: true });
  for (const s of splashSizes) {
    // for iPad (more square), letterbox by extending green background
    await sharp(splash)
      .resize(s.w, s.h, { fit: 'cover', position: 'center' })
      .png()
      .toFile(path.join(dest, s.name));
  }
  // Expo splash-icon: just the logo on transparent (Expo composes the bg from app.json)
  await sharp(master).resize(1242, 1242, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
    .png()
    .toFile(path.join(dest, 'splash-icon-1242.png'));
}

// --- Landing assets (high-res transparent) ---
async function mkLanding() {
  const dest = path.join(out, 'landing');
  fs.mkdirSync(dest, { recursive: true });
  // wordmark light (for white bg)
  await sharp(master).resize(2048, 2048, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
    .png().toFile(path.join(dest, 'logo-wordmark.png'));
  // wordmark dark variant (for dark bg)
  await sharp(masterDark).resize(2048, 2048, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
    .png().toFile(path.join(dest, 'logo-wordmark-dark.png'));
}

// --- Build the contact sheet for user validation ---
async function buildContactSheet() { return; // skip, use show.mjs instead

  const W = 1600, H = 2200;
  const bg = sharp({ create: { width: W, height: H, channels: 4, background: '#0F172A' } });

  const layers = [];

  // 1. Master light (small preview top-left on dark bg shown as how it looks)
  layers.push({ input: await sharp(master).resize(380, 380).toBuffer(), top: 60, left: 60 });
  // White panel behind it
  // Actually: composite a white rounded-ish rect behind by using overlay rect first
  // Skip rounded rect, just use a white square
  // 2. Master dark on dark
  layers.push({ input: await sharp(masterDark).resize(380, 380).toBuffer(), top: 60, left: 480 });
  // 3. Splash thumbnail
  layers.push({ input: await sharp(splash).resize(220, 480).toBuffer(), top: 60, left: 900 });

  // iOS row: 1024, 180, 120, 87, 60 (scaled down to show in row)
  const iosRow = [1024, 180, 120, 87, 60];
  let x = 60, y = 560;
  for (const s of iosRow) {
    const buf = await sharp(master).resize(s, s, { fit:'contain', background: '#FFFFFF' }).flatten({background:'#FFFFFF'}).extend({ top: 2, bottom: 2, left: 2, right: 2, background: '#FFFFFF'}).png().toBuffer();
    // display size capped at 280
    const disp = Math.min(280, s);
    layers.push({ input: await sharp(buf).resize(disp, disp).toBuffer(), top: y + (280-disp)/2|0, left: x });
    x += disp + 30;
  }

  // Android row: 192, 144, 96, 72, 48
  const aRow = [192, 144, 96, 72, 48];
  x = 60; y = 920;
  for (const s of aRow) {
    const buf = await sharp(master).resize(s, s, { fit:'contain', background:'#FFFFFF' }).flatten({background:'#FFFFFF'}).png().toBuffer();
    const disp = Math.min(280, s * 1.4);
    layers.push({ input: await sharp(buf).resize(Math.round(disp), Math.round(disp)).toBuffer(), top: y, left: x });
    x += Math.round(disp) + 30;
  }

  // Adaptive icon: foreground+background composed
  const adFg = await sharp(master).resize(660, 660, { fit:'contain', background:{r:0,g:0,b:0,alpha:0} }).toBuffer();
  const adBg = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#15803D' } }).png().toBuffer();
  const adaptive = await sharp(adBg).composite([{ input: adFg, gravity:'center'}]).resize(320, 320).png().toBuffer();
  layers.push({ input: adaptive, top: 1300, left: 60 });

  // Splash 3 sizes
  const splashSm = await sharp(splash).resize(180, 390).toBuffer();
  layers.push({ input: splashSm, top: 1280, left: 460 });
  const splashMd = await sharp(splash).resize(220, 476).toBuffer();
  layers.push({ input: splashMd, top: 1280, left: 680 });
  const splashLg = await sharp(splash).resize(260, 563).toBuffer();
  layers.push({ input: splashLg, top: 1280, left: 940 });

  // Favicon strip
  x = 60; y = 1900;
  for (const s of [16, 32, 192, 512]) {
    const buf = await sharp(master).resize(s, s, { fit:'contain', background:'#FFFFFF' }).flatten({background:'#FFFFFF'}).png().toBuffer();
    const disp = Math.min(120, s * 4);
    layers.push({ input: await sharp(buf).resize(Math.round(disp), Math.round(disp)).toBuffer(), top: y, left: x });
    x += Math.round(disp) + 30;
  }

  await bg.composite(layers).png().toFile(path.join(out, 'CONTACT-SHEET.png'));
}

// Run all
(async () => {
  for (const i of iosSizes) await mkIos(i.size, i.name);
  for (const a of androidSizes) await mkAndroid(a.size, a.dir);
  await mkAdaptive();
  await mkFavicons();
  await mkSplashes();
  await mkLanding();
  await buildContactSheet();
  console.log('Kit complete →', out);
})();
