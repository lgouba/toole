import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api';
import { formatDateShort, formatPhone } from '../utils';

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
  const navigate = useNavigate();
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  // Tri par colonne : clic sur l'en-tete pour toggle asc/desc.
  const [sortKey, setSortKey] = useState<
    'name' | 'phone' | 'email' | 'vehicle' | 'kyc' | 'status' | 'createdAt'
  >('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.fullName.localeCompare(b.fullName, 'fr', { sensitivity: 'base' });
          break;
        case 'phone':
          cmp = a.phone.localeCompare(b.phone);
          break;
        case 'email':
          cmp = (a.email ?? '').localeCompare(b.email ?? '');
          break;
        case 'vehicle':
          cmp = (a.driverProfile?.vehicleType ?? '').localeCompare(
            b.driverProfile?.vehicleType ?? '',
          );
          break;
        case 'kyc': {
          const order: Record<string, number> = { pending: 0, verified: 1, rejected: 2 };
          cmp =
            (order[a.driverProfile?.verificationStatus ?? 'pending'] ?? 0) -
            (order[b.driverProfile?.verificationStatus ?? 'pending'] ?? 0);
          break;
        }
        case 'status':
          cmp = Number(b.isActive) - Number(a.isActive);
          break;
        case 'createdAt':
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [items, sortKey, sortDir]);

  const SortIndicator = ({ active }: { active: boolean }) => (
    <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 11 }}>
      {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  );

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
                <th
                  onClick={() => toggleSort('name')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Nom <SortIndicator active={sortKey === 'name'} />
                </th>
                <th
                  className="col-phone"
                  onClick={() => toggleSort('phone')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Téléphone <SortIndicator active={sortKey === 'phone'} />
                </th>
                <th
                  onClick={() => toggleSort('email')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Email <SortIndicator active={sortKey === 'email'} />
                </th>
                {role === 'driver' ? (
                  <th
                    onClick={() => toggleSort('vehicle')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Véhicule <SortIndicator active={sortKey === 'vehicle'} />
                  </th>
                ) : null}
                {role === 'driver' ? <th>En ligne</th> : null}
                {role === 'driver' ? (
                  <th
                    onClick={() => toggleSort('kyc')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    KYC <SortIndicator active={sortKey === 'kyc'} />
                  </th>
                ) : null}
                <th
                  onClick={() => toggleSort('status')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Statut <SortIndicator active={sortKey === 'status'} />
                </th>
                <th
                  onClick={() => toggleSort('createdAt')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  className="col-date"
                >
                  Inscrit <SortIndicator active={sortKey === 'createdAt'} />
                </th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((u) => {
                const status = userStatus(u);
                return (
                  <tr
                    key={u.id}
                    className="row-link"
                    onClick={() => navigate(`/users/${u.id}`)}
                  >
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
                    <td className="muted nowrap col-date">{formatDateShort(u.createdAt)}</td>
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
