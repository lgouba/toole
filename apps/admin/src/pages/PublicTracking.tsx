import { CSSProperties, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { RIDER_MARKER_URI } from '../riderMarker';

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
  route?: {
    path: { latitude: number; longitude: number }[] | null;
    phase: 'to_pickup' | 'to_delivery' | null;
  } | null;
}

const POLL_MS = 5_000;

// --- Design tokens B3 ---
const C = {
  bg: '#FBF8F0',
  surface: '#FFFFFF',
  ink: '#16140F',
  muted: '#938E80',
  hair: '#EAE4D8',
  gDark: '#15803D',
  gMid: '#16A34A',
  gBright: '#22C55E',
  tender: '#E7F6EC',
  red: '#E5484D',
};
const FONT_UI = 'Archivo, system-ui, sans-serif';
const FONT_MONO = "'Space Mono', ui-monospace, monospace";
const FONT_NUM = "'Space Grotesk', Archivo, sans-serif";

const STATUS_META: Record<Status, { label: string; done?: boolean; final?: boolean }> = {
  scheduled: { label: 'Course programmée' },
  pending: { label: 'Recherche d’un livreur' },
  accepted: { label: 'Livreur en route' },
  picking_up: { label: 'Livreur sur place' },
  picked_up: { label: 'Colis récupéré' },
  delivering: { label: 'En route vers vous' },
  delivered: { label: 'Livré', done: true, final: true },
  cancelled: { label: 'Course annulée', final: true },
  expired: { label: 'Lien expiré', final: true },
};

/** Icône Material Symbols (police chargée dans index.html), via ligature. */
function Sym({
  name,
  size = 20,
  color = 'currentColor',
  fill = 0,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  fill?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: "'Material Symbols Rounded'",
        fontWeight: 'normal',
        fontSize: size,
        lineHeight: 1,
        color,
        display: 'inline-block',
        verticalAlign: 'middle',
        fontVariationSettings: `'FILL' ${fill}`,
        WebkitFontFeatureSettings: "'liga'",
        ...style,
      }}
    >
      {name}
    </span>
  );
}

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
      } catch {
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
      <Shell>
        <div style={{ ...s.center, minHeight: '60vh' }}>
          <div style={s.spinner} />
          <div style={{ ...s.muted, marginTop: 12 }}>Chargement du suivi…</div>
        </div>
      </Shell>
    );
  }

  if (error === 'NOT_FOUND') {
    return (
      <Shell>
        <ErrorBox
          icon="link_off"
          title="Suivi introuvable"
          message="Ce lien de suivi n'existe pas ou a expiré."
        />
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <ErrorBox
          icon="wifi_off"
          title="Connexion impossible"
          message="Vérifiez votre connexion et réessayez."
        />
      </Shell>
    );
  }
  if (!data) return null;

  const meta = STATUS_META[data.status];
  const positionStale =
    !!data.driver &&
    !data.driver.currentLocation &&
    !['delivered', 'cancelled', 'expired'].includes(data.status);

  return (
    <Shell>
      <Header />
      <Map delivery={data} />

      <div style={s.sheet}>
        {/* Badge statut */}
        <div style={s.badgeWrap}>
          <div style={s.badge}>
            {!meta.final && <span style={s.badgeDot} className="pulse-dot" />}
            {meta.final && (
              <Sym name={meta.done ? 'check_circle' : 'info'} size={16} color={C.gDark} fill={1} />
            )}
            <span style={s.badgeLabel}>{meta.label}</span>
          </div>
          <div style={s.ref}>Réf. {data.reference}</div>
        </div>

        {positionStale && (
          <div style={s.staleBanner}>
            <Sym name="my_location" size={15} color={C.muted} />
            <span>Position en cours d'actualisation…</span>
          </div>
        )}

        {data.driver && <DriverCard driver={data.driver} />}

        <ProgressPills status={data.status} />

        <RouteRail data={data} />
      </div>

      <Footer />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={s.page}>
      <TrackStyles />
      {children}
    </div>
  );
}

