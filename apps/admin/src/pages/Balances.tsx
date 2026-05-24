import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrap } from '../api';
import { formatCFA } from '../utils';
import { useDialog } from '../components/DialogProvider';

/**
 * Page "Soldes livreurs" — vue comptable simplifiee.
 *
 * Affiche un tableau de tous les livreurs actifs avec :
 *   - leur solde wallet (positif = plateforme leur doit, negatif = ils doivent)
 *   - colonne "A collecter" (cash) et "A reverser" (online)
 *   - bouton d'action pour enregistrer un reglement
 *
 * L'historique chronologique de toutes les operations reste dans
 * /transactions ; cette page-ci est l'ecran operationnel principal.
 */

interface DriverBalance {
  userId: string;
  fullName: string;
  phone: string;
  avatarUrl?: string | null;
  walletBalance: number;
  cashDebt: number;
  availableForPayout: number;
  totalDeliveries: number;
  ratingAvg: number;
  ratingCount: number;
}

interface BalancesResponse {
  items: DriverBalance[];
  summary: {
    totalToCollect: number;
    totalToPay: number;
    debtorCount: number;
    creditorCount: number;
  };
}

type Filter = 'all' | 'debtors' | 'creditors';

export default function Balances() {
  const dialog = useDialog();
  const [data, setData] = useState<BalancesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [settleFor, setSettleFor] = useState<DriverBalance | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/admin/driver-balances', {
        params: {
          filter: filter !== 'all' ? filter : undefined,
          search: search || undefined,
        },
      });
      setData(unwrap<BalancesResponse>(res));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line
  }, [filter]);

  // Search local (debounce simple)
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search]);

  const items = data?.items ?? [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Soldes livreurs</h1>
          <p className="muted">
            Ce que la plateforme doit aux livreurs (gains online à verser) et ce que les livreurs doivent à la plateforme (commissions cash — reversées par le livreur via l'app, à valider dans Transactions).
          </p>
        </div>
      </header>

      {/* Cartes resume */}
      {data && (
        <div className="balance-summary">
          <SummaryCard
            label="À COLLECTER"
            sublabel={`${data.summary.debtorCount} livreur(s) en dette`}
            amount={data.summary.totalToCollect}
            tone="red"
          />
          <SummaryCard
            label="À REVERSER"
            sublabel={`${data.summary.creditorCount} livreur(s) avec solde`}
            amount={data.summary.totalToPay}
            tone="green"
          />
          <SummaryCard
            label="NET PLATEFORME"
            sublabel="Collecter − Reverser"
            amount={data.summary.totalToCollect - data.summary.totalToPay}
            tone="neutral"
          />
        </div>
      )}

      {/* Filtres */}
      <div className="row" style={{ gap: 12, margin: '24px 0 16px', flexWrap: 'wrap' }}>
        <div className="tabs" style={{ flex: 'none' }}>
          {(
            [
              ['all', 'Tous', items.length],
              ['debtors', 'En dette', data?.summary.debtorCount ?? 0],
              ['creditors', 'À reverser', data?.summary.creditorCount ?? 0],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              className={`tab ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key as Filter)}
            >
              {label} <span className="muted">({count})</span>
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Recherche par nom ou téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240 }}
        />
      </div>

      {/* Tableau */}
      {loading && !data ? (
        <div className="muted">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p className="muted">Aucun livreur ne correspond.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>LIVREUR</th>
                <th style={{ textAlign: 'right' }}>SOLDE NET</th>
                <th style={{ textAlign: 'right' }}>À COLLECTER</th>
                <th style={{ textAlign: 'right' }}>À REVERSER</th>
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.userId}>
                  <td>
                    <Link to={`/users/${d.userId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontWeight: 600 }}>{d.fullName}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{d.phone}</div>
                    </Link>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          d.walletBalance < 0
                            ? '#dc2626'
                            : d.walletBalance > 0
                              ? '#15803d'
                              : '#78716c',
                      }}
                    >
                      {d.walletBalance > 0 ? '+' : ''}
                      {formatCFA(d.walletBalance)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {d.cashDebt > 0 ? (
                      <span className="amount-debit">{formatCFA(d.cashDebt)}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {d.availableForPayout > 0 ? (
                      <span className="amount-credit">{formatCFA(d.availableForPayout)}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {d.availableForPayout > 0 ? (
                      <button className="btn btn-sm btn-success" onClick={() => setSettleFor(d)}>
                        Verser
                      </button>
                    ) : d.cashDebt > 0 ? (
                      <span className="muted" title="Le livreur reversera sa commission via l'app">
                        En attente
                      </span>
                    ) : (
                      <span className="muted">À jour</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {settleFor && (
        <SettleModal
          driver={settleFor}
          onClose={() => setSettleFor(null)}
          onDone={async () => {
            setSettleFor(null);
            await load();
            await dialog.alert({
              title: 'Règlement enregistré',
              message: 'Le solde du livreur a été mis à jour.',
              type: 'success',
            });
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  sublabel,
  amount,
  tone,
}: {
  label: string;
  sublabel: string;
  amount: number;
  tone: 'red' | 'green' | 'neutral';
}) {
  const color =
    tone === 'red' ? '#dc2626' : tone === 'green' ? '#15803d' : '#1c1917';
  return (
    <div className="balance-card">
      <div className="balance-card-label">{label}</div>
      <div className="balance-card-amount" style={{ color }}>
        {formatCFA(Math.abs(amount))}
      </div>
      <div className="balance-card-sub">{sublabel}</div>
    </div>
  );
}

function SettleModal({
  driver,
  onClose,
  onDone,
}: {
  driver: DriverBalance;
  onClose: () => void;
  onDone: () => void;
}) {
  const kind: 'collect' | 'payout' =
    driver.cashDebt > 0 ? 'collect' : 'payout';
  const maxAmount = kind === 'collect' ? driver.cashDebt : driver.availableForPayout;

  const [amount, setAmount] = useState(maxAmount);
  const [paymentMethod, setPaymentMethod] =
    useState<'cash' | 'orange_money' | 'moov_money' | 'wallet'>('orange_money');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/admin/driver-balances/${driver.userId}/settle`, {
        kind,
        amount: Number(amount),
        paymentMethod,
        reference: reference || undefined,
        note: note || undefined,
      });
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? 'Erreur lors du règlement');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h2 className="modal-title">
          {kind === 'collect' ? 'Encaisser la dette' : 'Verser le solde'}
        </h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          {kind === 'collect'
            ? `${driver.fullName} doit ${formatCFA(maxAmount)} à la plateforme (commission sur paiements cash).`
            : `La plateforme doit ${formatCFA(maxAmount)} à ${driver.fullName} (gains online).`}
        </p>

        <label className="field">
          <span>Montant (max {formatCFA(maxAmount)})</span>
          <input
            type="number"
            className="input"
            value={amount}
            min={1}
            max={maxAmount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span>Mode {kind === 'collect' ? 'd\'encaissement' : 'de versement'}</span>
          <select
            className="input"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
          >
            <option value="orange_money">Orange Money</option>
            <option value="moov_money">Moov Money</option>
            <option value="cash">Cash</option>
            <option value="wallet">Wallet (interne)</option>
          </select>
        </label>

        <label className="field">
          <span>Référence (optionnel)</span>
          <input
            type="text"
            className="input"
            placeholder="N° de transaction, reçu, etc."
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Note (optionnel)</span>
          <textarea
            className="input"
            rows={2}
            placeholder="Ex: virement reçu le 23/05 à 14h"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {err && <div className="error-banner">{err}</div>}

        <div className="row" style={{ gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            className={kind === 'collect' ? 'btn' : 'btn btn-success'}
            onClick={submit}
            disabled={busy || !amount || amount > maxAmount}
          >
            {busy ? 'Enregistrement…' : kind === 'collect' ? 'Encaisser' : 'Verser'}
          </button>
        </div>
      </div>
    </div>
  );
}
