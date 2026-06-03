import { readFileSync, writeFileSync } from 'fs';

// Convert hex → HSL → bumped lightness → hex
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = c => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function lightenHex(hex) {
  let [h, s, l] = hexToHsl(hex);
  // Boost lightness aggressivement pour visibilité sur fond foncé
  l = Math.max(l, 0.55) + 0.2;  // floor à 55%, puis +20%
  l = Math.min(1, l);
  // Garder un peu de saturation pour pas tout en pastel
  s = Math.min(1, s * 0.9);
  return hslToHex(h, s, l).toUpperCase();
}

const input = process.argv[2];
const output = process.argv[3];
const svg = readFileSync(input, 'utf8');
const transformed = svg.replace(/#[0-9A-Fa-f]{6}/g, (m) => lightenHex(m));
writeFileSync(output, transformed);
console.log(`✓ ${output}`);
