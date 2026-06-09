import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';

type Status =
  | 'scheduled'
  | 'pending'
  | 'accepted'
  | 'picking_up'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'expired';

interface PublicDelivery {
  reference: string;
  status: Status;
  recipientName: string;
  packageType: string;
  pickupAddress: string;
  pickupLocation: { latitude: number; longitude: number };
  deliveryAddress: string;
  deliveryLocation: { latitude: number; longitude: number };
  estimatedDistanceKm: number | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  driver: null | {
    fullName: string;
    avatarUrl: string | null;
    ratingAvg: number;
    vehicleType: string | null;
    currentLocation: { latitude: number; longitude: number } | null;
    lastLocationUpdate: string | null;
  };
  // Itinéraire routier réel (suit les rues), phase-aware. null = ligne directe.
  route?: {
    path: { latitude: number; longitude: number }[] | null;
    phase: 'to_pickup' | 'to_delivery' | null;
  } | null;
}

const POLL_MS = 5_000;

const STATUS_META: Record<Status, { label: string; color: string; emoji: string }> = {
  scheduled: { label: 'Programmée', color: '#6b7280', emoji: '🕒' },
  pending: { label: 'Recherche d\'un livreur', color: '#f59e0b', emoji: '🔍' },
  accepted: { label: 'Livreur en route', color: '#3b82f6', emoji: '🛵' },
  picking_up: { label: 'Livreur sur place', color: '#3b82f6', emoji: '📍' },
  picked_up: { label: 'Colis récupéré', color: '#10b981', emoji: '📦' },
  delivering: { label: 'En route vers vous', color: '#10b981', emoji: '🚚' },
  delivered: { label: 'Livré', color: '#16a34a', emoji: '✅' },
  cancelled: { label: 'Annulé', color: '#ef4444', emoji: '❌' },
  expired: { label: 'Expiré', color: '#ef4444', emoji: '⏰' },
};

export default function PublicTracking() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicDelivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/track/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) {
              setError('NOT_FOUND');
              setLoading(false);
            }
            return;
          }
          if (!cancelled) setError(`HTTP_${res.status}`);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json.data);
          setError(null);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError('NETWORK');
          setLoading(false);
        }
      }
    };
    fetchOnce();
    intervalRef.current = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token]);

  if (loading) {
    return (
      <div style={s.fullScreen}>
        <div style={s.spinner} />
        <div style={s.muted}>Chargement du suivi...</div>
      </div>
    );
  }

  if (error === 'NOT_FOUND') {
    return (
      <div style={s.fullScreen}>
        <div style={s.errorBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={s.errorTitle}>Suivi introuvable</div>
          <div style={s.muted}>Ce lien de suivi n'existe pas ou a expiré.</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.fullScreen}>
        <div style={s.errorBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={s.errorTitle}>Connexion impossible</div>
          <div style={s.muted}>Vérifiez votre connexion et réessayez.</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const meta = STATUS_META[data.status];

  return (
    <div style={s.page}>
      <Header />

      <div style={s.statusBanner(meta.color)}>
        <span style={{ fontSize: 28 }}>{meta.emoji}</span>
        <div>
          <div style={s.statusLabel}>{meta.label}</div>
          <div style={s.refText}>Réf. {data.reference}</div>
        </div>
      </div>

      <Map delivery={data} />

      {data.driver ? <DriverCard driver={data.driver} /> : null}

      <Timeline data={data} />

      <Addresses data={data} />

      <Footer />
    </div>
  );
}

// ----------------------------------------
// Sous-composants
// ----------------------------------------

function Header() {
  return (
    <div style={s.header}>
      <div style={s.logo}>
        <span style={{ color: '#1d9e75' }}>T</span>oolé
      </div>
      <div style={s.headerSub}>Suivi de livraison</div>
    </div>
  );
}

function Map({ delivery }: { delivery: PublicDelivery }) {
  // Carte Leaflet via iframe srcDoc (pas besoin d'installer leaflet sur l'admin).
  // IMPORTANT : le HTML est construit UNE seule fois (au 1er rendu). Les mises à
  // jour (position du livreur, itinéraire) passent par postMessage → le marqueur
  // GLISSE au lieu de recharger toute la carte (plus de clignotement).
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const [html] = useState(() => buildMapHtml(delivery));

  const post = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'tracking',
        status: delivery.status,
        driver: delivery.driver?.currentLocation ?? null,
        path: delivery.route?.path ?? null,
        pickup: delivery.pickupLocation,
        delivery: delivery.deliveryLocation,
      },
      '*',
    );
  };

  // À chaque nouveau poll (delivery change), on pousse la MAJ dans l'iframe.
  useEffect(() => {
    if (readyRef.current) post();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery]);

  return (
    <div style={s.mapWrap}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        onLoad={() => {
          readyRef.current = true;
          post();
        }}
        style={{ width: '100%', height: '100%', border: 0 }}
        title="Carte de suivi"
      />
    </div>
  );
}

