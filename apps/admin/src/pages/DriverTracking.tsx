import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, unwrap } from '../api';
import { formatDate } from '../utils';

interface LocationLog {
  id: string;
  latitude: number;
  longitude: number;
  event: 'online' | 'offline' | 'heartbeat' | 'accept' | 'pickup' | 'delivered' | 'cancel';
  deliveryId: string | null;
  deliveryReference: string | null;
  deliveryStatus: string | null;
  createdAt: string;
}

interface HistoryData {
  driver: {
    id: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
  };
  range: { from: string | null; to: string | null };
  eventCounts: Record<string, number>;
  total: number;
  logs: LocationLog[];
}

const EVENT_META: Record<
  LocationLog['event'],
  { label: string; color: string; icon: string }
> = {
  online: { label: 'Passé en ligne', color: '#16a34a', icon: '🟢' },
  offline: { label: 'Hors ligne', color: '#64748b', icon: '⚪️' },
  heartbeat: { label: 'Position (heartbeat)', color: '#3b82f6', icon: '📍' },
  accept: { label: 'Course acceptée', color: '#8b5cf6', icon: '✅' },
  pickup: { label: 'Colis récupéré', color: '#f59e0b', icon: '📦' },
  delivered: { label: 'Livraison terminée', color: '#10b981', icon: '🎯' },
  cancel: { label: 'Course annulée', color: '#ef4444', icon: '❌' },
};