function Header() {
  return (
    <div style={s.header}>
      <div style={s.overtitle}>SUIVI DE LIVRAISON</div>
      <div style={s.logo}>
        <span style={{ color: C.gDark }}>T</span>oolé
      </div>
    </div>
  );
}

function DriverCard({ driver }: { driver: NonNullable<PublicDelivery['driver']> }) {
  return (
    <div style={s.driverCard}>
      <div style={s.driverAvatar}>
        <Sym name="person" size={26} color={C.gDark} fill={1} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.driverName}>{driver.fullName}</div>
        <div style={s.driverMeta}>
          <Sym name="star" size={14} color="#F5A524" fill={1} />
          <span style={{ fontFamily: FONT_NUM, fontWeight: 600 }}>
            {Number(driver.ratingAvg).toFixed(1)}
          </span>
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

function ProgressPills({ status }: { status: Status }) {
  const steps = [
    { label: 'En route' },
    { label: 'Récupéré' },
    { label: 'Livré' },
  ];
  const rank: Record<Status, number> = {
    scheduled: 0,
    pending: 0,
    accepted: 1,
    picking_up: 1,
    picked_up: 2,
    delivering: 2,
    delivered: 3,
    cancelled: 0,
    expired: 0,
  };
  const current = rank[status] ?? 0;
  return (
    <div style={s.pillsRow}>
      {steps.map((step, i) => {
        const idx = i + 1;
        const done = current > idx || (current === 3 && idx === 3);
        const active = current === idx;
        return (
          <div
            key={step.label}
            style={{
              ...s.pill,
              ...(done ? s.pillDone : active ? s.pillActive : s.pillIdle),
            }}
          >
            {done && <Sym name="check" size={14} color="#fff" fill={1} />}
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RouteRail({ data }: { data: PublicDelivery }) {
  return (
    <div style={s.rail}>
      <div style={s.railRow}>
        <div style={{ ...s.railDot, background: C.gBright }} />
        <div>
          <div style={s.railLabel}>RÉCUPÉRATION</div>
          <div style={s.railAddr}>{data.pickupAddress}</div>
        </div>
      </div>
      <div style={s.railLine} />
      <div style={s.railRow}>
        <div style={{ ...s.railDot, background: C.red }} />
        <div>
          <div style={s.railLabel}>LIVRAISON</div>
          <div style={s.railAddr}>{data.deliveryAddress}</div>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <>
      <Header />
      <div style={{ ...s.center, minHeight: '55vh', padding: 24 }}>
        <div style={s.errorIcon}>
          <Sym name={icon} size={34} color={C.gDark} />
        </div>
        <div style={s.errorTitle}>{title}</div>
        <div style={{ ...s.muted, textAlign: 'center', marginTop: 6 }}>{message}</div>
      </div>
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <div style={s.footer}>
      Fond de carte © OpenStreetMap · <span style={{ fontWeight: 700 }}>Toolé</span>
    </div>
  );
}

/** Styles globaux (pulse badge/halo + reduced-motion) injectés une fois. */
function TrackStyles() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes tk-pulse { 0%{transform:scale(.85);opacity:.75} 100%{transform:scale(2.2);opacity:0} }
      .pulse-dot { position: relative; }
      .pulse-dot::after {
        content:''; position:absolute; inset:0; border-radius:50%;
        background:${C.gBright}; animation: tk-pulse 1.7s ease-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .pulse-dot::after { animation: none; }
      }
    `}</style>
  );
}

// ----------------------------------------
// Carte Leaflet (iframe srcDoc + postMessage)
// ----------------------------------------

function Map({ delivery }: { delivery: PublicDelivery }) {
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
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        title="Carte de suivi"
      />
    </div>
  );
}

function buildMapHtml(d: PublicDelivery): string {
  // Défense en profondeur : ce HTML est injecté dans un iframe srcDoc et ces
  // coordonnées finissent en code JS inline. On force chaque valeur à être un
  // nombre fini — une valeur API malformée devient 0 au lieu de pouvoir
  // s'échapper du script. (Les chaînes utilisateur, nom/adresse, ne passent PAS
  // par ici : elles restent dans le JSX React, auto-échappé.)
  const num = (v: number): number => (Number.isFinite(v) ? v : 0);
  const pickup = d.pickupLocation;
  const delivery = d.deliveryLocation;
  const driver = d.driver?.currentLocation;
  const path = d.route?.path ?? null;
  const initRouteJs =
    path && path.length >= 2
      ? `setRoute([${path.map((p) => `[${num(p.latitude)}, ${num(p.longitude)}]`).join(',')}]);`
      : driver
        ? `var _t = targetFor(${JSON.stringify(d.status)}); if (_t) setRoute([[${num(driver.latitude)}, ${num(driver.longitude)}], _t]); else setRoute([pickup, delivery]);`
        : `setRoute([pickup, delivery]);`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    body { background: #eef2f4; }
    .pin { width: 22px; height: 22px; border-radius: 50%; border: 3px solid #fff;
           box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
    .pin-pickup { background: #22C55E; }
    .pin-delivery { background: #E5484D; }
    .rider { position: relative; width: 56px; height: 56px; display:flex; align-items:center; justify-content:center; }
    .rider img { width: 52px; height: 52px; display:block;
                 filter: drop-shadow(0 2px 4px rgba(0,0,0,.4)) drop-shadow(0 0 2px rgba(255,255,255,.85)); }
    .rider .halo { position: absolute; width: 40px; height: 40px; border-radius: 50%;
                   background: #16A34A; opacity: .18; animation: radar 2s ease-out infinite; }
    @keyframes radar { 0%{transform:scale(.7);opacity:.4} 100%{transform:scale(1.9);opacity:0} }
    @media (prefers-reduced-motion: reduce) { .rider .halo { animation: none; } }
    @keyframes route-flow { to { stroke-dashoffset: -18; } }
    .route-flow { animation: route-flow 0.9s linear infinite; }
    @media (prefers-reduced-motion: reduce) { .route-flow { animation: none; } }
    .leaflet-control-attribution { font-size: 10px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: true });
    map.zoomControl.setPosition('topleft');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var RIDER = ${JSON.stringify(RIDER_MARKER_URI)};
    function riderIcon() {
      return L.divIcon({
        className: 'rider-marker',
        html: '<div class="rider"><div class="halo"></div><img src="' + RIDER + '" alt="livreur"/></div>',
        iconSize: [56, 56], iconAnchor: [28, 28],
      });
    }
    function dot(cls) {
      return L.divIcon({ className: '', html: '<div class="pin ' + cls + '"></div>', iconSize: [22,22], iconAnchor: [11,11] });
    }

    var pickup = [${num(pickup.latitude)}, ${num(pickup.longitude)}];
    var delivery = [${num(delivery.latitude)}, ${num(delivery.longitude)}];
    L.marker(pickup, { icon: dot('pin-pickup') }).addTo(map);
    L.marker(delivery, { icon: dot('pin-delivery') }).addTo(map);

    var driverMarker = ${
      driver
        ? `L.marker([${num(driver.latitude)}, ${num(driver.longitude)}], { icon: riderIcon() }).addTo(map)`
        : 'null'
    };
    var routeLine = null;
    var routeFlow = null;
    var animTimer = null;

    function targetFor(status) {
      if (status === 'accepted' || status === 'picking_up') return pickup;
      if (status === 'picked_up' || status === 'delivering') return delivery;
      return null;
    }
    function styleFor(len) {
      return { color: '#15803D', weight: 6, opacity: 0.85, lineJoin: 'round', lineCap: 'round', dashArray: (len >= 3 ? null : '10 12') };
    }
    function setRoute(latlngs) {
      if (!latlngs || latlngs.length < 2) return;
      if (routeLine) { routeLine.setLatLngs(latlngs); routeLine.setStyle(styleFor(latlngs.length)); }
      else { routeLine = L.polyline(latlngs, styleFor(latlngs.length)).addTo(map); }
      // Couche "fourmis" : petits points verts qui defilent vers la cible.
      if (routeFlow) { routeFlow.setLatLngs(latlngs); }
      else {
        routeFlow = L.polyline(latlngs, {
          color: '#86EFAC', weight: 3.5, opacity: 0.95,
          lineJoin: 'round', lineCap: 'round', dashArray: '2 16', className: 'route-flow'
        }).addTo(map);
      }
      try { routeFlow.bringToFront(); } catch (e) {}
    }
    function glide(toLat, toLng) {
      if (!driverMarker) {
        driverMarker = L.marker([toLat, toLng], { icon: riderIcon() }).addTo(map);
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

    var initBounds = [pickup, delivery${driver ? `, [${num(driver.latitude)}, ${num(driver.longitude)}]` : ''}];
    map.fitBounds(initBounds, { padding: [40, 40], maxZoom: 15 });

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
// Styles
// ----------------------------------------

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: C.bg,
    fontFamily: FONT_UI,
    color: C.ink,
    maxWidth: 480,
    margin: '0 auto',
    position: 'relative',
  },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  muted: { color: C.muted, fontSize: 14 },

  header: {
    background: C.surface,
    textAlign: 'center',
    padding: '16px 16px 14px',
    borderBottom: `1px solid ${C.hair}`,
  },
  overtitle: { fontSize: 10.5, letterSpacing: 2.5, fontWeight: 700, color: C.muted },
  logo: { fontSize: 24, fontWeight: 800, marginTop: 4, letterSpacing: -0.5 },

  mapWrap: { height: 250, width: '100%', background: '#eef2f4', overflow: 'hidden' },

  sheet: {
    position: 'relative',
    marginTop: -22,
    background: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: '20px 18px 24px',
    boxShadow: '0 -8px 24px rgba(0,0,0,0.06)',
  },

  badgeWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: C.surface,
    border: `1px solid ${C.hair}`,
    borderRadius: 999,
    padding: '8px 16px',
  },
  badgeDot: { width: 9, height: 9, borderRadius: '50%', background: C.gBright, display: 'inline-block' },
  badgeLabel: { fontWeight: 700, fontSize: 14.5, color: C.ink },
  ref: { fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.3 },

  staleBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    color: C.muted,
    fontSize: 12.5,
  },

  driverCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    background: C.surface,
    border: `1px solid ${C.hair}`,
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: C.tender,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
  },
  driverName: { fontWeight: 700, fontSize: 16, color: C.ink },
  driverMeta: { display: 'flex', alignItems: 'center', gap: 5, color: C.muted, fontSize: 13, marginTop: 3 },

  pillsRow: { display: 'flex', gap: 8, marginTop: 18 },
  pill: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    padding: '10px 6px',
    fontSize: 12.5,
    fontWeight: 700,
  },
  pillDone: { background: C.gDark, color: '#fff' },
  pillActive: { background: C.tender, color: C.gDark, border: `1.5px solid ${C.gDark}` },
  pillIdle: { background: C.surface, color: C.muted, border: `1px solid ${C.hair}` },

  rail: {
    marginTop: 20,
    background: C.surface,
    border: `1px solid ${C.hair}`,
    borderRadius: 18,
    padding: '16px 16px 16px 14px',
  },
  railRow: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  railDot: { width: 14, height: 14, borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 0 0 1.5px ' + C.hair, marginTop: 2, flex: 'none' },
  railLine: { width: 2, height: 26, borderLeft: `2px dashed ${C.hair}`, marginLeft: 6 },
  railLabel: { fontSize: 10.5, letterSpacing: 1, fontWeight: 700, color: C.muted },
  railAddr: { fontSize: 14, color: C.ink, marginTop: 2, lineHeight: 1.35 },

  footer: { textAlign: 'center', padding: '18px 16px 28px', color: C.muted, fontSize: 11.5 },

  spinner: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: `3px solid ${C.hair}`,
    borderTopColor: C.gDark,
    animation: 'spin 0.8s linear infinite',
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    background: C.tender,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  errorTitle: { fontWeight: 800, fontSize: 18, color: C.ink },
};
