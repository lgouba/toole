import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrap } from '../api';
import { formatCFA, formatDate } from '../utils';
import { StatusBadge } from './Dashboard';

interface Row {
  id: string;
  reference: string;
  status: string;
  price: number;
  createdAt: string;
  recipientName: string;
  sender: { fullName: string; phone: string } | null;
  driver: { fullName: string; phone: string } | null;
}

export default function Deliveries() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (status !== 'all') params.status = status;
    if (search) params.search = search;

    try {
      const res = await api.get('/admin/deliveries', { params });
      setItems(unwrap<{ items: Row[]; total: number }>(res).items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [status]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Livraisons</h1>
      </div>
      <div className="searchbar">
        <input
          type="text"
          placeholder="Reference, destinataire, telephone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="accepted">Acceptee</option>
          <option value="picking_up">Recuperation</option>
          <option value="picked_up">Recupere</option>
          <option value="delivering">Livraison</option>
          <option value="delivered">Livree</option>
          <option value="cancelled">Annulee</option>
          <option value="expired">Expiree</option>
        </select>
        <button className="btn btn-outline" onClick={load}>Rechercher</button>
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
                <th>Reference</th>
                <th>Statut</th>
                <th>Client</th>
                <th>Livreur</th>
                <th>Destinataire</th>
                <th>Prix</th>
                <th>Creee</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>{d.reference}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{d.sender?.fullName ?? '-'}</td>
                  <td>{d.driver?.fullName ?? <span className="muted">-</span>}</td>
                  <td>{d.recipientName}</td>
                  <td>{formatCFA(d.price)}</td>
                  <td>{formatDate(d.createdAt)}</td>
                  <td><Link to={`/deliveries/${d.id}`} className="btn btn-ghost btn-sm">Detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
