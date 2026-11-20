/**
 * Test jetable (tsx) de l'échappement WebView carte.
 * Run : cd apps/mobile && npx tsx components/map/webviewEscape.test.ts
 *
 * Vérifie que le label échappé, une fois placé 1) dans bindPopup (innerHTML) et
 * 2) dans un <script> inline via JSON.stringify, ne peut plus injecter de HTML
 * ni sortir de la balise script.
 */
import assert from 'node:assert';
import { escapeHtmlForWebView } from './webviewEscape.js';

let passed = 0;
function check(label: string, cond: boolean) {
  assert.ok(cond, `ÉCHEC: ${label}`);
  passed++;
}

// Payloads d'attaque réalistes (nom de lieu OSM contrôlé par l'attaquant).
const scriptBreakout = '</script><script>fetch("https://evil.tld")</script>';
const imgOnerror = '<img src=x onerror=alert(1)>';
const quotes = `O'Brien "Pharmacie" & Co`;

// 1) Plus aucun caractère HTML dangereux brut après échappement.
for (const payload of [scriptBreakout, imgOnerror, quotes]) {
  const esc = escapeHtmlForWebView(payload);
  check(`pas de < brut: ${payload}`, !esc.includes('<'));
  check(`pas de > brut: ${payload}`, !esc.includes('>'));
  check(`pas de " brut: ${payload}`, !esc.includes('"'));
  check(`pas de ' brut: ${payload}`, !esc.includes("'"));
}

// 2) Reproduit l'injection exacte du code : JSON.stringify(esc) dans un <script>.
//    Le fragment ne doit pas contenir "</script" (breakout) ni la balise <img>.
const fragment = `marker.bindPopup(${JSON.stringify(escapeHtmlForWebView(scriptBreakout))});`;
check('fragment script sans </script', !/<\/script/i.test(fragment));
check('fragment script sans <script', !/<script/i.test(fragment));

const fragmentImg = `marker.bindPopup(${JSON.stringify(escapeHtmlForWebView(imgOnerror))});`;
check('fragment sans balise <img', !/<img/i.test(fragmentImg));
check('fragment sans onerror= exécutable', !/onerror=/i.test(fragmentImg) || !fragmentImg.includes('<'));

// 3) Le texte légitime reste lisible (entités, pas de perte de contenu).
const esc = escapeHtmlForWebView(quotes);
check('apostrophe → entité', esc.includes('&#39;'));
check('guillemet → entité', esc.includes('&quot;'));
check('esperluette → entité', esc.includes('&amp;'));
check('mot conservé', esc.includes('Pharmacie'));

// 4) Entrée bénigne inchangée (adresse normale).
check(
  'adresse normale préservée',
  escapeHtmlForWebView('Rue 10.34, Ouaga 2000') === 'Rue 10.34, Ouaga 2000',
);

// 5) Double échappement de & correct (pas de corruption).
check('& déjà présent → &amp;', escapeHtmlForWebView('Tom & Jerry') === 'Tom &amp; Jerry');

console.log(`\n✅ ${passed} assertions OK — label WebView échappé, XSS stockée neutralisée.`);
