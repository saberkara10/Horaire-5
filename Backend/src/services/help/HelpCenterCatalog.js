/**
 * Catalogue editorial du Centre d'aide.
 *
 * Ce fichier centralise la structure produit du module:
 * - categories navigables
 * - guides detailles
 * - slots video prepares pour le streaming ou l'etat "a venir"
 * - documents markdown relies au depot
 * - FAQ et scenarios d'usage
 *
 * Le but est d'avoir une source de verite simple a maintenir sans dupliquer
 * la logique de presentation dans le frontend.
 */

function createVideoSlot(definition) {
  return {
    description: "",
    durationLabel: null,
    level: null,
    videoSlug: null,
    publicVideoPath: null,
    publicVideoCandidates: [],
    publicThumbnailUrl: null,
    ...definition,
  };
}

function createGuide(definition) {
  return {
    type: "guide",
    tags: [],
    keywords: [],
    prerequisites: [],
    steps: [],
    attentionPoints: [],
    commonErrors: [],
    practicalTips: [],
    documentIds: [],
    videoSlots: [],
    relatedGuideIds: [],
    popularityScore: 70,
    addedAt: "2026-04-18",
    updatedAt: "2026-04-18",
    ...definition,
  };
}

function createDocument(definition) {
  return {
    tags: [],
    keywords: [],
    estimatedMinutes: 5,
    ...definition,
  };
}

function createFaq(definition) {
  return {
    type: "faq",
    tags: [],
    keywords: [],
    relatedGuideIds: [],
    relatedDocumentIds: [],
    addedAt: "2026-04-18",
    updatedAt: "2026-04-18",
    ...definition,
  };
}

function createScenario(definition) {
  return {
    type: "scenario",
    tags: [],
    keywords: [],
    relatedGuideIds: [],
    relatedDocumentIds: [],
    steps: [],
    addedAt: "2026-04-18",
    updatedAt: "2026-04-18",
    ...definition,
  };
}

export const HELP_LEVELS = [
  { id: "debutant", label: "Debutant" },
  { id: "intermediaire", label: "Intermediaire" },
  { id: "avance", label: "Avance" },
];

export const HELP_CONTENT_TYPES = [
  { id: "guide", label: "Guide" },
  { id: "video", label: "Video" },
  { id: "documentation", label: "Markdown" },
  { id: "faq", label: "FAQ" },
  { id: "scenario", label: "Scenario" },
];

export const HELP_DOCUMENT_KINDS = [
  { id: "guide-pas-a-pas", label: "Guide pas a pas" },
  { id: "explication-metier", label: "Explication metier" },
  { id: "procedure-detaillee", label: "Procedure detaillee" },
  { id: "resolution-probleme", label: "Resolution de probleme" },
  { id: "bonnes-pratiques", label: "Bonnes pratiques" },
];

export const HELP_CATEGORIES = [
  {
    id: "getting-started",
    name: "Bien demarrer",
    moduleKey: "onboarding",
    accent: "blue",
    description:
      "Connexion, navigation, reperes de base et premiers automatismes pour prendre en main la plateforme.",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    moduleKey: "dashboard",
    accent: "teal",
    description:
      "Lecture des indicateurs, alertes, compteurs et priorites visibles sur la page d'accueil.",
  },
  {
    id: "courses",
    name: "Cours",
    moduleKey: "cours",
    accent: "indigo",
    description:
      "Creation, modification, consultation et qualite des donnees de cours.",
  },
  {
    id: "teachers",
    name: "Professeurs",
    moduleKey: "professeurs",
    accent: "amber",
    description:
      "Gestion des fiches enseignants, specialites, donnees academiques et mise a jour des profils.",
  },
  {
    id: "rooms",
    name: "Salles",
    moduleKey: "salles",
    accent: "cyan",
    description:
      "Creation, edition, consultation et capacite des salles exploitees par le moteur.",
  },
  {
    id: "availabilities",
    name: "Disponibilites",
    moduleKey: "disponibilites",
    accent: "emerald",
    description:
      "Gestion des disponibilites par jour, semaine ou periode et impact automatique sur les cours planifies.",
  },
  {
    id: "student-import",
    name: "Importation etudiants",
    moduleKey: "import-etudiants",
    accent: "rose",
    description:
      "Import Excel, validation des donnees et lecture du resultat d'integration des cohortes.",
  },
  {
    id: "generation-planning",
    name: "Generation & planification",
    moduleKey: "generation",
    accent: "violet",
    description:
      "Generation globale ou ciblee, planification manuelle, reprises et corrections apres calcul.",
  },
  {
    id: "teacher-schedules",
    name: "Horaires professeur",
    moduleKey: "horaires-professeurs",
    accent: "blue",
    description:
      "Visualisation hebdomadaire, navigation par semaine, affectations et exports des horaires enseignants.",
  },
  {
    id: "group-schedules",
    name: "Horaires groupe",
    moduleKey: "horaires-groupes",
    accent: "indigo",
    description:
      "Lecture des horaires de groupe, filtres de recherche et extraction PDF / Excel.",
  },
  {
    id: "student-schedules",
    name: "Horaires etudiant",
    moduleKey: "horaires-etudiants",
    accent: "teal",
    description:
      "Recherche etudiante, simulation d'echange, verification des conflits et export du planning individuel.",
  },
  {
    id: "room-occupancy",
    name: "Occupation des salles",
    moduleKey: "occupation-salles",
    accent: "cyan",
    description:
      "Lecture de l'occupation des salles sur la session complete avec filtres de disponibilite.",
  },
  {
    id: "group-management",
    name: "Gestion des groupes",
    moduleKey: "gestion-groupes",
    accent: "emerald",
    description:
      "Supervision des groupes, mouvements d'etudiants, regeneration ciblee et mise a jour immediate des affectations.",
  },
  {
    id: "session-pilotage",
    name: "Pilotage session",
    moduleKey: "pilotage-session",
    accent: "amber",
    description:
      "Creation et activation des sessions, historique des generations, rapports et recommandations de correction.",
  },
  {
    id: "administration",
    name: "Administration",
    moduleKey: "administration",
    accent: "rose",
    description:
      "Gestion des comptes administratifs et des droits de supervision de la plateforme.",
  },
  {
    id: "troubleshooting",
    name: "Resolution des problemes / FAQ",
    moduleKey: "support",
    accent: "slate",
    description:
      "Questions frequentes, diagnostics de blocage et parcours de resolution rapide.",
  },
];

