import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, unwrap } from '../api';
import { useDialog } from '../components/DialogProvider';
import { formatDate } from '../utils';
import {
  VehicleDetail as VehicleDetailData,
  AssignableDriver,
  VehicleStatus,
  VEHICLE_TYPE_LABEL,
  VEHICLE_STATUS_LABEL,
  statusBadgeClass,
  ownerLabel,
  vehicleLabel,
  fmtFcfa,
} from './fleetTypes';

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const dialog = useDialog();
  const [data, setData] = useState<VehicleDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [showAssign, setShowAssign] = useState(false);
  const [drivers, setDrivers] = useState<AssignableDriver[]>([]);
  const [driverId, setDriverId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/admin/fleet/vehicles/${id}`);
      setData(unwrap<VehicleDetailData>(res));
    } catch {
      setError('Impossible de charger cet engin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openAssign = async () => {
    setDriverId('');
    setShowAssign(true);
    try {
      const res = await api.get('/admin/fleet/drivers/assignable');
      setDrivers(unwrap<AssignableDriver[]>(res));
    } catch {
      setToast('Impossible de charger les livreurs.');
    }
  };

  const confirmAssign = async () => {
    if (!driverId) return;
    const driver = drivers.find((d) => d.id === driverId);
    if (driver?.hasActiveVehicle) {
      const ok = await dialog.confirm({
        title: 'Livreur déjà affecté',
        message: `${driver.fullName} roule déjà avec ${driver.activeVehicleLabel}. Cet engin sera libéré au profit du nouveau. Continuer ?`,
        confirmLabel: 'Affecter quand même',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/fleet/vehicles/${id}/assign`, { driverId });
      setShowAssign(false);
      setToast('Engin affecté.');
      load();
    } catch (e: any) {
      const code = e?.response?.data?.error?.code;
      setToast(
        code === 'VEHICLE_NOT_ASSIGNABLE'
          ? 'Seul un engin en service peut être affecté.'
          : code === 'DRIVER_NOT_ASSIGNABLE'
            ? 'Ce livreur n’est plus affectable (non vérifié, inactif ou suspendu).'
            : 'Affectation impossible.',
      );
    } finally {
      setBusy(false);
    }
  };

  const unassign = async () => {
    const ok = await dialog.confirm({
      title: 'Désaffecter',
      message: 'Libérer cet engin de son livreur actuel ?',
      confirmLabel: 'Désaffecter',
    });
    if (!ok) return;
    try {
      await api.post(`/admin/fleet/vehicles/${id}/unassign`, {});
      setToast('Engin libéré.');
      load();
    } catch {
      setToast('Opération impossible.');
    }
  };

  const changeStatus = async (status: VehicleStatus) => {
    try {
      await api.patch(`/admin/fleet/vehicles/${id}`, { status });
      load();
    } catch {
      setToast('Changement de statut impossible.');
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading-wrap">
          <div className="spinner"></div>
          Chargement...
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="card">
        <div className="empty">
          {error ?? 'Engin introuvable.'}
          <div style={{ marginTop: 12 }}>
            <Link className="btn btn-outline btn-sm" to="/fleet">
              Retour au parc
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">{vehicleLabel(data)}</h1>
          <p className="page-subtitle">
            {VEHICLE_TYPE_LABEL[data.vehicleType]} · {ownerLabel(data)}
          </p>
        </div>
        <Link className="btn btn-ghost" to="/fleet">
          ← Parc Auto
        </Link>
      </div>

      {/* Cumul à vie */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-head">Courses livrées (cumul)</div>
          <div className="balance-card-amount">{data.totals.courses}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-head">Total généré (cumul)</div>
          <div className="balance-card-amount">{fmtFcfa(data.totals.totalGenere)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-head">Gains livreur (cumul)</div>
          <div className="balance-card-amount">{fmtFcfa(data.totals.gainsLivreur)}</div>
        </div>
      </div>

      {/* Infos + statut + affectation */}
      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <div className="grid-2">
          <div>
            <div className="label">Plaque</div>
            <div>{data.plate ?? <span className="muted">—</span>}</div>
          </div>
          <div>
            <div className="label">Statut</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={statusBadgeClass(data.status)}>{VEHICLE_STATUS_LABEL[data.status]}</span>
              <select
                value={data.status}
                onChange={(e) => changeStatus(e.target.value as VehicleStatus)}
                style={{ maxWidth: 160 }}
              >
                <option value="en_service">En service</option>
                <option value="en_panne">En panne</option>
                <option value="retire">Retiré</option>
              </select>
            </div>
          </div>
          <div>
            <div className="label">Propriétaire</div>
            <div>
              {data.ownerType === 'actionnaire' && data.shareholder ? (
                <Link className="cl-link" to={`/fleet/shareholders/${data.shareholder.id}`}>
                  {data.shareholder.fullName}
                </Link>
              ) : (
                ownerLabel(data)
              )}
            </div>
          </div>
          <div>
            <div className="label">Livreur actuel</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {data.activeAssignment ? (
                <>
                  <Link className="cl-link" to={`/users/${data.activeAssignment.driver.id}`}>
                    {data.activeAssignment.driver.fullName}
                  </Link>
                  <button className="btn btn-outline btn-sm" onClick={unassign}>
                    Désaffecter
                  </button>
                </>
              ) : (
                <>
                  <span className="muted">Libre</span>
                  <button
                    className="btn btn-sm"
                    onClick={openAssign}
                    disabled={data.status !== 'en_service'}
                    title={data.status !== 'en_service' ? 'Seul un engin en service est affectable' : undefined}
                  >
                    Affecter à un livreur
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {data.note && (
          <div style={{ marginTop: 16 }}>
            <div className="label">Note</div>
            <div className="muted">{data.note}</div>
          </div>
        )}
      </div>

      {/* Historique des affectations */}
      <div className="dashboard-section-title" style={{ marginTop: 24 }}>
        Historique des affectations
      </div>
      <div className="card">
        {data.history.length === 0 ? (
          <div className="empty">Aucune affectation pour le moment.</div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Livreur</th>
                <th>Début</th>
                <th>Fin</th>
                <th style={{ textAlign: 'right' }}>Courses</th>
                <th style={{ textAlign: 'right' }}>Total généré</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((h) => (
                <tr key={h.id}>
                  <td>
                    <Link className="cl-link" to={`/users/${h.driverId}`}>
                      {h.driverName ?? '—'}
                    </Link>
                  </td>
                  <td>{formatDate(h.startedAt)}</td>
                  <td>{h.endedAt ? formatDate(h.endedAt) : <span className="badge badge-active">En cours</span>}</td>
                  <td style={{ textAlign: 'right' }}>{h.totals.courses}</td>
                  <td style={{ textAlign: 'right' }}>{fmtFcfa(h.totals.totalGenere)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAssign && (
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
          onClick={() => !busy && setShowAssign(false)}
        >
          <div className="card" style={{ maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2>Affecter {vehicleLabel(data)}</h2>
            </div>
            <div className="card-body">
              <div className="form">
                <label>
                  Livreur
                  <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                    <option value="">— Choisir un livreur —</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName}
                        {d.hasActiveVehicle ? ` (déjà : ${d.activeVehicleLabel})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {drivers.length === 0 && (
                  <div className="muted">Aucun livreur vérifié disponible.</div>
                )}
              </div>
            </div>
            <div className="modal-actions" style={{ padding: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowAssign(false)} disabled={busy}>
                Annuler
              </button>
              <button className="btn" onClick={confirmAssign} disabled={busy || !driverId}>
                {busy ? 'Affectation…' : 'Affecter'}
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
