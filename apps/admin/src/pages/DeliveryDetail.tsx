import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, unwrap, resolveUploadUrl } from '../api';
import { formatCFA, formatDate, formatPhone } from '../utils';
import { StatusBadge } from './Dashboard';

interface DeliveryDetail {
  id: string;
  reference: string;
  status: string;
  packageType: string;
  packageDescription: string | null;
  packagePhotoPickupUrl: string | null;
  packagePhotoDeliveryUrl: string | null;
  recipientName: string;
  recipientPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  price: number;
  driverCommission: number | null;
  platformFee: number | null;
  tip: number;
  validationCode: string;
  createdAt: string;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelComment: string | null;
  sender: { id: string; fullName: string; phone: string } | null;
  driver: { id: string; fullName: string; phone: string } | null;
}

export default function DeliveryDetail() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/deliveries/${id}`);
      setD(unwrap<DeliveryDetail>(res));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  if (loading || !d) return <div className="muted">Chargement...</div>;

  const canCancel = !['delivered', 'cancelled', 'expired'].includes(d.status);

  const forceCancel = async () => {
    const note = window.prompt('Raison de l\'annulation forcee (optionnel) :') ?? '';
    if (!window.confirm('Confirmer l\'annulation ?')) return;
    setBusy(true);
    try {
      await api.post(`/admin/deliveries/${id}/force-cancel`, { note });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/deliveries" className="muted">← Retour</Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{d.reference}</h1>
        </div>
        <div className="row">
          <StatusBadge status={d.status} />
          {canCancel ? (
            <button className="btn btn-danger" onClick={forceCancel} disabled={busy}>
              Annuler de force
            </button>
          ) : null}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Type colis</div>
          <div className="value" style={{ fontSize: 16 }}>{d.packageType}</div>
          {d.packageDescription ? <div className="hint">{d.packageDescription}</div> : null}
        </div>
        <div className="stat-card">
          <div className="label">Prix</div>
          <div className="value" style={{ fontSize: 20 }}>{formatCFA(d.price)}</div>
          <div className="hint">
            Commission {formatCFA(d.platformFee)} · Gain livreur {formatCFA(d.driverCommission ?? 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Code de validation</div>
          <div className="value">{d.validationCode}</div>
        </div>
        <div className="stat-card">
          <div className="label">Destinataire</div>
          <div className="value" style={{ fontSize: 16 }}>{d.recipientName}</div>
          <div className="hint">{formatPhone(d.recipientPhone)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Itineraire</h2></div>
        <div style={{ padding: 18 }}>
          <div style={{ marginBottom: 10 }}>
            <span className="muted">Recuperation</span>
            <div>{d.pickupAddress}</div>
          </div>
          <div>
            <span className="muted">Livraison</span>
            <div>{d.deliveryAddress}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Parties</h2></div>
        <div style={{ padding: 18 }}>
          <div className="row-space" style={{ marginBottom: 8 }}>
            <div>
              <span className="muted">Client</span>
              <div>
                {d.sender ? (
                  <>
                    <Link to={`/users/${d.sender.id}`}>{d.sender.fullName}</Link>
                    <span className="muted"> · {formatPhone(d.sender.phone)}</span>
                  </>
                ) : '-'}
              </div>
            </div>
            <div>
              <span className="muted">Livreur</span>
              <div>
                {d.driver ? (
                  <>
                    <Link to={`/users/${d.driver.id}`}>{d.driver.fullName}</Link>
                    <span className="muted"> · {formatPhone(d.driver.phone)}</span>
                  </>
                ) : <span className="muted">Non assigne</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {d.packagePhotoPickupUrl || d.packagePhotoDeliveryUrl ? (
        <div className="card">
          <div className="card-header"><h2>Preuves photo</h2></div>
          <div style={{ padding: 18 }} className="photos-row">
            {d.packagePhotoPickupUrl ? (
              <div>
                <div className="muted">Recuperation</div>
                <img className="photo-thumb" src={resolveUploadUrl(d.packagePhotoPickupUrl)!} alt="Recuperation" />
              </div>
            ) : null}
            {d.packagePhotoDeliveryUrl ? (
              <div>
                <div className="muted">Livraison</div>
                <img className="photo-thumb" src={resolveUploadUrl(d.packagePhotoDeliveryUrl)!} alt="Livraison" />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header"><h2>Chronologie</h2></div>
        <table>
          <tbody>
            <tr><td>Creee</td><td>{formatDate(d.createdAt)}</td></tr>
            {d.acceptedAt ? <tr><td>Acceptee</td><td>{formatDate(d.acceptedAt)}</td></tr> : null}
            {d.pickedUpAt ? <tr><td>Colis recupere</td><td>{formatDate(d.pickedUpAt)}</td></tr> : null}
            {d.deliveredAt ? <tr><td>Livree</td><td>{formatDate(d.deliveredAt)}</td></tr> : null}
            {d.cancelledAt ? (
              <tr>
                <td>Annulee</td>
                <td>
                  {formatDate(d.cancelledAt)}
                  {d.cancelReason ? <span className="muted"> · {d.cancelReason}</span> : null}
                  {d.cancelComment ? <div className="muted">{d.cancelComment}</div> : null}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
