import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrap } from '../api';
import { formatCFA, formatDate } from '../utils';

interface Stats {
  users: { clients: number; drivers: number; newLast7d: number };
  deliveries: {
    total: number;
    deliveredAll: number;
    deliveredToday: number;
    deliveredLast7d: number;
    deliveredLast30d: number;
    active: number;
    pending: number;
    cancelledLast30d: number;
  };
  drivers: { online: number; pendingKyc: number };
  revenue: { grossLast30d: number; commissionLast30d: number };
  topDrivers: Array<{
    id: string;
    fullName: string;
    ratingAvg: string | number;
    ratingCount: number;
  }>;
  recentDeliveries: Array<{
    id: string;
    reference: string;
    status: string;
    price: number;
    createdAt: string;
    sender?: { fullName: string } | null;
    driver?: { fullName: string } | null;
  }>;
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, JSX.Element> = {
    client: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
      </>
    ),
    driver: (
      <>
        <circle cx="5" cy="17" r="3" />
        <circle cx="19" cy="17" r="3" />
        <path d="M5 17l3-9h6l2 5" />
      </>
    ),
    box: (
      <>
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l3 3 5-6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </>
    ),
    x: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6M15 9l-6 6" />
      </>
    ),
    money: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 10v.01M18 14v.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      </>
    ),
    trending: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M17 7h4v4" />
      </>
    ),
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

interface StatProps {
  icon: string;
  label: string;
  value: string | number;
  hint?: string;
  hintType?: 'positive' | 'negative' | 'neutral';
  accent?: 'primary' | 'blue' | 'purple' | 'orange' | 'pink' | 'teal';
  hero?: boolean;
}

function Stat({ icon, label, value, hint, hintType, accent = 'primary', hero }: StatProps) {
  return (
    <div className={`stat-card ${hero ? 'hero' : `accent-${accent}`}`}>
      <div className="stat-card-head">
        <div className="label">{label}</div>
        <div className="stat-icon">
          <Icon name={icon} />
        </div>
      </div>
      <div className="value">{value}</div>
      {hint ? (
        <div className={`hint ${hintType ?? 'neutral'}`}>{hint}</div>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'badge-pending', label: 'En attente' },
    accepted: { cls: 'badge-in-progress', label: 'Acceptee' },
    picking_up: { cls: 'badge-in-progress', label: 'Recuperation' },
    picked_up: { cls: 'badge-in-progress', label: 'Recupere' },
    delivering: { cls: 'badge-in-progress', label: 'Livraison' },
    delivered: { cls: 'badge-delivered', label: 'Livree' },
    cancelled: { cls: 'badge-cancelled', label: 'Annulee' },
    expired: { cls: 'badge-expired', label: 'Expiree' },
  };
  const s = map[status] ?? { cls: 'badge-offline', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/stats')
      .then((res) => setStats(unwrap<Stats>(res)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-wrap">
        <div className="spinner"></div>
        Chargement du tableau de bord...
      </div>
    );
  }
  if (!stats) {
    return <div className="empty">Impossible de charger les statistiques.</div>;
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">
            {today.charAt(0).toUpperCase() + today.slice(1)}
          </p>
        </div>
      </div>

      {/* Top row: hero + key counters */}
      <div className="stat-grid">
        <Stat
          hero
          icon="money"
          label="Chiffre d'affaires 30j"
          value={formatCFA(stats.revenue.grossLast30d)}
          hint={`Commission: ${formatCFA(stats.revenue.commissionLast30d)} (15%)`}
        />
        <Stat
          icon="client"
          label="Clients inscrits"
          value={stats.users.clients}
          accent="blue"
          hint={`+${stats.users.newLast7d} cette semaine`}
          hintType={stats.users.newLast7d > 0 ? 'positive' : 'neutral'}
        />
        <Stat
          icon="driver"
          label="Livreurs actifs"
          value={stats.users.drivers}
          accent="purple"
          hint={`${stats.drivers.online} en ligne maintenant`}
          hintType={stats.drivers.online > 0 ? 'positive' : 'neutral'}
        />
        <Stat
          icon="shield"
          label="KYC a verifier"
          value={stats.drivers.pendingKyc}
          accent="orange"
          hint={stats.drivers.pendingKyc > 0 ? 'Action requise' : 'A jour'}
          hintType={stats.drivers.pendingKyc > 0 ? 'negative' : 'positive'}
        />
      </div>

      {/* Deliveries breakdown */}
      <div className="stat-grid">
        <Stat
          icon="box"
          label="Livraisons totales"
          value={stats.deliveries.total}
          accent="teal"
          hint={`${stats.deliveries.active} en cours`}
        />
        <Stat
          icon="clock"
          label="En attente"
          value={stats.deliveries.pending}
          accent="orange"
          hint="A trouver un livreur"
        />
        <Stat
          icon="check"
          label="Livrees aujourd'hui"
          value={stats.deliveries.deliveredToday}
          accent="primary"
        />
        <Stat
          icon="calendar"
          label="Livrees 7 derniers jours"
          value={stats.deliveries.deliveredLast7d}
          accent="blue"
        />
        <Stat
          icon="trending"
          label="Livrees 30 derniers jours"
          value={stats.deliveries.deliveredLast30d}
          accent="primary"
        />
        <Stat
          icon="x"
          label="Annulees / expirees (30j)"
          value={stats.deliveries.cancelledLast30d}
          accent="pink"
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2>
              <span className="card-icon">
                <Icon name="driver" />
              </span>
              Top livreurs
            </h2>
            <Link to="/drivers" className="btn btn-ghost btn-sm">
              Voir tous
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Note</th>
                <th>Evaluations</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.topDrivers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Aucun livreur
                  </td>
                </tr>
              ) : (
                stats.topDrivers.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="table-avatar">
                        <div className="circle">{initials(d.fullName)}</div>
                        <span>{d.fullName}</span>
                      </div>
                    </td>
                    <td>
                      <strong>{Number(d.ratingAvg).toFixed(1)}</strong>{' '}
                      <span className="muted">/5</span>
                    </td>
                    <td>{d.ratingCount}</td>
                    <td>
                      <Link to={`/users/${d.id}`} className="btn btn-ghost btn-sm">
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>
              <span className="card-icon">
                <Icon name="box" />
              </span>
              Livraisons recentes
            </h2>
            <Link to="/deliveries" className="btn btn-ghost btn-sm">
              Toutes
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Statut</th>
                <th>Prix</th>
                <th>Creee</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Aucune livraison
                  </td>
                </tr>
              ) : (
                stats.recentDeliveries.slice(0, 8).map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link
                        to={`/deliveries/${d.id}`}
                        style={{ fontWeight: 600, color: 'var(--primary)' }}
                      >
                        {d.reference}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>
                      <strong>{formatCFA(d.price)}</strong>
                    </td>
                    <td className="muted">{formatDate(d.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
