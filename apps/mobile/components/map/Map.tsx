import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { LatLng } from '@/types';
import { colors } from '@/theme';

export interface MapMarker {
  id: string;
  coordinate: LatLng;
  color?: string;
  label?: string;
  icon?: 'pickup' | 'delivery' | 'driver' | 'default';
}

interface MapProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  onPress?: (coordinate: LatLng) => void;
  showsRoute?: boolean;
  routeCoordinates?: [LatLng, LatLng];
  style?: ViewStyle;
  interactive?: boolean;
  /**
   * Si vrai, la carte ajuste automatiquement son zoom/position pour inclure
   * tous les markers + la route (au lieu de se centrer sur `center`).
   * Utilise quand on veut montrer tout le parcours du client.
   */
  fitToContent?: boolean;
}

/** Serialise uniquement la structure d'un marker (pas sa position precise). */
function markersStructureKey(markers: MapMarker[]): string {
  return markers
    .map((m) => `${m.id}:${m.icon ?? 'default'}:${m.color ?? ''}`)
    .join('|');
}

/** Serialise uniquement la structure d'une route (existe ou pas). */
function routeStructureKey(r: [LatLng, LatLng] | undefined): string {
  return r ? 'route' : 'no-route';
}

function buildHtml(
  center: LatLng,
  zoom: number,
  markers: MapMarker[],
  route: [LatLng, LatLng] | null,
  interactive: boolean,
  fitToContent: boolean,
): string {
  const markersJs = markers
    .map((m) => {
      if (m.icon === 'driver') {
        // Livreur a moto — vue de profil 3/4 style Deliveroo / UberEats.
        // Personnage bien visible avec sac de livraison cube dans le dos.
        // Flip horizontal selon la direction de deplacement.
        return `
          {
            const marker = L.marker([${m.coordinate.latitude}, ${m.coordinate.longitude}], {
              icon: L.divIcon({
                className: 'driver-marker',
                html: \`
                  <div class="driver-marker-outer">
                    <div class="driver-marker-pulse"></div>
                    <div class="driver-marker-inner" data-id="${m.id}">
                      <svg viewBox="0 0 100 100" width="92" height="92" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="bag-${m.id}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="${colors.primary}"/>
                            <stop offset="100%" stop-color="${colors.primaryDark}"/>
                          </linearGradient>
                          <linearGradient id="skin-${m.id}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#c48b62"/>
                            <stop offset="100%" stop-color="#a56b44"/>
                          </linearGradient>
                        </defs>

                        <!-- Ombre portee sous la moto -->
                        <ellipse cx="50" cy="92" rx="30" ry="3" fill="rgba(0,0,0,0.2)"/>

                        <!-- ======= MOTO ======= -->

                        <!-- Roue arriere -->
                        <circle cx="22" cy="78" r="12" fill="#1a1a1a"/>
                        <circle cx="22" cy="78" r="7" fill="#3a3a3a"/>
                        <circle cx="22" cy="78" r="3" fill="#1a1a1a"/>
                        <!-- Rayons -->
                        <line x1="22" y1="71" x2="22" y2="85" stroke="#666" stroke-width="1"/>
                        <line x1="15" y1="78" x2="29" y2="78" stroke="#666" stroke-width="1"/>

                        <!-- Roue avant -->
                        <circle cx="78" cy="78" r="12" fill="#1a1a1a"/>
                        <circle cx="78" cy="78" r="7" fill="#3a3a3a"/>
                        <circle cx="78" cy="78" r="3" fill="#1a1a1a"/>
                        <line x1="78" y1="71" x2="78" y2="85" stroke="#666" stroke-width="1"/>
                        <line x1="71" y1="78" x2="85" y2="78" stroke="#666" stroke-width="1"/>

                        <!-- Chassis / cadre rouge (scooter style) -->
                        <path d="M 22 78 Q 35 60 50 58 Q 65 58 78 78"
                              fill="none"
                              stroke="${colors.secondary}"
                              stroke-width="6"
                              stroke-linecap="round"/>

                        <!-- Carenage avant -->
                        <path d="M 70 55 L 85 50 L 88 72 L 72 72 Z"
                              fill="${colors.secondary}"
                              stroke="#8a3a1f"
                              stroke-width="1"/>

                        <!-- Phare avant -->
                        <ellipse cx="84" cy="58" rx="3" ry="2.5" fill="#ffe680" stroke="#333" stroke-width="0.8"/>

                        <!-- Guidon -->
                        <path d="M 70 55 L 64 38" stroke="#333" stroke-width="3" stroke-linecap="round"/>
                        <circle cx="63" cy="37" r="2.5" fill="#1a1a1a"/>

                        <!-- Selle -->
                        <path d="M 38 58 L 52 56 L 52 62 L 38 64 Z" fill="#1a1a1a"/>

                        <!-- ======= LIVREUR ======= -->

                        <!-- Jambes (pantalon sombre) -->
                        <path d="M 45 60 L 42 72 L 47 74 L 50 62 Z" fill="#2a3a55"/>
                        <path d="M 50 58 L 55 68 L 60 66 L 56 56 Z" fill="#2a3a55"/>

                        <!-- Bras qui tient le guidon -->
                        <path d="M 52 42 Q 58 38 63 37" stroke="#d4a075" stroke-width="6" stroke-linecap="round" fill="none"/>
                        <path d="M 52 42 Q 58 38 63 37" stroke="#4a7bc8" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.95"/>

                        <!-- Torse (veste bleue) -->
                        <path d="M 40 58 Q 38 45 44 38 L 58 38 Q 64 46 62 58 L 58 60 L 44 60 Z"
                              fill="#4a7bc8"
                              stroke="#2d4e7a"
                              stroke-width="1"/>

                        <!-- Col de veste (contour clair) -->
                        <path d="M 44 38 L 48 42 L 54 42 L 58 38"
                              fill="none"
                              stroke="#8bb4ea"
                              stroke-width="1"/>

                        <!-- Cou -->
                        <rect x="47" y="34" width="8" height="6" rx="1" fill="url(#skin-${m.id})"/>

                        <!-- Tete -->
                        <circle cx="51" cy="28" r="9" fill="url(#skin-${m.id})"/>

                        <!-- CASQUE (par dessus la tete) -->
                        <path d="M 41 28 Q 41 16 51 15 Q 61 16 61 28 L 61 32 L 58 32 L 58 28 Q 58 20 51 20 Q 44 20 44 28 L 44 32 L 41 32 Z"
                              fill="#dd3333"
                              stroke="#8a1d1d"
                              stroke-width="0.8"/>

                        <!-- Bande blanche decorative sur le casque -->
                        <path d="M 42 22 Q 51 20 60 22"
                              stroke="#fff"
                              stroke-width="1.5"
                              fill="none"/>

                        <!-- Visiere (plastique transparent bleute) -->
                        <path d="M 43 26 Q 51 24 59 26 L 59 31 Q 51 30 43 31 Z"
                              fill="#5ab8ff"
                              opacity="0.85"
                              stroke="#2d5f8a"
                              stroke-width="0.8"/>

                        <!-- Reflet sur la visiere -->
                        <path d="M 45 26 L 48 28" stroke="#fff" stroke-width="1" opacity="0.9"/>

                        <!-- ======= SAC DE LIVRAISON DANS LE DOS ======= -->
                        <!-- Sac cube style Deliveroo, bien visible derriere -->
                        <rect x="26" y="38" width="20" height="22" rx="2"
                              fill="url(#bag-${m.id})"
                              stroke="#0a3d2a"
                              stroke-width="1"/>
                        <!-- Ombre du sac sur le corps -->
                        <rect x="28" y="40" width="16" height="18" rx="1" fill="rgba(0,0,0,0.08)"/>
                        <!-- Logo sur le sac (cercle simple) -->
                        <circle cx="36" cy="49" r="4" fill="#fff"/>
                        <circle cx="36" cy="49" r="2.5" fill="${colors.primary}"/>
                        <!-- Sangle sur l'epaule -->
                        <path d="M 44 38 L 48 34 L 52 34 L 48 38"
                              fill="#0a3d2a"
                              opacity="0.7"/>
                      </svg>
                    </div>
                  </div>
                \`,
                iconSize: [104, 104],
                iconAnchor: [52, 52],
              }),
            }).addTo(map);
            ${m.label ? `marker.bindPopup(${JSON.stringify(m.label)});` : ''}
            window._markers[${JSON.stringify(m.id)}] = marker;
            // Memorise la position précédente pour calculer le bearing au prochain update
            window._prevPositions = window._prevPositions || {};
            window._prevPositions[${JSON.stringify(m.id)}] = { lat: ${m.coordinate.latitude}, lng: ${m.coordinate.longitude} };
          }
        `;
      }
      const col = m.color || colors.primary;
      const emoji =
        m.icon === 'pickup'
          ? '🟢'
          : m.icon === 'delivery'
            ? '🔴'
            : '📍';
      return `
        {
          const marker = L.marker([${m.coordinate.latitude}, ${m.coordinate.longitude}], {
            icon: L.divIcon({
              className: 'custom-marker',
              html: '<div style="background:${col};width:36px;height:36px;border-radius:18px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:16px;">${emoji}</div>',
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            }),
          }).addTo(map);
          ${m.label ? `marker.bindPopup(${JSON.stringify(m.label)});` : ''}
          window._markers[${JSON.stringify(m.id)}] = marker;
        }
      `;
    })
    .join('\n');

  const routeJs = route
    ? `
      window._route = L.polyline([
        [${route[0].latitude}, ${route[0].longitude}],
        [${route[1].latitude}, ${route[1].longitude}]
      ], { color: '${colors.primary}', weight: 4, opacity: 0.7, dashArray: '10, 10' }).addTo(map);
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
    body { background: #F5F5F0; }
    .custom-marker { transition: transform 0.4s linear; }

    /* Livreur motard anime - design UberEats/Deliveroo */
    .driver-marker-outer {
      position: relative;
      width: 104px;
      height: 104px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Halo pulsant discret sous le personnage */
    .driver-marker-pulse {
      position: absolute;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 20px;
      border-radius: 50%;
      background: ${colors.primary};
      opacity: 0.25;
      animation: driver-pulse-ground 2s ease-out infinite;
    }
    .driver-marker-inner {
      position: relative;
      width: 96px;
      height: 96px;
      display: flex;
      align-items: center;
      justify-content: center;
      /* Pas de fond rond : le SVG a son propre design complet */
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
      /* Transition douce pour le flip horizontal selon la direction */
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      transform: scaleX(1);
    }
    /* Petit bounce quand la moto bouge (simule les vibrations) */
    .driver-marker-inner.moving {
      animation: driver-bounce 0.4s ease-in-out;
    }
    @keyframes driver-pulse {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    /* Halo elliptique au sol qui pulse */
    @keyframes driver-pulse-ground {
      0% { transform: translateX(-50%) scale(0.6); opacity: 0.4; }
      100% { transform: translateX(-50%) scale(1.4); opacity: 0; }
    }
    @keyframes driver-bounce {
      0%, 100% { translate: 0 0; }
      50% { translate: 0 -3px; }
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

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

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

    // API exposee a React Native pour mettre a jour sans rebuild.
    window.updateMarker = function(id, lat, lng) {
      try {
        var m = window._markers[id];
        if (!m) return;

        // Si c'est le livreur, on flip horizontalement le SVG selon la
        // direction (livreur face a droite = vers l'Est, flip = vers l'Ouest).
        // Le SVG est dessine vue de profil oriente a droite par defaut.
        var prev = window._prevPositions && window._prevPositions[id];
        if (prev && (Math.abs(prev.lat - lat) > 1e-6 || Math.abs(prev.lng - lng) > 1e-6)) {
          var bearing = computeBearing(prev.lat, prev.lng, lat, lng);
          var el = m.getElement();
          if (el) {
            var inner = el.querySelector('.driver-marker-inner');
            if (inner) {
              // bearing 0-180 = va vers l'Est (droite) -> pas de flip
              // bearing 180-360 = va vers l'Ouest (gauche) -> flip horizontal
              var goingWest = bearing > 180 && bearing < 360;
              inner.style.transform = goingWest ? 'scaleX(-1)' : 'scaleX(1)';
              // Petit rebond vertical pour simuler les vibrations
              inner.classList.add('moving');
              setTimeout(function() { inner.classList.remove('moving'); }, 400);
            }
          }
          window._prevPositions[id] = { lat: lat, lng: lng };
        }

        m.setLatLng([lat, lng]);
      } catch (e) {}
    };
    window.updateRoute = function(aLat, aLng, bLat, bLng) {
      try {
        if (window._route) {
          window._route.setLatLngs([[aLat, aLng], [bLat, bLng]]);
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
          ? [
              `[${route[0].latitude}, ${route[0].longitude}]`,
              `[${route[1].latitude}, ${route[1].longitude}]`,
            ]
          : []),
      ].join(', ')}];
      if (_points.length >= 2) {
        try {
          map.fitBounds(_points, { padding: [60, 60], maxZoom: 16 });
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
  style,
  interactive = true,
  fitToContent = false,
}: MapProps) {
  const webviewRef = useRef<WebView>(null);
  const prevMarkersRef = useRef<MapMarker[]>([]);
  const prevRouteRef = useRef<[LatLng, LatLng] | undefined>(undefined);
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
    () => markersStructureKey(markers) + '|' + routeStructureKey(routeCoordinates),
    [markers, routeCoordinates],
  );

  const html = useMemo(
    () =>
      buildHtml(
        initialCenterRef.current,
        zoom,
        markers,
        routeCoordinates || null,
        interactive,
        fitToContent,
      ),
    // NOTE: on ne met PAS center.latitude/longitude dans les deps pour éviter
    // les rebuilds intempestifs (tremblement). Le recentrage se fait via JS
    // injection dans l'useEffect ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoom, structureKey, interactive, fitToContent],
  );

  // Detecte un changement significatif du center (ex: GPS qui arrive apres
  // un fallback Ouagadougou) et fait un setView via injection JS — sans
  // rebuild du HTML, donc pas de tremblement.
  useEffect(() => {
    const prev = prevCenterRef.current;
    const distLat = Math.abs(prev.latitude - center.latitude);
    const distLng = Math.abs(prev.longitude - center.longitude);
    // Seuil ~1km : evite les recentrages a chaque heartbeat (~10m) du
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
    }

    // Met a jour la route si son trace a change (mais qu'elle existait déjà)
    if (
      routeCoordinates &&
      prevRouteRef.current &&
      (routeCoordinates[0].latitude !== prevRouteRef.current[0].latitude ||
        routeCoordinates[0].longitude !== prevRouteRef.current[0].longitude ||
        routeCoordinates[1].latitude !== prevRouteRef.current[1].latitude ||
        routeCoordinates[1].longitude !== prevRouteRef.current[1].longitude)
    ) {
      snippets.push(
        `window.updateRoute && window.updateRoute(${routeCoordinates[0].latitude}, ${routeCoordinates[0].longitude}, ${routeCoordinates[1].latitude}, ${routeCoordinates[1].longitude});`,
      );
    }

    if (snippets.length > 0) {
      const js = snippets.join('\n') + '\ntrue;';
      webviewRef.current?.injectJavaScript(js);
    }

    prevMarkersRef.current = markers;
    prevRouteRef.current = routeCoordinates;
  }, [markers, routeCoordinates]);

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
