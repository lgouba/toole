import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { LatLng } from '@/types';
import { colors } from '@/theme';
import { RIDER_MARKER_URI } from './riderMarker';

export interface MapMarker {
  id: string;
  coordinate: LatLng;
  color?: string;
  label?: string;
  icon?: 'pickup' | 'delivery' | 'driver' | 'default';
  /**
   * Point vers lequel le marqueur (livreur) doit "regarder" : son sprite est
   * orienté (miroir horizontal) vers cette cible. Utilisé pour que le livreur
   * regarde la destination de la phase courante (récup puis livraison),
   * indépendamment de son micro-déplacement.
   */
  target?: LatLng;
}

interface MapProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  onPress?: (coordinate: LatLng) => void;
  showsRoute?: boolean;
  /** Ligne directe (fallback) entre 2 points. Utilisée si `routePath` absent. */
  routeCoordinates?: [LatLng, LatLng];
  /**
   * Itinéraire routier réel (suit les rues), tableau de N points. S'il contient
   * ≥ 2 points, il remplace `routeCoordinates` (tracé plein, pas pointillé).
   */
  routePath?: LatLng[];
  style?: ViewStyle;
  interactive?: boolean;
  /**
   * Si vrai, la carte ajuste automatiquement son zoom/position pour inclure
   * tous les markers + la route (au lieu de se centrer sur `center`).
   * Utilise quand on veut montrer tout le parcours du client.
   */
  fitToContent?: boolean;
  /**
   * Thème de la carte. 'dark' utilise les tuiles CartoDB dark_matter (vraies
   * rues, rendu sombre premium). 'light' = OSM standard. Défaut 'light'.
   */
  theme?: 'light' | 'dark';
  /**
   * Hauteur (px) masquée en bas par un panneau/sheet superposé. Le cadrage
   * (fitToContent) ajoute cette marge en bas pour que les markers (livreur,
   * destination) restent dans la zone VISIBLE au-dessus du panneau.
   */
  contentInsetBottom?: number;
  /** Idem en haut (barre de statut/boutons superposés). Défaut 100. */
  contentInsetTop?: number;
}

/** Serialise uniquement la structure d'un marker (pas sa position precise). */
function markersStructureKey(markers: MapMarker[]): string {
  return markers
    .map((m) => `${m.id}:${m.icon ?? 'default'}:${m.color ?? ''}`)
    .join('|');
}

/** Serialise uniquement la structure d'une route (existe ou pas). */
function routeStructureKey(r: LatLng[] | null): string {
  return r && r.length >= 2 ? 'route' : 'no-route';
}

/** Indique si deux tracés diffèrent (longueur ou un point). */
function routePathChanged(a: LatLng[] | null, b: LatLng[] | null): boolean {
  if (!a && !b) return false;
  if (!a || !b) return true;
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i].latitude !== b[i].latitude || a[i].longitude !== b[i].longitude) {
      return true;
    }
  }
  return false;
}

