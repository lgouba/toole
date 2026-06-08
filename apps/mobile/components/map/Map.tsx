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

  const routeJs = route
    ? `
      window._route = L.polyline([
        [${route[0].latitude}, ${route[0].longitude}],
        [${route[1].latitude}, ${route[1].longitude}]
      ], { color: '${routeColor}', weight: 4, opacity: 0.85, dashArray: '10, 10' }).addTo(map);
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

        var prev = window._prevPositions && window._prevPositions[id];
        if (prev && (Math.abs(prev.lat - lat) > 1e-6 || Math.abs(prev.lng - lng) > 1e-6)) {
          // Oriente le livreur dans le sens de marche reel.
          var brng = computeBearing(prev.lat, prev.lng, lat, lng);
          orientDriver(m, brng);
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
  style,
  interactive = true,
  fitToContent = false,
  theme = 'light',
  contentInsetTop = 100,
  contentInsetBottom = 0,
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
