import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api';
import { Tabs, type TabDef } from '../components/Tabs';

type Status = 'open' | 'in_progress' | 'resolved';
type Category = 'app_problem' | 'account_data' | 'dispute' | 'refund' | 'other';

interface Ticket {
  id: string;
  reference: string;
  category: Category;
  description: string;
  status: Status;
  createdAt: string;
  user?: { id: string; fullName: string; phone: string; userType: string } | null;
  delivery?: { id: string; reference: string } | null;
}

const CATEGORY_LABEL: Record<Category, string> = {
  app_problem: "Problème appli",
  account_data: 'Infos compte',
  dispute: 'Litige',
  refund: 'Remboursement',
  other: 'Autres',
};

const STATUS_LABEL: Record<Status, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
};

const STATUS_COLOR: Record<Status, string> = {
  open: '#d97706',
  in_progress: '#6366f1',
  resolved: '#15803d',
};

type TabId = 'all' | Status;

export default function Support() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/admin/support/tickets');
      setTickets(unwrap<Ticket[]>(res));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, resolved: 0 };
    tickets.forEach((t) => (c[t.status] += 1));
    return c;
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (tab !== 'all' && t.status !== tab) return false;
      if (!q) return true;
      return (
        t.reference.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.user?.fullName ?? '').toLowerCase().includes(q) ||
        (t.user?.phone ?? '').includes(q)
      );
    });
  }, [tickets, tab, search]);

  const TABS: ReadonlyArray<TabDef<TabId>> = [
    { id: 'all', label: 'Toutes' },
    { id: 'open', label: 'Ouvertes', badge: counts.open },
    { id: 'in_progress', label: 'En cours', badge: counts.in_progress },
    { id: 'resolved', label: 'Résolues' },
  ];

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Réclamations</h1>
      <div style={s.subtitle}>
        Demandes de support envoyées depuis l'application. Ouvrez une demande pour
        répondre (par email / WhatsApp) et changer son statut.
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <input
        style={s.search}
        placeholder="Rechercher (référence, nom, téléphone, message)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={s.list}>
        {loading ? (
          <div style={s.muted}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={s.muted}>Aucune demande.</div>
        ) : (
          filtered.map((t) => (
            <div key={t.id} style={s.row} onClick={() => navigate(`/support/${t.id}`)}>
              <div style={s.rowTop}>
                <span style={s.ref}>{t.reference}</span>
                <span style={{ ...s.pill, background: STATUS_COLOR[t.status] + '18', color: STATUS_COLOR[t.status] }}>
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <div style={s.cat}>{CATEGORY_LABEL[t.category]}</div>
              <div style={s.desc}>{t.description}</div>
              <div style={s.meta}>
                {(t.user?.fullName ?? 'Utilisateur')} · {t.user?.phone ?? ''}
                {' · '}
                {new Date(t.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 24, maxWidth: 920, margin: '0 auto' },
  h1: { fontSize: 28, fontWeight: 800, margin: '0 0 8px' },
  subtitle: { color: 'var(--text-secondary, #6b7280)', fontSize: 14, marginBottom: 20 },
  search: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border, #e5e7eb)',
    fontSize: 14,
    margin: '16px 0',
    background: 'var(--bg, #fff)',
    color: 'var(--text, #111)',
    boxSizing: 'border-box',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  muted: { color: 'var(--text-tertiary, #9ca3af)', fontSize: 13, padding: 16 },
  row: {
    background: 'var(--card-bg, #fff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 14,
    padding: 16,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  rowTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontWeight: 700, fontSize: 15 },
  pill: { borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 },
  cat: { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-secondary, #6b7280)' },
  desc: { fontSize: 14, color: 'var(--text, #111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 12, color: 'var(--text-tertiary, #9ca3af)' },
};
