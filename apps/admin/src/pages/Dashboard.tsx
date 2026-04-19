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
  topDrivers: Array<{ id: string; fullName: string; ratingAvg: string | number; ratingCount: number }>;
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/stats')
      .then((res) => setStats(unwrap<Stats>(res)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="muted">Chargement...</div>;
  if (!stats) return <div className="empty">Impossible de charger les statistiques.</div>;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Tableau de bord</h1>
      </div>

      <div className="stat-grid">
        <Stat label="Clients inscrits" value={stats.users.clients} hint={`+${stats.users.newLast7d} cette semaine`} />
        <Stat label="Livreurs" value={stats.users.drivers} hint={`${stats.drivers.online} en ligne`} />
        <Stat label="Livraisons (total)" value={stats.deliveries.total} hint={`${stats.deliveries.active} en cours`} />
        <Stat label="En attente" value={stats.deliveries.pending} hint="A trouver un livreur" />
        <Stat label="Livrees aujourd'hui" value={stats.deliveries.deliveredToday} />
        <Stat label="Livrees 7 derniers jours" value={stats.deliveries.deliveredLast7d} />
        <Stat label="Livrees 30 derniers jours" value={stats.deliveries.deliveredLast30d} />
        <Stat label="Annulees / expirees (30j)" value={stats.deliveries.cancelledLast30d} />
        <Stat label="CA 30 derniers jours" value={formatCFA(stats.revenue.grossLast30d)} hint="TTC" />
        <Stat
          label="Commission 30j"
          value={formatCFA(stats.revenue.commissionLast30d)}
          hint="15% plateforme"
        />
        <Stat label="KYC a verifier" value={stats.drivers.pendingKyc} hint="Documents en attente" />
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Top livreurs</h2>
          <Link to="/drivers" className="btn btn-ghost btn-sm">Tous</Link>
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
              <tr><td colSpan={4} className="empty">Aucun livreur</td></tr>
            ) : (
              stats.topDrivers.map((d) => (
                <tr key={d.id}>
                  <td>{d.fullName}</td>
                  <td>{Number(d.ratingAvg).toFixed(1)} ⭐</td>
                  <td>{d.ratingCount}</td>
                  <td><Link to={`/users/${d.id}`} className="btn btn-ghost btn-sm">Voir</Link></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Livraisons recentes</h2>
          <Link to="/deliveries" className="btn btn-ghost btn-sm">Toutes</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Statut</th>
              <th>Client</th>
              <th>Livreur</th>
              <th>Prix</th>
              <th>Creee</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stats.recentDeliveries.map((d) => (
              <tr key={d.id}>
                <td>{d.reference}</td>
                <td><StatusBadge status={d.status} /></td>
                <td>{d.sender?.fullName ?? '-'}</td>
                <td>{d.driver?.fullName ?? <span className="muted">-</span>}</td>
                <td>{formatCFA(d.price)}</td>
                <td>{formatDate(d.createdAt)}</td>
                <td><Link to={`/deliveries/${d.id}`} className="btn btn-ghost btn-sm">Detail</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
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