function DriverCard({ driver }: { driver: NonNullable<PublicDelivery['driver']> }) {
  const initial = driver.fullName.charAt(0).toUpperCase();
  return (
    <div style={s.driverCard}>
      <div style={s.driverAvatar}>
        {driver.avatarUrl ? (
          <img
            src={driver.avatarUrl}
            alt={driver.fullName}
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span style={s.driverInitial}>{initial}</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={s.driverName}>{driver.fullName}</div>
        <div style={s.driverMeta}>
          ⭐ {Number(driver.ratingAvg).toFixed(1)}
          {driver.vehicleType ? ` · ${humanVehicle(driver.vehicleType)}` : ''}
        </div>
      </div>
    </div>
  );
}

function humanVehicle(v: string) {
  if (v === 'moto') return 'Moto';
  if (v === 'velo') return 'Vélo';
  if (v === 'voiture') return 'Voiture';
  if (v === 'tricycle') return 'Tricycle';
  return v;
}

function Timeline({ data }: { data: PublicDelivery }) {
  const steps = [
    { key: 'accepted', label: 'Livreur en route', time: data.acceptedAt },
    { key: 'picked_up', label: 'Colis récupéré', time: data.pickedUpAt },
    { key: 'delivered', label: 'Livré', time: data.deliveredAt },
  ];
  const rank: Record<Status, number> = {
    scheduled: -1,
    pending: 0,
    accepted: 1,
    picking_up: 1,
    picked_up: 2,
    delivering: 2,
    delivered: 3,
    cancelled: -1,
    expired: -1,
  };
  const current = rank[data.status] ?? 0;

  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>Progression</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step, i) => {
          const passed = current >= i + 1;
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: passed ? '#10b981' : '#e5e7eb',
                  color: passed ? '#fff' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {passed ? '✓' : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: passed ? '#111' : '#9ca3af' }}>
                  {step.label}
                </div>
                {step.time ? (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {new Date(step.time).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Addresses({ data }: { data: PublicDelivery }) {
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>Trajet</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Address dotColor="#1d9e75" label="Récupération" address={data.pickupAddress} />
        <Address dotColor="#d85a30" label="Livraison" address={data.deliveryAddress} />
      </div>
    </div>
  );
}

function Address({ dotColor, label, address }: { dotColor: string; label: string; address: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          background: dotColor,
          marginTop: 6,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: '#111', marginTop: 2 }}>{address}</div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ textAlign: 'center', padding: 16, fontSize: 12, color: '#9ca3af' }}>
      Toolé · Suivi sécurisé
    </div>
  );
}

// ----------------------------------------
// Carte Leaflet
// ----------------------------------------

