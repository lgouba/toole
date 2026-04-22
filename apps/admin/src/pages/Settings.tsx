import { useEffect, useState } from 'react';
import { api, unwrap } from '../api';

interface AppSettings {
  appName: string;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  currencyLocale: string;
  basePriceEnvelope: number;
  basePriceSmall: number;
  basePriceLarge: number;
  pricePerKm: number;
  platformCommissionPct: number;
  confettiEnabled: boolean;
  driverSoundEnabled: boolean;
  driverVibrationEnabled: boolean;
  nightSurchargePct: number;
  rainSurchargePct: number;
  updatedAt: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/admin/settings')
      .then((res) => setSettings(unwrap<AppSettings>(res)))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      // On retire les champs read-only de la requete
      const { updatedAt: _u, ...payload } = settings;
      const res = await api.put('/admin/settings', payload);
      setSettings(unwrap<AppSettings>(res));
      setToast('Parametres enregistres');
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Echec');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-wrap">
        <div className="spinner"></div>
        Chargement...
      </div>
    );
  }
  if (!settings) {
    return <div className="empty">Impossible de charger les parametres.</div>;
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">Parametres</h1>
          <p className="page-subtitle">
            Configuration globale de l'application — derniere modif{' '}
            {new Date(settings.updatedAt).toLocaleString('fr-FR')}
          </p>
        </div>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
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

      <div className="grid-2">
        {/* Branding */}
        <div className="card">
          <div className="card-header">
            <h2>Branding</h2>
          </div>
          <div className="card-body">
            <div className="form">
              <label>
                Nom de l'application
                <input
                  type="text"
                  value={settings.appName}
                  onChange={(e) => update('appName', e.target.value)}
                  maxLength={50}
                />
              </label>

              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ flex: 1 }}>
                  Couleur principale
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => update('primaryColor', e.target.value)}
                      style={{
                        width: 44,
                        height: 44,
                        padding: 0,
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        background: 'var(--surface)',
                      }}
                    />
                    <input
                      type="text"
                      value={settings.primaryColor}
                      onChange={(e) => update('primaryColor', e.target.value)}
                      pattern="^#[0-9a-fA-F]{6}$"
                      style={{ flex: 1 }}
                    />
                  </div>
                </label>

                <label style={{ flex: 1 }}>
                  Couleur secondaire
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => update('secondaryColor', e.target.value)}
                      style={{
                        width: 44,
                        height: 44,
                        padding: 0,
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        background: 'var(--surface)',
                      }}
                    />
                    <input
                      type="text"
                      value={settings.secondaryColor}
                      onChange={(e) => update('secondaryColor', e.target.value)}
                      pattern="^#[0-9a-fA-F]{6}$"
                      style={{ flex: 1 }}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Localisation */}
        <div className="card">
          <div className="card-header">
            <h2>Localisation</h2>
          </div>
          <div className="card-body">
            <div className="form">
              <label>
                Monnaie (symbole / code)
                <input
                  type="text"
                  value={settings.currency}
                  onChange={(e) => update('currency', e.target.value)}
                  placeholder="FCFA"
                  maxLength={10}
                />
              </label>
              <label>
                Format regional (pour nombres et dates)
                <select
                  value={settings.currencyLocale}
                  onChange={(e) => update('currencyLocale', e.target.value)}
                >
                  <option value="fr-BF">Burkina Faso (fr-BF)</option>
                  <option value="fr-CI">Cote d'Ivoire (fr-CI)</option>
                  <option value="fr-SN">Senegal (fr-SN)</option>
                  <option value="fr-ML">Mali (fr-ML)</option>
                  <option value="fr-NE">Niger (fr-NE)</option>
                  <option value="fr-TG">Togo (fr-TG)</option>
                  <option value="fr-BJ">Benin (fr-BJ)</option>
                  <option value="fr-FR">France (fr-FR)</option>
                  <option value="en-US">US (en-US)</option>
                </select>
              </label>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  margin: 0,
                }}
              >
                La monnaie sera affichee partout dans l'application client et
                livreur.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarification */}
      <div className="card">
        <div className="card-header">
          <h2>Tarification</h2>
        </div>
        <div className="card-body">
          <div className="form">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
              }}
            >
              <label>
                Prix de base — Enveloppe ({settings.currency})
                <input
                  type="number"
                  value={settings.basePriceEnvelope}
                  onChange={(e) =>
                    update('basePriceEnvelope', parseInt(e.target.value || '0', 10))
                  }
                  min={0}
                />
              </label>
              <label>
                Prix de base — Petit colis ({settings.currency})
                <input
                  type="number"
                  value={settings.basePriceSmall}
                  onChange={(e) =>
                    update('basePriceSmall', parseInt(e.target.value || '0', 10))
                  }
                  min={0}
                />
              </label>
              <label>
                Prix de base — Gros colis ({settings.currency})
                <input
                  type="number"
                  value={settings.basePriceLarge}
                  onChange={(e) =>
                    update('basePriceLarge', parseInt(e.target.value || '0', 10))
                  }
                  min={0}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Prix par kilometre ({settings.currency})
                <input
                  type="number"
                  value={settings.pricePerKm}
                  onChange={(e) =>
                    update('pricePerKm', parseInt(e.target.value || '0', 10))
                  }
                  min={0}
                />
              </label>
              <label>
                Commission plateforme (%)
                <input
                  type="number"
                  value={settings.platformCommissionPct}
                  onChange={(e) =>
                    update('platformCommissionPct', parseInt(e.target.value || '0', 10))
                  }
                  min={0}
                  max={100}
                />
              </label>
            </div>

            <div
              style={{
                marginTop: 8,
                padding: 12,
                background: 'var(--bg-alt)',
                borderRadius: 10,
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <strong>Formule :</strong> prix = prix_base + (distance_km × prix_km).
              Exemple : un petit colis sur 5 km ={' '}
              {settings.currency} {settings.basePriceSmall + 5 * settings.pricePerKm}.
              La commission retenue par la plateforme est de{' '}
              {settings.platformCommissionPct}% du prix.
            </div>
          </div>
        </div>
      </div>

      {/* Tarification dynamique — reservee */}
      <div className="card">
        <div className="card-header">
          <h2>
            Tarification dynamique{' '}
            <span
              className="badge badge-pending"
              style={{ marginLeft: 8, fontSize: 10 }}
            >
              Experimental
            </span>
          </h2>
        </div>
        <div className="card-body">
          <div className="form">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Majoration nuit (%)
                <input
                  type="number"
                  value={settings.nightSurchargePct}
                  onChange={(e) =>
                    update('nightSurchargePct', parseInt(e.target.value || '0', 10))
                  }
                  min={0}
                  max={500}
                />
              </label>
              <label>
                Majoration pluie (%)
                <input
                  type="number"
                  value={settings.rainSurchargePct}
                  onChange={(e) =>
                    update('rainSurchargePct', parseInt(e.target.value || '0', 10))
                  }
                  min={0}
                  max={500}
                />
              </label>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
              Ces majorations ne sont pas encore appliquees. Elles seront activees dans
              une prochaine version.
            </p>
          </div>
        </div>
      </div>

      {/* Toggles UX */}
      <div className="card">
        <div className="card-header">
          <h2>Experience utilisateur</h2>
        </div>
        <div className="card-body">
          <div className="form">
            <ToggleRow
              label="Confettis apres notation"
              hint="Anime des confettis quand le client note 4 ou 5 etoiles"
              checked={settings.confettiEnabled}
              onChange={(v) => update('confettiEnabled', v)}
            />
            <ToggleRow
              label="Son de notification livreur"
              hint="Le livreur entend un 'ding' quand une course tombe"
              checked={settings.driverSoundEnabled}
              onChange={(v) => update('driverSoundEnabled', v)}
            />
            <ToggleRow
              label="Vibration forte livreur"
              hint="Vibration repetee quand une course tombe (meme telephone en poche)"
              checked={settings.driverVibrationEnabled}
              onChange={(v) => update('driverVibrationEnabled', v)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
          {label}
        </div>
        {hint ? (
          <div
            style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}
          >
            {hint}
          </div>
        ) : null}
      </div>
      <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 24,
            background: checked ? 'var(--primary)' : 'var(--border-strong)',
            transition: 'background 0.2s',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: checked ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: 10,
              background: 'white',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          ></span>
        </span>
      </label>
    </div>
  );
}
