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
    title: "Comprendre le tableau de bord et toutes les informations qu'il contient",
    summary:
      "La capsule explique comment lire le tableau de bord, comprendre le role de chaque bloc d'information et utiliser les indicateurs pour orienter les prochaines actions.",
    objective:
      "Transformer le dashboard en outil de lecture rapide pour comprendre l'etat global de la plateforme avant de generer, corriger ou exporter.",
    prerequisites: ["Avoir une session active si possible."],
    steps: [
      "Ouvrez le tableau de bord et reperez chaque zone d'information disponible.",
      "Lisez les cartes de synthese pour comprendre rapidement les volumes, les alertes et l'etat de la session.",
      "Identifiez les informations les plus importantes pour savoir quoi verifier ensuite dans les modules metier.",
      "Utilisez le dashboard comme point d'entree avant une generation, une correction ou un export.",
    ],
    attentionPoints: [
      "Le tableau de bord aide a prioriser, mais il ne remplace pas la lecture detaillee des rapports et des modules metier.",
    ],
    commonErrors: [
      "Lire un indicateur isole sans le replacer dans le contexte global de la session.",
    ],
    practicalTips: [
      "Commencez chaque demonstration par le dashboard pour donner une vue d'ensemble avant d'entrer dans les modules detail.",
    ],
    level: "debutant",
    estimatedMinutes: 4,
    tags: ["dashboard", "indicateurs", "pilotage", "vue d ensemble"],
    keywords: ["tableau de bord", "indicateurs", "informations dashboard", "session active", "resume global"],
    documentIds: ["doc-dashboard", "doc-moteur-intelligent"],
    videoSlots: [
      createVideoSlot({
        id: "video-dashboard",
        title: "Comprendre le tableau de bord",
        description:
          "Lecture des informations, indicateurs et blocs de pilotage visibles sur le dashboard.",
        durationLabel: "3 min 19 s",
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
        videoSlug: "gestion-des-salles",
      }),
    ],
    relatedGuideIds: ["guide-occupation-salles", "guide-generation"],
    popularityScore: 79,
  }),
  createGuide({
    id: "guide-disponibilites",
    categoryId: "availabilities",
    moduleKey: "disponibilites",
    title: "Gerer les disponibilites d'un professeur et laisser le moteur replanifier",
    summary:
      "Choisissez un professeur, consultez ses disponibilites, modifiez-les sur une seance, une periode ou jusqu'a la fin de session, puis controlez la replanification automatique.",
    objective:
      "Permettre de mettre a jour les disponibilites d'un enseignant sans perdre la maitrise des cours deja affectes et des impacts sur les groupes.",
    prerequisites: [
      "Le professeur doit etre deja cree et rattache a la session de travail.",
      "Les plages horaires, dates de debut et horizons de modification doivent etre identifies.",
    ],
    steps: [
      "Choisissez le professeur puis ouvrez sa grille de disponibilites.",
      "Consultez l'etat actuel avant de modifier un jour, une heure, une seance isolee, une periode delimitee ou une plage allant jusqu'a la fin de session.",
      "Enregistrez la modification et laissez le moteur detecter les cours deja affectes sur les plages touchees.",
      "Verifiez la replanification automatique sur l'horaire du professeur et sur celui des groupes concernes.",
    ],
    attentionPoints: [
      "Une modification sur une plage deja occupee peut deplacer plusieurs cours en cascade.",
      "Une correction temporaire et une correction jusqu'a la fin de session n'ont pas le meme impact metier.",
    ],
    commonErrors: [
      "Modifier la disponibilite sans relire les cours deja affectes sur la plage visee.",
      "Appliquer une plage trop large alors qu'une seule periode devait etre corrigee.",
    ],
    practicalTips: [
      "Commencez par afficher l'etat actuel des disponibilites, puis montrez l'avant/apres sur les horaires replanifies.",
    ],
    level: "intermediaire",
    estimatedMinutes: 8,
    tags: ["disponibilites", "professeur", "replanification", "automatisation"],
    keywords: [
      "modifier disponibilites professeur",
      "voir disponibilites professeur",
      "jusqu a la fin de session",
      "replanifier automatiquement",
    ],
    documentIds: ["doc-replanification", "doc-professeurs"],
    videoSlots: [
      createVideoSlot({
        id: "video-disponibilites",
        title: "Disponibilites professeur et replanification automatique",
        description:
          "Choix du professeur, modification des plages et controle des cours automatiquement replanifies.",
        durationLabel: "7 min 21 s",
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
    title: "Maitriser le module Generer, de la generation a la correction manuelle",
    summary:
      "La capsule couvre la generation ciblee par programme et etape, les reprises d'etudiants non planifies, la simulation what-if, le mode legacy, la planification manuelle et la modification des affectations.",
    objective:
      "Donner une vue complete du module Generer pour produire un horaire, corriger un cas complexe et suivre toutes les planifications de la session dans un seul ecran.",
    prerequisites: [
      "Cours, salles, professeurs, disponibilites et etudiants doivent etre prepares.",
      "La session de travail doit etre selectionnee avant toute generation ou correction.",
    ],
    steps: [
      "Choisissez le perimetre de travail: programme et etape cibles, groupe concerne ou besoin de reprise.",
      "Lancez la generation et lisez les resultats, y compris les etudiants ou cours non planifies automatiquement.",
      "Utilisez les outils de simulation what-if ou le mode legacy pour verifier la faisabilite avant application.",
      "Creez ou modifiez une planification manuelle en fixant vous-meme le groupe, la salle, le creneau, la duree et l'horizon d'application.",
      "Consultez la liste complete des planifications de la session pour relire, ajuster ou documenter les corrections.",
    ],
    attentionPoints: [
      "Une planification manuelle doit rester coherente avec les contraintes verifiees par la simulation.",
      "Une reprise d'etudiant non planifiee doit etre traitee dans le bon contexte de programme et d'etape.",
    ],
    commonErrors: [
      "Corriger manuellement sans lancer d'abord une simulation de faisabilite.",
      "Oublier de relire les planifications deja creees dans la session.",
    ],
    practicalTips: [
      "Montrez le module dans l'ordre reel de travail: generation, lecture du resultat, simulation, correction, verification de la liste finale.",
    ],
    level: "intermediaire",
    estimatedMinutes: 18,
    tags: ["generation", "what-if", "legacy", "planification", "correction"],
    keywords: [
      "generation programme et etape",
      "reprise etudiant non planifie",
      "simulation what-if",
      "planification manuelle",
      "modifier planification",
    ],
    documentIds: [
      "doc-planification",
      "doc-planification-manuelle",
      "doc-moteur-intelligent",
      "doc-export",
    ],
    videoSlots: [
      createVideoSlot({
        id: "video-generation",
        title: "Module Generer : generation, reprises et simulation what-if",
        description:
          "Generation ciblee, reprises, legacy, planification manuelle et modification des affectations.",
        durationLabel: "17 min 59 s",
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
    title: "Planifier manuellement un cours, une reprise ou une correction ciblee",
    summary:
      "Choisissez groupe, salle, creneau, duree et horizon de planification pour completer ou corriger le calcul automatique. Cette operation est aussi detaillee dans la capsule longue du module Generer.",
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
      "La capsule du module Generer montre aussi cette sequence dans un cas complet de bout en bout.",
    ],
    level: "intermediaire",
    estimatedMinutes: 10,
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
    title: "Choisir un professeur, lire son horaire et l'exporter",
    summary:
      "Selectionnez un professeur, consultez son planning et exportez-le proprement depuis la vue dediee.",
    objective:
      "Acceder rapidement a l'horaire d'un enseignant pour verification, partage ou export administratif.",
    prerequisites: ["Le professeur doit etre affecte ou au moins present dans la base."],
    steps: [
      "Selectionnez le professeur dans la recherche dediee.",
      "Consultez sa grille horaire et verifiez les seances qui lui sont affectees.",
      "Exportez le resultat si un partage ou une validation est requis.",
    ],
    attentionPoints: [
      "Le professeur choisi doit correspondre au bon contexte de session avant export.",
    ],
    commonErrors: [
      "Exporter sans avoir verifie le bon professeur ou la bonne vue de travail.",
    ],
    practicalTips: [
      "Montrez la selection du professeur puis l'export dans la meme sequence pour garder une demonstration claire.",
    ],
    level: "debutant",
    estimatedMinutes: 3,
    tags: ["horaire professeur", "export", "grille"],
    keywords: ["choisir professeur", "voir horaire professeur", "exporter horaire professeur", "pdf", "excel"],
    documentIds: ["doc-export", "doc-professeurs"],
    videoSlots: [
      createVideoSlot({
        id: "video-horaires-professeurs",
        title: "Horaire professeur : consultation et export",
        description:
          "Choix du professeur, lecture de son planning et export du resultat.",
        durationLabel: "1 min 39 s",
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
    title: "Choisir un groupe, filtrer son horaire et l'exporter",
    summary:
      "Selectionnez un groupe, appliquez les filtres utiles et exportez son planning depuis la vue groupe.",
    objective:
      "Permettre une consultation rapide de l'horaire d'un groupe pour le suivi pedagogique et les besoins d'export.",
    prerequisites: ["Disposer du groupe ou du programme a rechercher."],
    steps: [
      "Choisissez le groupe a consulter depuis la vue dediee.",
      "Appliquez les filtres utiles pour affiner l'affichage du planning.",
      "Relisez le resultat puis exportez l'horaire si un support externe est necessaire.",
    ],
    attentionPoints: [
      "Les filtres de session et de programme doivent rester alignes avec le groupe selectionne.",
    ],
    commonErrors: [
      "Interpretrer une grille vide alors qu'un filtre de session ou de groupe est incorrect.",
    ],
    practicalTips: [
      "Combinez cette vue avec Gestion groupes pour valider l'impact d'un mouvement d'etudiant.",
    ],
    level: "debutant",
    estimatedMinutes: 3,
    tags: ["horaire groupe", "filtres", "export"],
    keywords: ["horaire groupe", "choisir groupe", "filtrer horaire groupe", "exporter horaire groupe", "pdf", "excel"],
    documentIds: ["doc-export", "doc-groupes"],
    videoSlots: [
      createVideoSlot({
        id: "video-horaires-groupes",
        title: "Horaire de groupe : filtres et export",
        description:
          "Choix du groupe, application des filtres et export du planning.",
        durationLabel: "1 min 12 s",
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
    title: "Rechercher un etudiant, lire son horaire detaille et gerer un echange",
    summary:
      "La capsule montre la recherche etudiante, la liste complete, la fiche detaillee, l'export de l'horaire et l'option de modifier un cours entre etudiants d'un meme programme et d'une meme etape.",
    objective:
      "Donner une lecture individuelle complete de l'etudiant et securiser les operations d'echange ou d'implantation.",
    prerequisites: [
      "Connaitre au moins un critere de recherche: nom, prenom, matricule, groupe, session ou etape.",
    ],
    steps: [
      "Filtrez et choisissez l'etudiant depuis la liste de recherche.",
      "Consultez son horaire puis exportez-le si necessaire.",
      "Ouvrez sa fiche detaillee pour lire ses informations, ses cours et son contexte academique.",
      "Utilisez l'option de modification ou d'echange de cours entre etudiants du meme programme et de la meme etape.",
      "Validez l'operation seulement apres lecture des details de faisabilite.",
    ],
    attentionPoints: [
      "Un echange ne doit pas etre applique sans verifier le meme programme et la meme etape.",
      "Les details de l'etudiant doivent etre relus avant un export ou une correction.",
    ],
    commonErrors: [
      "Confondre la liste globale des etudiants avec la fiche detaillee de l'etudiant cible.",
      "Modifier un cours sans confirmer la compatibilite academique des etudiants concernes.",
    ],
    practicalTips: [
      "En demonstration, montrez la sequence complete: recherche, fiche detaillee, horaire, export, puis echange controle.",
    ],
    level: "avance",
    estimatedMinutes: 9,
    tags: ["horaire etudiant", "liste etudiants", "echange", "export"],
    keywords: [
      "horaire etudiant",
      "liste des etudiants",
      "fiche detaillee etudiant",
      "modifier un cours entre etudiants",
      "meme programme meme etape",
    ],
    documentIds: [
      "doc-horaires-etudiants",
      "doc-echanges-etudiants",
      "doc-export",
    ],
    videoSlots: [
      createVideoSlot({
        id: "video-horaires-etudiants",
        title: "Horaire etudiant, fiche detaillee et echange controle",
        description:
          "Recherche, liste complete, export, lecture detaillee et modification d'un cours entre etudiants compatibles.",
        durationLabel: "8 min 09 s",
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
    title: "Comprendre le module occupation salles et lire l'etat des salles en temps reel",
    summary:
      "La capsule explique le role du module Occupation salles, comment voir en temps reel l'occupation et la disponibilite des salles, et comment lire les statistiques associees.",
    objective:
      "Donner une lecture claire de l'etat des salles pour verifier les disponibilites, comprendre les statistiques et appuyer une correction ou une generation.",
    prerequisites: ["Les salles doivent etre correctement parametrees."],
    steps: [
      "Ouvrez le module Occupation salles et reperez son role dans le suivi de la session.",
      "Consultez l'occupation des salles en temps reel ainsi que leurs disponibilites.",
      "Lisez les statistiques remontees par le module pour comprendre l'etat global des salles.",
      "Reutilisez ces informations avant une correction manuelle ou une generation ciblee.",
    ],
    attentionPoints: [
      "Une salle visible comme libre a un instant donne doit etre relue sur le bon contexte de session et de plage.",
    ],
    commonErrors: [
      "Confondre une disponibilite ponctuelle avec une disponibilite exploitable sur tout le besoin metier.",
    ],
    practicalTips: [
      "Montrez ce module en appui du moteur pour expliquer rapidement si le blocage vient d'une saturation de salle.",
    ],
    level: "intermediaire",
    estimatedMinutes: 4,
    tags: ["occupation", "salles", "temps reel", "statistiques"],
    keywords: ["occupation salles", "temps reel", "disponibilites salles", "statistiques salles", "role module salles"],
    documentIds: ["doc-salles"],
    videoSlots: [
      createVideoSlot({
        id: "video-occupation-salles",
        title: "Occupation salles : role, temps reel et statistiques",
        description:
          "Role du module, lecture des disponibilites en temps reel et interpretation des statistiques des salles.",
        durationLabel: "3 min 09 s",
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
    title: "Piloter les groupes, les membres et la regeneration ciblee",
    summary:
      "La capsule explique la consultation des groupes, la liste des membres, la creation manuelle d'un groupe, l'ajout manuel d'un etudiant, le changement vers un groupe frere et la regeneration d'un horaire cible.",
    objective:
      "Permettre une gestion fine des groupes et des etudiants sans perdre la coherence des horaires.",
    prerequisites: [
      "Disposer du groupe source, du groupe cible et du contexte de session.",
    ],
    steps: [
      "Affichez les groupes et consultez les membres de chaque groupe.",
      "Creez un nouveau groupe manuellement si la structure pedagogique l'exige.",
      "Ajoutez un etudiant manuellement a un groupe existant, avec ou sans cours echoues selon le cas.",
      "Deplacez un etudiant vers un groupe frere lorsque la structure le permet.",
      "Regenerez uniquement l'horaire du groupe choisi et verifiez les informations detaillees sur les groupes et leurs etudiants.",
    ],
    attentionPoints: [
      "Un changement de groupe doit etre verifie sur les cours echoues, les conflits et le groupe cible.",
      "La regeneration doit rester ciblee au bon groupe pour eviter un recalcul inutile.",
    ],
    commonErrors: [
      "Ajouter un etudiant sans relire son contexte academique et ses cours echoues.",
      "Deplacer un etudiant vers un groupe non compatible.",
    ],
    practicalTips: [
      "Utilisez la fiche du groupe comme point d'entree unique pour montrer membres, mouvements et regeneration.",
    ],
    level: "avance",
    estimatedMinutes: 8,
    tags: ["groupes", "membres", "deplacement", "regeneration"],
    keywords: [
      "voir tous les groupes",
      "ajouter groupe manuellement",
      "ajouter etudiant a un groupe",
      "deplacer etudiant groupe frere",
      "regenerer horaire groupe",
    ],
    documentIds: ["doc-groupes", "doc-horaires-etudiants"],
    videoSlots: [
      createVideoSlot({
        id: "video-gestion-groupes",
        title: "Gestion des groupes, mouvements d'etudiants et regeneration ciblee",
        description:
          "Groupes, membres, creation manuelle, mouvements et regeneration de l'horaire cible.",
        durationLabel: "7 min 29 s",
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
    title: "Creer une session, choisir l'optimisation et piloter la generation",
    summary:
      "La capsule montre la creation d'une session, les verifications prealables, le choix du mode d'optimisation, le lancement de la generation, le changement de session et la lecture detaillee de l'historique.",
    objective:
      "Donner une methode complete pour lancer une planification automatique propre des la premiere session et interpreter les rapports produits.",
    prerequisites: [
      "Disposer des droits de pilotage.",
      "Verifier en amont les cours, les etudiants, les disponibilites professeurs et les disponibilites salles.",
    ],
    steps: [
      "Creez la session puis activez-la comme contexte de travail.",
      "Verifiez les prerequis de generation: cours, etudiants, disponibilites professeurs, disponibilites salles et coherence generale des donnees.",
      "Choisissez le mode d'optimisation adapte puis lancez la generation.",
      "Basculez entre les sessions si vous comparez plusieurs campagnes.",
      "Consultez l'historique et ouvrez le rapport detaille avec les scores professeur, etudiant et groupe, les cours non planifies, leurs causes et les suggestions de correction manuelle.",
    ],
    attentionPoints: [
      "Une premiere generation ne doit pas etre lancee sans verification complete des donnees de reference.",
      "Le mode d'optimisation choisi influence la qualite du resultat et le temps de calcul.",
    ],
    commonErrors: [
      "Lancer une generation complete sans avoir active la bonne session.",
      "Ignorer les suggestions manuelles presentes dans le rapport detaille.",
    ],
    practicalTips: [
      "C'est la capsule de reference pour une premiere planification automatique: utilisez-la comme point de depart d'une formation.",
    ],
    level: "intermediaire",
    estimatedMinutes: 14,
    tags: ["session", "optimisation", "rapport", "historique"],
    keywords: [
      "creer session",
      "activer session",
      "mode optimisation",
      "historique generations",
      "rapport detaille generation",
      "cours non planifies",
    ],
    documentIds: ["doc-moteur-intelligent", "doc-dashboard"],
    videoSlots: [
      createVideoSlot({
        id: "video-pilotage-session",
        title: "Pilotage session : creation, optimisation et rapport detaille",
        description:
          "Creation de session, choix du mode d'optimisation, historique et lecture du rapport detaille.",
        durationLabel: "13 min 35 s",
        level: "intermediaire",
        videoSlug: "pilotage-session-generation",
      }),
    ],
    relatedGuideIds: ["guide-generation", "guide-diagnostic-generation"],
    popularityScore: 99,
  }),
  createGuide({
    id: "guide-administration",
    categoryId: "administration",
    moduleKey: "administration",
    title: "Comprendre les roles administratifs et gerer les sous-admins",
    summary:
      "La capsule explique les responsabilites du responsable administratif et de l'admin, puis montre comment ajouter, modifier et supprimer un sous-admin avec un exemple reel.",
    objective:
      "Permettre une delegation propre des droits administratifs en comprenant clairement les roles et les actions de gestion de comptes.",
    prerequisites: ["Disposer des droits de responsable ou d'administration centrale."],
    steps: [
      "Comprenez d'abord la difference de responsabilites entre le responsable administratif et l'admin.",
      "Ajoutez un sous-admin avec les informations requises en suivant l'exemple montre dans la capsule.",
      "Modifiez ensuite un compte si un role ou une responsabilite change.",
      "Supprimez un admin lorsqu'il ne doit plus conserver l'acces.",
    ],
    attentionPoints: [
      "Les droits d'administration doivent toujours rester limites au besoin reel de la personne.",
    ],
    commonErrors: [
      "Laisser actif un compte admin qui ne correspond plus a une responsabilite actuelle.",
    ],
    practicalTips: [
      "Utilisez un exemple reel pour expliquer plus facilement la logique de delegation des roles.",
    ],
    level: "intermediaire",
    estimatedMinutes: 4,
    tags: ["administration", "roles", "sous-admin", "delegation"],
    keywords: ["responsable administratif", "admin", "ajouter sous admin", "modifier admin", "supprimer admin"],
    documentIds: ["doc-admins"],
    videoSlots: [
      createVideoSlot({
        id: "video-administration",
        title: "Sous-admin : roles, ajout, modification et suppression",
        description:
          "Responsabilites du responsable administratif et de l'admin, puis gestion complete d'un sous-admin avec un exemple reel.",
        durationLabel: "3 min 04 s",
        level: "intermediaire",
        videoSlug: "gestion-admins",
      }),
    ],
    relatedGuideIds: ["guide-onboarding"],
    popularityScore: 73,
  }),
  createGuide({
    id: "guide-diagnostic-generation",
    categoryId: "troubleshooting",
    moduleKey: "generation",
    title: "Comprendre le systeme de planification des cours echoues et le rapport detaille",
    summary:
      "La capsule explique comment le moteur cherche une solution pour affecter un cours echoue, montre un exemple concret de planification et apprend a lire le rapport detaille.",
    objective:
      "Permettre de comprendre la logique du moteur sur les cours echoues, savoir comment intervenir proprement et relire le rapport detaille avec un vrai sens metier.",
    prerequisites: [
      "Disposer du rapport de generation ou d'un cours signale comme echoue ou non planifie.",
      "Connaitre le contexte du groupe, du professeur, de la salle et de la session concernes.",
    ],
    steps: [
      "Ouvrez le rapport detaille de generation et reperez les cours echoues ou non planifies.",
      "Lisez les causes de blocage puis comprenez comment le moteur explore les combinaisons de salle, professeur, groupe, duree et creneau pour trouver une solution.",
      "Suivez l'exemple de planification montre dans la capsule pour voir comment traiter un cours echoue de facon concrete.",
      "Revenez ensuite au rapport detaille pour verifier le resultat, relire les scores et confirmer que la correction est coherente.",
    ],
    attentionPoints: [
      "Un meme cours echoue peut cumuler plusieurs contraintes simultanees.",
      "Le rapport detaille doit etre relu apres correction pour verifier que l'on a traite la vraie cause et non seulement le symptome.",
    ],
    commonErrors: [
      "Essayer de planifier un cours echoue sans lire les raisons exactes du blocage.",
      "Relancer une generation trop large alors qu'un traitement cible ou manuel suffisait.",
    ],
    practicalTips: [
      "Pendant une demonstration, montrez d'abord comment le moteur raisonne, puis seulement l'action de correction.",
      "La capsule Pilotage session complete utilement ce sujet pour la lecture des scores et de l'historique global.",
    ],
    level: "avance",
    estimatedMinutes: 18,
    tags: ["cours echoues", "blocage", "rapport detaille", "correction"],
    keywords: [
      "systeme de planification des cours echoues",
      "comment planifier un cours echoue",
      "lire rapport detaille generation",
      "comprendre rapport cours non planifie",
    ],
    documentIds: [
      "doc-moteur-intelligent",
      "doc-planification",
      "doc-replanification",
    ],
    videoSlots: [
      createVideoSlot({
        id: "video-cours-echoues",
        title:
          "Comment fonctionne le systeme de planification des cours echoues, comment faire et lire le rapport detaille",
        description:
          "Explication du moteur, exemple concret de planification d'un cours echoue et lecture guidee du rapport detaille.",
        durationLabel: "17 min 33 s",
        level: "avance",
        videoSlug: "planification-cours-echoues",
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
    "guide-onboarding",
    "guide-generation",
    "guide-disponibilites",
    "guide-horaires-etudiants",
    "guide-gestion-groupes",
    "guide-diagnostic-generation",
  ],
  recentContentIds: [
    "guide-pilotage-session",
    "guide-diagnostic-generation",
    "doc-moteur-intelligent",
    "doc-planification-manuelle",
  ],
  recommendedGuideIds: [
    "guide-onboarding",
    "guide-dashboard",
    "guide-cours",
    "guide-disponibilites",
    "guide-generation",
  ],
  learningPath: [
    {
      id: "path-step-1",
      title: "Prendre ses reperes",
      description: "Connexion, navigation et lecture du dashboard.",
      contentId: "guide-onboarding",
    },
    {
      id: "path-step-2",
      title: "Verifier les donnees de reference",
      description: "Cours, professeurs, salles et disponibilites.",
      contentId: "guide-cours",
    },
    {
      id: "path-step-3",
      title: "Produire un premier planning",
      description: "Generation ciblee ou globale selon le besoin.",
      contentId: "guide-generation",
    },
    {
      id: "path-step-4",
      title: "Corriger et partager",
      description: "Planification manuelle, verification et exports.",
      contentId: "guide-planification-manuelle",
    },
  ],
};

export function findDocumentDefinitionBySlug(slug) {
  return HELP_DOCUMENTS.find((document) => document.slug === slug) || null;
}
