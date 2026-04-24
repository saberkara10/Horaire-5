import { Outlet, useLocation } from "react-router-dom";
import { AppShell } from "./AppShell.jsx";

const DEFAULT_PAGE_META = {
  title: "Gestion des Horaires",
  subtitle: "Consultez et pilotez les modules depuis un shell unique.",
};

const PAGE_META_BY_PATH = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Vue de pilotage academique.",
  },
  "/cours": {
    title: "Cours",
    subtitle: "Gerez les cours, les etapes et la salle de reference par code.",
  },
  "/professeurs": {
    title: "Professeurs",
    subtitle:
      "Rattachez chaque enseignant a ses cours autorises. Les programmes sont deduits automatiquement.",
  },
  "/disponibilites-professeurs": {
    title: "Disponibilites professeurs",
    subtitle:
      "Appliquez une disponibilite standard ou temporaire, replanifiez localement les seances impactees et conservez un historique metier complet.",
  },
  "/salles": {
    title: "Salles",
    subtitle: "Gerez les salles disponibles dans l'etablissement.",
  },
  "/import-etudiants": {
    title: "Import etudiants",
    subtitle:
      "Importez un fichier melangeant plusieurs etapes. Les groupes sont crees automatiquement par cohorte.",
  },
  "/generer": {
    title: "Generer",
    subtitle:
      "Travaillez sur la session active, filtrez une cohorte et corrigez les seances manuellement.",
  },
  "/horaires-professeurs": {
    title: "Horaires professeurs",
    subtitle: "Recherchez un enseignant puis consultez son planning de travail.",
  },
  "/horaires-groupes": {
    title: "Horaires groupes",
    subtitle:
      "Filtrez par programme et etape, puis consultez l'horaire exact de chaque groupe.",
  },
  "/horaires-salles": {
    title: "Occupation des salles",
    subtitle:
      "Selectionnez une salle et consultez son occupation hebdomadaire, ses disponibilites et son etat actuel.",
  },
  "/horaires-etudiants": {
    title: "Horaires etudiants",
    subtitle:
      "Consultez le groupe principal, les reprises et les exceptions individuelles de suivi dans un horaire fusionne.",
  },
  "/gestion-groupes": {
    title: "Gestion des Groupes",
    subtitle:
      "Pilotez vos groupes, gerez les etudiants et generez les horaires cibles.",
  },
  "/centre-aide": {
    title: "Centre d'aide",
    subtitle:
      "Guides, videos et documentation pour accompagner chaque module.",
  },
  "/admins": {
    title: "Sous-admins",
    subtitle: "Creation, modification et suivi des comptes admin.",
  },
  "/admin-concurrence": {
    title: "Concurrence",
    subtitle: "Surveillez les utilisateurs connectes, les verrous et les files d'attente.",
  },
  "/journal-activite": {
    title: "Journal d'activite",
    subtitle: "Audit securise des connexions, imports, generations et modifications importantes.",
  },
  "/scheduler": {
    title: "Pilotage sessions",
    subtitle:
      "Administrez les sessions, le bootstrap et l'historique du moteur avance.",
  },
};

function getPageMeta(pathname) {
  return PAGE_META_BY_PATH[pathname] || DEFAULT_PAGE_META;
}

export function MainLayout({ utilisateur, onLogout }) {
  const location = useLocation();
  const pageMeta = getPageMeta(location.pathname);

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
    >
      {/* The outlet is the only part that changes between internal modules. */}
      <Outlet />
    </AppShell>
  );
}
