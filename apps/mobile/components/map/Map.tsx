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
): string {
  const markersJs = markers
    .map((m) => {
      if (m.icon === 'driver') {
        // Livreur a moto : SVG anime avec rotation selon la direction
        // + legere pulsation pour bien le reperer.
        return `
          {
            const marker = L.marker([${m.coordinate.latitude}, ${m.coordinate.longitude}], {
              icon: L.divIcon({
                className: 'driver-marker',
                html: \`
                  <div class="driver-marker-outer">
                    <div class="driver-marker-pulse"></div>
                    <div class="driver-marker-inner" data-id="${m.id}">
                      <svg viewBox="0 0 48 48" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
                        <!-- Ombre sous la moto -->
                        <ellipse cx="24" cy="42" rx="14" ry="3" fill="rgba(0,0,0,0.25)"/>
                        <!-- Roue arriere -->
                        <circle cx="13" cy="34" r="5.5" fill="#1a1a1a"/>
                        <circle cx="13" cy="34" r="2.2" fill="#666"/>
                        <!-- Roue avant -->
                        <circle cx="35" cy="34" r="5.5" fill="#1a1a1a"/>
                        <circle cx="35" cy="34" r="2.2" fill="#666"/>
                        <!-- Corps de la moto -->
                        <path d="M13 34 L19 26 L29 26 L35 34" stroke="${colors.primary}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                        <!-- Reservoir / selle -->
                        <rect x="17" y="23" width="14" height="5" rx="2.5" fill="${colors.primary}"/>
                        <!-- Guidon -->
                        <path d="M32 26 L35 21" stroke="#333" stroke-width="2.5" stroke-linecap="round"/>
                        <!-- Corps du livreur -->
                        <rect x="19" y="13" width="10" height="13" rx="5" fill="${colors.secondary}"/>
                        <!-- Tete / casque -->
                        <circle cx="24" cy="9" r="5.5" fill="#2a2a2a"/>
                        <!-- Visiere -->
                        <path d="M19 8.5 L29 8.5" stroke="#4a9eff" stroke-width="2.5" stroke-linecap="round"/>
                        <!-- Sac de livraison dans le dos -->
                        <rect x="15" y="15" width="6" height="9" rx="1.5" fill="#fff" stroke="${colors.primary}" stroke-width="1.2"/>
                        <rect x="16.5" y="18.5" width="3" height="2" rx="0.3" fill="${colors.primary}"/>
                      </svg>
                    </div>
                  </div>
                \`,
                iconSize: [88, 88],
                iconAnchor: [44, 44],
              }),
            }).addTo(map);
            ${m.label ? `marker.bindPopup(${JSON.stringify(m.label)});` : ''}
            window._markers[${JSON.stringify(m.id)}] = marker;
            // Memorise la position precedente pour calculer le bearing au prochain update
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

    /* Livreur motard anime */
    .driver-marker-outer {
      position: relative;
      width: 88px;
      height: 88px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .driver-marker-pulse {
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      background: ${colors.primary};
      opacity: 0.3;
      animation: driver-pulse 2s ease-out infinite;
    }
    .driver-marker-inner {
      position: relative;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35);
      border: 3px solid ${colors.primary};
      /* Transition douce pour la rotation */
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      /* Rotation initiale neutre */
      transform: rotate(0deg);
    }
    /* Petit bounce quand la moto bouge (simule les vibrations) */
    .driver-marker-inner.moving {
      animation: driver-bounce 0.4s ease-in-out;
    }
    @keyframes driver-pulse {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    @keyframes driver-bounce {
      0%, 100% { translate: 0 0; }
      50% { translate: 0 -2px; }
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

        // Si c'est le livreur, on calcule l'angle de deplacement
        // et on oriente le SVG dans cette direction
        var prev = window._prevPositions && window._prevPositions[id];
        if (prev && (Math.abs(prev.lat - lat) > 1e-6 || Math.abs(prev.lng - lng) > 1e-6)) {
          var bearing = computeBearing(prev.lat, prev.lng, lat, lng);
          var el = m.getElement();
          if (el) {
            var inner = el.querySelector('.driver-marker-inner');
            if (inner) {
              // Le SVG est dessine "vers le haut" par defaut (Nord).
              // bearing 0 = Nord, 90 = Est. Pour Leaflet, CSS rotate tourne dans le sens des aiguilles.
              inner.style.transform = 'rotate(' + bearing + 'deg)';
              // Anime un petit rebond le temps du deplacement
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
}: MapProps) {
  const webviewRef = useRef<WebView>(null);
  const prevMarkersRef = useRef<MapMarker[]>([]);
  const prevRouteRef = useRef<[LatLng, LatLng] | undefined>(undefined);

  // On ne rebuild le HTML que quand la STRUCTURE change (nombre/id/icon des markers,
  // presence ou non d'une route). Les simples changements de coordonnees passent
  // par injectJavaScript (plus rapide, pas de flash, anim CSS).
  const structureKey = useMemo(
    () => markersStructureKey(markers) + '|' + routeStructureKey(routeCoordinates),
    [markers, routeCoordinates],
  );

  const html = useMemo(
    () => buildHtml(center, zoom, markers, routeCoordinates || null, interactive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center.latitude, center.longitude, zoom, structureKey, interactive],
  );

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

    // Met a jour la route si son trace a change (mais qu'elle existait deja)
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
