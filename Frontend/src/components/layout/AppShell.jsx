import { NavLink } from "react-router-dom";
import "../../styles/AppShell.css";

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="11" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="18" width="7" height="3" rx="1.5" />
    </svg>
  );
}

function IconCours() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 5.5C5 4.67 5.67 4 6.5 4H19v14H6.5C5.67 18 5 18.67 5 19.5V5.5Z" />
      <path d="M5 19.5C5 18.67 5.67 18 6.5 18H19v2H6.5C5.67 20 5 19.33 5 18.5" />
      <path d="M9 8H15" />
      <path d="M9 11H15" />
    </svg>
  );
}

function IconProfesseurs() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" />
      <path d="M4 18C4 15.79 6.24 14 9 14C11.76 14 14 15.79 14 18" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 18C15 16.34 16.79 15 19 15" />
    </svg>
  );
}

function IconSalles() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9H16" />
      <path d="M8 13H16" />
      <path d="M8 17H12" />
    </svg>
  );
}

function IconImport() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 4V14" />
      <path d="M8 10L12 14L16 10" />
      <path d="M5 19H19" />
    </svg>
  );
}

function IconAffectations() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9H16" />
      <path d="M8 13H13" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M10 17L15 12L10 7" />
      <path d="M15 12H4" />
      <path d="M20 4V20" />
    </svg>
  );
}

function IconBrand() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7V12L15.5 14" />
    </svg>
  );
}

export function AppShell({
  children,
  onLogout,
  utilisateur,
  title = "Gestion des Horaires",
  subtitle = "",
}) {
  const nomAffiche =
    `${utilisateur?.prenom || ""} ${utilisateur?.nom || ""}`.trim() ||
    utilisateur?.email ||
    "Utilisateur connecté";

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <div className="app-shell__brand-icon">
            <IconBrand />
          </div>
          <div className="app-shell__brand-text">
            <div className="app-shell__brand-title">Gestion Horaires</div>
            <div className="app-shell__brand-subtitle">v5</div>
          </div>
        </div>

        <nav className="app-shell__nav" aria-label="Navigation principale">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconDashboard /></span>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/cours"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconCours /></span>
            <span>Cours</span>
          </NavLink>

          <NavLink
            to="/professeurs"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconProfesseurs /></span>
            <span>Professeurs</span>
          </NavLink>

          <NavLink
            to="/salles"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconSalles /></span>
            <span>Salles</span>
          </NavLink>

          <NavLink
            to="/import-etudiants"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconImport /></span>
            <span>Import étudiants</span>
          </NavLink>

          <NavLink
            to="/affectations"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconAffectations /></span>
            <span>Affectations</span>
          </NavLink>
        </nav>

        <button className="app-shell__logout" type="button" onClick={onLogout}>
          <span className="app-shell__nav-icon"><IconLogout /></span>
          <span>Déconnexion</span>
        </button>
      </aside>

      <main className="app-shell__main">
        <header className="app-shell__topbar">
          <div>
            <h1 className="app-shell__page-title">{title}</h1>
            {subtitle ? (
              <p className="app-shell__page-subtitle">{subtitle}</p>
            ) : null}
          </div>

          <div className="app-shell__user-card">
            <div className="app-shell__user-avatar">
              {nomAffiche.charAt(0).toUpperCase()}
            </div>
            <div className="app-shell__user-text">
              <div className="app-shell__user-name">{nomAffiche}</div>
              <div className="app-shell__user-role">
                {utilisateur?.roles?.[0] || utilisateur?.role || "Utilisateur"}
              </div>
            </div>
          </div>
        </header>

        <div className="app-shell__content">{children}</div>
      </main>
    </div>
  );
}