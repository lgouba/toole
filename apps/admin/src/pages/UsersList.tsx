import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrap } from '../api';
import { formatDate, formatPhone } from '../utils';

interface UserRow {
  id: string;
  phone: string;
  fullName: string;
  email: string | null;
  userType: string;
  isActive: boolean;
  suspendedAt: string | null;
  createdAt: string;
  driverProfile?: {
    isOnline: boolean;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    vehicleType: string;
    totalDeliveries: number;
  } | null;
}

type FilterValue = 'all' | 'active' | 'pending-activation' | 'suspended' | 'pending-kyc';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Statut global : Actif / En attente d'activation / Suspendu. */
function userStatus(u: UserRow): { cls: string; label: string } {
  if (u.isActive) return { cls: 'badge-active', label: 'Actif' };
  if (u.suspendedAt) return { cls: 'badge-suspended', label: 'Suspendu' };
  return { cls: 'badge-pending', label: 'En attente' };
}

export default function UsersList({
  role,
  title,
}: {
  role: 'client' | 'driver';
  title: string;
}) {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');

  const load = async () => {
    setLoading(true);
    const params: Record<string, string> = { role };
    if (search) params.search = search;
    if (filter === 'active') params.isActive = 'true';
    if (filter === 'suspended' || filter === 'pending-activation') {
      params.isActive = 'false';
    }

    try {
      const res = await api.get('/admin/users', { params });
      let data = unwrap<{ items: UserRow[]; total: number }>(res).items;
      if (filter === 'pending-kyc') {
        data = data.filter((u) => u.driverProfile?.verificationStatus === 'pending');
      }
      if (filter === 'pending-activation') {
        data = data.filter((u) => !u.suspendedAt);
      }
      if (filter === 'suspended') {
        data = data.filter((u) => !!u.suspendedAt);
      }
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, filter]);

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {items.length} {items.length > 1 ? 'utilisateurs' : 'utilisateur'}
          </p>
        </div>
      </div>

      <div className="searchbar">
        <input
          type="text"
          placeholder="Rechercher (nom, telephone, email)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as FilterValue)}>
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          {role === 'driver' ? (
            <option value="pending-activation">En attente d'activation</option>
          ) : null}
          <option value="suspended">Suspendus</option>
          {role === 'driver' ? <option value="pending-kyc">KYC en attente</option> : null}
        </select>
        <button className="btn btn-outline" onClick={load}>
          Rechercher
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-wrap">
            <div className="spinner"></div>
            Chargement...
          </div>
        ) : items.length === 0 ? (
          <div className="empty">Aucun resultat.</div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th className="col-phone">Telephone</th>
                <th>Email</th>
                {role === 'driver' ? <th>Vehicule</th> : null}
                {role === 'driver' ? <th>En ligne</th> : null}
                {role === 'driver' ? <th>KYC</th> : null}
                <th>Statut</th>
                <th>Inscrit</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const status = userStatus(u);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="table-avatar">
                        <div className="circle">{initials(u.fullName)}</div>
                        <span>{u.fullName}</span>
                      </div>
                    </td>
                    <td className="col-phone">
                      <span className="nowrap">{formatPhone(u.phone)}</span>
                    </td>
                    <td className="muted">{u.email ?? '—'}</td>
                    {role === 'driver' ? (
                      <td style={{ textTransform: 'capitalize' }}>
                        {u.driverProfile?.vehicleType ?? '—'}
                      </td>
                    ) : null}
                    {role === 'driver' ? (
                      <td>
                        {u.driverProfile?.isOnline ? (
                          <span className="badge badge-online">En ligne</span>
                        ) : (
                          <span className="badge badge-offline">Hors ligne</span>
                        )}
                      </td>
                    ) : null}
                    {role === 'driver' ? (
                      <td>
                        <KycBadge
                          status={u.driverProfile?.verificationStatus ?? 'pending'}
                        />
                      </td>
                    ) : null}
                    <td>
                      <span className={`badge ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="muted nowrap">{formatDate(u.createdAt)}</td>
                    <td className="col-actions">
                      <Link to={`/users/${u.id}`} className="btn btn-ghost btn-sm">
                        Gerer
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function KycBadge({
  status,
}: {
  status: 'pending' | 'verified' | 'rejected';
}) {
  if (status === 'verified') return <span className="badge badge-verified">Verifie</span>;
  if (status === 'rejected') return <span className="badge badge-rejected">Refuse</span>;
  return <span className="badge badge-pending">En attente</span>;
}
