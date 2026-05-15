import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrap } from '../api';
import { formatCFA, formatDate } from '../utils';
import { StatusBadge } from './Dashboard';
import { Tabs, type TabDef } from '../components/Tabs';

// Onglets regroupant les statuts par phase visuelle. Le filtre cote API
// reste un statut precis, donc chaque tab envoie une valeur exacte (ou 'all'
// pour ne rien filtrer cote backend, on filtre cote client).
type DeliveryTabId =
  | 'all'
  | 'inProgress'
  | 'pending'
  | 'delivered'
  | 'cancelled'
  | 'scheduled';

// Statuts couverts par chaque onglet (pour filtrage cote client).
const TAB_STATUSES: Record<DeliveryTabId, string[]> = {
  all: [],
  pending: ['pending'],
  inProgress: ['accepted', 'picking_up', 'picked_up', 'delivering'],
  delivered: ['delivered'],
  cancelled: ['cancelled', 'expired'],
  scheduled: ['scheduled'],
};

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
  const [tab, setTab] = useState<DeliveryTabId>('all');
  const [search, setSearch] = useState('');

  // Charge TOUTES les livraisons (les tabs filtrent cote client pour eviter
  // 5 round-trips API quand l'admin switch d'onglet). Le search continue
  // de passer en param API pour la recherche full-text plus fine.
  const load = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
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
  }, []);

  // Filtrage cote client en fonction du tab
  const filtered = (() => {
    const allowed = TAB_STATUSES[tab];
    if (allowed.length === 0) return items;
    return items.filter((d) => allowed.includes(d.status));
  })();

  const countByTab = (t: DeliveryTabId) => {
    const allowed = TAB_STATUSES[t];
    if (allowed.length === 0) return items.length;
    return items.filter((d) => allowed.includes(d.status)).length;
  };

  const TABS: ReadonlyArray<TabDef<DeliveryTabId>> = [
    { id: 'all', label: 'Toutes', icon: '📋', badge: countByTab('all') },
    {
      id: 'pending',
      label: 'En attente',
      icon: '🔎',
      badge: countByTab('pending'),
    },
    {
      id: 'inProgress',
      label: 'En cours',
      icon: '🚴',
      badge: countByTab('inProgress'),
    },
    {
      id: 'delivered',
      label: 'Terminées',
      icon: '✅',
      badge: countByTab('delivered'),
    },
    {
      id: 'cancelled',
      label: 'Annulées',
      icon: '❌',
      badge: countByTab('cancelled'),
    },
    {
      id: 'scheduled',
      label: 'Programmées',
      icon: '⏰',
      badge: countByTab('scheduled'),
    },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Livraisons</h1>
      </div>

      <Tabs
        tabs={TABS}
        value={tab}
        onChange={setTab}
        rightSlot={
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder="Référence, destinataire, téléphone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 13,
                minWidth: 240,
              }}
            />
            <button
              className="btn btn-outline"
              onClick={load}
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              Rechercher
            </button>
          </div>
        }
      />

      <div className="card">
        {loading ? (
          <div className="empty">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Aucun résultat.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Statut</th>
                <th>Client</th>
                <th>Livreur</th>
                <th>Destinataire</th>
                <th>Prix</th>
                <th>Créée</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
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
