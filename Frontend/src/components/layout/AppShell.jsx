import { NavLink } from "react-router-dom";
import "../../styles/AppShell.css";
import { utilisateurEstResponsable } from "../../utils/roles.js";

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

function IconDisponibilites() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3V7" />
      <path d="M16 3V7" />
      <path d="M4 10H20" />
      <path d="M9 14H12" />
      <path d="M9 17H15" />
    </svg>
  );
}

function IconHorairesProfesseurs() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="3" />
      <path d="M3.5 18C3.5 15.79 5.52 14 8 14C10.48 14 12.5 15.79 12.5 18" />
      <rect x="14" y="5" width="7" height="12" rx="2" />
      <path d="M16.5 9H18.5" />
      <path d="M16.5 12H18.5" />
    </svg>
  );
}

function IconHorairesGroupes() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9H16" />
      <path d="M8 13H12" />
      <path d="M15 12C15 10.34 16.34 9 18 9" />
      <path d="M16 16H19" />
    </svg>
  );
}

function IconHorairesEtudiants() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="3" />
      <path d="M3.5 18C3.5 15.79 5.52 14 8 14C10.48 14 12.5 15.79 12.5 18" />
      <path d="M16 7H20" />
      <path d="M16 11H20" />
      <path d="M16 15H20" />
    </svg>
  );
}

function IconHorairesSalles() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8H16" />
      <path d="M8 12H16" />
      <path d="M8 16H12" />
      <path d="M15.5 15.5L18.5 18.5" />
      <circle cx="14.5" cy="14.5" r="2.5" />
    </svg>
  );
}

function IconGestionGroupes() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconAdmins() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" />
      <path d="M4 18C4 15.79 6.24 14 9 14C11.76 14 14 15.79 14 18" />
      <path d="M18 7V13" />
      <path d="M15 10H21" />
    </svg>
  );
}

function IconScheduler() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconAdminCentral() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3L4 7v5c0 4.4 3.4 8.5 8 9.5 4.6-1 8-5.1 8-9.5V7l-8-4z" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M8.5 9a3.5 3.5 0 1 1 5.82 2.6c-.92.8-1.82 1.43-1.82 2.4" />
      <path d="M12 17h.01" />
      <path d="M21 12c0 4.97-4.48 9-10 9a10.9 10.9 0 0 1-4-.73L3 21l1.1-3.3A8.7 8.7 0 0 1 2 12C2 7.03 6.48 3 12 3s10 4.03 10 9z" />
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
      <path d="M3 9L12 4L21 9" />
      <path d="M5 10V18" />
      <path d="M9 10V18" />
      <path d="M15 10V18" />
      <path d="M19 10V18" />
      <path d="M3 20H21" />
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
  const rolesUtilisateur = Array.isArray(utilisateur?.roles) ? utilisateur.roles : [];
  const estResponsable = utilisateurEstResponsable(utilisateur);
  const peutUtiliserScheduler =
    rolesUtilisateur.includes("ADMIN") ||
    rolesUtilisateur.includes("RESPONSABLE") ||
    rolesUtilisateur.includes("ADMIN_RESPONSABLE");

  const rolePrincipal = rolesUtilisateur.includes("ADMIN_RESPONSABLE")
    ? "ADMIN_RESPONSABLE"
    : rolesUtilisateur.includes("RESPONSABLE")
    ? "RESPONSABLE"
    : rolesUtilisateur[0] || utilisateur?.role || "Utilisateur";

  const nomAffiche =
    `${utilisateur?.nom || ""} ${utilisateur?.prenom || ""}`.trim() ||
    utilisateur?.email ||
    "Utilisateur connecte";

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <div className="app-shell__brand-icon">
            <IconBrand />
          </div>
          <div className="app-shell__brand-text">
            <div className="app-shell__brand-title">College Horaires</div>
            <div className="app-shell__brand-subtitle">Coordination academique</div>
          </div>
        </div>

        <div className="app-shell__sidebar-note">
          <span className="app-shell__sidebar-note-label">Session active</span>
          <strong>Portail campus</strong>
          <p>Organisation pedagogique, affectations et suivi des cohortes.</p>
        </div>

        <div className="app-shell__nav-label">Navigation campus</div>

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
            to="/disponibilites-professeurs"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconDisponibilites /></span>
            <span>Disponibilites</span>
          </NavLink>

          <NavLink
            to="/import-etudiants"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconImport /></span>
            <span>Import etudiants</span>
          </NavLink>

          <NavLink
            to="/generer"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconAffectations /></span>
            <span>Generer</span>
          </NavLink>

          <NavLink
            to="/horaires-professeurs"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconHorairesProfesseurs /></span>
            <span>Horaires professeurs</span>
          </NavLink>

          <NavLink
            to="/horaires-groupes"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconHorairesGroupes /></span>
            <span>Horaires groupes</span>
          </NavLink>

          <NavLink
            to="/horaires-salles"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconHorairesSalles /></span>
            <span>Occupation salles</span>
          </NavLink>

          <NavLink
            to="/horaires-etudiants"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconHorairesEtudiants /></span>
            <span>Horaires etudiants</span>
          </NavLink>

          <NavLink
            to="/gestion-groupes"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconGestionGroupes /></span>
            <span>Gestion groupes</span>
          </NavLink>

          {peutUtiliserScheduler ? (
            <NavLink
              to="/scheduler"
              className={({ isActive }) =>
                `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
              }
            >
              <span className="app-shell__nav-icon"><IconScheduler /></span>
              <span>Pilotage sessions</span>
            </NavLink>
          ) : null}

          {estResponsable ? (
            <NavLink
              to="/admins"
              className={({ isActive }) =>
                `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
              }
            >
              <span className="app-shell__nav-icon"><IconAdmins /></span>
              <span>Sous-admins</span>
            </NavLink>
          ) : null}

          {rolesUtilisateur.includes("ADMIN_RESPONSABLE") ? (
            <NavLink
              to="/admin-responsable"
              className={({ isActive }) =>
                `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
              }
            >
              <span className="app-shell__nav-icon"><IconAdminCentral /></span>
              <span>Admin central</span>
            </NavLink>
          ) : null}

          <NavLink
            to="/centre-aide"
            className={({ isActive }) =>
              `app-shell__nav-item ${isActive ? "app-shell__nav-item--active" : ""}`
            }
          >
            <span className="app-shell__nav-icon"><IconHelp /></span>
            <span>Centre d'aide</span>
          </NavLink>
        </nav>

        <button className="app-shell__logout" type="button" onClick={onLogout}>
          <span className="app-shell__nav-icon"><IconLogout /></span>
          <span>Deconnexion</span>
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
              <div className="app-shell__user-role">{rolePrincipal}</div>
            </div>
          </div>
        </header>

        <div className="app-shell__content">{children}</div>
      </main>
    </div>
  );
}