export const HELP_DOCUMENTS = [
  createDocument({
    id: "doc-dashboard",
    slug: "documentation-dashboard",
    title: "Documentation dashboard",
    description: "Structure de reponse et logique de lecture du tableau de bord.",
    categoryId: "dashboard",
    moduleKey: "dashboard",
    kind: "explication-metier",
    relativePath: "documents/documentation-dashboard.md",
    estimatedMinutes: 6,
    tags: ["dashboard", "indicateurs", "session"],
    keywords: ["dashboard", "overview", "indicateurs", "alertes"],
  }),
  createDocument({
    id: "doc-cours",
    slug: "documentation-gestion-cours",
    title: "Documentation gestion des cours",
    description: "CRUD des cours, validations et contrat API associe.",
    categoryId: "courses",
    moduleKey: "cours",
    kind: "guide-pas-a-pas",
    relativePath: "documents/documentation-gestion-cours.md",
    estimatedMinutes: 8,
    tags: ["cours", "crud", "validation"],
    keywords: ["cours", "ajout", "modification", "consultation"],
  }),
  createDocument({
    id: "doc-professeurs",
    slug: "documentation-gestion-professeurs",
    title: "Documentation gestion des professeurs",
    description: "Regles de gestion et fonctionnement du module enseignants.",
    categoryId: "teachers",
    moduleKey: "professeurs",
    kind: "guide-pas-a-pas",
    relativePath: "documents/documentation-gestion-professeurs.md",
    estimatedMinutes: 8,
    tags: ["professeurs", "specialites", "crud"],
    keywords: ["professeur", "enseignant", "modification", "consultation"],
  }),
  createDocument({
    id: "doc-salles",
    slug: "documentation-salles",
    title: "Documentation salles",
    description: "Regles de salle, types, capacites et lecture de l'occupation.",
    categoryId: "rooms",
    moduleKey: "salles",
    kind: "guide-pas-a-pas",
    relativePath: "documents/documentation-salles.md",
    estimatedMinutes: 7,
    tags: ["salles", "capacite", "occupation"],
    keywords: ["salle", "occupation", "capacite", "type de salle"],
  }),
  createDocument({
    id: "doc-replanification",
    slug: "documentation-replanification-intelligente",
    title: "Documentation replanification intelligente",
    description:
      "Mecanisme automatique de reprise lorsqu'une disponibilite professeur evolue.",
    categoryId: "availabilities",
    moduleKey: "disponibilites",
    kind: "explication-metier",
    relativePath: "documents/documentation-replanification-intelligente.md",
    estimatedMinutes: 7,
    tags: ["disponibilites", "replanification", "automatisation"],
    keywords: ["disponibilite", "replanification", "professeur", "impact"],
  }),
  createDocument({
    id: "doc-import",
    slug: "documentation-import-etudiants",
    title: "Documentation import etudiants",
    description: "Format attendu, controles et lecture du resultat d'import.",
    categoryId: "student-import",
    moduleKey: "import-etudiants",
    kind: "procedure-detaillee",
    relativePath: "documents/documentation-import-etudiants.md",
    estimatedMinutes: 6,
    tags: ["import", "excel", "etudiants"],
    keywords: ["import", "excel", "cohorte", "validation"],
  }),
  createDocument({
    id: "doc-planification",
    slug: "documentation-planification",
    title: "Documentation planification",
    description: "Planification standard, affectations et generation rapide.",
    categoryId: "generation-planning",
    moduleKey: "generation",
    kind: "procedure-detaillee",
    relativePath: "documents/documentation-planification.md",
    estimatedMinutes: 7,
    tags: ["generation", "planification", "affectations"],
    keywords: ["generation", "planning", "programme", "etape"],
  }),
  createDocument({
    id: "doc-planification-manuelle",
    slug: "documentation-planification-manuelle",
    title: "Documentation planification manuelle",
    description: "Creation, edition et suppression de planifications ciblees.",
    categoryId: "generation-planning",
    moduleKey: "generation",
    kind: "guide-pas-a-pas",
    relativePath: "documents/documentation-planification-manuelle.md",
    estimatedMinutes: 7,
    tags: ["manuel", "planning", "reprise"],
    keywords: ["planification manuelle", "creneau", "salle", "duree"],
  }),
  createDocument({
    id: "doc-moteur-intelligent",
    slug: "documentation-moteur-intelligent",
    title: "Documentation moteur intelligent",
    description: "Rapports, blocages, scores de qualite et logique de generation avancee.",
    categoryId: "session-pilotage",
    moduleKey: "pilotage-session",
    kind: "explication-metier",
    relativePath: "documents/documentation-moteur-intelligent.md",
    estimatedMinutes: 8,
    tags: ["moteur", "rapport", "score", "generation"],
    keywords: ["rapport", "generation", "blocage", "recommandations"],
  }),
  createDocument({
    id: "doc-horaires-etudiants",
    slug: "documentation-horaires-etudiants",
    title: "Documentation horaires etudiants",
    description: "Recherche etudiante, consultation d'horaire et lecture metier.",
    categoryId: "student-schedules",
    moduleKey: "horaires-etudiants",
    kind: "guide-pas-a-pas",
    relativePath: "documents/documentation-horaires-etudiants.md",
    estimatedMinutes: 6,
    tags: ["horaire etudiant", "recherche", "export"],
    keywords: ["etudiant", "horaire", "matricule", "groupe", "session"],
  }),
  createDocument({
    id: "doc-echanges-etudiants",
    slug: "documentation-echanges-cours-etudiants",
    title: "Documentation echanges de cours etudiants",
    description:
      "Simulation what-if, conflits et echanges entre etudiants de groupes differents.",
    categoryId: "student-schedules",
    moduleKey: "horaires-etudiants",
    kind: "procedure-detaillee",
    relativePath: "documents/documentation-echanges-cours-etudiants.md",
    estimatedMinutes: 7,
    tags: ["echange", "what-if", "conflits"],
    keywords: ["echange", "simulation", "cours echoue", "conflit"],
  }),
  createDocument({
    id: "doc-groupes",
    slug: "documentation-groupes",
    title: "Documentation groupes",
    description: "Structuration des groupes, mouvements d'etudiants et regeneration ciblee.",
    categoryId: "group-management",
    moduleKey: "gestion-groupes",
    kind: "guide-pas-a-pas",
    relativePath: "documents/documentation-groupes.md",
    estimatedMinutes: 7,
    tags: ["groupes", "regeneration", "affectations"],
    keywords: ["groupe", "groupe frere", "etudiant", "regenerer"],
  }),
  createDocument({
    id: "doc-export",
    slug: "documentation-export",
    title: "Documentation export",
    description: "Exports PDF / Excel disponibles pour les differents horaires.",
    categoryId: "teacher-schedules",
    moduleKey: "export",
    kind: "bonnes-pratiques",
    relativePath: "documents/documentation-export.md",
    estimatedMinutes: 5,
    tags: ["export", "pdf", "excel"],
    keywords: ["export", "pdf", "excel", "horaire"],
  }),
  createDocument({
    id: "doc-admins",
    slug: "documentation-admins",
    title: "Documentation administration",
    description: "Gestion des comptes admin et bonnes pratiques de delegation.",
    categoryId: "administration",
    moduleKey: "administration",
    kind: "guide-pas-a-pas",
    relativePath: "documents/documentation-admins.md",
    estimatedMinutes: 5,
    tags: ["administration", "comptes", "roles"],
    keywords: ["admin", "responsable", "delegation", "droits"],
  }),
  createDocument({
    id: "doc-centre-documentaire",
    slug: "centre-documentaire-projet",
    title: "Centre documentaire du projet",
    description:
      "Point d'entree global vers la documentation, les conceptions, les diagrammes et les guides operatoires du depot.",
    categoryId: "getting-started",
    moduleKey: "onboarding",
    kind: "guide-pas-a-pas",
    relativePath: "documents/README.md",
    estimatedMinutes: 10,
    tags: ["documentation", "projet", "index"],
    keywords: ["readme", "documentation complete", "index documentaire", "projet"],
  }),
  createDocument({
    id: "doc-documentation-complete",
    slug: "documentation-complete-horaires-5",
    title: "Documentation complete Horaires-5",
    description:
      "Vue consolidee du projet pour comprendre les modules, les flux et le perimetre global de la solution.",
    categoryId: "getting-started",
    moduleKey: "onboarding",
    kind: "explication-metier",
    relativePath: "documents/Documentation-complete-horaires-5.md",
    estimatedMinutes: 15,
    tags: ["projet", "vue globale", "architecture", "documentation"],
    keywords: ["horaires-5", "documentation complete", "vue d'ensemble", "fonctionnement"],
  }),
  createDocument({
    id: "doc-installation",
    slug: "guide-installation",
    title: "Guide d'installation",
    description:
      "Procedure de preparation de l'environnement, installation des dependances et lancement local du projet.",
    categoryId: "getting-started",
    moduleKey: "onboarding",
    kind: "procedure-detaillee",
    relativePath: "documents/guide-d'installation.md",
    estimatedMinutes: 6,
    tags: ["installation", "demarrage", "environnement"],
    keywords: ["installer", "lancer le projet", "backend", "frontend"],
  }),
  createDocument({
    id: "doc-tests",
    slug: "guide-tests",
    title: "Guide des tests",
    description:
      "Repere minimal pour verifier rapidement la stabilite du projet et les points de controle essentiels.",
    categoryId: "getting-started",
    moduleKey: "onboarding",
    kind: "bonnes-pratiques",
    relativePath: "documents/guide-tests.md",
    estimatedMinutes: 4,
    tags: ["tests", "verification", "qualite"],
    keywords: ["tests", "verification", "check rapide", "stabilite"],
  }),
  createDocument({
    id: "doc-authentification",
    slug: "documentation-authentification",
    title: "Documentation authentification",
    description:
      "Connexion, session serveur, utilisateur connecte et points de vigilance autour des roles.",
    categoryId: "administration",
    moduleKey: "administration",
    kind: "procedure-detaillee",
    relativePath: "documents/documentation-authentification.md",
    estimatedMinutes: 7,
    tags: ["authentification", "session", "securite"],
    keywords: ["login", "session", "roles", "auth"],
  }),
  createDocument({
    id: "doc-conception-auth",
    slug: "conception-authentification",
    title: "Conception authentification",
    description:
      "Vision fonctionnelle de la connexion, des sessions et du controle d'acces dans la plateforme.",
    categoryId: "administration",
    moduleKey: "administration",
    kind: "explication-metier",
    relativePath: "documents/conception-auth.md",
    estimatedMinutes: 8,
    tags: ["authentification", "conception", "acces"],
    keywords: ["conception auth", "session", "autorisation", "securite"],
  }),
  createDocument({
    id: "doc-roles",
    slug: "gestion-roles",
    title: "Gestion des roles",
    description:
      "Referentiel des roles, responsabilites et droits utilises dans la solution.",
    categoryId: "administration",
    moduleKey: "administration",
    kind: "bonnes-pratiques",
    relativePath: "documents/roles.md",
    estimatedMinutes: 5,
    tags: ["roles", "droits", "responsabilites"],
    keywords: ["admin", "responsable", "role", "autorisation"],
  }),
  createDocument({
    id: "doc-frontend",
    slug: "documentation-frontend",
    title: "Documentation frontend",
    description:
      "Organisation des pages React, des services API et du routage principal de l'interface.",
    categoryId: "getting-started",
    moduleKey: "onboarding",
    kind: "explication-metier",
    relativePath: "documents/documentation-frontend.md",
    estimatedMinutes: 7,
    tags: ["frontend", "react", "routing"],
    keywords: ["frontend", "pages", "react", "services api"],
  }),
  createDocument({
    id: "doc-conception-frontend",
    slug: "conception-frontend",
    title: "Conception frontend",
    description:
      "Lecture fonctionnelle de l'organisation de l'interface et des flux utilisateur.",
    categoryId: "getting-started",
    moduleKey: "onboarding",
    kind: "explication-metier",
    relativePath: "documents/conception-frontend.md",
    estimatedMinutes: 7,
    tags: ["frontend", "conception", "interface"],
    keywords: ["conception frontend", "interface", "navigation", "pages"],
  }),
  createDocument({
    id: "doc-conception-dashboard",
    slug: "conception-dashboard",
    title: "Conception dashboard",
    description:
      "Lecture conceptuelle du tableau de bord, de ses indicateurs et de son role dans le pilotage.",
    categoryId: "dashboard",
    moduleKey: "dashboard",
    kind: "explication-metier",
    relativePath: "documents/conception-dashboard.md",
    estimatedMinutes: 6,
    tags: ["dashboard", "conception", "pilotage"],
    keywords: ["dashboard", "indicateurs", "supervision", "alertes"],
  }),
  createDocument({
    id: "doc-conception-cours",
    slug: "conception-cours",
    title: "Conception des cours",
    description:
      "Structure du module cours, regles pedagogiques et informations exploitees par la planification.",
    categoryId: "courses",
    moduleKey: "cours",
    kind: "explication-metier",
    relativePath: "documents/conception-cours.md",
    estimatedMinutes: 7,
    tags: ["cours", "conception", "pedagogie"],
    keywords: ["conception cours", "programme", "etape", "salle de reference"],
  }),
  createDocument({
    id: "doc-conception-professeurs",
    slug: "conception-professeurs",
    title: "Conception des professeurs",
    description:
      "Modele des enseignants, capacites, cours autorises et interactions avec les disponibilites.",
    categoryId: "teachers",
    moduleKey: "professeurs",
    kind: "explication-metier",
    relativePath: "documents/conception-prof.md",
    estimatedMinutes: 7,
    tags: ["professeurs", "conception", "disponibilites"],
    keywords: ["conception professeurs", "enseignants", "specialites", "cours autorises"],
  }),
  createDocument({
    id: "doc-conception-salles",
    slug: "conception-salles",
    title: "Conception des salles",
    description:
      "Types de salles, capacites, occupation et regles d'usage par le moteur de planification.",
    categoryId: "rooms",
    moduleKey: "salles",
    kind: "explication-metier",
    relativePath: "documents/conception-salles.md",
    estimatedMinutes: 6,
    tags: ["salles", "conception", "capacite"],
    keywords: ["conception salles", "type de salle", "occupation", "capacite"],
  }),
  createDocument({
    id: "doc-conception-groupes",
    slug: "conception-groupes",
    title: "Conception des groupes",
    description:
      "Logique de structuration des groupes, mouvements d'etudiants et regeneration ciblee.",
    categoryId: "group-management",
    moduleKey: "gestion-groupes",
    kind: "explication-metier",
    relativePath: "documents/conception-groupes.md",
    estimatedMinutes: 7,
    tags: ["groupes", "conception", "regeneration"],
    keywords: ["conception groupes", "groupe frere", "deplacement etudiant", "regeneration"],
  }),
  createDocument({
    id: "doc-conception-planification",
    slug: "conception-planification",
    title: "Conception de la planification",
    description:
      "Fonctionnement general de la construction des horaires et des contraintes de base.",
    categoryId: "generation-planning",
    moduleKey: "generation",
    kind: "explication-metier",
    relativePath: "documents/conception-planification.md",
    estimatedMinutes: 8,
    tags: ["planification", "conception", "generation"],
    keywords: ["conception planification", "horaires", "contraintes", "generation"],
  }),
  createDocument({
    id: "doc-conception-planification-manuelle",
    slug: "conception-planification-manuelle",
    title: "Conception de la planification manuelle",
    description:
      "Ajustements manuels, validations immediates et coexistence avec le moteur automatique.",
    categoryId: "generation-planning",
    moduleKey: "generation",
    kind: "explication-metier",
    relativePath: "documents/conception-planification-manuelle.md",
    estimatedMinutes: 8,
    tags: ["planification manuelle", "conception", "correction"],
    keywords: ["conception planification manuelle", "ajustement", "controle", "horaire"],
  }),
  createDocument({
    id: "doc-conception-replanification",
    slug: "conception-replanification-intelligente",
    title: "Conception de la replanification intelligente",
    description:
      "Mecanismes de recalcul local apres changement de disponibilites ou incident de planification.",
    categoryId: "availabilities",
    moduleKey: "disponibilites",
    kind: "explication-metier",
    relativePath: "documents/conception-replanification-intelligente.md",
    estimatedMinutes: 7,
    tags: ["replanification", "conception", "disponibilites"],
    keywords: ["conception replanification", "impact", "professeur", "seances"],
  }),
  createDocument({
    id: "doc-conception-moteur-intelligent",
    slug: "conception-moteur-intelligent",
    title: "Conception du moteur intelligent",
    description:
      "Architecture, pipeline de generation, bootstrap et composants du scheduler academique.",
    categoryId: "session-pilotage",
    moduleKey: "pilotage-session",
    kind: "explication-metier",
    relativePath: "documents/conception-moteur-intelligent.md",
    estimatedMinutes: 12,
    tags: ["moteur", "scheduler", "architecture"],
    keywords: ["moteur intelligent", "scheduler", "pipeline", "bootstrap"],
  }),
  createDocument({
    id: "doc-conception-export",
    slug: "conception-export",
    title: "Conception des exports",
    description:
      "Vue fonctionnelle des sorties PDF et Excel disponibles depuis les vues d'horaires.",
    categoryId: "teacher-schedules",
    moduleKey: "export",
    kind: "explication-metier",
    relativePath: "documents/conception-export.md",
    estimatedMinutes: 5,
    tags: ["export", "conception", "pdf", "excel"],
    keywords: ["conception export", "pdf", "excel", "horaire"],
  }),
];

