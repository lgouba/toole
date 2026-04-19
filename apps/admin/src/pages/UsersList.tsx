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
  createdAt: string;
  driverProfile?: {
    isOnline: boolean;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    vehicleType: string;
    totalDeliveries: number;
  } | null;
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
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'pending-kyc'>('all');

  const load = async () => {
    setLoading(true);
    const params: Record<string, string> = { role };
    if (search) params.search = search;
    if (filter === 'active') params.isActive = 'true';
    if (filter === 'suspended') params.isActive = 'false';

    try {
      const res = await api.get('/admin/users', { params });
      let data = unwrap<{ items: UserRow[]; total: number }>(res).items;
      if (filter === 'pending-kyc') {
        data = data.filter((u) => u.driverProfile?.verificationStatus === 'pending');
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
        <h1 className="page-title">{title}</h1>
      </div>

      <div className="searchbar">
        <input
          type="text"
          placeholder="Rechercher (nom, telephone, email)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          {role === 'driver' ? <option value="pending-kyc">KYC en attente</option> : null}
        </select>
        <button className="btn btn-outline" onClick={load}>
          Rechercher
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="empty">Aucun resultat.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Telephone</th>
                <th>Email</th>
                {role === 'driver' ? <th>Vehicule</th> : null}
                {role === 'driver' ? <th>En ligne</th> : null}
                {role === 'driver' ? <th>KYC</th> : null}
                <th>Statut</th>
                <th>Inscrit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{formatPhone(u.phone)}</td>
                  <td className="muted">{u.email ?? '-'}</td>
                  {role === 'driver' ? <td>{u.driverProfile?.vehicleType ?? '-'}</td> : null}
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
                      <KycBadge status={u.driverProfile?.verificationStatus ?? 'pending'} />
                    </td>
                  ) : null}
                  <td>
                    {u.isActive ? (
                      <span className="badge badge-active">Actif</span>
                    ) : (
                      <span className="badge badge-suspended">Suspendu</span>
                    )}
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <Link to={`/users/${u.id}`} className="btn btn-ghost btn-sm">
                      Gerer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function KycBadge({ status }: { status: 'pending' | 'verified' | 'rejected' }) {
  if (status === 'verified') return <span className="badge badge-verified">Verifie</span>;
  if (status === 'rejected') return <span className="badge badge-rejected">Refuse</span>;
  return <span className="badge badge-pending">En attente</span>;
}
