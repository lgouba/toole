// Génère les assets du splash Android (bootsplash) à partir des sources existantes.
//   node scripts/gen-splash-assets.mjs
//
// Sorties :
//   assets/bootsplash-logo.png  (1152×1152, transparent, motif dans le cercle central 768)
//   assets/toole-hero.png       (hero upscalé + bord supérieur aplati #176842)
//
// Écart assumé : le hero source (704×1900, ratio 0.370) et la cible « 1284×2778 »
// (ratio 0.462) n'ont PAS le même ratio. Forcer 1284×2778 déformerait la moto.
// On upscale donc à largeur 1284 en PRÉSERVANT le ratio (hauteur ~3466). Le rendu
// JS l'affiche en `cover` plein écran, donc la hauteur supplémentaire est simplement
// recadrée — aucune déformation. Voir compte rendu.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const R = (p) => path.resolve(dir, '..', p);

const BG = '#176842'; // vert du HAUT du hero (raccord invisible avec le splash système)

async function makeLogo() {
  const src = R('assets/images/splash-logo.png');
  // 1) trim des marges transparentes, 2) contient dans 768 (zone de sécurité),
  // 3) centré sur un canvas transparent 1152×1152.
  const inner = await sharp(src)
    .trim()
    .resize(768, 768, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 1152, height: 1152, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(R('assets/bootsplash-logo.png'));
  console.log('✓ assets/bootsplash-logo.png (1152×1152)');
}

async function makeHero() {
  const src = R('assets/images/toole-splash.png');
  const meta = await sharp(src).metadata();
  const W = 1284;
  const H = Math.round((meta.height * W) / meta.width); // ratio préservé
  const base = await sharp(src)
    .resize(W, H, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  // Aplatit le bord supérieur : 6 % pleins en #176842, puis dégradé de raccord
  // de 4 % vers l'image d'origine -> couture invisible avec le fond système.
  const solid = Math.round(H * 0.06);
  const fade = Math.round(H * 0.04);
  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="${solid}" x2="0" y2="${solid + fade}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${BG}" stop-opacity="1"/>
      <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${solid}" fill="${BG}"/>
  <rect x="0" y="${solid}" width="${W}" height="${fade}" fill="url(#g)"/>
</svg>`;
  await sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(R('assets/toole-hero.png'));
  console.log(`✓ assets/toole-hero.png (${W}×${H}, top aplati ${BG})`);
}

await makeLogo();
await makeHero();
console.log('Terminé.');
