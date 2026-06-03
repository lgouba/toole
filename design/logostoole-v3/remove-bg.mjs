import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/macos/Tollé/design/logostoole-v3';
const files = ['toole-master-light.png', 'toole-master-dark.png'];

// Treat near-grayscale bright pixels as background → alpha 0
// Apply soft alpha gradient at the boundary to keep anti-aliasing clean
async function removeBg(inFile, outFile) {
  const { data, info } = await sharp(path.join(root, inFile))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i], g = out[i+1], b = out[i+2];
    const maxc = Math.max(r,g,b), minc = Math.min(r,g,b);
    const chroma = maxc - minc;        // saturation in 0..255
    const lum = (r + g + b) / 3;       // 0..255

    // Background: low chroma AND high luminance (gray-ish & bright)
    if (chroma < 18 && lum > 200) {
      out[i+3] = 0;
    } else if (chroma < 35 && lum > 180) {
      // boundary anti-alias zone: partial transparency
      const t = Math.min(1, (chroma - 18) / 17) * Math.min(1, (200 - lum) / -20 + 1);
      out[i+3] = Math.round(out[i+3] * Math.max(0, Math.min(1, t)));
    }
  }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(path.join(root, outFile));
  console.log('cleaned:', outFile);
}

await removeBg('toole-master-light.png', 'toole-master-light-clean.png');
await removeBg('toole-master-dark.png',  'toole-master-dark-clean.png');