export const HELP_GUIDES = [
  createGuide({
    id: "guide-onboarding",
    categoryId: "getting-started",
    moduleKey: "onboarding",
    title: "Prendre en main la plateforme en 15 minutes",
    summary:
      "Un parcours court pour comprendre l'ecran d'accueil, les modules et les points d'entree du centre d'aide.",
    objective:
      "Permettre a un nouvel utilisateur administratif de trouver rapidement ses reperes et d'executer ses premieres actions sans assistance technique.",
    prerequisites: [
      "Disposer d'un compte actif.",
      "Connaitre la session ou le programme sur lequel vous travaillez.",
    ],
    steps: [
      "Connectez-vous et verifiez la session visible dans la navigation.",
      "Reperez le dashboard, puis les modules Cours, Professeurs, Salles et Generer.",
      "Ouvrez le Centre d'aide pour retrouver les guides recommandes et les acces rapides.",
      "Choisissez un parcours selon votre objectif: consulter, planifier, corriger ou exporter.",
    ],
    attentionPoints: [
      "Travaillez toujours sur la bonne session avant de lancer une generation.",
      "L'ordre logique reste: donnees de reference, disponibilites, generation, verification, export.",
    ],
    commonErrors: [
      "Lancer une generation sans avoir valide les disponibilites.",
      "Chercher un horaire dans une session non active.",
    ],
    practicalTips: [
      "Epinglez les guides recommandes pour les operations recurrentes.",
      "Utilisez la recherche du Centre d'aide par mot-cle si vous ne connaissez pas le nom exact du module.",
    ],
    level: "debutant",
    estimatedMinutes: 15,
    tags: ["demarrage", "navigation", "dashboard"],
    keywords: ["connexion", "prise en main", "navigation", "parcours"],
    documentIds: ["doc-dashboard"],
    videoSlots: [
      createVideoSlot({
        id: "video-onboarding",
        title: "Connexion et prise en main",
        description:
          "Presentation du portail, des reperes de session et de la navigation de base.",
        durationLabel: "4 min",
        level: "debutant",
        videoSlug: "connexion-prise-en-main",
      }),
    ],
    relatedGuideIds: ["guide-navigation", "guide-dashboard"],
    popularityScore: 98,
  }),
  createGuide({
    id: "guide-navigation",
    categoryId: "getting-started",
    moduleKey: "onboarding",
    title: "Comprendre la navigation et les parcours recommandes",
    summary:
      "Vue d'ensemble des modules et logique de progression pour un utilisateur non technique.",
    objective:
      "Aider l'utilisateur a savoir ou cliquer selon qu'il souhaite preparer les donnees, produire un horaire, verifier un resultat ou corriger un blocage.",
    prerequisites: ["Avoir acces a la navigation principale."],
    steps: [
      "Commencez par les modules de donnees: Cours, Professeurs, Salles et Disponibilites.",
      "Passez ensuite au module Generer pour produire ou corriger la planification.",
      "Controlez les resultats via les horaires Professeur, Groupe, Etudiant et Occupation des salles.",
      "Terminez par l'export ou par un diagnostic dans la FAQ si un blocage persiste.",
    ],
    attentionPoints: [
      "Le module Pilotage session est la reference pour les rapports de generation.",
    ],
    commonErrors: ["Confondre le module Generer avec les vues de consultation d'horaires."],
    practicalTips: [
      "Un administrateur debutant peut suivre le parcours recommande affiche sur la page d'accueil du Centre d'aide.",
    ],
    level: "debutant",
    estimatedMinutes: 8,
    tags: ["navigation", "parcours", "modules"],
    keywords: ["ou cliquer", "module", "apprentissage", "progression"],
    relatedGuideIds: ["guide-onboarding", "guide-generation"],
    popularityScore: 84,
  }),
  createGuide({
    id: "guide-dashboard",
    categoryId: "dashboard",
    moduleKey: "dashboard",
    title: "Lire le dashboard et prioriser les actions",
    summary:
      "Interpretez les indicateurs, les cas particuliers et les groupes a surveiller avant une action metier.",
    objective:
      "Transformer le dashboard en outil de decision rapide pour savoir s'il faut generer, corriger ou exporter.",
    prerequisites: ["Avoir une session active si possible."],
    steps: [
      "Lisez les cartes de synthese pour connaitre le volume de groupes, etudiants, professeurs et salles.",
      "Verifiez la couverture de la session active et le score du dernier rapport de generation.",
      "Analysez les groupes sans horaire et les cas particuliers pour prioriser les corrections.",
      "Utilisez les listes recentes pour acceder rapidement aux modules concernes.",
    ],
    attentionPoints: [
      "Un bon score global n'annule pas l'analyse des cours non planifies.",
    ],
    commonErrors: [
      "Se fier uniquement au score sans regarder les raisons de blocage detaillees.",
    ],
    practicalTips: [
      "Consultez le dashboard avant chaque generation complete et apres chaque correction importante.",
    ],
    level: "debutant",
    estimatedMinutes: 6,
    tags: ["dashboard", "pilotage", "priorisation"],
    keywords: ["indicateurs", "rapport", "session active", "cas particuliers"],
    documentIds: ["doc-dashboard", "doc-moteur-intelligent"],
    videoSlots: [
      createVideoSlot({
        id: "video-dashboard",
        title: "Comprendre le tableau de bord",
        description:
          "Lecture des indicateurs, alertes, groupes a surveiller et resume de session.",
        durationLabel: "3 min",
        level: "debutant",
        videoSlug: "tableau-de-bord",
      }),
    ],
    relatedGuideIds: ["guide-pilotage-session", "guide-diagnostic-generation"],
    popularityScore: 91,
  }),
  createGuide({
    id: "guide-cours",
    categoryId: "courses",
    moduleKey: "cours",
    title: "Ajouter, modifier et consulter les cours proprement",
    summary:
      "Le guide de reference pour preparer des cours exploitables par le moteur de planification.",
    objective:
      "Garantir des fiches cours completes, coherentes et exploitables pour la generation intelligente.",
    prerequisites: [
      "Connaitre le programme, l'etape et le type de salle attendu.",
    ],
    steps: [
      "Ajoutez un cours avec son code, son nom, sa duree, son programme et son etape.",
      "Verifiez le type de salle et corrigez les doublons avant de sauvegarder.",
      "Consultez la liste des cours pour confirmer les informations metier.",
      "Modifiez les champs necessaires si le besoin pedagogique change.",
    ],
    attentionPoints: [
      "Un type de salle incorrect peut empecher la planification du cours.",
      "Une duree incoherente fausse les creneaux proposes par le moteur.",
    ],
    commonErrors: [
      "Creer deux cours avec des codes proches mais non harmonises.",
      "Modifier un cours deja utilise sans mesurer l'impact sur les generations futures.",
    ],
    practicalTips: [
      "Uniformisez les noms et codes avant tout import et avant la generation complete.",
    ],
    level: "debutant",
    estimatedMinutes: 7,
    tags: ["cours", "ajout", "modification", "consultation"],
    keywords: ["ajouter un cours", "modifier un cours", "consulter les cours"],
    documentIds: ["doc-cours"],
    videoSlots: [
      createVideoSlot({
        id: "video-cours",
        title: "Gerer un cours du debut a la validation",
        description:
          "Creation, edition et controle des champs critiques d'un cours.",
        durationLabel: "5 min",
        level: "debutant",
        videoSlug: "gerer-un-cours",
        publicVideoCandidates: [
          "/help/CRUD_COURS.mkv",
          "/help/CRUD_COURS.mp4",
          "/help/COURS.mkv",
          "/help/COURS.mp4",
        ],
      }),
    ],
    relatedGuideIds: ["guide-generation"],
    popularityScore: 88,
  }),
  createGuide({
    id: "guide-professeurs",
    categoryId: "teachers",
    moduleKey: "professeurs",
    title: "Ajouter, modifier et suivre les professeurs",
    summary:
      "Creation des fiches enseignants, modification des informations et lecture de la liste complete.",
    objective:
      "Maintenir des profils professeurs fiables pour faciliter l'affectation et le diagnostic des blocages.",
    prerequisites: ["Disposer du matricule, de la specialite et des informations de contact utiles."],
    steps: [
      "Ajoutez un professeur avec ses informations d'identification et sa specialite.",
      "Mettez a jour la fiche si un programme, un statut ou un parametre academique evolue.",
      "Consultez la liste des professeurs pour verifier l'unicite et la coherence des profils.",
      "Utilisez les filtres de recherche pour retrouver rapidement un enseignant.",
    ],
    attentionPoints: [
      "Les specialites doivent rester coherentes avec les programmes et cours a couvrir.",
    ],
    commonErrors: [
      "Creer un doublon de professeur avec un matricule different.",
      "Oublier de mettre a jour la fiche avant de modifier ses disponibilites.",
    ],
    practicalTips: [
      "Validez les fiches professeurs avant l'ouverture des disponibilites et avant une generation globale.",
    ],
    level: "debutant",
    estimatedMinutes: 7,
    tags: ["professeurs", "ajout", "modification"],
    keywords: ["ajouter un professeur", "modifier un professeur", "consulter les professeurs"],
    documentIds: ["doc-professeurs"],
    videoSlots: [
      createVideoSlot({
        id: "video-professeurs",
        title: "Gerer les profils enseignants",
        description:
          "Creation, modification et verification des donnees professeurs.",
        durationLabel: "4 min",
        level: "debutant",
        videoSlug: "gestion-profils-enseignants",
      }),
    ],
    relatedGuideIds: ["guide-disponibilites", "guide-horaires-professeurs"],
    popularityScore: 85,
  }),
  createGuide({
    id: "guide-salles",
    categoryId: "rooms",
    moduleKey: "salles",
    title: "Ajouter, modifier et consulter les salles",
    summary:
      "Preparation des espaces, capacites et types de salle utilises dans les planifications.",
    objective:
      "Garantir un parc de salles clair, disponible et correctement qualifie pour eviter des refus de generation.",
    prerequisites: ["Connaitre le type, la capacite et les informations de chaque salle."],
    steps: [
      "Ajoutez une salle avec son nom, son type et sa capacite.",
      "Modifiez la salle si sa capacite ou son usage change.",
      "Consultez la liste complete pour corriger les incoherences ou doublons.",
      "Verifiez l'occupation des salles apres generation pour detecter les tensions de capacite.",
    ],
    attentionPoints: [
      "Une capacite trop faible ou un type incorrect bloquent certains placements.",
    ],
    commonErrors: [
      "Conserver une salle archivee comme ressource encore active.",
    ],
    practicalTips: [
      "Standardisez les types de salle utilises par les cours pour limiter les blocages.",
    ],
    level: "debutant",
    estimatedMinutes: 6,
    tags: ["salles", "capacite", "consultation"],
    keywords: ["ajouter une salle", "modifier une salle", "consulter les salles"],
    documentIds: ["doc-salles"],
    videoSlots: [
      createVideoSlot({
        id: "video-salles",
        title: "Gerer les salles et leurs capacites",
        description:
          "Creation, edition et controle des salles exploitees par le moteur.",
        durationLabel: "4 min",
        level: "debutant",
        publicVideoPath: "/help/CRUD_SALLE.mkv",
      }),
    ],
    relatedGuideIds: ["guide-occupation-salles", "guide-generation"],
    popularityScore: 79,
  }),
  createGuide({
    id: "guide-disponibilites",
    categoryId: "availabilities",
    moduleKey: "disponibilites",
    title: "Gerer les disponibilites professeur et la replanification automatique",
    summary:
      "Saisissez les disponibilites par jour, semaine ou periode et comprenez l'effet sur les cours deja planifies.",
    objective:
      "Permettre une mise a jour fiable des contraintes professeurs tout en securisant la replanification des cours impactes.",
    prerequisites: [
      "Le professeur doit exister dans le module Professeurs.",
      "Les periodes et jours vises doivent etre clairement identifies.",
    ],
    steps: [
      "Choisissez le professeur et renseignez ses disponibilites par jour, semaine ou periode.",
      "Enregistrez la modification et laissez le moteur d'automatisation detecter les planifications impactees.",
      "Consultez les cours automatiquement replanifies ou signales comme a corriger.",
      "Controlez l'horaire final du professeur et des groupes concernes.",
    ],
    attentionPoints: [
      "Toute reduction de disponibilite peut forcer un deplacement de cours deja places.",
      "La replanification doit etre revue si plusieurs contraintes changent en cascade.",
    ],
    commonErrors: [
      "Modifier une disponibilite sans verifier l'horaire des groupes lies.",
      "Oublier de recontroler les exports apres replanification.",
    ],
    practicalTips: [
      "Documentez les exceptions temporaires pour distinguer une indisponibilite ponctuelle d'une regle recurrente.",
    ],
    level: "intermediaire",
    estimatedMinutes: 9,
    tags: ["disponibilites", "replanification", "automatisation"],
    keywords: [
      "ajouter disponibilites",
      "changer disponibilite professeur",
      "replanifier automatiquement",
    ],
    documentIds: ["doc-replanification", "doc-professeurs"],
    videoSlots: [
      createVideoSlot({
        id: "video-disponibilites",
        title: "Saisir les disponibilites d'un professeur",
        description:
          "Parametrage des disponibilites et lecture de l'automatisation associee.",
        durationLabel: "5 min",
        level: "intermediaire",
        videoSlug: "saisir-disponibilites",
      }),
    ],
    relatedGuideIds: ["guide-professeurs", "guide-diagnostic-generation"],
    popularityScore: 93,
  }),
  createGuide({
    id: "guide-import-etudiants",
    categoryId: "student-import",
    moduleKey: "import-etudiants",
    title: "Importer les etudiants depuis Excel sans erreur",
    summary:
      "Validez le format du fichier et lisez le bilan d'import pour integrer rapidement une cohorte.",
    objective:
      "Fiabiliser l'import des etudiants et preparer correctement les groupes et les horaires de session.",
    prerequisites: ["Disposer du fichier Excel conforme au format attendu."],
    steps: [
      "Chargez le fichier Excel depuis le module d'importation.",
      "Lancez la validation et corrigez les anomalies signalees avant confirmation.",
      "Consultez le resume d'import pour verifier les effectifs, les groupes et les exclusions.",
      "Poursuivez avec le module Gestion groupes si des ajustements sont necessaires.",
    ],
    attentionPoints: [
      "Les erreurs de groupe, de session ou de programme se propagent ensuite dans les horaires.",
    ],
    commonErrors: [
      "Importer un fichier dans la mauvaise session.",
      "Ignorer les lignes refusees alors qu'elles concernent des etudiants prioritaires.",
    ],
    practicalTips: [
      "Conservez un modele de fichier valide pour les imports recurrentiels.",
    ],
    level: "debutant",
    estimatedMinutes: 6,
    tags: ["import", "excel", "etudiants"],
    keywords: ["importation etudiants", "excel", "cohorte", "validation"],
    documentIds: ["doc-import", "doc-groupes"],
    videoSlots: [
      createVideoSlot({
        id: "video-import",
        title: "Importer une liste d'etudiants",
        description:
          "Controle du fichier Excel, validation et lecture du resultat d'integration.",
        durationLabel: "4 min",
        level: "debutant",
        videoSlug: "importer-etudiants",
      }),
    ],
    relatedGuideIds: ["guide-gestion-groupes"],
    popularityScore: 90,
  }),
  createGuide({
    id: "guide-generation",
    categoryId: "generation-planning",
    moduleKey: "generation",
    title: "Generer un planning complet ou cible et piloter les filtres",
    summary:
      "Generation sur un programme, une etape, tous les programmes ou un groupe cible, avec lecture du resultat.",
    objective:
      "Permettre une generation rapide et fiable selon le bon niveau de granularite, puis controler les sorties produites.",
    prerequisites: [
      "Cours, professeurs, salles et disponibilites doivent etre suffisamment prepares.",
      "La session doit etre active si vous travaillez sur une generation globale.",
    ],
    steps: [
      "Choisissez le niveau de generation: programme + etape, tous les programmes ou groupe specifique.",
      "Lancez la generation et surveillez les cours planifies, non planifies et les recommandations produites.",
      "Affinez la lecture via les filtres par groupe, programme, session ou autre critere.",
      "Si besoin, basculez vers une correction manuelle ou une regeneration ciblee.",
    ],
    attentionPoints: [
      "Une generation globale doit etre reservee a une base de reference stabilisee.",
      "Un groupe cible permet de corriger sans perturber toute la session.",
    ],
    commonErrors: [
      "Relancer une generation complete pour corriger un seul groupe.",
      "Ignorer les blocages detailles avant d'ajuster les donnees source.",
    ],
    practicalTips: [
      "Commencez par une generation ciblee lors des demonstrations pour montrer la precision du moteur.",
    ],
    level: "intermediaire",
    estimatedMinutes: 10,
    tags: ["generation", "planification", "filtres", "groupe"],
    keywords: [
      "generation complete",
      "generation programme",
      "generation groupe specifique",
      "filtres",
    ],
    documentIds: [
      "doc-planification",
      "doc-moteur-intelligent",
      "doc-export",
    ],
    videoSlots: [
      createVideoSlot({
        id: "video-generation",
        title: "Generer un planning complet ou cible",
        description:
          "Choix du perimetre de generation et lecture du resultat produit.",
        durationLabel: "6 min",
        level: "intermediaire",
        videoSlug: "generer-un-planning",
      }),
    ],
    relatedGuideIds: [
      "guide-planification-manuelle",
      "guide-pilotage-session",
      "guide-diagnostic-generation",
    ],
    popularityScore: 97,
  }),
  createGuide({
    id: "guide-planification-manuelle",
    categoryId: "generation-planning",
    moduleKey: "generation",
    title: "Planifier manuellement un cours ou une reprise apres generation",
    summary:
      "Choisissez groupe, salle, creneau, duree et horizon de planification pour completer ou corriger le calcul automatique.",
    objective:
      "Rendre les corrections rapides, controlees et pedagogiquement lisibles apres une generation initiale.",
    prerequisites: [
      "Identifier le groupe, la salle et le professeur concernes.",
      "Connaitre la duree et la plage hebdomadaire souhaites.",
    ],
    steps: [
      "Selectionnez la cible: reprise etudiant ou cours a planifier manuellement.",
      "Choisissez groupe, salle, creneau, duree et horizon: une semaine, plusieurs semaines ou fin de session.",
      "Validez la planification puis consultez la liste de toutes les planifications deja creees.",
      "Modifiez ou supprimez la planification si la simulation met en evidence une meilleure option.",
    ],
    attentionPoints: [
      "Les planifications manuelles doivent rester compatibles avec les conflits de ressources existants.",
    ],
    commonErrors: [
      "Planifier sans verifier l'occupation de salle sur toute la periode selectionnee.",
      "Creer une correction temporaire alors qu'une solution jusqu'a la fin de session est requise.",
    ],
    practicalTips: [
      "Utilisez la vue liste des planifications pour documenter clairement chaque correction lors d'une soutenance.",
    ],
    level: "intermediaire",
    estimatedMinutes: 9,
    tags: ["manuel", "reprise", "correction"],
    keywords: [
      "planification manuelle",
      "reprise etudiant",
      "modifier planification",
      "supprimer planification",
    ],
    documentIds: ["doc-planification-manuelle", "doc-planification"],
    videoSlots: [
      createVideoSlot({
        id: "video-planification-manuelle",
        title: "Planification manuelle et reprise etudiant",
        description:
          "Creation, edition et suppression d'une correction manuelle.",
        durationLabel: "5 min",
        level: "intermediaire",
        videoSlug: "planification-manuelle",
      }),
    ],
    relatedGuideIds: ["guide-generation", "guide-horaires-etudiants"],
    popularityScore: 92,
  }),
  createGuide({
    id: "guide-horaires-professeurs",
    categoryId: "teacher-schedules",
    moduleKey: "horaires-professeurs",
    title: "Consulter l'horaire d'un professeur et exporter proprement",
    summary:
      "Choisissez un enseignant, naviguez par semaine et exportez le rendu en PDF ou Excel.",
    objective:
      "Obtenir rapidement la vue hebdomadaire d'un professeur et partager un export propre pour validation.",
    prerequisites: ["Le professeur doit etre affecte ou au moins present dans la base."],
    steps: [
      "Selectionnez le professeur dans la recherche dediee.",
      "Consultez sa grille hebdomadaire sur 7 jours et naviguez entre les semaines.",
      "Verifiez les planifications attribuees et leur repartition temporelle.",
      "Exportez au format PDF ou Excel si un partage est requis.",
    ],
    attentionPoints: [
      "Une semaine sans planification ne signifie pas forcement une absence sur toute la session.",
    ],
    commonErrors: [
      "Exporter sans avoir choisi la bonne semaine ou le bon professeur.",
    ],
    practicalTips: [
      "Utilisez la navigation hebdomadaire pendant une demonstration pour montrer la lisibilite de la grille.",
    ],
    level: "debutant",
    estimatedMinutes: 6,
    tags: ["horaire professeur", "export", "grille"],
    keywords: ["choisir professeur", "visualiser horaire", "pdf", "excel"],
    documentIds: ["doc-export", "doc-professeurs"],
    videoSlots: [
      createVideoSlot({
        id: "video-horaires-professeurs",
        title: "Consulter les horaires d'un professeur",
        description:
          "Recherche enseignant, navigation hebdomadaire et exports.",
        durationLabel: "4 min",
        level: "debutant",
        videoSlug: "consulter-horaires-professeur",
      }),
    ],
    relatedGuideIds: ["guide-professeurs", "guide-disponibilites"],
    popularityScore: 86,
  }),
  createGuide({
    id: "guide-horaires-groupes",
    categoryId: "group-schedules",
    moduleKey: "horaires-groupes",
    title: "Visualiser l'horaire d'un groupe et filtrer efficacement",
    summary:
      "Accedez a l'horaire d'un groupe, appliquez des filtres et exportez le resultat.",
    objective:
      "Permettre une consultation rapide des plannings de groupe pour les operations de suivi pedagogique.",
    prerequisites: ["Disposer du groupe ou du programme a rechercher."],
    steps: [
      "Recherchez le groupe vise puis ouvrez sa grille horaire.",
      "Affinez par programme, session ou autres filtres disponibles.",
      "Consultez les planifications existantes sur la semaine ou la periode choisie.",
      "Exportez en PDF ou Excel si un support externe est necessaire.",
    ],
    attentionPoints: [
      "Les filtres de session et de programme doivent rester alignes avec le groupe selectionne.",
    ],
    commonErrors: [
      "Interpretrer une grille vide alors que le filtre de session est incorrect.",
    ],
    practicalTips: [
      "Combinez cette vue avec Gestion groupes pour valider l'impact d'un mouvement d'etudiant.",
    ],
    level: "debutant",
    estimatedMinutes: 5,
    tags: ["horaire groupe", "filtres", "export"],
    keywords: ["horaire groupe", "filtres recherche", "pdf", "excel"],
    documentIds: ["doc-export", "doc-groupes"],
    videoSlots: [
      createVideoSlot({
        id: "video-horaires-groupes",
        title: "Consulter les horaires d'un groupe",
        description:
          "Lecture du planning hebdomadaire et controle par filtres.",
        durationLabel: "4 min",
        level: "debutant",
        videoSlug: "consulter-horaires-groupe",
      }),
    ],
    relatedGuideIds: ["guide-generation", "guide-gestion-groupes"],
    popularityScore: 83,
  }),
  createGuide({
    id: "guide-horaires-etudiants",
    categoryId: "student-schedules",
    moduleKey: "horaires-etudiants",
    title: "Rechercher un etudiant, lire son horaire et simuler un echange",
    summary:
      "Recherche multicritere, export individuel et operation speciale d'implantation ou d'echange entre etudiants.",
    objective:
      "Donner une vision individuelle complete de l'etudiant, y compris les conflits, cours echoues et simulations what-if.",
    prerequisites: [
      "Connaitre au moins un critere de recherche: nom, prenom, matricule, groupe, session ou etape.",
    ],
    steps: [
      "Recherchez l'etudiant via nom, prenom, matricule, groupe, session ou etape.",
      "Consultez son horaire et exportez-le en PDF ou Excel si necessaire.",
      "Lancez une simulation what-if si vous devez implanter ou echanger un cours entre deux etudiants.",
      "Analysez immediatement la reponse du systeme pour savoir si l'operation est possible ou refusee.",
    ],
    attentionPoints: [
      "Les cours echoues et les conflits existants doivent etre pris en compte avant toute implantation.",
      "Une simulation acceptable doit etre revue avant application definitive.",
    ],
    commonErrors: [
      "Chercher un etudiant avec un filtre de session incomplet.",
      "Appliquer un echange sans lire le diagnostic de conflits associe.",
    ],
    practicalTips: [
      "Pendant une demonstration, montrez toujours la difference entre simulation et application.",
    ],
    level: "avance",
    estimatedMinutes: 10,
    tags: ["horaire etudiant", "simulation", "echange", "export"],
    keywords: [
      "horaire etudiant",
      "simulation what-if",
      "echange entre etudiants",
      "cours echoues",
    ],
    documentIds: [
      "doc-horaires-etudiants",
      "doc-echanges-etudiants",
      "doc-export",
    ],
    videoSlots: [
      createVideoSlot({
        id: "video-horaires-etudiants",
        title: "Visualiser et corriger l'horaire etudiant",
        description:
          "Recherche multicritere, export et simulation d'echange.",
        durationLabel: "6 min",
        level: "avance",
        videoSlug: "horaires-etudiants-what-if",
      }),
    ],
    relatedGuideIds: ["guide-planification-manuelle", "guide-gestion-groupes"],
    popularityScore: 95,
  }),
  createGuide({
    id: "guide-occupation-salles",
    categoryId: "room-occupancy",
    moduleKey: "occupation-salles",
    title: "Verifier l'occupation des salles en temps reel sur la session",
    summary:
      "Suivez les salles disponibles ou saturees et utilisez les filtres pour preparer une correction.",
    objective:
      "Disposer d'une lecture claire des tensions de salle avant une generation, une correction manuelle ou un export.",
    prerequisites: ["Les salles doivent etre correctement parametrees."],
    steps: [
      "Ouvrez la vue d'occupation des salles sur la session active.",
      "Utilisez les filtres pour cibler un type de salle, une capacite ou une plage specifique.",
      "Reperez les salles sur-utilisees ou les creux exploitables.",
      "Reutilisez cette information dans Generer ou en planification manuelle.",
    ],
    attentionPoints: [
      "Une salle libre ponctuellement n'est pas forcement libre sur toute la serie de semaines voulue.",
    ],
    commonErrors: [
      "Choisir une salle sans verifier la continuite sur plusieurs semaines.",
    ],
    practicalTips: [
      "Croisez cette vue avec les cours non planifies pour identifier rapidement un blocage capacitaire.",
    ],
    level: "intermediaire",
    estimatedMinutes: 6,
    tags: ["occupation", "salles", "session"],
    keywords: ["occupation salles", "temps reel", "filtres", "capacite"],
    documentIds: ["doc-salles"],
    videoSlots: [
      createVideoSlot({
        id: "video-occupation-salles",
        title: "Consulter l'occupation des salles",
        description:
          "Lecture de la disponibilite des salles sur toute la session.",
        durationLabel: "4 min",
        level: "intermediaire",
        videoSlug: "occupation-salles",
      }),
    ],
    relatedGuideIds: ["guide-salles", "guide-planification-manuelle"],
    popularityScore: 81,
  }),
  createGuide({
    id: "guide-gestion-groupes",
    categoryId: "group-management",
    moduleKey: "gestion-groupes",
    title: "Superviser les groupes et deplacer un etudiant proprement",
    summary:
      "Consultez les groupes, deplacez un etudiant vers un groupe frere, regenerez uniquement ce groupe et actualisez l'horaire immediatement.",
    objective:
      "Permettre des ajustements fins de groupe sans destabiliser toute la session.",
    prerequisites: [
      "Disposer du groupe source, du groupe cible et du contexte de session.",
    ],
    steps: [
      "Consultez tous les groupes puis ouvrez la liste des etudiants d'un groupe.",
      "Ajoutez un groupe manuellement si une nouvelle structure est requise.",
      "Testez le deplacement d'un etudiant vers un groupe frere en verifiant conflits, chevauchements et cours echoues.",
      "Ajoutez un etudiant manuellement ou regenerez l'horaire uniquement pour le groupe concerne.",
    ],
    attentionPoints: [
      "Un deplacement de groupe doit recalculer les affectations et l'horaire de l'etudiant sans casser l'equilibre du groupe cible.",
    ],
    commonErrors: [
      "Deplacer un etudiant sans relire ses cours echoues ou ses conflits existants.",
    ],
    practicalTips: [
      "Utilisez la regeneration ciblee comme geste de correction privilegie pour un seul groupe.",
    ],
    level: "avance",
    estimatedMinutes: 9,
    tags: ["groupes", "deplacement", "regeneration"],
    keywords: [
      "voir tous les groupes",
      "deplacer etudiant",
      "groupe frere",
      "regenerer groupe",
    ],
    documentIds: ["doc-groupes", "doc-horaires-etudiants"],
    videoSlots: [
      createVideoSlot({
        id: "video-gestion-groupes",
        title: "Gerer la structure des groupes",
        description:
          "Consultation des groupes, mouvements d'etudiants et regeneration ciblee.",
        durationLabel: "5 min",
        level: "avance",
        videoSlug: "gestion-groupes",
      }),
    ],
    relatedGuideIds: ["guide-horaires-groupes", "guide-horaires-etudiants"],
    popularityScore: 94,
  }),
  createGuide({
    id: "guide-pilotage-session",
    categoryId: "session-pilotage",
    moduleKey: "pilotage-session",
    title: "Creer une session, lancer la generation et lire le rapport detaille",
    summary:
      "Pilotage de session, historique des generations, scores globaux et blocages explicites.",
    objective:
      "Donner une vue de pilotage professionnelle sur la preparation d'une session et la qualite des generations produites.",
    prerequisites: [
      "Disposer des droits de pilotage.",
      "Les modules de reference doivent etre suffisamment renseignes.",
    ],
    steps: [
      "Creez la session puis activez-la pour en faire le contexte de travail.",
      "Basculez entre les sessions si vous comparez plusieurs periodes academiques.",
      "Lancez la generation complete puis consultez l'historique des generations.",
      "Analysez le rapport detaille: scores etudiant, professeur, groupe, cours non planifies et recommandations.",
    ],
    attentionPoints: [
      "Les rapports doivent etre conserves comme trace de pilotage et de soutenance.",
      "Les blocages detailles orientent les corrections prioritaires: salle manquante, professeur indisponible, etc.",
    ],
    commonErrors: [
      "Lancer une generation complete sans avoir active la bonne session.",
      "Ne pas exploiter les recommandations avant une nouvelle tentative.",
    ],
    practicalTips: [
      "En demonstration, montrez la chronologie: creation de session, generation, lecture du rapport, correction.",
    ],
    level: "intermediaire",
    estimatedMinutes: 8,
    tags: ["session", "rapport", "scores", "historique"],
    keywords: [
      "creer session",
      "activer session",
      "historique generations",
      "rapport detaille",
    ],
    documentIds: ["doc-moteur-intelligent", "doc-dashboard"],
    videoSlots: [
      createVideoSlot({
        id: "video-pilotage-session",
        title: "Piloter une session de generation",
        description:
          "Activation de session, historique et rapport detaille de generation.",
        durationLabel: "5 min",
        level: "intermediaire",
        videoSlug: "pilotage-session-generation",
      }),
    ],
    relatedGuideIds: ["guide-generation", "guide-diagnostic-generation"],
    popularityScore: 89,
  }),
  createGuide({
    id: "guide-administration",
    categoryId: "administration",
    moduleKey: "administration",
    title: "Ajouter et modifier des comptes administratifs",
    summary:
      "Gestion des sous-admins et maintien d'une administration propre et tracable.",
    objective:
      "Permettre une delegation securisee de l'administration sans perte de lisibilite sur les droits accordes.",
    prerequisites: ["Disposer des droits de responsable ou d'administration centrale."],
    steps: [
      "Ajoutez un compte admin avec les informations d'identification requises.",
      "Modifiez les donnees du compte si un role ou une responsabilite change.",
      "Verifiez la coherence des droits avant de partager l'acces.",
      "Documentez les changements importants dans votre procedure interne.",
    ],
    attentionPoints: [
      "Les droits d'administration doivent rester limites aux besoins reels.",
    ],
    commonErrors: [
      "Conserver un compte admin obselete ou mal documente.",
    ],
    practicalTips: [
      "Gardez une convention de nommage et de responsabilite pour les sous-admins.",
    ],
    level: "intermediaire",
    estimatedMinutes: 5,
    tags: ["administration", "comptes", "roles"],
    keywords: ["ajout admin", "modification admin", "sous-admin"],
    documentIds: ["doc-admins"],
    videoSlots: [
      createVideoSlot({
        id: "video-administration",
        title: "Gerer les comptes administratifs",
        description:
          "Ajout, edition et verification des comptes admin et responsable.",
        durationLabel: "3 min",
        level: "intermediaire",
        videoSlug: "gestion-admins",
      }),
    ],
    relatedGuideIds: ["guide-onboarding"],
    popularityScore: 73,
  }),
  createGuide({
    id: "guide-vision-projet",
    categoryId: "getting-started",
    moduleKey: "onboarding",
    title: "Comprendre le projet Horaires-5 et ses grands modules",
    summary:
      "Une vue d'ensemble claire pour comprendre a quoi sert chaque module, dans quel ordre travailler et ou trouver la bonne documentation.",
    objective:
      "Permettre a un membre de l'equipe de comprendre rapidement le perimetre du projet, ses flux principaux et les documents de reference utiles.",
    prerequisites: [
      "Avoir acces au centre d'aide ou au depot documentaire.",
    ],
    steps: [
      "Commencez par le centre documentaire pour visualiser les grandes familles de documents du projet.",
      "Lisez ensuite la documentation complete pour obtenir une vue consolidee des modules et du perimetre produit.",
      "Reperez l'ordre d'utilisation metier: dashboard, donnees de reference, disponibilites, generation, verification, export.",
      "Approfondissez ensuite chaque domaine via les documentations module par module ou les conceptions techniques.",
    ],
    attentionPoints: [
      "Toutes les pages n'ont pas le meme role: certaines gerent les referentiels, d'autres pilotent les generations ou les corrections.",
      "Les fichiers `documents/` decrivent le fonctionnement global; le centre d'aide sert de point d'entree guide.",
    ],
    commonErrors: [
      "Chercher une fonctionnalite detaillee sans avoir identifie d'abord le bon module metier.",
      "Melanger le CRUD standard des horaires avec le scheduler academique et ses rapports.",
    ],
    practicalTips: [
      "Utilisez ce guide comme porte d'entree quand vous devez onboarder un nouveau collaborateur.",
      "Gardez le README documentaire et la documentation complete comme references transverses.",
    ],
    level: "debutant",
    estimatedMinutes: 10,
    tags: ["projet", "vue globale", "documentation", "modules"],
    keywords: ["comprendre le projet", "comment fonctionne le projet", "vue d'ensemble", "horaires-5"],
    documentIds: [
      "doc-centre-documentaire",
      "doc-documentation-complete",
      "doc-installation",
      "doc-frontend",
    ],
    videoSlots: [
      createVideoSlot({
        id: "video-vision-projet",
        title: "Presentation generale du projet",
        description:
          "Vue d'ensemble des modules, de la navigation et de l'ordre logique de travail.",
        durationLabel: "6 min",
        level: "debutant",
      }),
    ],
    relatedGuideIds: ["guide-onboarding", "guide-dashboard", "guide-generation"],
    popularityScore: 92,
  }),
  createGuide({
    id: "guide-architecture-scheduler",
    categoryId: "session-pilotage",
    moduleKey: "pilotage-session",
    title: "Comprendre le scheduler academique et le pipeline de generation",
    summary:
      "Un guide de lecture du moteur intelligent pour relier routes, pages, bootstrap, rapports et contraintes reelles.",
    objective:
      "Donner une vision claire du fonctionnement du scheduler academique afin de mieux diagnostiquer une generation, une reprise ou une replanification locale.",
    prerequisites: [
      "Connaitre les modules Cours, Professeurs, Salles et Disponibilites.",
      "Avoir deja consulte au moins une generation ou un rapport.",
    ],
    steps: [
      "Lisez la conception du moteur intelligent pour comprendre le pipeline complet du scheduler.",
      "Reliez ensuite cette conception a la documentation d'exploitation du moteur pour voir les endpoints, rapports et preconditions.",
      "Passez par les documentations de planification standard et manuelle pour distinguer generation globale et correction locale.",
      "Utilisez enfin les guides de diagnostic pour transformer les blocages en plan d'action concret.",
    ],
    attentionPoints: [
      "Le scheduler academique ne doit pas etre confondu avec les operations CRUD classiques exposees sous les autres modules.",
      "Le bootstrap aide le moteur, mais ne remplace pas une bonne qualite des donnees de reference.",
    ],
    commonErrors: [
      "Chercher un bug de generation sans verifier les preconditions metier de la session cible.",
      "Relancer une generation complete alors qu'une regeneration ciblee ou une correction manuelle suffirait.",
    ],
    practicalTips: [
      "Appuyez-vous sur le rapport de generation comme document de travail, pas comme simple log technique.",
      "Combinez ce guide avec les modules Disponibilites et Gestion groupes pour comprendre les impacts de correction.",
    ],
    level: "avance",
    estimatedMinutes: 12,
    tags: ["scheduler", "moteur", "generation", "architecture"],
    keywords: ["comment fonctionne le scheduler", "pipeline generation", "moteur intelligent", "rapport generation"],
    documentIds: [
      "doc-conception-moteur-intelligent",
      "doc-moteur-intelligent",
      "doc-conception-planification",
      "doc-planification",
      "doc-conception-planification-manuelle",
      "doc-planification-manuelle",
    ],
    videoSlots: [
      createVideoSlot({
        id: "video-architecture-scheduler",
        title: "Lire le pipeline du scheduler",
        description:
          "Bootstrap, chargement de contexte, generation, rapports et diagnostics de sortie.",
        durationLabel: "8 min",
        level: "avance",
      }),
    ],
    relatedGuideIds: [
      "guide-generation",
      "guide-pilotage-session",
      "guide-diagnostic-generation",
    ],
    popularityScore: 90,
  }),
  createGuide({
    id: "guide-securite-acces",
    categoryId: "administration",
    moduleKey: "administration",
    title: "Comprendre les acces, les sessions et les roles du projet",
    summary:
      "Un guide transversal pour comprendre qui peut faire quoi, comment les sessions fonctionnent et quels documents utiliser pour auditer les acces.",
    objective:
      "Fiabiliser la gestion des droits d'acces et permettre a l'equipe de savoir ou verifier la logique d'authentification et de delegation.",
    prerequisites: [
      "Disposer d'un acces au module administration ou aux documents techniques du projet.",
    ],
    steps: [
      "Commencez par le referentiel des roles pour identifier les responsabilites reelles de chaque profil.",
      "Poursuivez avec la documentation authentification pour comprendre la session serveur et le comportement de connexion.",
      "Lisez ensuite la conception auth pour voir la logique attendue de controle d'acces.",
      "Completez avec la documentation administration pour cadrer la delegation des comptes.",
    ],
    attentionPoints: [
      "Les droits metier doivent rester alignes avec les besoins reels et la gouvernance de l'etablissement.",
      "Les documents d'authentification et d'administration se completent: l'un traite la session, l'autre la delegation.",
    ],
    commonErrors: [
      "Donner trop de droits par confort au lieu de documenter une vraie responsabilite.",
      "Diagnostiquer un probleme de role sans verifier d'abord la structure de session et l'utilisateur connecte.",
    ],
    practicalTips: [
      "Gardez ce guide comme reference quand vous onboardez un nouvel administrateur ou un responsable.",
      "Utilisez les documents relies pour preparer des revues d'acces plus propres.",
    ],
    level: "intermediaire",
    estimatedMinutes: 8,
    tags: ["administration", "authentification", "roles", "droits"],
    keywords: ["roles", "session", "droits acces", "authentification"],
    documentIds: [
      "doc-roles",
      "doc-authentification",
      "doc-conception-auth",
      "doc-admins",
    ],
    videoSlots: [
      createVideoSlot({
        id: "video-securite-acces",
        title: "Verifier les acces et la delegation",
        description:
          "Roles, session et delegation d'administration en pratique.",
        durationLabel: "4 min",
        level: "intermediaire",
      }),
    ],
    relatedGuideIds: ["guide-administration", "guide-vision-projet"],
    popularityScore: 81,
  }),
  createGuide({
    id: "guide-diagnostic-generation",
    categoryId: "troubleshooting",
    moduleKey: "support",
    title: "Diagnostiquer une generation echouee ou un cours non planifie",
    summary:
      "Interpretez les rapports et remontez rapidement a la vraie cause du blocage.",
    objective:
      "Transformer les messages de blocage en plan d'action clair pour corriger la donnee source, la disponibilite ou la ressource manquante.",
    prerequisites: ["Disposer du rapport de generation ou d'un cours signale comme non planifie."],
    steps: [
      "Ouvrez le rapport detaille de generation et reperez les cours non planifies.",
      "Lisez la cause principale: salle manquante, indisponibilite professeur, conflit de groupe ou manque de creneau.",
      "Retournez dans le module source pour corriger la cause la plus probable.",
      "Relancez une generation ciblee ou une correction manuelle selon l'impact attendu.",
    ],
    attentionPoints: [
      "Un meme cours peut etre bloque par plusieurs contraintes simultanees.",
    ],
    commonErrors: [
      "Corriger le symptome au lieu de la cause racine.",
      "Relancer immediatement une generation complete sans verification ciblee.",
    ],
    practicalTips: [
      "Documentez les blocages recurrents pour enrichir votre FAQ metier.",
    ],
    level: "avance",
    estimatedMinutes: 8,
    tags: ["faq", "blocage", "rapport", "non planifie"],
    keywords: [
      "generation echoue",
      "cours non planifie",
      "blocage",
      "diagnostic",
    ],
    documentIds: [
      "doc-moteur-intelligent",
      "doc-planification",
      "doc-replanification",
    ],
    videoSlots: [
      createVideoSlot({
        id: "video-diagnostic",
        title: "Comprendre pourquoi une generation a echoue",
        description:
          "Lecture du rapport detaille, des scores et des causes de blocage.",
        durationLabel: "5 min",
        level: "avance",
        videoSlug: "diagnostiquer-generation-echouee",
      }),
    ],
    relatedGuideIds: ["guide-generation", "guide-pilotage-session"],
    popularityScore: 96,
  }),
];