function buildMapHtml(d: PublicDelivery): string {
  const pickup = d.pickupLocation;
  const delivery = d.deliveryLocation;
  const driver = d.driver?.currentLocation;
  const path = d.route?.path ?? null;
  const initRouteJs =
    path && path.length >= 2
      ? `setRoute([${path.map((p) => `[${p.latitude}, ${p.longitude}]`).join(',')}]);`
      : driver
        ? `var _t = targetFor(${JSON.stringify(d.status)}); if (_t) setRoute([[${driver.latitude}, ${driver.longitude}], _t]); else setRoute([pickup, delivery]);`
        : `setRoute([pickup, delivery]);`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    body { background: #f8f9fa; }
    .pickup-marker, .delivery-marker, .driver-marker {
      width: 28px; height: 28px; border-radius: 14px;
      border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center; font-size: 14px;
    }
    .pickup-marker { background: #1d9e75; color: #fff; }
    .delivery-marker { background: #d85a30; color: #fff; }
    .driver-marker { background: #fff; color: #1d9e75; font-size: 16px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var pickup = [${pickup.latitude}, ${pickup.longitude}];
    var delivery = [${delivery.latitude}, ${delivery.longitude}];
    L.marker(pickup, { icon: L.divIcon({ className: 'pickup-marker', html: '🟢' }) }).addTo(map);
    L.marker(delivery, { icon: L.divIcon({ className: 'delivery-marker', html: '🔴' }) }).addTo(map);

    var driverMarker = ${
      driver
        ? `L.marker([${driver.latitude}, ${driver.longitude}], { icon: L.divIcon({ className: 'driver-marker', html: '🛵' }) }).addTo(map)`
        : 'null'
    };
    var routeLine = null;
    var animTimer = null;

    // Cible de la phase courante (pour le fallback ligne directe si pas d'OSRM).
    function targetFor(status) {
      if (status === 'accepted' || status === 'picking_up') return pickup;
      if (status === 'picked_up' || status === 'delivering') return delivery;
      return null;
    }
    function styleFor(len) {
      // Trace plein = vrai itineraire routier ; pointille = ligne directe.
      return { color: '#1d9e75', weight: 4, opacity: 0.85, lineJoin: 'round', lineCap: 'round', dashArray: (len >= 3 ? null : '6 6') };
    }
    function setRoute(latlngs) {
      if (!latlngs || latlngs.length < 2) return;
      if (routeLine) { routeLine.setLatLngs(latlngs); routeLine.setStyle(styleFor(latlngs.length)); }
      else { routeLine = L.polyline(latlngs, styleFor(latlngs.length)).addTo(map); }
    }
    // Glisse le marqueur livreur vers sa nouvelle position (~4s, fluide).
    function glide(toLat, toLng) {
      if (!driverMarker) {
        driverMarker = L.marker([toLat, toLng], { icon: L.divIcon({ className: 'driver-marker', html: '🛵' }) }).addTo(map);
        return;
      }
      var from = driverMarker.getLatLng();
      if (Math.abs(from.lat - toLat) < 1e-7 && Math.abs(from.lng - toLng) < 1e-7) return;
      var start = Date.now(); var dur = 4000;
      if (animTimer) clearInterval(animTimer);
      animTimer = setInterval(function () {
        var t = Math.min(1, (Date.now() - start) / dur);
        driverMarker.setLatLng([from.lat + (toLat - from.lat) * t, from.lng + (toLng - from.lng) * t]);
        if (t >= 1) { clearInterval(animTimer); animTimer = null; }
      }, 50);
    }

    ${initRouteJs}

    var initBounds = [pickup, delivery${driver ? `, [${driver.latitude}, ${driver.longitude}]` : ''}];
    map.fitBounds(initBounds, { padding: [40, 40], maxZoom: 15 });

    // Mises a jour live poussees par la page (postMessage) : deplacement fluide
    // + itineraire routier phase-aware (livreur -> recup puis livreur -> livraison).
    window.addEventListener('message', function (ev) {
      var msg = ev.data || {};
      if (!msg || msg.type !== 'tracking') return;
      if (msg.path && msg.path.length >= 2) {
        setRoute(msg.path.map(function (p) { return [p.latitude, p.longitude]; }));
      } else if (msg.driver) {
        var t = targetFor(msg.status);
        if (t) setRoute([[msg.driver.latitude, msg.driver.longitude], t]);
      }
      if (msg.driver) glide(msg.driver.latitude, msg.driver.longitude);
    });
  </script>
</body>
</html>`;
}

// ----------------------------------------
// Styles inline (page autonome, pas de CSS partage)
// ----------------------------------------

const s = {
  page: {
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
    background: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
    color: '#111',
  } as React.CSSProperties,
  header: {
    padding: '14px 16px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,
  logo: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: -0.5,
  } as React.CSSProperties,
  headerSub: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 600,
  } as React.CSSProperties,
  statusBanner: (color: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 16px',
    background: color + '14',
    borderBottom: `3px solid ${color}`,
  }),
  statusLabel: {
    fontSize: 17,
    fontWeight: 700,
  } as React.CSSProperties,
  refText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  } as React.CSSProperties,
  mapWrap: {
    height: 280,
    width: '100%',
    background: '#f3f4f6',
  } as React.CSSProperties,
  driverCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottom: '1px solid #e5e7eb',
  } as React.CSSProperties,
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: '#e1f5ee',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as React.CSSProperties,
  driverInitial: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1d9e75',
  } as React.CSSProperties,
  driverName: {
    fontSize: 15,
    fontWeight: 700,
  } as React.CSSProperties,
  driverMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  } as React.CSSProperties,
  section: {
    padding: 16,
    borderBottom: '1px solid #e5e7eb',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  } as React.CSSProperties,
  fullScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column' as const,
    gap: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
    color: '#111',
    padding: 20,
  } as React.CSSProperties,
  spinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    border: '3px solid #e5e7eb',
    borderTopColor: '#1d9e75',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,
  muted: { color: '#6b7280', fontSize: 14 } as React.CSSProperties,
  errorBox: {
    textAlign: 'center' as const,
    maxWidth: 360,
  } as React.CSSProperties,
  errorTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
  } as React.CSSProperties,
};
