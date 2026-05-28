import { useEffect, useState } from 'react';
import { api, unwrap } from '../api';
import { useDialog } from '../components/DialogProvider';

interface AppSettings {
  appName: string;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  currencyLocale: string;
  basePriceEnvelope: number;
  basePriceSmall: number;
  basePriceMedium: number;
  basePriceLarge: number;
  pricePerKm: number;
  platformCommissionPct: number;
  confettiEnabled: boolean;
  driverSoundEnabled: boolean;
  driverVibrationEnabled: boolean;
  nightSurchargeEnabled: boolean;
  nightSurchargeStartHour: number;
  nightSurchargeEndHour: number;
  nightSurchargeAmount: number;
  rainSurchargePct: number;
  deliveryExpiryMinutes: number;
  driverCancelCooldownSeconds: number;
  nearbyRadiusKm: number;
  chainingMaxRemainingMinutes: number;
  driverHeartbeatMaxAgeSeconds: number;
  minWithdrawAmount: number;
  commissionDebtLimit: number;
  scheduledMinDelayMinutes: number;
  minSupportedAppVersion: string;
  forceUpdateMessage: string | null;
  updatedAt: string;
}

type TabId = 'brand' | 'pricing' | 'operations' | 'wallet' | 'ux' | 'release';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'brand', label: 'Marque & Localisation', icon: '🎨' },
  { id: 'pricing', label: 'Tarification', icon: '💰' },
  { id: 'operations', label: 'Opérationnel', icon: '⚙️' },
  { id: 'wallet', label: 'Portefeuille', icon: '👛' },
  { id: 'ux', label: 'Expérience utilisateur', icon: '✨' },
  { id: 'release', label: 'Versions & releases', icon: '🚀' },
];

export default function Settings() {
  const dialog = useDialog();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('brand');

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
      const { updatedAt: _u, ...payload } = settings;
      const res = await api.put('/admin/settings', payload);
      setSettings(unwrap<AppSettings>(res));
      setToast('Paramètres enregistrés');
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      await dialog.alert({
        title: 'Échec',
        message:
          err?.response?.data?.error?.message ??
          "Impossible d'enregistrer les paramètres.",
        type: 'error',
      });
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
    return <div className="empty">Impossible de charger les paramètres.</div>;
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">
            Configuration globale de l'application — dernière modif{' '}
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

      {/* Tabs nav */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
          overflowX: 'auto',
          scrollbarWidth: 'thin',
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: active
                  ? '2px solid var(--primary)'
                  : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ marginRight: 6 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'brand' && <BrandTab settings={settings} update={update} />}
      {tab === 'pricing' && <PricingTab settings={settings} update={update} />}
      {tab === 'operations' && <OperationsTab settings={settings} update={update} />}
      {tab === 'wallet' && <WalletTab settings={settings} update={update} />}
      {tab === 'ux' && <UxTab settings={settings} update={update} />}
      {tab === 'release' && <ReleaseTab settings={settings} update={update} />}
    </>
  );
}

// ============================================================
// Tab : Marque & Localisation
// ============================================================
function BrandTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <h2>Branding</h2>
        </div>
        <div className="card-body">
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--warning-bg)',
              color: '#92400e',
              borderRadius: 8,
              fontSize: 12.5,
              marginBottom: 14,
            }}
          >
            💡 Les couleurs sont appliquées au prochain redémarrage de l'application
            mobile chez l'utilisateur (fermeture + réouverture). Le nom de l'app et
            la monnaie s'appliquent immédiatement.
          </div>
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
              Format régional (pour nombres et dates)
              <select
                value={settings.currencyLocale}
                onChange={(e) => update('currencyLocale', e.target.value)}
              >
                <option value="fr-BJ">Bénin</option>
                <option value="fr-BF">Burkina Faso</option>
                <option value="fr-CI">Côte d'Ivoire</option>
                <option value="en-US">États-Unis</option>
                <option value="fr-FR">France</option>
                <option value="fr-ML">Mali</option>
                <option value="fr-NE">Niger</option>
                <option value="fr-SN">Sénégal</option>
                <option value="fr-TG">Togo</option>
              </select>
            </label>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                margin: 0,
              }}
            >
              La monnaie sera affichée partout dans l'application client et
              livreur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tab : Tarification (prix + tarif de nuit)
