import { useNavigate } from "react-router-dom";
import laciteCampus from "../assets/1733872234400.jpg";
import laciteLogo from "../assets/lacite-logo.png";
import "../styles/LoginPage.css";

export function LoginHelpPage() {
  const navigate = useNavigate();

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
        <div className="login-help-page">
          <div className="login-help-page__header">
            <img
              className="login-help-page__logo"
              src={laciteLogo}
              alt="Logo La Cite"
            />

            <button
              type="button"
              className="login-card__help-button"
              onClick={() => navigate("/login")}
            >
              Retour
            </button>
          </div>

          <div className="login-help-page__body">
            <div className="login-help-page__copy">
              <span className="login-help-page__eyebrow">Aide connexion</span>
              <h1>Comment se connecter au projet</h1>
              <p>
                Cette video montre le parcours de connexion a la plateforme,
                depuis l'ouverture de la page login jusqu'a l'entree dans
                l'espace de gestion.
              </p>
            </div>

            <div className="login-help-page__video-shell">
              <video
                className="login-help-page__video"
                controls
                preload="metadata"
                playsInline
              >
                <source src="/help/LOGIN.mkv" type="video/x-matroska" />
                Votre navigateur ne supporte pas cette video.
              </video>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
