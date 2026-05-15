import { useEffect, useState } from 'react';
import { api, unwrap } from '../api';
import { useDialog } from '../components/DialogProvider';
import { Tabs, type TabDef } from '../components/Tabs';

type PromoTabId = 'active' | 'inactive' | 'all';

interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  currentUses: number;
  maxUsesPerUser: number | null;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  _count?: { usages: number };
}

interface FormState {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  minOrderAmount: string;
  maxUses: string;
  maxUsesPerUser: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  description: string;
}

const emptyForm: FormState = {
  code: '',
  discountType: 'percentage',
  discountValue: '',
  minOrderAmount: '',
  maxUses: '',
  maxUsesPerUser: '',
  validFrom: '',
  validTo: '',
  isActive: true,
  description: '',
};

export default function PromoCodes() {
  const dialog = useDialog();
  const [list, setList] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PromoTabId>('active');
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/promo-codes');
      setList(unwrap<PromoCode[]>(res));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (promo: PromoCode) => {
    setEditing(promo);
    setForm({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: String(promo.discountValue),
      minOrderAmount: promo.minOrderAmount?.toString() ?? '',
      maxUses: promo.maxUses?.toString() ?? '',
      maxUsesPerUser: promo.maxUsesPerUser?.toString() ?? '',
      validFrom: promo.validFrom.slice(0, 16),
      validTo: promo.validTo ? promo.validTo.slice(0, 16) : '',
      isActive: promo.isActive,
      description: promo.description ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || form.code.trim().length < 3) {
      await dialog.alert({
        title: 'Code invalide',
        message: 'Le code doit faire au moins 3 caractères.',
        type: 'error',
      });
      return;
    }
    const value = parseInt(form.discountValue, 10);
    if (!value || value < 1) {
      await dialog.alert({
        title: 'Valeur invalide',
        message: 'La valeur de la remise doit être un entier positif.',
        type: 'error',
      });
      return;
    }
    if (form.discountType === 'percentage' && value > 100) {
      await dialog.alert({
        title: 'Pourcentage invalide',
        message: 'Le pourcentage doit être entre 1 et 100.',
        type: 'error',
      });
      return;
    }

    const payload: any = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: value,
      isActive: form.isActive,
    };
    if (form.minOrderAmount) payload.minOrderAmount = parseInt(form.minOrderAmount, 10);
    if (form.maxUses) payload.maxUses = parseInt(form.maxUses, 10);
    if (form.maxUsesPerUser)
      payload.maxUsesPerUser = parseInt(form.maxUsesPerUser, 10);
    if (form.validFrom) payload.validFrom = new Date(form.validFrom).toISOString();
    if (form.validTo) payload.validTo = new Date(form.validTo).toISOString();
    if (form.description.trim()) payload.description = form.description.trim();

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/promo-codes/${editing.id}`, payload);
        setToast(`Code ${payload.code} mis à jour`);
      } else {
        await api.post('/admin/promo-codes', payload);
        setToast(`Code ${payload.code} créé`);
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      await dialog.alert({
        title: 'Échec',
        message:
          err?.response?.data?.error?.message ??
          "Impossible d'enregistrer le code promo.",
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promo: PromoCode) => {
    const confirmed = await dialog.confirm({
      title: 'Supprimer ce code ?',
      message: `Le code ${promo.code} sera définitivement supprimé. Cette action ne peut pas être annulée.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/promo-codes/${promo.id}`);
      setToast(`Code ${promo.code} supprimé`);
      await load();
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      await dialog.alert({
        title: 'Échec',
        message:
          err?.response?.data?.error?.message ??
          'Impossible de supprimer le code.',
        type: 'error',
      });
    }
  };

  const handleToggleActive = async (promo: PromoCode) => {
    try {
      await api.put(`/admin/promo-codes/${promo.id}`, {
        isActive: !promo.isActive,
      });
      await load();
    } catch (err: any) {
      await dialog.alert({
        title: 'Échec',
        message: err?.response?.data?.error?.message ?? 'Impossible.',
        type: 'error',
      });
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">Codes promo</h1>
          <p className="page-subtitle">
            Créez des codes de réduction à diffuser à vos clients
          </p>
        </div>
        <button className="btn" onClick={openCreate}>
          + Nouveau code
        </button>
      </div>

      {toast ? (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--success-bg)',
            color: 'var(--primary-700)',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ✓ {toast}
        </div>
      ) : null}

      {/* Tabs filter */}
      {(() => {
        const activeCount = list.filter(
          (p) =>
            p.isActive &&
            (!p.validTo || new Date(p.validTo) >= new Date()) &&
            (p.maxUses == null || p.currentUses < p.maxUses),
        ).length;
        const inactiveCount = list.length - activeCount;
        const TABS: ReadonlyArray<TabDef<PromoTabId>> = [
          { id: 'active', label: 'Actifs', icon: '✅', badge: activeCount },
          {
            id: 'inactive',
            label: 'Inactifs / expirés',
            icon: '⏸️',
            badge: inactiveCount,
          },
          { id: 'all', label: 'Tous', icon: '📋', badge: list.length },
        ];
        return <Tabs tabs={TABS} value={tab} onChange={setTab} />;
      })()}

      {(() => {
        const now = new Date();
        const filtered = list.filter((p) => {
          const expired = p.validTo && new Date(p.validTo) < now;
          const quotaReached =
            p.maxUses != null && p.currentUses >= p.maxUses;
          const isActiveNow = p.isActive && !expired && !quotaReached;
          if (tab === 'active') return isActiveNow;
          if (tab === 'inactive') return !isActiveNow;
          return true;
        });
        if (loading) {
          return (
            <div className="loading-wrap">
              <div className="spinner"></div>
              Chargement...
            </div>
          );
        }
        if (filtered.length === 0) {
          return (
            <div className="empty">
              {tab === 'active'
                ? "Aucun code promo actif. Cliquez sur 'Nouveau code' pour en créer un."
                : tab === 'inactive'
                  ? "Aucun code inactif ou expiré."
                  : "Aucun code promo pour le moment."}
            </div>
          );
        }
        return (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Remise</th>
                <th>Min commande</th>
                <th>Utilisations</th>
                <th>Validité</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isExpired = p.validTo && new Date(p.validTo) < new Date();
                const isQuotaReached =
                  p.maxUses != null && p.currentUses >= p.maxUses;
                return (
                  <tr key={p.id}>
                    <td>
                      <code
                        style={{
                          background: 'var(--bg-alt)',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                        }}
                      >
                        {p.code}
                      </code>
                      {p.description ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            marginTop: 2,
                          }}
                        >
                          {p.description}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {p.discountType === 'percentage'
                        ? `-${p.discountValue}%`
                        : `-${p.discountValue.toLocaleString('fr-FR')} FCFA`}
                    </td>
                    <td>
                      {p.minOrderAmount
                        ? `${p.minOrderAmount.toLocaleString('fr-FR')} FCFA`
                        : '—'}
                    </td>
                    <td>
                      {p.currentUses}
                      {p.maxUses ? ` / ${p.maxUses}` : ''}
                      {p.maxUsesPerUser
                        ? ` (max ${p.maxUsesPerUser}/user)`
                        : ''}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {new Date(p.validFrom).toLocaleDateString('fr-FR')}
                      {p.validTo
                        ? ` → ${new Date(p.validTo).toLocaleDateString('fr-FR')}`
                        : ' → ∞'}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: !p.isActive
                            ? 'var(--bg-alt)'
                            : isExpired || isQuotaReached
                              ? 'var(--warning-bg)'
                              : 'var(--success-bg)',
                          color: !p.isActive
                            ? 'var(--text-tertiary)'
                            : isExpired || isQuotaReached
                              ? '#92400e'
                              : 'var(--primary-700)',
                        }}
                      >
                        {!p.isActive
                          ? 'Désactivé'
                          : isExpired
                            ? 'Expiré'
                            : isQuotaReached
                              ? 'Épuisé'
                              : 'Actif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-ghost"
                        onClick={() => handleToggleActive(p)}
                        style={{ marginRight: 6, fontSize: 12 }}
                      >
                        {p.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => openEdit(p)}
                        style={{ marginRight: 6, fontSize: 12 }}
                      >
                        Éditer
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => handleDelete(p)}
                        style={{ color: 'var(--danger)', fontSize: 12 }}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        );
      })()}

      {showForm && (
        <PromoForm
          form={form}
          setForm={setForm}
          editing={!!editing}
          saving={saving}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
            setForm(emptyForm);
          }}
        />
      )}
    </>
  );
}

function PromoForm({
  form,
  setForm,
  editing,
  saving,
  onSubmit,
  onClose,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  editing: boolean;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header">
          <h2>{editing ? 'Modifier le code promo' : 'Nouveau code promo'}</h2>
        </div>
        <div className="card-body">
          <div className="form">
            <label>
              Code (ex: BIENVENUE)
              <input
                type="text"
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                maxLength={30}
                disabled={editing}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Type de remise
                <select
                  value={form.discountType}
                  onChange={(e) =>
                    set('discountType', e.target.value as 'percentage' | 'fixed')
                  }
                >
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (FCFA)</option>
                </select>
              </label>
              <label>
                Valeur ({form.discountType === 'percentage' ? '%' : 'FCFA'})
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => set('discountValue', e.target.value)}
                  min={1}
                  max={form.discountType === 'percentage' ? 100 : 1000000}
                />
              </label>
            </div>

            <label>
              Montant minimum de commande (FCFA, optionnel)
              <input
                type="number"
                value={form.minOrderAmount}
                onChange={(e) => set('minOrderAmount', e.target.value)}
                min={0}
                placeholder="Ex: 2000"
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Utilisations max total (optionnel)
                <input
                  type="number"
                  value={form.maxUses}
                  onChange={(e) => set('maxUses', e.target.value)}
                  min={1}
                  placeholder="Illimité"
                />
              </label>
              <label>
                Utilisations max par user (optionnel)
                <input
                  type="number"
                  value={form.maxUsesPerUser}
                  onChange={(e) => set('maxUsesPerUser', e.target.value)}
                  min={1}
                  placeholder="Illimité"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Valide à partir du
                <input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => set('validFrom', e.target.value)}
                />
              </label>
              <label>
                Valide jusqu'au (optionnel)
                <input
                  type="datetime-local"
                  value={form.validTo}
                  onChange={(e) => set('validTo', e.target.value)}
                />
              </label>
            </div>

            <label>
              Description interne (optionnel)
              <input
                type="text"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Ex: Campagne lancement Ouaga"
                maxLength={500}
              />
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexDirection: 'row',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              Code actif (les clients peuvent l'utiliser)
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={onClose} disabled={saving}>
              Annuler
            </button>
            <button className="btn" onClick={onSubmit} disabled={saving}>
              {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
