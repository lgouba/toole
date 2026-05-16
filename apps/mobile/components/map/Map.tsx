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
                      <svg viewBox="0 0 100 130" width="80" height="104" xmlns="http://www.w3.org/2000/svg">
                        <!-- ====== FORME PIN (goutte) ====== -->
                        <!-- Couleur solide (pas de gradient) pour fiabilite WebView Android -->
                        <path d="M 50 5 C 25 5, 8 22, 8 47 C 8 70, 30 90, 50 122 C 70 90, 92 70, 92 47 C 92 22, 75 5, 50 5 Z"
                              fill="${colors.primary}"
                              stroke="#fff"
                              stroke-width="3"/>

                        <!-- ====== CYCLISTE A L'INTERIEUR (scale 0.55, centre dans la tete) ====== -->
                        <g transform="translate(50 47) scale(0.55) translate(-50 -50)">

                        <!-- ombre sous le velo -->
                        <ellipse cx="50" cy="86" rx="32" ry="3" fill="rgba(0,0,0,0.18)"/>

                        <!-- ======= VELO ======= -->

                        <!-- Roue arriere -->
                        <circle cx="22" cy="74" r="14" fill="none" stroke="#1a1a1a" stroke-width="3"/>
                        <circle cx="22" cy="74" r="2.5" fill="#1a1a1a"/>
                        <line x1="22" y1="60" x2="22" y2="88" stroke="#fff" stroke-width="1" opacity="0.7"/>
                        <line x1="8" y1="74" x2="36" y2="74" stroke="#fff" stroke-width="1" opacity="0.7"/>
                        <line x1="12" y1="64" x2="32" y2="84" stroke="#fff" stroke-width="0.8" opacity="0.6"/>
                        <line x1="32" y1="64" x2="12" y2="84" stroke="#fff" stroke-width="0.8" opacity="0.6"/>

                        <!-- Roue avant -->
                        <circle cx="78" cy="74" r="14" fill="none" stroke="#1a1a1a" stroke-width="3"/>
                        <circle cx="78" cy="74" r="2.5" fill="#1a1a1a"/>
                        <line x1="78" y1="60" x2="78" y2="88" stroke="#fff" stroke-width="1" opacity="0.7"/>
                        <line x1="64" y1="74" x2="92" y2="74" stroke="#fff" stroke-width="1" opacity="0.7"/>
                        <line x1="68" y1="64" x2="88" y2="84" stroke="#fff" stroke-width="0.8" opacity="0.6"/>
                        <line x1="88" y1="64" x2="68" y2="84" stroke="#fff" stroke-width="0.8" opacity="0.6"/>

                        <!-- Cadre velo en V (orange Tolle) -->
                        <path d="M 22 74 L 50 52 L 78 74 M 50 52 L 50 66 L 22 74" stroke="${colors.secondary}" stroke-width="4" fill="none" stroke-linecap="round"/>

                        <!-- Tige de selle + selle -->
                        <line x1="50" y1="52" x2="40" y2="40" stroke="${colors.secondary}" stroke-width="3.5" stroke-linecap="round"/>
                        <ellipse cx="40" cy="38" rx="7" ry="2.5" fill="#1a1a1a"/>

                        <!-- Guidon -->
                        <line x1="78" y1="74" x2="66" y2="40" stroke="${colors.secondary}" stroke-width="3.5" stroke-linecap="round"/>
                        <line x1="60" y1="38" x2="72" y2="42" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>

                        <!-- Pedalier -->
                        <circle cx="50" cy="74" r="3.5" fill="#1a1a1a"/>

                        <!-- ======= CYCLISTE ======= -->

                        <!-- Jambe avant pliee (pedale) -->
                        <path d="M 50 74 L 58 58 L 50 48" stroke="#2a3a55" stroke-width="6" stroke-linecap="round" fill="none"/>
                        <!-- Jambe arriere etendue -->
                        <path d="M 50 74 L 42 64 L 36 76" stroke="#2a3a55" stroke-width="6" stroke-linecap="round" fill="none"/>

                        <!-- Tronc (T-shirt clair) -->
                        <path d="M 38 42 Q 38 32 50 28 Q 62 32 62 42 L 60 50 L 40 50 Z" fill="#fafafa" stroke="#d4d4d4" stroke-width="0.8"/>

                        <!-- Sac de livraison cube dans le dos -->
                        <rect x="30" y="26" width="18" height="22" rx="2.5" fill="${colors.secondary}" stroke="#fff" stroke-width="1.5"/>
                        <text x="39" y="40" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="#fff" text-anchor="middle">T</text>
                        <path d="M 48 26 L 52 22 L 54 24" stroke="#8a3a1f" stroke-width="2" fill="none" stroke-linecap="round"/>

                        <!-- Bras qui tient le guidon -->
                        <path d="M 58 38 Q 64 38 67 41" stroke="#fafafa" stroke-width="5" stroke-linecap="round" fill="none"/>

                        <!-- Cou -->
                        <rect x="49" y="22" width="6" height="6" fill="#c48b62"/>

                        <!-- Tete -->
                        <circle cx="52" cy="20" r="7" fill="#c48b62"/>

                        <!-- Casque (vert primaire pour rappel marque) -->
                        <path d="M 45 19 Q 45 11 52 9 Q 59 11 59 19 L 59 23 L 45 23 Z" fill="${colors.primary}" stroke="#0a4d35" stroke-width="0.8"/>
                        <line x1="45" y1="15" x2="59" y2="15" stroke="#fff" stroke-width="1.2"/>
                        <line x1="50" y1="23" x2="51" y2="27" stroke="#1a1a1a" stroke-width="0.8"/>

                        </g>

                      </svg>
                    </div>
                  </div>
                \`,
                // Le SVG fait 80x104 et l'ancrage doit pointer la POINTE du pin
                // = bas du SVG (centre x, bas y).
                iconSize: [80, 104],
                iconAnchor: [40, 104],
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

    /* Pin GPS livreur avec cycliste SVG a l'interieur */
    .driver-pin-outer {
      position: relative;
      width: 80px;
      height: 104px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    /* Halo ellipsoide au sol qui pulse, sous la pointe du pin */
    .driver-pin-halo {
      position: absolute;
      bottom: -2px;
      left: 50%;
      transform: translateX(-50%);
      width: 36px;
      height: 12px;
      border-radius: 50%;
      background: ${colors.primary};
      opacity: 0.35;
      animation: driver-pulse-ground 2s ease-out infinite;
    }
    .driver-pin-inner {
      position: relative;
      width: 80px;
      height: 104px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.30));
    }
    /* Halo elliptique au sol qui pulse */
    @keyframes driver-pulse-ground {
      0%   { transform: translateX(-50%) scale(0.6); opacity: 0.5; }
      100% { transform: translateX(-50%) scale(1.6); opacity: 0; }
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

        // Le marker est un pin vertical : pas de flip horizontal a faire,
        // mais on garde la trace de la position precedente au cas ou
        // on veut afficher une orientation visuelle plus tard.
        var prev = window._prevPositions && window._prevPositions[id];
        if (prev && (Math.abs(prev.lat - lat) > 1e-6 || Math.abs(prev.lng - lng) > 1e-6)) {
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