export const HELP_FAQS = [
  createFaq({
    id: "faq-generation-echoue",
    categoryId: "troubleshooting",
    moduleKey: "generation",
    title: "Pourquoi une generation echoue ?",
    summary:
      "Les causes les plus frequentes sont une ressource manquante, une indisponibilite professeur ou un conflit de groupe.",
    answer:
      "Commencez par ouvrir le rapport detaille. Le blocage principal est generalement explicite: salle indisponible, capacite insuffisante, professeur hors plage ou conflit de groupe. Corrigez d'abord la cause racine, puis relancez une generation ciblee pour verifier l'effet de votre correction.",
    level: "intermediaire",
    tags: ["generation", "blocage", "rapport"],
    keywords: ["generation echoue", "blocage", "rapport detaille"],
    relatedGuideIds: ["guide-diagnostic-generation", "guide-pilotage-session"],
    relatedDocumentIds: ["doc-moteur-intelligent", "doc-planification"],
  }),
  createFaq({
    id: "faq-cours-non-planifie",
    categoryId: "troubleshooting",
    moduleKey: "generation",
    title: "Pourquoi un cours n'est pas planifie ?",
    summary:
      "Le moteur n'a pas trouve de combinaison compatible entre professeur, salle, groupe et creneau.",
    answer:
      "Verifiez d'abord le type de salle demande, la duree du cours, la disponibilite du professeur et les conflits du groupe. Si tous ces elements sont corrects, analysez l'occupation des salles et les recommandations du rapport. Une correction manuelle peut aussi etre la meilleure option si le cas est tres specifique.",
    level: "intermediaire",
    tags: ["cours non planifie", "contrainte", "correction"],
    keywords: ["cours non planifie", "type de salle", "duree", "conflit"],
    relatedGuideIds: ["guide-diagnostic-generation", "guide-planification-manuelle"],
    relatedDocumentIds: ["doc-planification", "doc-salles"],
  }),
  createFaq({
    id: "faq-professeur-indisponible",
    categoryId: "troubleshooting",
    moduleKey: "disponibilites",
    title: "Que faire si un professeur devient indisponible ?",
    summary:
      "Mettre a jour sa disponibilite puis verifier les cours replanifies ou a reprendre.",
    answer:
      "Modifiez la disponibilite sur la bonne plage temporelle. Le mecanisme de replanification identifie ensuite les cours impactes. Controlez les horaires professeur et groupe, puis appliquez si necessaire une correction manuelle pour les cas qui ne peuvent pas etre replanifies automatiquement.",
    level: "intermediaire",
    tags: ["professeur", "indisponibilite", "replanification"],
    keywords: ["professeur indisponible", "changer disponibilite", "impact cours"],
    relatedGuideIds: ["guide-disponibilites", "guide-horaires-professeurs"],
    relatedDocumentIds: ["doc-replanification"],
  }),
  createFaq({
    id: "faq-corriger-conflit",
    categoryId: "troubleshooting",
    moduleKey: "support",
    title: "Comment corriger un conflit ?",
    summary:
      "Identifiez d'abord la ressource en conflit, puis choisissez entre correction source, regeneration ciblee ou planification manuelle.",
    answer:
      "Un conflit peut concerner une salle, un professeur, un groupe ou un etudiant. La bonne pratique consiste a isoler le conflit, corriger la donnee source si elle est erronee, puis relancer uniquement le perimetre touche. Si le cas reste exceptionnel, utilisez la planification manuelle ou la simulation what-if selon le contexte.",
    level: "avance",
    tags: ["conflit", "correction", "what-if"],
    keywords: ["corriger conflit", "replanification", "simulation"],
    relatedGuideIds: [
      "guide-planification-manuelle",
      "guide-horaires-etudiants",
      "guide-gestion-groupes",
    ],
    relatedDocumentIds: ["doc-echanges-etudiants", "doc-groupes"],
  }),
  createFaq({
    id: "faq-exporter-horaire",
    categoryId: "troubleshooting",
    moduleKey: "export",
    title: "Comment exporter un horaire ?",
    summary:
      "Les vues professeur, groupe et etudiant exposent un export PDF ou Excel une fois la bonne recherche appliquee.",
    answer:
      "Commencez par selectionner le bon professeur, groupe ou etudiant, puis appliquez vos filtres de session et de semaine. Une fois la vue correcte, declenchez l'export PDF ou Excel. Si le rendu parait vide, reverifiez d'abord les filtres actifs.",
    level: "debutant",
    tags: ["export", "pdf", "excel"],
    keywords: ["exporter horaire", "pdf", "excel"],
    relatedGuideIds: [
      "guide-horaires-professeurs",
      "guide-horaires-groupes",
      "guide-horaires-etudiants",
    ],
    relatedDocumentIds: ["doc-export"],
  }),
  createFaq({
    id: "faq-planifier-manuellement",
    categoryId: "troubleshooting",
    moduleKey: "generation",
    title: "Comment planifier manuellement ?",
    summary:
      "Utilisez le module Generer pour creer une correction ciblee avec groupe, salle, creneau et horizon de repetion.",
    answer:
      "Selectionnez le cas a traiter, puis renseignez groupe, salle, creneau, duree et periode d'application. Avant validation, verifiez l'occupation des salles et les conflits du professeur ou du groupe. Une fois la correction creee, relisez la liste complete des planifications manuelles pour garder une tracabilite claire.",
    level: "intermediaire",
    tags: ["manuel", "planification", "correction"],
    keywords: ["planifier manuellement", "creneau", "duree", "groupe"],
    relatedGuideIds: ["guide-planification-manuelle", "guide-occupation-salles"],
    relatedDocumentIds: ["doc-planification-manuelle"],
  }),
  createFaq({
    id: "faq-simuler-echange",
    categoryId: "troubleshooting",
    moduleKey: "horaires-etudiants",
    title: "Comment simuler un echange entre etudiants ?",
    summary:
      "La simulation what-if controle immediatement faisabilite, conflits et cours echoues avant application.",
    answer:
      "Recherchez les deux etudiants concernes, choisissez le cours a implanter ou a echanger, puis lancez la simulation. Le systeme indique tout de suite si l'operation est possible ou refusee et detaille les conflits. N'appliquez la modification definitive qu'apres lecture de cette simulation.",
    level: "avance",
    tags: ["echange", "simulation", "etudiants"],
    keywords: ["simuler echange", "what-if", "etudiants"],
    relatedGuideIds: ["guide-horaires-etudiants"],
    relatedDocumentIds: ["doc-echanges-etudiants"],
  }),
  createFaq({
    id: "faq-interpreter-rapport",
    categoryId: "troubleshooting",
    moduleKey: "pilotage-session",
    title: "Comment interpreter le rapport de generation ?",
    summary:
      "Le rapport donne des scores globaux et les vraies raisons des cours non planifies.",
    answer:
      "Lisez d'abord les scores globaux pour comprendre la qualite generale du resultat. Descendez ensuite sur les cours non planifies et les recommandations. Les blocages explicitent la vraie cause metier: salle manquante, professeur indisponible, capacite insuffisante ou conflit de groupe. C'est ce niveau detaille qui oriente la correction.",
    level: "intermediaire",
    tags: ["rapport", "score", "recommandations"],
    keywords: ["interpreter rapport", "score global", "recommandations"],
    relatedGuideIds: ["guide-pilotage-session", "guide-diagnostic-generation"],
    relatedDocumentIds: ["doc-moteur-intelligent"],
  }),
];

