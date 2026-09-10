import { useEffect, useMemo, useRef, useState } from 'react';
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
  cashCollected: number;
  cashDeliveries: number;
  totalDeliveries: number;
  ratingAvg: number;
  ratingCount: number;
}

interface BalancesResponse {
  items: DriverBalance[];
  summary: {
    totalToCollect: number;
    totalToPay: number;
    totalCashCollected: number;
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
            label="ENCAISSÉ (CASH)"
            sublabel="Total collecté auprès des destinataires"
            amount={data.summary.totalCashCollected}
            tone="neutral"
          />
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
        <div className="search-field">
          <svg
            className="search-field-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="search-field-input"
            placeholder="Rechercher un livreur par nom ou téléphone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="search-field-clear"
              onClick={() => setSearch('')}
              aria-label="Effacer la recherche"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
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
                <th style={{ textAlign: 'right' }}>ENCAISSÉ (CASH)</th>
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
                    <div style={{ fontWeight: 600 }}>{formatCFA(d.cashCollected)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {d.cashDeliveries} course(s) cash
                    </div>
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

  const amountRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  // Formatage d'AFFICHAGE uniquement (séparateur de milliers). L'état `amount`
  // reste un nombre brut -> le payload envoyé au backend est IDENTIQUE à avant.
  const fmt = (n: number) =>
    n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
  const parse = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;

  const over = amount > maxAmount;
  const reste = Math.max(0, maxAmount - amount);
  const verb = kind === 'collect' ? 'Encaisser' : 'Verser';
  const initials = driver.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  // A11y : focus sur Montant à l'ouverture, Échap ferme, piège de focus dans la
  // modale, focus rendu au déclencheur à la fermeture.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // focus sans sélectionner le texte (pas de surbrillance sur le montant).
    amountRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const nodes = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const titleId = 'settle-title';

  return (
    <div
      className="settle-console sc-overlay"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="sc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="sc-header">
          <div className="sc-eyebrow">
            <span className="sc-dot" /> OPÉRATION MANUELLE
          </div>
          <button
            className="sc-close"
            aria-label="Fermer"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
          <h2 className="sc-title" id={titleId}>
            {kind === 'collect' ? 'Encaisser la dette' : 'Verser le solde'}
          </h2>
        </div>

        {/* Corps */}
        <div className="sc-body">
          {/* Bloc bénéficiaire */}
          <div className="sc-benef">
            <div className="sc-benef-left">
              <div className="sc-avatar">{initials}</div>
              <div>
                <div className="sc-benef-name">{driver.fullName}</div>
                <div className="sc-benef-origin">
                  {kind === 'collect' ? 'commission cash' : 'gains online'}
                </div>
              </div>
            </div>
            <div className="sc-benef-right">
              <div className="sc-label">
                {kind === 'collect' ? 'DÛ À LA PLATEFORME' : 'DÛ PAR LA PLATEFORME'}
              </div>
              <div className="sc-benef-amount">{fmt(maxAmount)} FCFA</div>
            </div>
          </div>

          {/* Montant — champ dominant */}
          <div className="sc-block">
            <div className="sc-amount-head">
              <span className="sc-label">Montant</span>
              <button
                type="button"
                className="sc-all"
                onClick={() => setAmount(maxAmount)}
              >
                TOUT
              </button>
            </div>
            <div className={`sc-amount-field${over ? ' sc-amount-field--err' : ''}`}>
              <input
                ref={amountRef}
                type="text"
                inputMode="numeric"
                className="sc-amount-input"
                aria-label="Montant"
                aria-invalid={over}
                value={amount ? fmt(amount) : ''}
                onChange={(e) => setAmount(parse(e.target.value))}
              />
              <span className="sc-amount-suffix">FCFA</span>
            </div>
            <div className="sc-amount-foot">
              <span className="sc-amount-max">max {fmt(maxAmount)} FCFA</span>
              <span
                className={`sc-reste${reste === 0 ? ' sc-reste--ok' : ' sc-reste--warn'}`}
                aria-live="polite"
              >
                reste {fmt(reste)} FCFA
              </span>
            </div>
            {over && (
              <div className="sc-field-err">Le montant dépasse le maximum.</div>
            )}
          </div>

          {/* Mode de versement */}
          <div className="sc-block">
            <label className="sc-label" htmlFor="sc-mode">
              Mode {kind === 'collect' ? "d'encaissement" : 'de versement'}
            </label>
            <div className="sc-select-wrap">
              <select
                id="sc-mode"
                className="sc-input sc-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
              >
                <option value="orange_money">Orange Money</option>
                <option value="moov_money">Moov Money</option>
                <option value="cash">Cash</option>
                <option value="wallet">Wallet (interne)</option>
              </select>
              <svg
                className="sc-chevron"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Référence */}
          <div className="sc-block">
            <label className="sc-label" htmlFor="sc-ref">
              Référence <span className="sc-opt">(optionnel)</span>
            </label>
            <input
              id="sc-ref"
              className="sc-input"
              placeholder="N° de transaction, reçu, etc."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="sc-block">
            <label className="sc-label" htmlFor="sc-note">
              Note <span className="sc-opt">(optionnel)</span>
            </label>
            <textarea
              id="sc-note"
              className="sc-input sc-textarea"
              placeholder="Ex: virement reçu le 23/05 à 14h"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {err && <div className="sc-alert">{err}</div>}
        </div>

        {/* Pied */}
        <div className="sc-footer">
          <button className="sc-btn-ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            className="sc-btn-primary"
            onClick={submit}
            disabled={busy || !amount || over}
          >
            {busy ? (
              <>
                <span className="sc-spinner" /> Versement…
              </>
            ) : (
              `${verb} ${fmt(amount || 0)} FCFA`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
