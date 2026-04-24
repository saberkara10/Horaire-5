import { NavLink, useLocation } from "react-router-dom";
import "../../styles/AppShell.css";
import {
  getLibelleRoleFrontend,
  utilisateurEstAdminResponsable,
  utilisateurEstResponsable,
} from "../../utils/roles.js";
import { usePopup } from "../feedback/PopupProvider.jsx";
import laciteCampus from "../../assets/1733872234400.jpg";
import laciteLogo from "../../assets/lacite-logo.png";

function routeEstActive(pathname, route) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function AppShell({
  children,
  onLogout,
  utilisateur,
  title = "Gestion des Horaires",
  subtitle = "",
}) {
  const location = useLocation();
  const { confirm } = usePopup();
  const rolesUtilisateur = Array.isArray(utilisateur?.roles) ? utilisateur.roles : [];
  const estResponsable = utilisateurEstResponsable(utilisateur);
  const estAdminGeneral = utilisateurEstAdminResponsable(utilisateur);
  const peutUtiliserScheduler =
    rolesUtilisateur.includes("ADMIN") ||
    rolesUtilisateur.includes("RESPONSABLE") ||
    rolesUtilisateur.includes("ADMIN_RESPONSABLE");

  const nomAffiche =
    `${utilisateur?.nom || ""} ${utilisateur?.prenom || ""}`.trim() ||
    utilisateur?.email ||
    "Utilisateur connecte";

  const navigationCampus = [
    {
      label: "Dashboard",
      to: "/dashboard",
    },
    {
      label: "Cours",
      to: "/cours",
    },
    {
      label: "Professeurs",
      to: "/professeurs",
      matchRoutes: ["/professeurs", "/disponibilites-professeurs"],
      children: [
        {
          label: "Disponibilites",
          to: "/disponibilites-professeurs",
        },
      ],
    },
    {
      label: "Salles",
      to: "/salles",
      matchRoutes: ["/salles", "/horaires-salles"],
      children: [
        {
          label: "Occupation salles",
          to: "/horaires-salles",
        },
      ],
    },
    {
      label: "Horaires",
      to: "/horaires-professeurs",
      matchRoutes: [
        "/horaires-professeurs",
        "/horaires-groupes",
        "/horaires-etudiants",
      ],
      children: [
        {
          label: "Horaires professeurs",
          to: "/horaires-professeurs",
        },
        {
          label: "Horaires groupes",
          to: "/horaires-groupes",
        },
        {
          label: "Horaires etudiants",
          to: "/horaires-etudiants",
        },
      ],
    },
  ];

  const navigationSecondaire = [
    {
      label: "Import etudiants",
      to: "/import-etudiants",
    },
    {
      label: "Generer",
      to: "/generer",
    },
    {
      label: "Gestion groupes",
      to: "/gestion-groupes",
    },
    {
      label: "Centre d'aide",
      to: "/centre-aide",
    },
    ...(peutUtiliserScheduler
      ? [
          {
            label: "Planification",
            to: "/scheduler",
          },
        ]
      : []),
    ...(estResponsable
      ? [
          {
            label: "Sous-admins",
            to: "/admins",
          },
        ]
      : []),
    ...(estAdminGeneral
      ? [
          {
            label: "Concurrence",
            to: "/admin-concurrence",
          },
          {
            label: "Journal d'activite",
            to: "/journal-activite",
          },
        ]
      : []),
  ];

  function renderNavLink(item, niveau = "principal") {
    return (
      <NavLink
        key={`${niveau}-${item.to}`}
        to={item.to}
        className={({ isActive }) =>
          `app-shell__nav-item app-shell__nav-item--${niveau} ${
            isActive ? "app-shell__nav-item--active" : ""
          }`
        }
      >
        <span className="app-shell__nav-bullet" aria-hidden="true" />
        <span>{item.label}</span>
      </NavLink>
    );
  }

  function renderNavGroup(item) {
    const estOuvert = item.matchRoutes.some((route) =>
      routeEstActive(location.pathname, route)
    );

    return (
      <div className="app-shell__nav-group" key={item.to}>
        <NavLink
          to={item.to}
          className={() =>
            `app-shell__nav-item app-shell__nav-item--principal ${
              estOuvert ? "app-shell__nav-item--active" : ""
            }`
          }
        >
          <span className="app-shell__nav-bullet" aria-hidden="true" />
          <span>{item.label}</span>
          <span
            className={`app-shell__nav-chevron ${
              estOuvert ? "app-shell__nav-chevron--open" : ""
            }`}
            aria-hidden="true"
          />
        </NavLink>

        {estOuvert ? (
          <div className="app-shell__submenu">
            {item.children.map((child) => renderNavLink(child, "secondaire"))}
          </div>
        ) : null}
      </div>
    );
  }

  async function handleLogoutClick() {
    const confirmation = await confirm({
      title: "Se deconnecter ?",
      message: "Votre session courante sera fermee sur ce navigateur.",
      confirmLabel: "Se deconnecter",
      cancelLabel: "Rester connecte",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    await onLogout?.();
  }

  return (
    <div className="app-shell" style={{ "--app-shell-bg": `url(${laciteCampus})` }}>
      <div className="app-shell__backdrop" aria-hidden="true" />

      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <img
            className="app-shell__brand-logo"
            src={laciteLogo}
            alt="Logo La Cite"
          />
          <span className="app-shell__brand-kicker">Portail academique</span>
          <div className="app-shell__brand-title">Gestion des horaires</div>
        </div>

        <div className="app-shell__sidebar-body">
          <section className="app-shell__nav-section">
            <div className="app-shell__nav-label">Navigation campus</div>
            <nav className="app-shell__nav" aria-label="Navigation principale">
              {navigationCampus.map((item) =>
                item.children ? renderNavGroup(item) : renderNavLink(item)
              )}
            </nav>
          </section>

          <section className="app-shell__nav-section">
            <div className="app-shell__nav-label">Outils</div>
            <nav className="app-shell__nav" aria-label="Navigation secondaire">
              {navigationSecondaire.map((item) => renderNavLink(item))}
            </nav>
          </section>
        </div>

        <button className="app-shell__logout" type="button" onClick={handleLogoutClick}>
          <span className="app-shell__nav-bullet" aria-hidden="true" />
          <span>Deconnexion</span>
        </button>
      </aside>

      <main className="app-shell__main">
        <header className="app-shell__topbar">
          <div className="app-shell__title-block">
            <div className="app-shell__eyebrow">
              <img
                className="app-shell__eyebrow-logo"
                src={laciteLogo}
                alt="Logo La Cite"
              />
            </div>
            <h1 className="app-shell__page-title">{title}</h1>
            {subtitle ? <p className="app-shell__page-subtitle">{subtitle}</p> : null}
          </div>

          <div className="app-shell__user-card">
            <div className="app-shell__user-avatar">
              {nomAffiche.charAt(0).toUpperCase()}
            </div>
            <div className="app-shell__user-text">
              <div className="app-shell__user-name">{nomAffiche}</div>
              <div className="app-shell__user-role">
                {getLibelleRoleFrontend(utilisateur)}
              </div>
            </div>
          </div>
        </header>

        <div className="app-shell__content">{children}</div>
      </main>
    </div>
  );
}
