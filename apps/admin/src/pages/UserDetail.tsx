import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, unwrap, resolveUploadUrl } from '../api';
import { formatDate, formatPhone } from '../utils';
import { StatusBadge } from './Dashboard';
import { KycBadge } from './UsersList';
import { useDialog } from '../components/DialogProvider';

interface UserDetailData {
  user: {
    id: string;
    phone: string;
    fullName: string;
    email: string | null;
    userType: string;
    isActive: boolean;
    suspendedAt: string | null;
    suspendReason: string | null;
    createdAt: string;
    avatarUrl: string | null;
    driverProfile: {
      vehicleType: string;
      vehiclePlate: string | null;
      vehiclePhotoUrl: string | null;
      cnibNumber: string | null;
      cnibPhotoUrl: string | null;
      cnibPhotoBackUrl: string | null;
      licenseNumber: string | null;
      licensePhotoUrl: string | null;
      isOnline: boolean;
      currentLat: number | null;
      currentLng: number | null;
      verificationStatus: 'pending' | 'verified' | 'rejected';
      verificationNote: string | null;
      totalDeliveries: number;
      walletBalance: number;
    } | null;
    _count: {
      sentDeliveries: number;
      drivenDeliveries: number;
      receivedRatings: number;
    };
  };
  recentDeliveries: Array<{
    id: string;
    reference: string;
    status: string;
    createdAt: string;
    sender: { fullName: string };
    driver: { fullName: string } | null;
  }>;
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const dialog = useDialog();
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [kycNote, setKycNote] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/users/${id}`);
      const raw = unwrap<UserDetailData>(res);
      setData(raw);
      setKycNote(raw.user.driverProfile?.verificationNote ?? '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  if (loading || !data) return <div className="muted">Chargement...</div>;

  const { user } = data;
  const isDriver = user.userType === 'driver';

  const suspend = async () => {
    const reason = await dialog.prompt({
      title: 'Suspendre cet utilisateur',
      message: 'Indiquez un motif (visible dans l\'historique).',
      placeholder: 'Ex : comportement abusif',
      multiline: true,
    });
    if (reason === null) return;
    setBusy(true);
    try {
      await api.post(`/admin/users/${id}/suspend`, { reason });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const reactivate = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/users/${id}/reactivate`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resetOtp = async () => {
    const ok = await dialog.confirm({
      title: "Réinitialiser l'OTP ?",
      message:
        "L'utilisateur sera déconnecté de tous ses appareils et devra demander un nouveau code OTP pour se reconnecter.",
      confirmLabel: 'Réinitialiser',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(`/admin/users/${id}/reset-otp`);
      await dialog.alert({
        title: 'OTP réinitialisé',
        message: "L'utilisateur devra se reconnecter.",
        type: 'success',
      });
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async () => {
    const ok = await dialog.confirm({
      title: 'Supprimer définitivement ?',
      message:
        'Cette action est irréversible. Toutes les données associées (livraisons, transactions) seront conservées mais anonymisées.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete(`/admin/users/${id}`);
      nav(isDriver ? '/drivers' : '/clients');
    } catch (err: any) {
      await dialog.alert({
        title: 'Échec',
        message: err?.response?.data?.error?.message ?? 'Suppression impossible.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const setKyc = async (status: 'verified' | 'rejected' | 'pending') => {
    setBusy(true);
    try {
      await api.post(`/admin/drivers/${id}/verify`, { status, note: kycNote || undefined });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <Link to={isDriver ? '/drivers' : '/clients'} className="muted">
            ← Retour
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {user.fullName}
          </h1>
        </div>
        <div className="row">
          {isDriver ? (
            <Link
              to={`/drivers/${user.id}/tracking`}
              className="btn btn-outline"
            >
              Voir parcours GPS
            </Link>
          ) : null}
          {user.isActive ? (
            <button className="btn btn-danger" onClick={suspend} disabled={busy}>
              Suspendre
            </button>
          ) : (
            <button className="btn" onClick={reactivate} disabled={busy}>
              {user.suspendedAt ? 'Reactiver' : 'Activer'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={resetOtp} disabled={busy}>
            Reset OTP
          </button>
          <button className="btn btn-ghost" onClick={deleteUser} disabled={busy}>
            Supprimer
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Statut</div>
          <div className="value" style={{ fontSize: 18 }}>
            {user.isActive ? (
              <span className="badge badge-active">Actif</span>
            ) : user.suspendedAt ? (
              <span className="badge badge-suspended">Suspendu</span>
            ) : (
              <span className="badge badge-pending">En attente</span>
            )}
          </div>
          {!user.isActive && user.suspendedAt && user.suspendReason ? (
            <div className="hint">Motif: {user.suspendReason}</div>
          ) : !user.isActive && !user.suspendedAt ? (
            <div className="hint">A activer par un admin</div>
          ) : null}
        </div>
        <div className="stat-card">
          <div className="label">Telephone</div>
          <div className="value" style={{ fontSize: 18 }}>{formatPhone(user.phone)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Email</div>
          <div className="value" style={{ fontSize: 18 }}>{user.email ?? '-'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Inscrit</div>
          <div className="value" style={{ fontSize: 16 }}>{formatDate(user.createdAt)}</div>
        </div>
        {isDriver ? (
          <>
            <div className="stat-card">
              <div className="label">Livraisons effectuees</div>
              <div className="value">{user._count.drivenDeliveries}</div>
            </div>
            <div className="stat-card">
              <div className="label">En ligne</div>
              <div className="value" style={{ fontSize: 18 }}>
                {user.driverProfile?.isOnline ? (
                  <span className="badge badge-online">Oui</span>
                ) : (
                  <span className="badge badge-offline">Non</span>
                )}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Portefeuille</div>
              <div className="value">{user.driverProfile?.walletBalance ?? 0} FCFA</div>
            </div>
          </>
        ) : (
          <div className="stat-card">
            <div className="label">Livraisons envoyees</div>
            <div className="value">{user._count.sentDeliveries}</div>
          </div>
        )}
      </div>

      {isDriver && user.driverProfile ? (
        <div className="card">
          <div className="card-header">
            <h2>KYC — Documents du livreur</h2>
            <KycBadge status={user.driverProfile.verificationStatus} />
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div className="muted">Vehicule</div>
              <div>
                {user.driverProfile.vehicleType}
                {user.driverProfile.vehiclePlate ? ` · ${user.driverProfile.vehiclePlate}` : ''}
              </div>
            </div>

            <div className="row">
              <div>
                <div className="muted">CNIB</div>
                <div>{user.driverProfile.cnibNumber ?? '-'}</div>
              </div>
              <div style={{ marginLeft: 40 }}>
                <div className="muted">Permis</div>
                <div>{user.driverProfile.licenseNumber ?? '-'}</div>
              </div>
            </div>

            <div className="photos-row">
              {user.driverProfile.cnibPhotoUrl ? (
                <div>
                  <div className="muted">CNIB recto</div>
                  <img className="photo-thumb" src={resolveUploadUrl(user.driverProfile.cnibPhotoUrl)!} alt="CNIB recto" />
                </div>
              ) : null}
              {user.driverProfile.cnibPhotoBackUrl ? (
                <div>
                  <div className="muted">CNIB verso</div>
                  <img className="photo-thumb" src={resolveUploadUrl(user.driverProfile.cnibPhotoBackUrl)!} alt="CNIB verso" />
                </div>
              ) : null}
              {user.driverProfile.licensePhotoUrl ? (
                <div>
                  <div className="muted">Permis</div>
                  <img className="photo-thumb" src={resolveUploadUrl(user.driverProfile.licensePhotoUrl)!} alt="Permis" />
                </div>
              ) : null}
              {user.driverProfile.vehiclePhotoUrl ? (
                <div>
                  <div className="muted">Vehicule</div>
                  <img className="photo-thumb" src={resolveUploadUrl(user.driverProfile.vehiclePhotoUrl)!} alt="Vehicule" />
                </div>
              ) : null}
              {!user.driverProfile.cnibPhotoUrl &&
              !user.driverProfile.licensePhotoUrl &&
              !user.driverProfile.vehiclePhotoUrl ? (
                <div className="muted">Aucun document envoye.</div>
              ) : null}
            </div>

            <label>
              Note interne (visible par le livreur)
              <textarea
                rows={2}
                value={kycNote}
                onChange={(e) => setKycNote(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </label>

            <div className="row">
              <button className="btn" onClick={() => setKyc('verified')} disabled={busy}>
                Valider
              </button>
              <button className="btn btn-danger" onClick={() => setKyc('rejected')} disabled={busy}>
                Refuser
              </button>
              <button className="btn btn-ghost" onClick={() => setKyc('pending')} disabled={busy}>
                Remettre en attente
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h2>Livraisons recentes</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Statut</th>
              <th>Client</th>
              <th>Livreur</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.recentDeliveries.length === 0 ? (
              <tr><td colSpan={6} className="empty">Aucune livraison</td></tr>
            ) : (
              data.recentDeliveries.map((d) => (
                <tr key={d.id}>
                  <td>{d.reference}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{d.sender.fullName}</td>
                  <td>{d.driver?.fullName ?? '-'}</td>
                  <td>{formatDate(d.createdAt)}</td>
                  <td><Link to={`/deliveries/${d.id}`} className="btn btn-ghost btn-sm">Detail</Link></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
