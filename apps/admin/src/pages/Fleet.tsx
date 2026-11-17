import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api';
import {
  VehicleRow,
  Shareholder,
  VehicleType,
  VehicleStatus,
  VehicleOwnerType,
  VEHICLE_TYPE_LABEL,
  VEHICLE_STATUS_LABEL,
  statusBadgeClass,
  ownerLabel,
  fmtFcfa,
} from './fleetTypes';

interface VehicleListItem extends VehicleRow {
  totals?: { courses: number; totalGenere: number; gainsLivreur: number };
}

const emptyForm = {
  vehicleType: 'moto' as VehicleType,
  brand: '',
  model: '',
  plate: '',
  status: 'en_service' as VehicleStatus,
  ownerType: 'toole' as VehicleOwnerType,
  shareholderId: '',
  note: '',
};

export default function Fleet() {
  const navigate = useNavigate();
  const [items, setItems] = useState<VehicleListItem[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState<'' | VehicleStatus>('');
  const [fOwner, setFOwner] = useState<'' | VehicleOwnerType>('');
  const [fAssigned, setFAssigned] = useState<'' | 'true' | 'false'>('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (fStatus) params.status = fStatus;
    if (fOwner) params.ownerType = fOwner;
    if (fAssigned) params.assigned = fAssigned;
    try {
      const res = await api.get('/admin/fleet/vehicles', { params });
      setItems(unwrap<VehicleListItem[]>(res));
    } catch {
      setError('Impossible de charger le parc. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const loadShareholders = async () => {
    try {
      const res = await api.get('/admin/fleet/shareholders');
      setShareholders(unwrap<Shareholder[]>(res).filter((s) => s.isActive));
    } catch {
      /* non bloquant pour la liste */
    }
  };

  useEffect(() => {
    load();
    loadShareholders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fStatus, fOwner, fAssigned]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openForm = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const submit = async () => {
    if (form.ownerType === 'actionnaire' && !form.shareholderId) {
      setToast('Choisissez un actionnaire pour un engin d’actionnaire.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        vehicleType: form.vehicleType,
        status: form.status,
        ownerType: form.ownerType,
      };
      if (form.brand.trim()) payload.brand = form.brand.trim();
      if (form.model.trim()) payload.model = form.model.trim();
      if (form.plate.trim()) payload.plate = form.plate.trim();
      if (form.note.trim()) payload.note = form.note.trim();
      if (form.ownerType === 'actionnaire') payload.shareholderId = form.shareholderId;

      const res = await api.post('/admin/fleet/vehicles', payload);
      const { plateWarning } = unwrap<{ vehicle: VehicleRow; plateWarning: string | null }>(res);
      setShowForm(false);
      setToast(plateWarning ?? 'Engin créé.');
      load();
    } catch {
      setToast('Création impossible. Vérifiez les informations et réessayez.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">Parc Auto</h1>
          <p className="page-subtitle">
            {items.length} {items.length > 1 ? 'engins' : 'engin'}
          </p>
        </div>
        <button className="btn" onClick={openForm}>
          Nouvel engin
        </button>
      </div>

      <div className="searchbar">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)}>
          <option value="">Tous les statuts</option>
          <option value="en_service">En service</option>
          <option value="en_panne">En panne</option>
          <option value="retire">Retiré</option>
        </select>
        <select value={fOwner} onChange={(e) => setFOwner(e.target.value as any)}>
          <option value="">Tous propriétaires</option>
          <option value="toole">Toolé (parc propre)</option>
          <option value="actionnaire">Actionnaire</option>
        </select>
        <select value={fAssigned} onChange={(e) => setFAssigned(e.target.value as any)}>
          <option value="">Affectés & libres</option>
          <option value="true">Affectés</option>
          <option value="false">Libres</option>
        </select>
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
            Aucun engin.
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-outline btn-sm" onClick={openForm}>
                Ajouter un engin
              </button>
            </div>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Plaque</th>
                <th>Type</th>
                <th>Marque / Modèle</th>
                <th>Statut</th>
                <th>Propriétaire</th>
                <th>Livreur actuel</th>
                <th style={{ textAlign: 'right' }}>Courses</th>
                <th style={{ textAlign: 'right' }}>Total généré</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr
                  key={v.id}
                  className="row-link"
                  onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{v.plate ?? <span className="muted">—</span>}</td>
                  <td>{VEHICLE_TYPE_LABEL[v.vehicleType]}</td>
                  <td>{[v.brand, v.model].filter(Boolean).join(' ') || <span className="muted">—</span>}</td>
                  <td>
                    <span className={statusBadgeClass(v.status)}>
                      {VEHICLE_STATUS_LABEL[v.status]}
                    </span>
                  </td>
                  <td>{ownerLabel(v)}</td>
                  <td>
                    {v.activeAssignment ? (
                      v.activeAssignment.driver.fullName
                    ) : (
                      <span className="muted">Libre</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>{v.totals ? v.totals.courses : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {v.totals ? fmtFcfa(v.totals.totalGenere) : '—'}
                  </td>
                </tr>
              ))}
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
          <div
            className="card"
            style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h2>Nouvel engin</h2>
            </div>
            <div className="card-body">
              <div className="form">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label>
                    Type
                    <select
                      value={form.vehicleType}
                      onChange={(e) => set('vehicleType', e.target.value as VehicleType)}
                    >
                      <option value="moto">Moto</option>
                      <option value="velo">Vélo</option>
                      <option value="voiture">Voiture</option>
                      <option value="tricycle">Tricycle</option>
                    </select>
                  </label>
                  <label>
                    Statut
                    <select
                      value={form.status}
                      onChange={(e) => set('status', e.target.value as VehicleStatus)}
                    >
                      <option value="en_service">En service</option>
                      <option value="en_panne">En panne</option>
                      <option value="retire">Retiré</option>
                    </select>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label>
                    Marque
                    <input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Ex: Honda" maxLength={100} />
                  </label>
                  <label>
                    Modèle
                    <input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Ex: CG 125" maxLength={100} />
                  </label>
                </div>
                <label>
                  Plaque d’immatriculation
                  <input value={form.plate} onChange={(e) => set('plate', e.target.value)} placeholder="Ex: 11 AB 1234" maxLength={30} />
                </label>
                <label>
                  Propriétaire
                  <select
                    value={form.ownerType}
                    onChange={(e) => set('ownerType', e.target.value as VehicleOwnerType)}
                  >
                    <option value="toole">Toolé (parc propre)</option>
                    <option value="actionnaire">Actionnaire</option>
                  </select>
                </label>
                {form.ownerType === 'actionnaire' && (
                  <label>
                    Actionnaire
                    <select
                      value={form.shareholderId}
                      onChange={(e) => set('shareholderId', e.target.value)}
                    >
                      <option value="">— Choisir —</option>
                      {shareholders.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
                {saving ? 'Création…' : 'Créer l’engin'}
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
