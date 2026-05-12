import { useEffect, useState } from 'react';
import { api, unwrap } from '../api';
import { formatCFA, formatDate } from '../utils';
import { useDialog } from '../components/DialogProvider';

interface Transaction {
  id: string;
  userId: string;
  deliveryId: string | null;
  type: string;
  amount: number;
  paymentMethod: string;
  phoneNumber: string | null;
  note: string | null;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  processedAt: string | null;
  user: {
    id: string;
    fullName: string;
    phone: string;
    userType: string;
  };
}

const TYPE_LABEL: Record<string, string> = {
  payment: 'Paiement',
  commission: 'Gain livraison',
  commission_debt: 'Commission plateforme',
  tip: 'Pourboire',
  topup: 'Règlement livreur',
  withdrawal: 'Retrait',
  withdrawal_fee: 'Frais retrait',
  adjustment: 'Ajustement',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  wallet: 'Wallet',
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
};

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('226') ? digits.slice(3) : digits;
  if (local.length !== 8) return phone;
  return `+226 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`;
}

export default function Transactions() {
  const dialog = useDialog();
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/admin/transactions', { params });
      const data = unwrap<{ items: Transaction[] }>(res);
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  const showError = async (err: any) =>
    dialog.alert({
      title: 'Échec',
      message: err?.response?.data?.error?.message ?? 'Une erreur est survenue.',
      type: 'error',
    });

  const markPaid = async (id: string) => {
    const ok = await dialog.confirm({
      title: 'Marquer ce retrait comme payé ?',
      message: 'Confirmer que le paiement Mobile Money a bien été envoyé au livreur.',
      confirmLabel: 'Marquer payé',
    });
    if (!ok) return;
    setBusy(id);
    try {
      await api.post(`/admin/transactions/${id}/mark-paid`, {
        note: noteById[id] ?? '',
      });
      await load();
    } catch (err: any) {
      await showError(err);
    } finally {
      setBusy(null);
    }
  };

  const rejectWithdraw = async (id: string) => {
    const note = await dialog.prompt({
      title: 'Rejeter cette demande',
      message:
        'Le solde sera remboursé au livreur. Indiquez le motif (optionnel).',
      placeholder: 'Ex : compte non vérifié',
      multiline: true,
    });
    if (note === null) return;
    setBusy(id);
    try {
      await api.post(`/admin/transactions/${id}/reject`, { note });
      await load();
    } catch (err: any) {
      await showError(err);
    } finally {
      setBusy(null);
    }
  };

  const confirmTopup = async (id: string) => {
    const ok = await dialog.confirm({
      title: 'Confirmer la réception ?',
      message:
        'Vous confirmez avoir reçu le paiement du livreur. La dette commission sera régularisée.',
      confirmLabel: 'Confirmer',
    });
    if (!ok) return;
    setBusy(id);
    try {
      await api.post(`/admin/transactions/${id}/confirm-topup`, {
        note: noteById[id] ?? '',
      });
      await load();
    } catch (err: any) {
      await showError(err);
    } finally {
      setBusy(null);
    }
  };

  const rejectTopup = async (id: string) => {
    const note = await dialog.prompt({
      title: 'Rejeter ce paiement',
      message: 'Indiquez le motif du rejet (optionnel).',
      placeholder: 'Ex : montant ne correspond pas',
      multiline: true,
    });
    if (note === null) return;
    setBusy(id);
    try {
      await api.post(`/admin/transactions/${id}/reject-topup`, { note });
      await load();
    } catch (err: any) {
      await showError(err);
    } finally {
      setBusy(null);
    }
  };

  const pendingCount = items.filter((t) => t.status === 'pending').length;

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">
            {items.length} transactions
            {pendingCount > 0
              ? ` · ${pendingCount} en attente de traitement`
              : ''}
          </p>
        </div>
      </div>

      <div className="searchbar">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Tous les types</option>
          <option value="withdrawal">Retraits</option>
          <option value="topup">Règlements (topup)</option>
          <option value="commission">Commissions livreur</option>
          <option value="commission_debt">Dettes plateforme</option>
          <option value="adjustment">Ajustements</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous statuts</option>
          <option value="pending">En attente</option>
          <option value="completed">Complétées</option>
          <option value="failed">Échouées</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-wrap">
            <div className="spinner"></div>
            Chargement...
          </div>
        ) : items.length === 0 ? (
          <div className="empty">Aucune transaction.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th>Mode</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const canActWithdraw =
                  t.type === 'withdrawal' && t.status === 'pending';
                const canActTopup = t.type === 'topup' && t.status === 'pending';
                return (
                  <tr key={t.id}>
                    <td className="muted nowrap">{formatDate(t.createdAt)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.user.fullName}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {t.user.phone}
                      </div>
                    </td>
                    <td>{TYPE_LABEL[t.type] ?? t.type}</td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color:
                          t.amount < 0
                            ? 'var(--error)'
                            : 'var(--primary)',
                      }}
                    >
                      {t.amount > 0 ? '+' : ''}
                      {formatCFA(t.amount)}
                    </td>
                    <td>{METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod}</td>
                    <td className="nowrap">{formatPhone(t.phoneNumber)}</td>
                    <td>
                      <span
                        className={`badge ${
                          t.status === 'completed'
                            ? 'badge-delivered'
                            : t.status === 'failed'
                              ? 'badge-cancelled'
                              : 'badge-pending'
                        }`}
                      >
                        {t.status === 'completed'
                          ? 'Complétée'
                          : t.status === 'failed'
                            ? 'Échouée'
                            : 'En attente'}
                      </span>
                    </td>
                    <td>
                      {canActWithdraw ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => markPaid(t.id)}
                            disabled={busy === t.id}
                          >
                            Marquer payé
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => rejectWithdraw(t.id)}
                            disabled={busy === t.id}
                          >
                            Rejeter
                          </button>
                        </div>
                      ) : canActTopup ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => confirmTopup(t.id)}
                            disabled={busy === t.id}
                          >
                            Confirmer reçu
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => rejectTopup(t.id)}
                            disabled={busy === t.id}
                          >
                            Rejeter
                          </button>
                        </div>
                      ) : t.note ? (
                        <span
                          className="muted"
                          style={{ fontSize: 11 }}
                          title={t.note}
                        >
                          {t.note.length > 30
                            ? t.note.slice(0, 30) + '…'
                            : t.note}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