function toLocalDateInput(d: Date): string {
  // format YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Cle pour mémoriser une adresse déjà résolue via reverse geocoding */
function addrKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Reverse geocoding via Nominatim (OpenStreetMap). Rate limit ~1 req/s. */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=fr`;
  try {
    // Pas de header custom (notamment pas User-Agent) pour eviter un preflight
    // CORS - Nominatim accepte les requetes simples depuis navigateur.
    console.log('[geocode] fetching', url);
    const res = await fetch(url);
    console.log('[geocode] status', res.status);
    if (!res.ok) return null;
    const json = await res.json();
    console.log('[geocode] result', json);
    return (json.display_name as string) ?? null;
  } catch (err) {
    console.warn('[geocode] error', err);
    return null;
  }
}

export default function DriverTracking() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LocationLog | null>(null);
  // Cache des adresses résolues : clé "lat,lng" → adresse (string) ou 'pending' ou null
  const [addresses, setAddresses] = useState<Record<string, string | null | 'pending'>>({});

  // Filtres date — par defaut : 7 derniers jours
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const [from, setFrom] = useState(toLocalDateInput(sevenDaysAgo));
  const [to, setTo] = useState(toLocalDateInput(today));

  const load = () => {
    if (!id) return;
    setLoading(true);
    const params: Record<string, string> = {};
    if (from) params.from = new Date(from + 'T00:00:00').toISOString();
    if (to) params.to = new Date(to + 'T23:59:59').toISOString();
    api
      .get(`/admin/drivers/${id}/location-history`, { params })
      .then((res) => setData(unwrap<HistoryData>(res)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Ecoute les clics sur les marqueurs de la carte (iframe) pour synchroniser
  // la sélection et déclencher le reverse geocoding.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'marker-click') return;
      const log = data?.logs.find((l) => l.id === e.data.id);
      if (log) setSelectedLog(log);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [data]);

  // Reverse geocoding quand un log est sélectionné (si pas déjà en cache)
  useEffect(() => {
    if (!selectedLog) return;
    const key = addrKey(selectedLog.latitude, selectedLog.longitude);
    if (addresses[key] !== undefined) return; // déjà fetché ou en cours
    setAddresses((prev) => ({ ...prev, [key]: 'pending' }));
    reverseGeocode(selectedLog.latitude, selectedLog.longitude).then((addr) => {
      setAddresses((prev) => ({ ...prev, [key]: addr }));
    });
  }, [selectedLog, addresses]);

  const selectedAddress = selectedLog
    ? addresses[addrKey(selectedLog.latitude, selectedLog.longitude)]
    : undefined;

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <div style={{ marginBottom: 4 }}>
            <Link to={`/users/${id}`} className="muted" style={{ fontSize: 13 }}>
              ← Retour à la fiche livreur
            </Link>
          </div>
          <h1 className="page-title">
            Parcours {data?.driver.fullName ?? ''}
          </h1>
          {data ? (
            <p className="page-subtitle">
              {data.total} événements · {data.driver.phone}
            </p>
          ) : null}
        </div>
      </div>

      <div className="searchbar">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Du</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ minWidth: 160 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>au</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ minWidth: 160 }}
          />
        </label>
        <button className="btn btn-outline" onClick={load}>
          Appliquer
        </button>
      </div>

      {loading ? (
        <div className="loading-wrap">
          <div className="spinner"></div>
          Chargement du parcours...
        </div>
      ) : !data || data.logs.length === 0 ? (
        <div className="card">
          <div className="empty">
            Aucun enregistrement de position sur cette période.
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
              Les positions sont tracées quand le livreur passe en ligne,
              accepte une course, récupère un colis, livre ou annule.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Compteurs rapides */}
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            {(Object.keys(data.eventCounts) as LocationLog['event'][]).map((k) => {
              const meta = EVENT_META[k];
              if (!meta) return null;
              return (
                <div key={k} className="stat-card" style={{ padding: 14 }}>
                  <div className="label">{meta.label}</div>
                  <div className="value" style={{ fontSize: 22 }}>
                    {data.eventCounts[k]}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid-2" style={{ alignItems: 'stretch' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-header">
                <h2>Carte du parcours</h2>
              </div>
              <div style={{ height: 520 }}>
                <TrackingMap
                  logs={data.logs}
                  selectedLog={selectedLog}
                  selectedAddress={
                    typeof selectedAddress === 'string' ? selectedAddress : null
                  }
                />
              </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
              <div className="card-header">
                <h2>Chronologie</h2>
                <span className="muted" style={{ fontSize: 12 }}>
                  {data.logs.length} points
                </span>
              </div>
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {data.logs
                  .slice()
                  .reverse()
                  .map((log) => {
                    const meta = EVENT_META[log.event] ?? {
                      label: log.event,
                      color: '#64748b',
                      icon: '•',
                    };
                    const isSelected = selectedLog?.id === log.id;
                    return (
                      <button
                        key={log.id}
                        className="log-row"
                        onClick={() => setSelectedLog(log)}
                        style={{
                          background: isSelected ? 'var(--primary-50)' : 'var(--surface)',
                          borderLeft: `3px solid ${meta.color}`,
                        }}
                      >
                        <div className="log-row-icon">{meta.icon}</div>
                        <div className="log-row-body">
                          <div className="log-row-title">{meta.label}</div>
                          {log.deliveryReference ? (
                            <Link
                              to={`/deliveries/${log.deliveryId}`}
                              className="log-row-delivery"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {log.deliveryReference}
                            </Link>
                          ) : null}
                          <div className="log-row-time">
                            {formatDate(log.createdAt)}
                          </div>
                          <div className="log-row-coords">
                            {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                          </div>
                          {isSelected && (
                            <div
                              className="log-row-address"
                              style={{
                                marginTop: 4,
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                fontStyle:
                                  addresses[addrKey(log.latitude, log.longitude)] ===
                                  'pending'
                                    ? 'italic'
                                    : 'normal',
                              }}
                            >
                              {addresses[addrKey(log.latitude, log.longitude)] ===
                              'pending'
                                ? 'Recherche de l\'adresse...'
                                : addresses[addrKey(log.latitude, log.longitude)] ||
                                  'Adresse introuvable'}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// -------- Carte Leaflet embarquee via iframe HTML string --------

function TrackingMap({
  logs,
  selectedLog,
  selectedAddress,
}: {
  logs: LocationLog[];
  selectedLog: LocationLog | null;
  selectedAddress: string | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // On passe les donnees via postMessage ou via le srcDoc initial
  const html = useMemo(() => buildMapHtml(logs), [logs]);

  useEffect(() => {
    if (!selectedLog || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'focus',
        latitude: selectedLog.latitude,
        longitude: selectedLog.longitude,
        id: selectedLog.id,
        address: selectedAddress ?? null,
      },
      '*',
    );
  }, [selectedLog, selectedAddress]);

  return (
    <iframe
      ref={iframeRef}
      title="driver-tracking-map"
      srcDoc={html}
      style={{ width: '100%', height: '100%', border: 0 }}
    />
  );
}

function buildMapHtml(logs: LocationLog[]): string {
  if (logs.length === 0) {
    return '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#64748b">Aucune donnée</body></html>';
  }

  const center = logs[Math.floor(logs.length / 2)];
  const markersJs = logs
    .map((l) => {
      const meta = EVENT_META[l.event] ?? { color: '#64748b', icon: '•', label: l.event };
      const time = new Date(l.createdAt).toLocaleString('fr-FR');
      const popup = `<b>${meta.label}</b><br/>${time}${
        l.deliveryReference ? `<br/><span style="color:#64748b">${l.deliveryReference}</span>` : ''
      }<div data-role="address" style="margin-top:6px;font-size:12px;color:#475569;font-style:italic">Cliquez pour voir l'adresse...</div>`;
      const size = l.event === 'heartbeat' ? 10 : 20;
      return `
        {
          const m = L.circleMarker([${l.latitude}, ${l.longitude}], {
            radius: ${size / 2},
            fillColor: '${meta.color}',
            color: 'white',
            weight: 2,
            fillOpacity: 0.9,
          }).addTo(map);
          m.bindPopup(${JSON.stringify(popup)});
          m.on('click', function() {
            window.parent && window.parent.postMessage({
              type: 'marker-click',
              id: ${JSON.stringify(l.id)},
            }, '*');
          });
          window._markers[${JSON.stringify(l.id)}] = m;
        }
      `;
    })
    .join('\n');

  const pathCoords = logs.map((l) => `[${l.latitude}, ${l.longitude}]`).join(',');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #f5f7fa; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    window._markers = {};
    const map = L.map('map').setView([${center.latitude}, ${center.longitude}], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ''
    }).addTo(map);

    // Trace du parcours
    const path = L.polyline([${pathCoords}], {
      color: '#1d9e75',
      weight: 3,
      opacity: 0.6,
    }).addTo(map);

    ${markersJs}

    // Ajuste la vue pour englober tout le parcours
    if (path.getBounds().isValid()) {
      map.fitBounds(path.getBounds(), { padding: [30, 30] });
    }

    // Focus un marqueur au postMessage depuis le parent
    window.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'focus') return;
      const m = window._markers[e.data.id];
      if (!m) return;
      map.setView([e.data.latitude, e.data.longitude], 16);
      m.openPopup();

      // Met a jour le bloc "adresse" dans la popup (rendue apres openPopup)
      setTimeout(function () {
        var popupNode = m.getPopup() && m.getPopup().getElement();
        if (!popupNode) return;
        var addrBlock = popupNode.querySelector('[data-role="address"]');
        if (!addrBlock) return;
        if (e.data.address) {
          addrBlock.style.fontStyle = 'normal';
          addrBlock.style.color = '#0f172a';
          addrBlock.textContent = e.data.address;
        } else {
          addrBlock.textContent = 'Recherche de l\\'adresse...';
        }
      }, 50);
    });
  </script>
</body>
</html>
  `;
}