// ============================================================
function PricingTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2>Prix de base</h2>
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
                Petit colis &lt; 5kg ({settings.currency})
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
                Moyen 5-20kg ({settings.currency})
                <input
                  type="number"
                  value={settings.basePriceMedium}
                  onChange={(e) =>
                    update('basePriceMedium', parseInt(e.target.value || '0', 10))
                  }
                  min={0}
                />
              </label>
              <label>
                Grand +20kg ({settings.currency})
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
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                margin: 0,
              }}
            >
              💡 Le prix dépend de la <b>taille</b> du colis (et de la distance).
              La catégorie (Repas, Pharmacie, etc.) est juste une info pour le
              livreur.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Prix par kilomètre ({settings.currency})
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

      {/* Tarif de nuit */}
      <div className="card">
        <div className="card-header">
          <h2>
            🌙 Tarif de nuit{' '}
            <span
              className="badge"
              style={{
                marginLeft: 8,
                fontSize: 10,
                background: settings.nightSurchargeEnabled
                  ? 'var(--success-bg)'
                  : 'var(--bg-alt)',
                color: settings.nightSurchargeEnabled
                  ? 'var(--primary-700)'
                  : 'var(--text-tertiary)',
              }}
            >
              {settings.nightSurchargeEnabled ? 'Actif' : 'Désactivé'}
            </span>
          </h2>
        </div>
        <div className="card-body">
          <div className="form">
            <ToggleRow
              label="Activer le tarif de nuit"
              hint="Une majoration fixe est ajoutée au prix pour toute course créée durant la plage horaire ci-dessous. Le montant est intégralement reversé au livreur."
              checked={settings.nightSurchargeEnabled}
              onChange={(v) => update('nightSurchargeEnabled', v)}
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
                opacity: settings.nightSurchargeEnabled ? 1 : 0.5,
                pointerEvents: settings.nightSurchargeEnabled ? 'auto' : 'none',
              }}
            >
              <label>
                Heure de début (0-23)
                <input
                  type="number"
                  value={settings.nightSurchargeStartHour}
                  onChange={(e) =>
                    update(
                      'nightSurchargeStartHour',
                      parseInt(e.target.value || '0', 10),
                    )
                  }
                  min={0}
                  max={23}
                />
              </label>
              <label>
                Heure de fin (0-23)
                <input
                  type="number"
                  value={settings.nightSurchargeEndHour}
                  onChange={(e) =>
                    update(
                      'nightSurchargeEndHour',
                      parseInt(e.target.value || '0', 10),
                    )
                  }
                  min={0}
                  max={23}
                />
              </label>
              <label>
                Montant ajouté ({settings.currency})
                <input
                  type="number"
                  value={settings.nightSurchargeAmount}
                  onChange={(e) =>
                    update(
                      'nightSurchargeAmount',
                      parseInt(e.target.value || '0', 10),
                    )
                  }
                  min={0}
                  max={100000}
                />
              </label>
            </div>

            <div
              style={{
                marginTop: 4,
                padding: 12,
                background: 'var(--bg-alt)',
                borderRadius: 10,
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <strong>Plage configurée :</strong>{' '}
              {formatHour(settings.nightSurchargeStartHour)} →{' '}
              {formatHour(settings.nightSurchargeEndHour)}
              {settings.nightSurchargeStartHour > settings.nightSurchargeEndHour
                ? ' (traverse minuit)'
                : ''}
              .{' '}
              {settings.nightSurchargeEnabled && settings.nightSurchargeAmount > 0 ? (
                <>
                  Une course créée dans cette plage coûtera{' '}
                  <b>
                    +{settings.nightSurchargeAmount} {settings.currency}
                  </b>{' '}
                  au client (reversés intégralement au livreur).
                </>
              ) : (
                <>Aucune majoration n'est actuellement appliquée.</>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, '0')}h00`;
}

// ============================================================
// Tab : Opérationnel
// ============================================================
function OperationsTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Réglages opérationnels</h2>
      </div>
      <div className="card-body">
        <div className="form">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <label>
              Durée de recherche d'un livreur (minutes)
              <input
                type="number"
                value={settings.deliveryExpiryMinutes}
                onChange={(e) =>
                  update('deliveryExpiryMinutes', parseInt(e.target.value || '0', 10))
                }
                min={1}
                max={60}
              />
            </label>
            <label>
              Délai avant annulation livreur (secondes)
              <input
                type="number"
                value={settings.driverCancelCooldownSeconds}
                onChange={(e) =>
                  update(
                    'driverCancelCooldownSeconds',
                    parseInt(e.target.value || '0', 10),
                  )
                }
                min={0}
                max={1800}
              />
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
            }}
          >
            <label>
              Rayon de diffusion aux livreurs (km)
              <input
                type="number"
                value={settings.nearbyRadiusKm}
                onChange={(e) =>
                  update('nearbyRadiusKm', parseInt(e.target.value || '0', 10))
                }
                min={1}
                max={50}
              />
            </label>
            <label title="Si un livreur termine sa course dans X minutes ou moins (selon l'ETA OSRM), on lui propose deja la prochaine course en banniere non-bloquante (style Uber). 0 = chainage desactive.">
              Chainage prochaine course (min restantes max)
              <input
                type="number"
                value={settings.chainingMaxRemainingMinutes}
                onChange={(e) =>
                  update(
                    'chainingMaxRemainingMinutes',
                    parseInt(e.target.value || '0', 10),
                  )
                }
                min={0}
                max={15}
              />
            </label>
            <label>
              Fraîcheur GPS livreur (secondes)
              <input
                type="number"
                value={settings.driverHeartbeatMaxAgeSeconds}
                onChange={(e) =>
                  update(
                    'driverHeartbeatMaxAgeSeconds',
                    parseInt(e.target.value || '0', 10),
                  )
                }
                min={30}
                max={600}
              />
            </label>
            <label>
              Délai min livraison programmée (min)
              <input
                type="number"
                value={settings.scheduledMinDelayMinutes}
                onChange={(e) =>
                  update(
                    'scheduledMinDelayMinutes',
                    parseInt(e.target.value || '0', 10),
                  )
                }
                min={1}
                max={120}
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
            <strong>Explications :</strong>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>
                <b>Durée de recherche</b> : temps maximum d'attente avant qu'une
                demande client expire si aucun livreur n'accepte (défaut 5 min).
              </li>
              <li>
                <b>Délai min livraison programmée</b> : seuil sous lequel une
                livraison "programmée" est en réalité diffusée immédiatement.
                Par défaut 10 min ; descendre à 2-3 min pour les tests.
              </li>
              <li>
                <b>Délai avant annulation</b> : un livreur ne peut pas annuler
                immédiatement après avoir accepté (évite les abus). Défaut 120s.
              </li>
              <li>
                <b>Rayon de diffusion</b> : rayon autour du pickup pour chercher
                les livreurs disponibles. Défaut 5 km.
              </li>
              <li>
                <b>Fraîcheur GPS</b> : si un livreur n'a pas envoyé sa position
                depuis N secondes, il est considéré hors-ligne. Défaut 120s.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tab : Portefeuille
// ============================================================
function WalletTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Portefeuille et paiement</h2>
      </div>
      <div className="card-body">
        <div className="form">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <label>
              Montant minimum de retrait ({settings.currency})
              <input
                type="number"
                value={settings.minWithdrawAmount}
                onChange={(e) =>
                  update('minWithdrawAmount', parseInt(e.target.value || '0', 10))
                }
                min={0}
              />
            </label>
            <label>
              Plafond dette commission ({settings.currency})
              <input
                type="number"
                value={settings.commissionDebtLimit}
                onChange={(e) =>
                  update('commissionDebtLimit', parseInt(e.target.value || '0', 10))
                }
                min={0}
              />
            </label>
          </div>
          <div
            style={{
              marginTop: 4,
              padding: 12,
              background: 'var(--bg-alt)',
              borderRadius: 10,
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            <b>Plafond dette commission</b> : dès que la dette d'un livreur
            dépasse ce montant, il ne peut plus accepter de nouvelles courses
            tant qu'il n'a pas réglé via Mobile Money.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tab : Expérience utilisateur
// ============================================================
function UxTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Expérience utilisateur</h2>
      </div>
      <div className="card-body">
        <div className="form">
          <ToggleRow
            label="Confettis après notation"
            hint="Anime des confettis quand le client note 4 ou 5 étoiles"
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
            hint="Vibration répétée quand une course tombe (même téléphone en poche)"
            checked={settings.driverVibrationEnabled}
            onChange={(v) => update('driverVibrationEnabled', v)}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tab : Versions & releases (force update)
// ============================================================
function ReleaseTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>🚀 Force update / Kill switch version</h2>
      </div>
      <div className="card-body">
        <div className="form">
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--warning-bg)',
              color: '#92400e',
              borderRadius: 10,
              fontSize: 12.5,
              marginBottom: 6,
              lineHeight: 1.5,
            }}
          >
            ⚠️ <b>Utiliser avec précaution.</b> Si tu mets une version supérieure
            à celle installée chez les utilisateurs, ils seront <b>bloqués</b> sur
            un écran "Mettre à jour" et ne pourront plus utiliser l'app tant
            qu'ils n'ont pas téléchargé une version ≥ celle ici. À utiliser
            uniquement pour killer une version bugguée en prod.
          </div>

          <label>
            Version mobile minimum supportée (semver : 1.0.0)
            <input
              type="text"
              value={settings.minSupportedAppVersion}
              onChange={(e) =>
                update('minSupportedAppVersion', e.target.value)
              }
              placeholder="1.0.0"
              pattern="^\d+\.\d+\.\d+$"
            />
          </label>

          <label>
            Message custom sur l'écran "Mise à jour requise" (optionnel)
            <textarea
              value={settings.forceUpdateMessage ?? ''}
              onChange={(e) =>
                update('forceUpdateMessage', e.target.value || null)
              }
              placeholder="Ex : Une nouvelle version avec le paiement Mobile Money est disponible !"
              maxLength={500}
              rows={3}
            />
          </label>

          <div
            style={{
              marginTop: 4,
              padding: 12,
              background: 'var(--bg-alt)',
              borderRadius: 10,
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            <b>Fonctionnement :</b>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>
                À chaque ouverture, l'app compare sa version avec celle ci-dessus.
              </li>
              <li>
                Si version installée &lt; minimum → écran bloquant avec bouton
                "Mettre à jour" qui redirige vers le store.
              </li>
              <li>
                Garde toujours cette valeur ≤ à la version réellement
                disponible sur les stores. Sinon les users n'auront aucun moyen
                de débloquer leur app.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
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
      <label
        style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}
      >
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
