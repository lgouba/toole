import React, { useMemo, useRef } from 'react';
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

function buildHtml(
  center: LatLng,
  zoom: number,
  markers: MapMarker[],
  route: [LatLng, LatLng] | null,
  interactive: boolean
): string {
  const markersJs = markers
    .map((m) => {
      const col = m.color || colors.primary;
      const emoji =
        m.icon === 'pickup' ? '🟢' :
        m.icon === 'delivery' ? '🔴' :
        m.icon === 'driver' ? '🛵' : '📍';
      return `
        L.marker([${m.coordinate.latitude}, ${m.coordinate.longitude}], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:${col};width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);font-size:14px;">${emoji}</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).addTo(map)${m.label ? `.bindPopup('${m.label.replace(/'/g, "\\'")}')` : ''};
      `;
    })
    .join('\n');

  const routeJs = route
    ? `
      L.polyline([
        [${route[0].latitude}, ${route[0].longitude}],
        [${route[1].latitude}, ${route[1].longitude}]
      ], { color: '${colors.primary}', weight: 4, opacity: 0.7, dashArray: '10, 10' }).addTo(map);
    `
    : '';

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
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
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

  const html = useMemo(
    () => buildHtml(center, zoom, markers, routeCoordinates || null, interactive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      center.latitude,
      center.longitude,
      zoom,
      JSON.stringify(markers),
      JSON.stringify(routeCoordinates),
      interactive,
    ]
  );

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
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
