/**
 * Échappement de texte utilisateur avant injection dans le HTML de la WebView
 * carte (Leaflet). Isolé ici pour être testable sans dépendances React Native.
 *
 * Contexte sécurité : le `label` d'un marqueur = adresse issue d'OSM/Nominatim
 * (noms de lieux éditables publiquement) ; sur les écrans livreur c'est
 * l'adresse SAISIE PAR LE CLIENT, rendue dans la WebView du livreur. `bindPopup`
 * rend sa chaîne comme du HTML (innerHTML) ET le marqueur est bâti dans un
 * `<script>` inline. Sans échappement, un label `</script><script>…</script>`
 * ou `<img src=x onerror=…>` exécute du JS arbitraire (XSS stockée inter-user).
 * Échapper les entités HTML neutralise les DEUX vecteurs : il ne reste aucun
 * `<`/`>`/`&`/`"`/`'` brut, donc ni breakout de `<script>` ni injection innerHTML.
 */
export function escapeHtmlForWebView(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
