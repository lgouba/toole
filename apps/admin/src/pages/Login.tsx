import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store';

export default function Login() {
  const nav = useNavigate();
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) nav('/');
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="logo-mark">T</div>
          <div className="login-brand-text">
            <span className="brand">Tôllé</span>
            <span className="sub">Administration</span>
          </div>
        </div>

        <h1>Bon retour</h1>
        <p>Connectez-vous pour acceder au panneau d'administration.</p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="admin@tolle.bf"
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>
          <button className="btn" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                Connexion...
              </>
            ) : (
              'Se connecter'
            )}
          </button>
          {error ? <div className="error-text">{error}</div> : null}
        </form>
      </div>
    </div>
  );
}
