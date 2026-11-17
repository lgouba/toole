import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api';
import { formatPhone } from '../utils';
import { Shareholder, VehicleRow } from './fleetTypes';

const emptyForm = { fullName: '', phone: '', email: '', note: '' };

export default function Shareholders() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Shareholder[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [shRes, vRes] = await Promise.all([
        api.get('/admin/fleet/shareholders'),
        api.get('/admin/fleet/vehicles', { params: { ownerType: 'actionnaire' } }),
      ]);
      setItems(unwrap<Shareholder[]>(shRes));
      setVehicles(unwrap<VehicleRow[]>(vRes));
    } catch {
      setError('Impossible de charger les actionnaires.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, { total: number; assigned: number }>();
    for (const v of vehicles) {
      if (!v.shareholderId) continue;
      const c = m.get(v.shareholderId) ?? { total: 0, assigned: 0 };
      c.total += 1;
      if (v.activeAssignment) c.assigned += 1;
      m.set(v.shareholderId, c);
    }
    return m;
  }, [vehicles]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.fullName.trim()) {
      setToast('Le nom est requis.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { fullName: form.fullName.trim() };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.note.trim()) payload.note = form.note.trim();
      await api.post('/admin/fleet/shareholders', payload);
      setShowForm(false);
      setForm(emptyForm);
      setToast('Actionnaire créé.');
      load();
    } catch {
      setToast('Création impossible. Vérifiez les informations.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">Actionnaires</h1>
          <p className="page-subtitle">
            {items.length} {items.length > 1 ? 'actionnaires' : 'actionnaire'}
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>
          Nouvel actionnaire
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-wrap">
            <div className="spinner"></div>
            Chargement...
          </div>
        ) : error ? (
          <div className="empty">
            {error}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-outline btn-sm" onClick={load}>
                Réessayer
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            Aucun actionnaire.
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setShowForm(true)}>
                Ajouter un actionnaire
              </button>
            </div>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>Engins</th>
                <th style={{ textAlign: 'right' }}>Affectés</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const c = counts.get(s.id) ?? { total: 0, assigned: 0 };
                return (
                  <tr
                    key={s.id}
                    className="row-link"
                    onClick={() => navigate(`/fleet/shareholders/${s.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      {s.fullName}
                      {!s.isActive && <span className="badge badge-suspended" style={{ marginLeft: 8 }}>Archivé</span>}
                    </td>
                    <td>{s.phone ? formatPhone(s.phone) : <span className="muted">—</span>}</td>
                    <td>{s.email ?? <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right' }}>{c.total}</td>
                    <td style={{ textAlign: 'right' }}>{c.assigned}</td>
                    <td style={{ textAlign: 'right' }} className="muted">›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,26,31,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => !saving && setShowForm(false)}
        >
          <div className="card" style={{ maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2>Nouvel actionnaire</h2>
            </div>
            <div className="card-body">
              <div className="form">
                <label>
                  Nom complet
                  <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} maxLength={200} />
                </label>
                <label>
                  Téléphone (optionnel)
                  <input value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={30} />
                </label>
                <label>
                  Email (optionnel)
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={200} />
                </label>
                <label>
                  Note (optionnel)
                  <input value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={1000} />
                </label>
              </div>
            </div>
            <div className="modal-actions" style={{ padding: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>
                Annuler
              </button>
              <button className="btn" onClick={submit} disabled={saving}>
                {saving ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" onAnimationEnd={() => setToast(null)}>
          <div className="toast-body">{toast}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setToast(null)}>
            OK
          </button>
        </div>
      )}
    </>
  );
}
