import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store';

/**
 * Écran de connexion admin — direction visuelle « Console » (thème sombre,
 * registre outil d'exploitation, accent vert Toolé).
 *
 * Le thème sombre est SCOPÉ à cette page (classe racine `.console-login`,
 * cf. styles.css) : le reste du back-office reste en thème clair.
 *
 * Écarts assumés vs la spec (auth réelle, rien inventé) :
 *  - Pas de 2FA côté backend  -> encart « code à 6 chiffres » retiré.
 *  - `/admin/login` n'accepte que { email, password } -> toggle « Session
 *    courte » retiré (aucune durée transmissible).
 *  - Compte bloqué = HTTP 403 ACCOUNT_DISABLED (pas 423) -> mappé sur le
 *    message « Compte verrouillé ».
 *  - Pas de flux reset password -> « Mot de passe oublié ? » ouvre un mail
 *    support (pas de route inventée).
 *  - Le guard de routage ne préserve pas l'URL d'origine ; on lit `returnUrl`
 *    s'il est présent, sinon on redirige vers le tableau de bord.
 */

const SUPPORT_EMAIL = 'support@qalitylabs.fr';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Fenêtre du limiter serveur (`adminLoginLimiter`: 10 essais / 15 min).
const DEFAULT_LOCK_SEC = 15 * 60;

type Icon = { size?: number };

