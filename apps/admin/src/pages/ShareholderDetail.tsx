import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, unwrap } from '../api';
import { useDialog } from '../components/DialogProvider';
import { formatPhone } from '../utils';
import {
  Shareholder,
  VehicleRow,
  ActivityTotals,
  VEHICLE_TYPE_LABEL,
  VEHICLE_STATUS_LABEL,
  statusBadgeClass,
  fmtFcfa,
} from './fleetTypes';

interface VehicleWithTotals extends VehicleRow {
  totals: ActivityTotals;
}

export default function ShareholderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dialog = useDialog();
  const [shareholder, setShareholder] = useState<Shareholder | null>(null);
  const [activity, setActivity] = useState<ActivityTotals | null>(null);
  const [vehicles, setVehicles] = useState<VehicleWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [shRes, vRes] = await Promise.all([
        api.get(`/admin/fleet/shareholders/${id}`),
        api.get('/admin/fleet/vehicles', { params: { ownerType: 'actionnaire' } }),
      ]);
      const sh = unwrap<{ shareholder: Shareholder; activity: ActivityTotals }>(shRes);
      setShareholder(sh.shareholder);
      setActivity(sh.activity);
      setVehicles(unwrap<VehicleWithTotals[]>(vRes).filter((v) => v.shareholderId === id));
    } catch {
      setError('Impossible de charger cet actionnaire.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const archive = async () => {
    const ok = await dialog.confirm({
      title: 'Archiver l’actionnaire',
      message: 'Il n’apparaîtra plus dans les listes de sélection. Ses engins et leur historique restent inchangés.',
      confirmLabel: 'Archiver',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post(`/admin/fleet/shareholders/${id}/archive`, {});
      setToast('Actionnaire archivé.');
      load();
    } catch {
      setToast('Opération impossible.');
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
  if (error || !shareholder) {
    return (
      <div className="card">
        <div className="empty">
          {error ?? 'Actionnaire introuvable.'}
          <div style={{ marginTop: 12 }}>
            <Link className="btn btn-outline btn-sm" to="/fleet/shareholders">
              Retour aux actionnaires
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const assigned = vehicles.filter((v) => v.activeAssignment).length;

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">
            {shareholder.fullName}
            {!shareholder.isActive && <span className="badge badge-suspended" style={{ marginLeft: 10 }}>Archivé</span>}
          </h1>
          <p className="page-subtitle">
            {shareholder.phone ? formatPhone(shareholder.phone) : 'Pas de téléphone'}
            {shareholder.email ? ` · ${shareholder.email}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {shareholder.isActive && (
            <button className="btn btn-outline btn-danger" onClick={archive}>
              Archiver
            </button>
          )}
          <Link className="btn btn-ghost" to="/fleet/shareholders">
            ← Actionnaires
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-head">Engins</div>
          <div className="balance-card-amount">{vehicles.length}</div>
          <div className="balance-card-sub">dont {assigned} affecté{assigned > 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-head">Courses livrées (cumul)</div>
          <div className="balance-card-amount">{activity?.courses ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-head">Total généré (cumul)</div>
          <div className="balance-card-amount">{fmtFcfa(activity?.totalGenere ?? 0)}</div>
        </div>
      </div>

      {shareholder.note && (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <div className="label">Note</div>
          <div className="muted">{shareholder.note}</div>
        </div>
      )}

      <div className="dashboard-section-title" style={{ marginTop: 24 }}>
        Ses engins
      </div>
      <div className="card">
        {vehicles.length === 0 ? (
          <div className="empty">Aucun engin rattaché à cet actionnaire.</div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Plaque</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Livreur actuel</th>
                <th style={{ textAlign: 'right' }}>Courses</th>
                <th style={{ textAlign: 'right' }}>Total généré</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr
                  key={v.id}
                  className="row-link"
                  onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{v.plate ?? <span className="muted">—</span>}</td>
                  <td>{VEHICLE_TYPE_LABEL[v.vehicleType]}</td>
                  <td>
                    <span className={statusBadgeClass(v.status)}>{VEHICLE_STATUS_LABEL[v.status]}</span>
                  </td>
                  <td>
                    {v.activeAssignment ? v.activeAssignment.driver.fullName : <span className="muted">Libre</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{v.totals.courses}</td>
                  <td style={{ textAlign: 'right' }}>{fmtFcfa(v.totals.totalGenere)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
