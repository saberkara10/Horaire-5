import { useState } from 'react';
import { Lock, User } from 'lucide-react';


export function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const meResponse = await fetch('http://localhost:3000/auth/me', {
          credentials: 'include'
        });

        if (meResponse.ok) {
          const user = await meResponse.json();
          onLogin(user);
        }
      } else {
        setError('Identifiants incorrects');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <Lock />
          </div>
          <h1 className="login-title">Gestion d'Horaires</h1>
          <p className="login-subtitle">Connectez-vous pour continuer</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label>Courriel</label>
            <div className="login-input-wrapper">
              <User />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                placeholder="admin@ecole.ca"
              />
            </div>
          </div>

          <div className="login-field">
            <label>Mot de passe</label>
            <div className="login-input-wrapper">
              <Lock />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}