function buildHtml(
  center: LatLng,
  zoom: number,
  markers: MapMarker[],
  route: LatLng[] | null,
  interactive: boolean,
  fitToContent: boolean,
  theme: 'light' | 'dark',
  contentInsetTop: number,
  contentInsetBottom: number,
): string {
  const isDark = theme === 'dark';
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const bodyBg = isDark ? '#0E1326' : '#F5F5F0';
  const routeColor = isDark ? '#00E676' : colors.primary;
  const markersJs = markers
    .map((m) => {
      if (m.icon === 'driver') {
        // Pin GPS style "Google Maps" avec cycliste SVG detaille a l'interieur.
        // Forme : pin/goutte avec tete ronde + pointe vers le bas (GPS exact).
        // Halo qui pulse pour signaler que le marker est vivant.
        return `
          {
            const marker = L.marker([${m.coordinate.latitude}, ${m.coordinate.longitude}], {
              icon: L.divIcon({
                className: 'driver-marker',
                html: \`
                  <div class="driver-pin-outer">
                    <div class="driver-pin-halo"></div>
                    <div class="driver-pin-inner" data-id="${m.id}">
                      <img src="${RIDER_MARKER_URI}" width="66" height="66" style="display:block;" alt="livreur" />
                    </div>
                  </div>
                \`,
                // Avatar seul, 68x68 carre. L'ancre est au centre du SVG
                // (le centre du cycliste = position GPS exacte).
                iconSize: [68, 68],
                iconAnchor: [34, 34],
              }),
            }).addTo(map);
            ${m.label ? `marker.bindPopup(${JSON.stringify(m.label)});` : ''}
            window._markers[${JSON.stringify(m.id)}] = marker;
            // Memorise la position précédente pour calculer le bearing au prochain update
            window._prevPositions = window._prevPositions || {};
            window._prevPositions[${JSON.stringify(m.id)}] = { lat: ${m.coordinate.latitude}, lng: ${m.coordinate.longitude} };
            window._targets = window._targets || {};
            ${
              m.target
                ? `window._targets[${JSON.stringify(m.id)}] = { lat: ${m.target.latitude}, lng: ${m.target.longitude} };
            // Oriente le livreur vers sa cible dès la création.
            setTimeout(function(){ orientDriver(marker, computeBearing(${m.coordinate.latitude}, ${m.coordinate.longitude}, ${m.target.latitude}, ${m.target.longitude})); }, 0);`
                : `delete window._targets[${JSON.stringify(m.id)}];`
            }
          }
        `;
      }
      // Icones distinctes (plus d'ambiguite couleur) :
      //   pickup (recuperation) = colis a aller chercher 📦, fond terra
      //   delivery (livraison)  = destination finale 🏁, fond vert kola
      const isPickup = m.icon === 'pickup';
      const isDelivery = m.icon === 'delivery';
      const col =
        m.color || (isPickup ? '#C2410C' : isDelivery ? '#15803D' : colors.primary);
      const emoji = isPickup ? '📦' : isDelivery ? '🏁' : '📍';
      return `
        {
          const marker = L.marker([${m.coordinate.latitude}, ${m.coordinate.longitude}], {
            icon: L.divIcon({
              className: 'custom-marker',
              html: '<div style="background:${col};width:38px;height:38px;border-radius:19px;display:flex;align-items:center;justify-content:center;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:17px;">${emoji}</div>',
              iconSize: [38, 38],
              iconAnchor: [19, 19],
            }),
          }).addTo(map);
          ${m.label ? `marker.bindPopup(${JSON.stringify(m.label)});` : ''}
          window._markers[${JSON.stringify(m.id)}] = marker;
        }
      `;
    })
    .join('\n');

  // Tracé : si c'est un vrai itinéraire routier (≥ 3 points), ligne PLEINE qui
  // suit les rues ; si c'est juste une ligne directe (2 points = fallback), on
  // garde le pointillé pour signaler que ce n'est pas le parcours réel.
  const isRealRoute = !!route && route.length >= 3;
  const routeLatLngsJs = route
    ? '[' + route.map((p) => `[${p.latitude}, ${p.longitude}]`).join(',') + ']'
    : '[]';
  const routeJs = route
    ? `
      window._route = L.polyline(${routeLatLngsJs}, {
        color: '${routeColor}',
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round'${isRealRoute ? '' : `,\n        dashArray: '10, 10'`}
      }).addTo(map);
    `
    : `window._route = null;`;

  const clickJs = `
    map.on('click', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'press',
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      }));
    });
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    body { background: ${bodyBg}; }
    /* Descend le contrôle zoom sous la barre de statut, à droite. */
    .leaflet-top { top: ${Math.max(40, contentInsetTop)}px; }
    .leaflet-right { right: 10px; }
    ${isDark ? `
    /* Boutons zoom adaptés au thème sombre */
    .leaflet-bar a {
      background: rgba(20,26,44,0.9);
      color: #E8EBF5;
      border-bottom-color: rgba(255,255,255,0.12);
    }
    .leaflet-bar a:hover { background: rgba(32,40,64,0.95); }
    ` : ''}
    .custom-marker { transition: transform 0.4s linear; }

    /* Avatar livreur seul (pas de pin), 68x68 centre sur la position GPS */
    .driver-pin-outer {
      position: relative;
      width: 68px;
      height: 68px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Halo discret derriere l'avatar pour le distinguer du fond carte */
    .driver-pin-halo {
      position: absolute;
      inset: 6px;
      border-radius: 50%;
      background: ${colors.primary};
      opacity: 0.18;
      animation: driver-pulse-ring 2s ease-out infinite;
    }
    .driver-pin-inner {
      position: relative;
      width: 68px;
      height: 68px;
      display: flex;
      align-items: center;
      justify-content: center;
      /* Drop-shadow autour du cycliste pour le detacher de la carte */
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)) drop-shadow(0 0 2px rgba(255,255,255,0.8));
    }
    /* Flip horizontal fluide quand le livreur change de sens de marche */
    .driver-pin-inner img { transition: transform 0.3s ease; }
    /* Halo qui pulse autour de l'avatar */
    @keyframes driver-pulse-ring {
      0%   { transform: scale(0.9); opacity: 0.45; }
      100% { transform: scale(1.8); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    window._markers = {};
    window._route = null;
    window._prevPositions = {};
    const map = L.map('map', {
      zoomControl: ${interactive ? 'true' : 'false'},
      dragging: ${interactive ? 'true' : 'false'},
      scrollWheelZoom: ${interactive ? 'true' : 'false'},
      doubleClickZoom: ${interactive ? 'true' : 'false'},
      touchZoom: ${interactive ? 'true' : 'false'},
      attributionControl: false
    }).setView([${center.latitude}, ${center.longitude}], ${zoom});

    L.tileLayer('${tileUrl}', {
      maxZoom: 20,
      subdomains: 'abcd'
    }).addTo(map);

    // Déplace le contrôle zoom (+/-) en HAUT-DROITE pour ne plus chevaucher la
    // barre de statut (heure/batterie) ni le bouton retour en haut-gauche.
    if (map.zoomControl) { try { map.zoomControl.setPosition('topright'); } catch (e) {} }

    // Calcule le bearing (angle en degres) entre deux points GPS.
    // 0 = Nord, 90 = Est, 180 = Sud, 270 = Ouest.
    function computeBearing(lat1, lng1, lat2, lng2) {
      var toRad = function(d) { return d * Math.PI / 180; };
      var toDeg = function(r) { return r * 180 / Math.PI; };
      var dLng = toRad(lng2 - lng1);
      var y = Math.sin(dLng) * Math.cos(toRad(lat2));
      var x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
            - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
      var brng = toDeg(Math.atan2(y, x));
      return (brng + 360) % 360;
    }

    // Oriente le sprite du livreur selon son sens de deplacement : la 3D est
    // une vue 3/4 qui regarde a GAUCHE par defaut. S'il va vers l'EST (droite),
    // on miroir horizontalement pour qu'il regarde a droite.
    function orientDriver(m, brng) {
      try {
        var el = m.getElement && m.getElement();
        if (!el) return;
        var img = el.querySelector('img');
        if (!img) return;
        var faceRight = brng > 10 && brng < 170; // cap vers l'est
        var faceLeft = brng > 190 && brng < 350;  // cap vers l'ouest
        if (faceRight) img.style.transform = 'scaleX(-1)';
        else if (faceLeft) img.style.transform = 'scaleX(1)';
        // (cap quasi nord/sud : on garde l'orientation precedente)
      } catch (e) {}
    }

    // API exposee a React Native pour mettre a jour sans rebuild.
    window.updateMarker = function(id, lat, lng) {
      try {
        var m = window._markers[id];
        if (!m) return;

        // Orientation : en priorité vers la CIBLE de la phase (récup/livraison)
        // si elle est connue ; sinon, à défaut, selon le sens de déplacement.
        var tgt = window._targets && window._targets[id];
        if (tgt) {
          orientDriver(m, computeBearing(lat, lng, tgt.lat, tgt.lng));
        } else {
          var prev = window._prevPositions && window._prevPositions[id];
          if (prev && (Math.abs(prev.lat - lat) > 1e-6 || Math.abs(prev.lng - lng) > 1e-6)) {
            orientDriver(m, computeBearing(prev.lat, prev.lng, lat, lng));
          }
        }
        window._prevPositions[id] = { lat: lat, lng: lng };

        m.setLatLng([lat, lng]);
      } catch (e) {}
    };
    // Met à jour la cible d'orientation d'un marqueur (changement de phase).
    window.updateTarget = function(id, lat, lng) {
      try {
        window._targets = window._targets || {};
        var m = window._markers[id];
        if (lat == null || lng == null) { delete window._targets[id]; return; }
        window._targets[id] = { lat: lat, lng: lng };
        if (m) {
          var p = window._prevPositions[id] || { lat: lat, lng: lng };
          orientDriver(m, computeBearing(p.lat, p.lng, lat, lng));
        }
      } catch (e) {}
    };
    window.updateRoute = function(aLat, aLng, bLat, bLng) {
      try {
        if (window._route) {
          window._route.setLatLngs([[aLat, aLng], [bLat, bLng]]);
        }
      } catch (e) {}
    };
    // Met à jour le tracé complet (itinéraire routier de N points) sans rebuild.
    window.updateRoutePath = function(points) {
      try {
        if (!points || points.length < 2) return;
        var solid = points.length >= 3;
        if (window._route) {
          window._route.setLatLngs(points);
          window._route.setStyle({ dashArray: solid ? null : '10, 10' });
        } else {
          window._route = L.polyline(points, {
            color: '${routeColor}', weight: 5, opacity: 0.9,
            lineJoin: 'round', lineCap: 'round',
            dashArray: solid ? null : '10, 10'
          }).addTo(map);
        }
      } catch (e) {}
    };
    window.panToMarker = function(id) {
      try {
        var m = window._markers[id];
        if (!m) return;
        map.panTo(m.getLatLng(), { animate: true, duration: 0.5 });
      } catch (e) {}
    };

    ${markersJs}
    ${routeJs}
    ${interactive ? clickJs : ''}

    ${
      fitToContent && (markers.length > 0 || route)
        ? `
      // Ajuste la vue pour englober tous les markers + la route
      var _points = [${[
        ...markers.map(
          (m) => `[${m.coordinate.latitude}, ${m.coordinate.longitude}]`,
        ),
        ...(route
          ? route.map((p) => `[${p.latitude}, ${p.longitude}]`)
          : []),
      ].join(', ')}];
      if (_points.length >= 2) {
        try {
          map.fitBounds(_points, {
            // Marges asymétriques : on réserve de l'espace en haut (barre) et
            // surtout en bas (panneau/sheet) pour que les markers restent
            // visibles dans la zone non masquée.
            paddingTopLeft: [40, ${Math.max(40, contentInsetTop)}],
            paddingBottomRight: [40, ${Math.max(40, contentInsetBottom)}],
            maxZoom: 16,
          });
        } catch (e) {}
      }
    `
        : ''
    }
  </script>
</body>
</html>
  `;
}