const IconUser = ({ size = 18 }: Icon) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconLock = ({ size = 18 }: Icon) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const IconEye = ({ size = 18 }: Icon) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = ({ size = 18 }: Icon) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.4 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.7 3.5" />
    <path d="M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 2.6-.3" />
  </svg>
);
const IconAlert = ({ size = 16 }: Icon) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </svg>
);
const IconInfo = ({ size = 16 }: Icon) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </svg>
);

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const alertRef = useRef<HTMLDivElement>(null);

  const envLabel = import.meta.env.PROD ? 'PRODUCTION' : 'LOCAL';
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

  // Tic 1s uniquement pendant un verrouillage (429), pour le compte à rebours.
  useEffect(() => {
    if (lockUntil === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  const lockRemainingSec = lockUntil ? Math.max(0, Math.ceil((lockUntil - now) / 1000)) : 0;
  const locked = lockRemainingSec > 0;

  // Fin du verrouillage -> on nettoie.
  useEffect(() => {
    if (lockUntil !== null && lockRemainingSec === 0) {
      setLockUntil(null);
      setGlobalError(null);
    }
  }, [lockUntil, lockRemainingSec]);

  // Erreur globale -> focus sur l'alerte (a11y).
  useEffect(() => {
    if (globalError) alertRef.current?.focus();
  }, [globalError]);

  const emailError = useMemo(() => {
    if (!touched.email) return null;
    if (!email.trim()) return 'Champ obligatoire.';
    if (!EMAIL_RE.test(email.trim())) return 'Adresse e-mail invalide.';
    return null;
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return null;
    if (!password) return 'Champ obligatoire.';
    return null;
  }, [password, touched.password]);

  const canSubmit =
    !!email.trim() && !!password && !loading && !locked && !emailError;

  const lockMessage = () => {
    const min = Math.max(1, Math.ceil(lockRemainingSec / 60));
    return `Trop de tentatives. Réessayez dans ${min} minute${min > 1 ? 's' : ''}.`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || locked) return; // anti double-soumission + verrou actif

    // Validation finale : marque tout comme touché pour révéler les erreurs.
    setTouched({ email: true, password: true });
    const trimmed = email.trim();
    if (!trimmed || !password) return; // soumission bloquée si champ vide
    if (!EMAIL_RE.test(trimmed)) return;

    setGlobalError(null);
    setLoading(true);
    const res = await login(trimmed, password);
    setLoading(false);

    if (res.ok) {
      const params = new URLSearchParams(location.search);
      const returnUrl = params.get('returnUrl');
      const safe = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//');
      nav(safe ? returnUrl! : '/', { replace: true });
      return;
    }

    switch (res.status) {
      case 401:
        setGlobalError('Identifiant ou mot de passe incorrect.');
        break;
      case 403:
        setGlobalError('Compte verrouillé. Contactez un administrateur.');
        break;
      case 429: {
        const sec = res.retryAfterSec ?? DEFAULT_LOCK_SEC;
        const until = Date.now() + sec * 1000;
        setLockUntil(until);
        setNow(Date.now());
        const min = Math.max(1, Math.ceil(sec / 60));
        setGlobalError(`Trop de tentatives. Réessayez dans ${min} minute${min > 1 ? 's' : ''}.`);
        break;
      }
      default:
        // 5xx, pas de réponse (réseau), ou statut inattendu.
        setGlobalError('Service indisponible. Réessayez dans un instant.');
    }
    // Le mot de passe n'est JAMAIS vidé après une erreur.
  };

  // Message d'erreur global : si verrou actif, on affiche le décompte à jour.
  const shownGlobalError = locked ? lockMessage() : globalError;

  return (
    <main className="console-login">
      {/* Fond décoratif : grille + halos radiaux */}
      <svg className="cl-bg" aria-hidden="true" preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="cl-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="#1B2A24" strokeWidth="1" />
          </pattern>
          <radialGradient id="cl-halo1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0F3325" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0F3325" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cl-halo2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#12402D" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#12402D" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1440" height="900" fill="url(#cl-grid)" />
        <circle cx="720" cy="360" r="420" fill="url(#cl-halo1)" />
        <circle cx="720" cy="360" r="260" fill="url(#cl-halo2)" />
      </svg>

      {/* Barre supérieure */}
      <header className="cl-topbar">
        <div className="cl-brand">
          <img src="/favicon.png" alt="" aria-hidden="true" className="cl-logo" />
          <span className="cl-brand-text">toole<span className="cl-brand-sep">/</span>admin-console</span>
        </div>
        <div className="cl-chip" aria-label={`Environnement ${envLabel}`}>
          <span className="cl-chip-dot" />
          {envLabel}
        </div>
      </header>

      <form className="cl-card" onSubmit={handleSubmit} noValidate>
        <div className="cl-eyebrow">Accès restreint</div>
        <div className="cl-head">
          <h1 className="cl-title">Authentification</h1>
          <p className="cl-subtitle">
            Identifiez-vous pour ouvrir la console d'exploitation.
          </p>
        </div>

        {shownGlobalError ? (
          <div
            className="cl-alert"
            role="alert"
            tabIndex={-1}
            ref={alertRef}
          >
            <IconAlert />
            <span>{shownGlobalError}</span>
          </div>
        ) : null}

        <div className="cl-fields">
          <div className="cl-field">
            <label className="cl-label" htmlFor="cl-email">Identifiant</label>
            <div className={`cl-input${emailError ? ' cl-input--error' : ''}`}>
              <span className="cl-input-icon"><IconUser /></span>
              <input
                id="cl-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                placeholder="admin@toole.bf"
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                autoCapitalize="none"
                disabled={loading}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'cl-email-err' : undefined}
              />
            </div>
            {emailError ? (
              <span className="cl-field-err" id="cl-email-err">{emailError}</span>
            ) : null}
          </div>

          <div className="cl-field">
            <label className="cl-label" htmlFor="cl-password">Mot de passe</label>
            <div className={`cl-input${passwordError ? ' cl-input--error' : ''}`}>
              <span className="cl-input-icon"><IconLock /></span>
              <input
                id="cl-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                autoComplete="current-password"
                disabled={loading}
                className="cl-password-value"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'cl-password-err' : undefined}
              />
              <button
                type="button"
                className="cl-reveal"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                disabled={loading}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {passwordError ? (
              <span className="cl-field-err" id="cl-password-err">{passwordError}</span>
            ) : null}
          </div>
        </div>

        <div className="cl-row">
          {/* Pas de flux reset password côté backend : lien -> mail support. */}
          <a className="cl-link" href={`mailto:${SUPPORT_EMAIL}?subject=Toolé%20admin%20—%20mot%20de%20passe%20oublié`}>
            Mot de passe oublié ?
          </a>
        </div>

        <button className="cl-submit" type="submit" disabled={!canSubmit} aria-busy={loading}>
          {loading ? (
            <>
              <span className="cl-spinner" aria-hidden="true" />
              Connexion…
            </>
          ) : (
            'Ouvrir la console'
          )}
        </button>

        {/* Encart 2FA retiré : pas de 2FA côté backend (cf. en-tête du fichier). */}
      </form>

      <footer className="cl-footer">
        <span className="cl-foot-ver">v{version} · </span>
        toutes les connexions sont journalisées
        <span className="cl-foot-sup">
          {' '}· <a className="cl-link" href={`mailto:${SUPPORT_EMAIL}`}>support</a>
        </span>
      </footer>
    </main>
  );
}