export const HELP_SCENARIOS = [
  createScenario({
    id: "scenario-groupe-cible",
    categoryId: "generation-planning",
    moduleKey: "generation",
    title: "Je veux generer l'horaire d'un seul groupe",
    summary:
      "Le scenario ideal pour corriger rapidement un groupe sans relancer toute la session.",
    objective: "Produire ou recalculer uniquement le planning du groupe concerne.",
    level: "intermediaire",
    tags: ["groupe", "generation ciblee"],
    keywords: ["generer un seul groupe", "generation ciblee"],
    steps: [
      "Ouvrir Generer et choisir le mode cible par groupe.",
      "Selectionner le groupe, la session et les filtres utiles.",
      "Lancer la generation puis verifier le resultat dans Horaire groupe.",
    ],
    relatedGuideIds: ["guide-generation", "guide-horaires-groupes"],
    relatedDocumentIds: ["doc-planification"],
  }),
  createScenario({
    id: "scenario-cours-non-planifie",
    categoryId: "troubleshooting",
    moduleKey: "generation",
    title: "Je veux corriger un cours non planifie",
    summary:
      "Diagnostic de la cause, correction source puis regeneration ciblee ou planification manuelle.",
    objective: "Resoudre rapidement un blocage sur un cours refuse par le moteur.",
    level: "avance",
    tags: ["cours non planifie", "diagnostic"],
    keywords: ["corriger cours non planifie", "blocage"],
    steps: [
      "Lire la raison du blocage dans le rapport.",
      "Corriger la donnee source ou la ressource manquante.",
      "Relancer une generation ciblee ou corriger manuellement.",
    ],
    relatedGuideIds: ["guide-diagnostic-generation", "guide-planification-manuelle"],
    relatedDocumentIds: ["doc-moteur-intelligent", "doc-planification"],
  }),
  createScenario({
    id: "scenario-disponibilite-prof",
    categoryId: "availabilities",
    moduleKey: "disponibilites",
    title: "Je veux changer la disponibilite d'un professeur",
    summary:
      "Mise a jour de la disponibilite puis verification des cours replanifies automatiquement.",
    objective: "Actualiser la contrainte sans perdre le controle sur les impacts.",
    level: "intermediaire",
    tags: ["professeur", "disponibilite"],
    keywords: ["changer disponibilite professeur"],
    steps: [
      "Modifier la disponibilite sur la bonne periode.",
      "Verifier les cours impactes et la replanification automatique.",
      "Controler les horaires professeur et groupe.",
    ],
    relatedGuideIds: ["guide-disponibilites", "guide-horaires-professeurs"],
    relatedDocumentIds: ["doc-replanification"],
  }),
  createScenario({
    id: "scenario-export-etudiant",
    categoryId: "student-schedules",
    moduleKey: "horaires-etudiants",
    title: "Je veux exporter un horaire etudiant",
    summary:
      "Recherche etudiante, verification du contexte puis export PDF ou Excel.",
    objective: "Produire un support exploitable pour un etudiant ou un service administratif.",
    level: "debutant",
    tags: ["export", "etudiant"],
    keywords: ["exporter horaire etudiant"],
    steps: [
      "Rechercher l'etudiant avec un critere fiable.",
      "Verifier la session et la periode affichees.",
      "Declencher l'export adequat.",
    ],
    relatedGuideIds: ["guide-horaires-etudiants"],
    relatedDocumentIds: ["doc-export", "doc-horaires-etudiants"],
  }),
  createScenario({
    id: "scenario-occupation-salle",
    categoryId: "room-occupancy",
    moduleKey: "occupation-salles",
    title: "Je veux verifier l'occupation d'une salle",
    summary:
      "Lecture de l'occupation sur la session pour confirmer un creneau disponible.",
    objective: "Valider qu'une salle reste compatible sur la plage voulue.",
    level: "intermediaire",
    tags: ["salle", "occupation"],
    keywords: ["verifier occupation salle"],
    steps: [
      "Filtrer la vue sur la salle ou le type vise.",
      "Verifier la disponibilite sur la periode utile.",
      "Reutiliser l'information dans Generer ou en correction manuelle.",
    ],
    relatedGuideIds: ["guide-occupation-salles", "guide-planification-manuelle"],
    relatedDocumentIds: ["doc-salles"],
  }),
  createScenario({
    id: "scenario-deplacer-etudiant",
    categoryId: "group-management",
    moduleKey: "gestion-groupes",
    title: "Je veux deplacer un etudiant dans un groupe frere",
    summary:
      "Controle des conflits, mouvement d'etudiant puis mise a jour immediate de ses affectations.",
    objective: "Reequilibrer les groupes sans introduire de chevauchement ou de rupture d'horaire.",
    level: "avance",
    tags: ["groupe frere", "deplacement", "etudiant"],
    keywords: ["deplacer etudiant groupe frere"],
    steps: [
      "Comparer groupe source et groupe cible.",
      "Verifier les conflits, cours echoues et chevauchements.",
      "Appliquer le deplacement puis relire l'horaire.",
    ],
    relatedGuideIds: ["guide-gestion-groupes", "guide-horaires-etudiants"],
    relatedDocumentIds: ["doc-groupes", "doc-echanges-etudiants"],
  }),
  createScenario({
    id: "scenario-comprendre-echec",
    categoryId: "session-pilotage",
    moduleKey: "pilotage-session",
    title: "Je veux comprendre pourquoi une generation a echoue",
    summary:
      "Lecture du rapport, tri des blocages et priorisation des corrections.",
    objective: "Passer d'un echec global a une liste d'actions claire et defendable.",
    level: "intermediaire",
    tags: ["echec", "rapport", "blocage"],
    keywords: ["comprendre generation echouee"],
    steps: [
      "Ouvrir le rapport detaille de generation.",
      "Classer les blocages par nature: salle, professeur, groupe ou temps.",
      "Traiter les causes racines puis relancer une verification ciblee.",
    ],
    relatedGuideIds: ["guide-pilotage-session", "guide-diagnostic-generation"],
    relatedDocumentIds: ["doc-moteur-intelligent"],
  }),
];

