/**
 * PAGE - Login
 *
 * Cette page gere l'authentification
 * des utilisateurs de l'application.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUtilisateur } from "../services/auth.api.js";
import laciteCampus from "../assets/1733872234400.jpg";
import laciteLogo from "../assets/lacite-logo.png";
import "../styles/LoginPage.css";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 7L12 13L20 7" />
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M7 11V8C7 5.24 9.24 3 12 3C14.76 3 17 5.24 17 8V11" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M2.5 12C3.23 8.09 7 4.75 12 4.75C17 4.75 20.77 8.09 21.5 12C20.77 15.91 17 19.25 12 19.25C7 19.25 3.23 15.91 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 3L21 21" />
      <path d="M10.58 10.58C10.21 10.95 10 11.46 10 12C10 13.1 10.9 14 12 14C12.54 14 13.05 13.79 13.42 13.42" />
      <path d="M9.88 5.09C10.56 4.86 11.27 4.75 12 4.75C16.5 4.75 20.27 8.09 21 12C20.73 13.45 19.99 14.76 18.92 15.76" />
      <path d="M6.1 6.1C4.25 7.39 2.95 9.48 2.5 12C3.23 15.91 7 19.25 11.5 19.25C12.64 19.25 13.74 19.03 14.75 18.63" />
    </svg>
  );
}

function formaterTemps(secondes) {
  const totalSecondes = Math.max(0, Number(secondes) || 0);
  const minutes = Math.floor(totalSecondes / 60);
  const secondesRestantes = totalSecondes % 60;

  if (minutes <= 0) {
    return `${secondesRestantes}s`;
  }

  return `${minutes}m ${String(secondesRestantes).padStart(2, "0")}s`;
}

export function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tentativesRestantes, setTentativesRestantes] = useState(null);
  const [compteurBlocage, setCompteurBlocage] = useState(0);
  const compteurRef = useRef(null);

  const navigate = useNavigate();
  const connexionBloquee = compteurBlocage > 0;

  useEffect(() => {
    if (!connexionBloquee) {
      if (compteurRef.current) {
        window.clearInterval(compteurRef.current);
        compteurRef.current = null;
      }

      return undefined;
    }

    compteurRef.current = window.setInterval(() => {
      setCompteurBlocage((valeur) => {
        if (valeur <= 1) {
          window.clearInterval(compteurRef.current);
          compteurRef.current = null;
          setTentativesRestantes(null);
          setError("");
          return 0;
        }

        return valeur - 1;
      });
    }, 1000);

    return () => {
      if (compteurRef.current) {
        window.clearInterval(compteurRef.current);
        compteurRef.current = null;
      }
    };
  }, [connexionBloquee]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (connexionBloquee) {
      setError(
        `Trop de tentatives. Reessayez dans ${formaterTemps(compteurBlocage)}.`
      );
      return;
    }

    setLoading(true);

    const emailNettoye = email.trim();
    const motDePasseNettoye = password.trim();

    if (!emailNettoye || !motDePasseNettoye) {
      setError("Email et mot de passe obligatoires.");
      setLoading(false);
      return;
    }

    try {
      const utilisateur = await loginUtilisateur({
        email: emailNettoye,
        password: motDePasseNettoye,
      });

      onLogin?.(utilisateur || { email: emailNettoye });
      navigate("/dashboard", { replace: true });
    } catch (erreur) {
      const data = erreur.data || erreur.payload || {};

      if (erreur.status === 429) {
        const attenteSecondes = Number(data.attente_secondes) || 60;
        setCompteurBlocage(attenteSecondes);
        setTentativesRestantes(0);
        setError(
          data.message ||
            `Trop de tentatives. Reessayez dans ${formaterTemps(attenteSecondes)}.`
        );
      } else {
        const tentatives = data.tentatives_restantes;
        setTentativesRestantes(
          Number.isFinite(Number(tentatives)) ? Number(tentatives) : null
        );
        setError(erreur.message || "Impossible de se connecter.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-page__background" aria-hidden="true">
        <img
          className="login-page__background-image"
          src={laciteCampus}
          alt=""
        />
      </div>

      <section className="login-page__content">
        <div className="login-card">
          <div className="login-card__topbar">
            <button
              type="button"
              className="login-card__help-button"
              onClick={() => navigate("/login/aide")}
            >
              Aide
            </button>
          </div>

          <div className="login-card__brand">
            <img
              className="login-page__logo"
              src={laciteLogo}
              alt="Logo La Cite"
            />
          </div>

          <div className="login-card__header">
            <h1 className="login-page__title">Connexion</h1>
            <p>Accedez a votre espace de gestion.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-form__group">
              <label htmlFor="email" className="login-form__label">
                Adresse email
              </label>

              <div className="login-input">
                <span className="login-input__icon" aria-hidden="true">
                  <MailIcon />
                </span>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@ecole.ca"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  disabled={loading || connexionBloquee}
                  required
                />
              </div>
            </div>

            <div className="login-form__group">
              <label htmlFor="password" className="login-form__label">
                Mot de passe
              </label>

              <div className="login-input">
                <span className="login-input__icon" aria-hidden="true">
                  <LockIcon />
                </span>

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="........"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={loading || connexionBloquee}
                  required
                />

                <button
                  type="button"
                  className="login-input__toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading || connexionBloquee}
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button
              className="login-form__submit"
              type="submit"
              disabled={loading || connexionBloquee}
            >
              {connexionBloquee
                ? `Reessayer dans ${formaterTemps(compteurBlocage)}`
                : loading
                  ? "Connexion..."
                  : "Se connecter"}
            </button>

            {error ? (
              <div className="login-form__error" role="alert">
                <p>{error}</p>
                {connexionBloquee ? (
                  <span>
                    Compte a rebours : {formaterTemps(compteurBlocage)}
                  </span>
                ) : null}
                {!connexionBloquee && tentativesRestantes !== null ? (
                  <span>
                    Tentatives restantes : {tentativesRestantes}
                  </span>
                ) : null}
              </div>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