export function Map({
  center,
  zoom = 14,
  markers = [],
  onPress,
  routeCoordinates,
  routePath,
  style,
  interactive = true,
  fitToContent = false,
  theme = 'light',
  contentInsetTop = 100,
  contentInsetBottom = 0,
}: MapProps) {
  const webviewRef = useRef<WebView>(null);
  const prevMarkersRef = useRef<MapMarker[]>([]);
  const prevRouteRef = useRef<LatLng[] | null>(null);

  // Tracé effectif : l'itinéraire routier réel (≥ 2 points) s'il existe, sinon
  // la ligne directe `routeCoordinates` en fallback. Mémoïsé pour une identité
  // stable entre les rendus (sinon l'effet de diff se déclencherait à tort).
  const routeLine = useMemo<LatLng[] | null>(() => {
    if (routePath && routePath.length >= 2) return routePath;
    if (routeCoordinates) return [routeCoordinates[0], routeCoordinates[1]];
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePath, routeCoordinates]);
  // Le center initial est fige au premier rendu. Les changements ulterieurs
  // passent par injectJavaScript (setView) pour éviter de reload tout le
  // WebView (qui provoquait un effet "tremblement" quand center suivait la
  // position animee du livreur).
  const initialCenterRef = useRef<LatLng>(center);
  const prevCenterRef = useRef<LatLng>(center);

  // On ne rebuild le HTML que quand la STRUCTURE change (nombre/id/icon des markers,
  // presence ou non d'une route). Les simples changements de coordonnees passent
  // par injectJavaScript (plus rapide, pas de flash, anim CSS).
  const structureKey = useMemo(
    () => markersStructureKey(markers) + '|' + routeStructureKey(routeLine),
    [markers, routeLine],
  );

  const html = useMemo(
    () =>
      buildHtml(
        initialCenterRef.current,
        zoom,
        markers,
        routeLine,
        interactive,
        fitToContent,
        theme,
        contentInsetTop,
        contentInsetBottom,
      ),
    // NOTE: on ne met PAS center.latitude/longitude dans les deps pour éviter
    // les rebuilds intempestifs (tremblement). Le recentrage se fait via JS
    // injection dans l'useEffect ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoom, structureKey, interactive, fitToContent, theme, contentInsetTop, contentInsetBottom],
  );

  // Detecte un changement significatif du center (ex: GPS qui arrive après
  // un fallback Ouagadougou) et fait un setView via injection JS — sans
  // rebuild du HTML, donc pas de tremblement.
  useEffect(() => {
    const prev = prevCenterRef.current;
    const distLat = Math.abs(prev.latitude - center.latitude);
    const distLng = Math.abs(prev.longitude - center.longitude);
    // Seuil ~1km : évite les recentrages a chaque heartbeat (~10m) du
    // livreur, mais capture les sauts type "Ouaga -> Paris".
    const SIGNIFICANT = 0.01; // ~1.1km
    if (distLat > SIGNIFICANT || distLng > SIGNIFICANT) {
      const js = `try { map.setView([${center.latitude}, ${center.longitude}]); } catch(e) {} true;`;
      webviewRef.current?.injectJavaScript(js);
      prevCenterRef.current = center;
    }
  }, [center.latitude, center.longitude]);

  // Detecte les changements de coordonnees de markers et injecte des updates.
  useEffect(() => {
    const prev = prevMarkersRef.current;
    const prevById: Record<string, MapMarker> = {};
    for (const m of prev) prevById[m.id] = m;

    const snippets: string[] = [];
    for (const m of markers) {
      const pm = prevById[m.id];
      if (
        pm &&
        (pm.coordinate.latitude !== m.coordinate.latitude ||
          pm.coordinate.longitude !== m.coordinate.longitude)
      ) {
        snippets.push(
          `window.updateMarker && window.updateMarker(${JSON.stringify(m.id)}, ${m.coordinate.latitude}, ${m.coordinate.longitude});`,
        );
      }
      // Changement de cible d'orientation (ex: phase récup -> livraison)
      const prevT = pm?.target;
      const curT = m.target;
      const targetChanged =
        (!!prevT !== !!curT) ||
        (prevT && curT &&
          (prevT.latitude !== curT.latitude || prevT.longitude !== curT.longitude));
      if (pm && targetChanged) {
        snippets.push(
          curT
            ? `window.updateTarget && window.updateTarget(${JSON.stringify(m.id)}, ${curT.latitude}, ${curT.longitude});`
            : `window.updateTarget && window.updateTarget(${JSON.stringify(m.id)}, null, null);`,
        );
      }
    }

    // Met à jour le tracé (itinéraire routier ou ligne directe) s'il a changé
    // et qu'il existait déjà (sinon c'est un rebuild HTML qui le dessine).
    if (
      routeLine &&
      routeLine.length >= 2 &&
      prevRouteRef.current &&
      routePathChanged(prevRouteRef.current, routeLine)
    ) {
      const pts =
        '[' +
        routeLine.map((p) => `[${p.latitude}, ${p.longitude}]`).join(',') +
        ']';
      snippets.push(`window.updateRoutePath && window.updateRoutePath(${pts});`);
    }

    if (snippets.length > 0) {
      const js = snippets.join('\n') + '\ntrue;';
      webviewRef.current?.injectJavaScript(js);
    }

    prevMarkersRef.current = markers;
    prevRouteRef.current = routeLine;
  }, [markers, routeLine]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'press' && onPress) {
              onPress({ latitude: data.latitude, longitude: data.longitude });
            }
          } catch {}
        }}
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