export const HELP_FEATURED = {
  quickAccessIds: [
    "scenario-groupe-cible",
    "scenario-cours-non-planifie",
    "scenario-disponibilite-prof",
    "scenario-export-etudiant",
    "scenario-occupation-salle",
    "scenario-deplacer-etudiant",
  ],
  popularGuideIds: [
    "guide-vision-projet",
    "guide-onboarding",
    "guide-generation",
    "guide-disponibilites",
    "guide-horaires-etudiants",
    "guide-gestion-groupes",
    "guide-diagnostic-generation",
  ],
  recentContentIds: [
    "doc-documentation-complete",
    "doc-centre-documentaire",
    "guide-pilotage-session",
    "guide-diagnostic-generation",
    "doc-moteur-intelligent",
    "doc-planification-manuelle",
  ],
  recommendedGuideIds: [
    "guide-vision-projet",
    "guide-onboarding",
    "guide-dashboard",
    "guide-cours",
    "guide-disponibilites",
    "guide-generation",
  ],
  learningPath: [
    {
      id: "path-step-1",
      title: "Comprendre le projet",
      description: "Vue globale des modules, de la logique metier et de la documentation utile.",
      contentId: "guide-vision-projet",
    },
    {
      id: "path-step-2",
      title: "Prendre ses reperes",
      description: "Connexion, navigation et lecture du dashboard.",
      contentId: "guide-onboarding",
    },
    {
      id: "path-step-3",
      title: "Verifier les donnees de reference",
      description: "Cours, professeurs, salles et disponibilites.",
      contentId: "guide-cours",
    },
    {
      id: "path-step-4",
      title: "Produire un premier planning",
      description: "Generation ciblee ou globale selon le besoin.",
      contentId: "guide-generation",
    },
    {
      id: "path-step-5",
      title: "Corriger et partager",
      description: "Planification manuelle, verification et exports.",
      contentId: "guide-planification-manuelle",
    },
  ],
};

export function findDocumentDefinitionBySlug(slug) {
  return HELP_DOCUMENTS.find((document) => document.slug === slug) || null;
}
