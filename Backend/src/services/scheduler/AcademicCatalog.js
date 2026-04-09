export const SESSION_DURATION_MONTHS = 4;
export const TARGET_GROUPS_PER_PROGRAM = 4;
export const TARGET_GROUP_SIZE = 28;
export const TARGET_STUDENTS_PER_PROGRAM =
  TARGET_GROUPS_PER_PROGRAM * TARGET_GROUP_SIZE;
export const MAX_PROGRAMS_PER_PROFESSOR = 2;
export const MAX_COURSES_PER_PROGRAM_PER_PROFESSOR = 6;
export const MAX_COURSES_PER_PROFESSOR = 6;
export const MAX_GROUPS_PER_PROFESSOR = 12;
export const MAX_WEEKLY_SESSIONS_PER_PROFESSOR = 12;
export const DEFAULT_COURSE_DURATION_HOURS = 3;
export const DEFAULT_SESSIONS_PER_WEEK = 1;
export const REQUIRED_WEEKLY_SESSIONS_PER_GROUP = 7;
export const MAX_WEEKLY_SESSIONS_PER_GROUP_WITH_RECOVERY = 8;
export const TARGET_ACTIVE_DAYS_PER_GROUP = 4;
export const MIN_ACTIVE_DAYS_PER_GROUP = 3;
export const MAX_GROUP_SESSIONS_PER_DAY = 3;
export const MAX_PROFESSOR_SESSIONS_PER_DAY = 4;
export const ACADEMIC_WEEKDAY_ORDER = [1, 2, 3, 4, 5];
export const ACADEMIC_WEEKDAY_TIME_SLOTS = [
  { debut: "08:00:00", fin: "11:00:00" },
  { debut: "11:00:00", fin: "14:00:00" },
  { debut: "14:00:00", fin: "17:00:00" },
  { debut: "17:00:00", fin: "20:00:00" },
];

export const ACADEMIC_ROOM_CATALOG = [
  { code: "CLS101", type: "Salle de cours", capacite: 40 },
  { code: "CLS102", type: "Salle de cours", capacite: 40 },
  { code: "CLS103", type: "Salle de cours", capacite: 40 },
  { code: "CLS104", type: "Salle de cours", capacite: 40 },
  { code: "CLS105", type: "Salle de cours", capacite: 40 },
  { code: "CLS106", type: "Salle de cours", capacite: 40 },
  { code: "CLS107", type: "Salle de cours", capacite: 40 },
  { code: "CLS108", type: "Salle de cours", capacite: 40 },
  { code: "LAB201", type: "Laboratoire", capacite: 32 },
  { code: "LAB202", type: "Laboratoire", capacite: 32 },
  { code: "LAB203", type: "Laboratoire", capacite: 32 },
  { code: "LAB204", type: "Laboratoire", capacite: 32 },
  { code: "LAB205", type: "Laboratoire", capacite: 32 },
  { code: "LAB206", type: "Laboratoire", capacite: 32 },
  { code: "NET301", type: "Salle reseautique", capacite: 32 },
  { code: "NET302", type: "Salle reseautique", capacite: 32 },
  { code: "NET303", type: "Salle reseautique", capacite: 32 },
  { code: "NET304", type: "Salle reseautique", capacite: 32 },
  { code: "CLI401", type: "Laboratoire clinique", capacite: 30 },
  { code: "CLI402", type: "Laboratoire clinique", capacite: 30 },
  { code: "CLI403", type: "Laboratoire clinique", capacite: 30 },
  { code: "CLI404", type: "Laboratoire clinique", capacite: 30 },
  { code: "CUL501", type: "Cuisine pedagogique", capacite: 30 },
  { code: "CUL502", type: "Cuisine pedagogique", capacite: 30 },
  { code: "CUL503", type: "Cuisine pedagogique", capacite: 30 },
  { code: "CUL504", type: "Cuisine pedagogique", capacite: 30 },
  { code: "CLS109", type: "Salle de cours", capacite: 40 },
  { code: "CLS110", type: "Salle de cours", capacite: 40 },
  { code: "CLS111", type: "Salle de cours", capacite: 40 },
  { code: "CLS112", type: "Salle de cours", capacite: 40 },
  { code: "CLS113", type: "Salle de cours", capacite: 40 },
  { code: "CLS114", type: "Salle de cours", capacite: 40 },
  { code: "LAB207", type: "Laboratoire", capacite: 32 },
  { code: "LAB208", type: "Laboratoire", capacite: 32 },
  { code: "LAB209", type: "Laboratoire", capacite: 32 },
  { code: "LAB210", type: "Laboratoire", capacite: 32 },
  { code: "LAB211", type: "Laboratoire", capacite: 32 },
  { code: "LAB212", type: "Laboratoire", capacite: 32 },
  { code: "LAB213", type: "Laboratoire", capacite: 32 },
  { code: "LAB214", type: "Laboratoire", capacite: 32 },
  { code: "LAB215", type: "Laboratoire", capacite: 32 },
  { code: "LAB216", type: "Laboratoire", capacite: 32 },
  { code: "LAB217", type: "Laboratoire", capacite: 32 },
  { code: "LAB218", type: "Laboratoire", capacite: 32 },
  { code: "NET305", type: "Salle reseautique", capacite: 32 },
  { code: "NET306", type: "Salle reseautique", capacite: 32 },
  { code: "NET307", type: "Salle reseautique", capacite: 32 },
  { code: "NET308", type: "Salle reseautique", capacite: 32 },
  { code: "NET309", type: "Salle reseautique", capacite: 32 },
  { code: "NET310", type: "Salle reseautique", capacite: 32 },
  { code: "NET311", type: "Salle reseautique", capacite: 32 },
  { code: "NET312", type: "Salle reseautique", capacite: 32 },
  { code: "CLI405", type: "Laboratoire clinique", capacite: 30 },
  { code: "CLI406", type: "Laboratoire clinique", capacite: 30 },
  { code: "CLI407", type: "Laboratoire clinique", capacite: 30 },
  { code: "CLI408", type: "Laboratoire clinique", capacite: 30 },
  { code: "CUL505", type: "Cuisine pedagogique", capacite: 30 },
  { code: "CUL506", type: "Cuisine pedagogique", capacite: 30 },
  { code: "CUL507", type: "Cuisine pedagogique", capacite: 30 },
  { code: "CUL508", type: "Cuisine pedagogique", capacite: 30 },
  { code: "CLS115", type: "Salle de cours", capacite: 40 },
  { code: "CLS116", type: "Salle de cours", capacite: 40 },
  { code: "CLS117", type: "Salle de cours", capacite: 40 },
  { code: "CLS118", type: "Salle de cours", capacite: 40 },
];

export const ACADEMIC_STAGES = ["1", "2", "3", "4"];

const BASE_ACADEMIC_PROGRAM_CATALOG = [
  {
    programme: "Programmation informatique",
    profPrefix: "INF",
    courses: [
      { code: "INF101", nom: "Introduction a la programmation", type_salle: "Laboratoire", est_cours_cle: 1 },
      { code: "INF102", nom: "Algorithmique appliquee", type_salle: "Laboratoire", est_cours_cle: 1 },
      { code: "INF103", nom: "Bases de donnees relationnelles", type_salle: "Laboratoire", est_cours_cle: 1 },
      { code: "INF104", nom: "Developpement Web I", type_salle: "Laboratoire", est_cours_cle: 0 },
      { code: "INF105", nom: "Genie logiciel et versionnement", type_salle: "Laboratoire", est_cours_cle: 0 },
      { code: "INF106", nom: "Tests, qualite et debogage", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "INF107", nom: "UX, integration et projet agile", type_salle: "Salle de cours", est_cours_cle: 0 },
    ],
  },
  {
    programme:
      "Technologie des systemes informatiques - cybersecurite et reseautique",
    profPrefix: "CYB",
    courses: [
      { code: "CYB101", nom: "Fondements reseautiques", type_salle: "Salle reseautique", est_cours_cle: 1 },
      { code: "CYB102", nom: "Administration des systemes", type_salle: "Salle reseautique", est_cours_cle: 1 },
      { code: "CYB103", nom: "Securite des postes de travail", type_salle: "Salle reseautique", est_cours_cle: 1 },
      { code: "CYB104", nom: "Pare feux et segmentation", type_salle: "Salle reseautique", est_cours_cle: 0 },
      { code: "CYB105", nom: "Virtualisation et services cloud", type_salle: "Laboratoire", est_cours_cle: 0 },
      { code: "CYB106", nom: "Scripts d'automatisation", type_salle: "Laboratoire", est_cours_cle: 0 },
      { code: "CYB107", nom: "Gestion des incidents et journalisation", type_salle: "Salle de cours", est_cours_cle: 0 },
    ],
  },
  {
    programme: "Analyse de donnees",
    profPrefix: "DAT",
    courses: [
      { code: "DAT101", nom: "Statistiques appliquees", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "DAT102", nom: "SQL analytique", type_salle: "Laboratoire", est_cours_cle: 1 },
      { code: "DAT103", nom: "Python pour l'analyse de donnees", type_salle: "Laboratoire", est_cours_cle: 1 },
      { code: "DAT104", nom: "Visualisation et tableaux de bord", type_salle: "Laboratoire", est_cours_cle: 0 },
      { code: "DAT105", nom: "Qualite et nettoyage des donnees", type_salle: "Laboratoire", est_cours_cle: 0 },
      { code: "DAT106", nom: "Entreposage et modelisation", type_salle: "Laboratoire", est_cours_cle: 0 },
      { code: "DAT107", nom: "Projet analytique hebdomadaire", type_salle: "Salle de cours", est_cours_cle: 0 },
    ],
  },
  {
    programme: "Intelligence artificielle appliquee",
    profPrefix: "AIA",
    courses: [
      { code: "AIA101", nom: "Fondements de l'intelligence artificielle", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "AIA102", nom: "Python et notebooks pour l'IA", type_salle: "Laboratoire", est_cours_cle: 1 },
      { code: "AIA103", nom: "Apprentissage supervise", type_salle: "Laboratoire", est_cours_cle: 1 },
      { code: "AIA104", nom: "Donnees, etiquetage et preparation", type_salle: "Laboratoire", est_cours_cle: 0 },
      { code: "AIA105", nom: "Vision, texte et extraction", type_salle: "Laboratoire", est_cours_cle: 0 },
      { code: "AIA106", nom: "Ethique et gouvernance de l'IA", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "AIA107", nom: "Deploiement de modeles", type_salle: "Laboratoire", est_cours_cle: 0 },
    ],
  },
  {
    programme: "Techniques en administration des affaires",
    profPrefix: "ADM",
    courses: [
      { code: "ADM101", nom: "Introduction a la gestion", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "ADM102", nom: "Comptabilite d'entreprise", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "ADM103", nom: "Marketing operationnel", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "ADM104", nom: "Analyse financiere", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "ADM105", nom: "Ressources humaines et leadership", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "ADM106", nom: "Processus et outils d'affaires", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "ADM107", nom: "Projet integrateur en gestion", type_salle: "Salle de cours", est_cours_cle: 0 },
    ],
  },
  {
    programme: "Gestion des services de restauration",
    profPrefix: "RES",
    courses: [
      { code: "RES101", nom: "Hygiene et securite alimentaire", type_salle: "Cuisine pedagogique", est_cours_cle: 1 },
      { code: "RES102", nom: "Techniques culinaires", type_salle: "Cuisine pedagogique", est_cours_cle: 1 },
      { code: "RES103", nom: "Production et service", type_salle: "Cuisine pedagogique", est_cours_cle: 1 },
      { code: "RES104", nom: "Nutrition appliquee", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "RES105", nom: "Gestion des stocks", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "RES106", nom: "Cout, rentabilite et achats", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "RES107", nom: "Organisation d'une brigade", type_salle: "Cuisine pedagogique", est_cours_cle: 0 },
    ],
  },
  {
    programme: "Soins infirmiers auxiliaires",
    profPrefix: "SIA",
    courses: [
      { code: "SIA101", nom: "Anatomie et physiologie", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "SIA102", nom: "Soins de base", type_salle: "Laboratoire clinique", est_cours_cle: 1 },
      { code: "SIA103", nom: "Communication therapeutique", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "SIA104", nom: "Pharmacologie pratique", type_salle: "Laboratoire clinique", est_cours_cle: 0 },
      { code: "SIA105", nom: "Evaluation clinique", type_salle: "Laboratoire clinique", est_cours_cle: 0 },
      { code: "SIA106", nom: "Soins medico chirurgicaux", type_salle: "Laboratoire clinique", est_cours_cle: 0 },
      { code: "SIA107", nom: "Simulation interprofessionnelle", type_salle: "Laboratoire clinique", est_cours_cle: 0 },
    ],
  },
  {
    programme: "Travail social",
    profPrefix: "TSO",
    courses: [
      { code: "TSO101", nom: "Relation d'aide", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "TSO102", nom: "Intervention individuelle", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "TSO103", nom: "Intervention de groupe", type_salle: "Salle de cours", est_cours_cle: 1 },
      { code: "TSO104", nom: "Diversite et inclusion", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "TSO105", nom: "Reseaux communautaires", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "TSO106", nom: "Ethique professionnelle", type_salle: "Salle de cours", est_cours_cle: 0 },
      { code: "TSO107", nom: "Documentation clinique et sociale", type_salle: "Salle de cours", est_cours_cle: 0 },
    ],
  },
];

const ACADEMIC_STAGE_NAME_OVERRIDES = {
  INF101: [
    "Introduction a la programmation",
    "Programmation orientee objet",
    "Structures de donnees et complexite",
    "Architecture logicielle et integration",
  ],
  INF102: [
    "Algorithmique appliquee",
    "Developpement full stack I",
    "API, services et integration",
    "Optimisation et performance applicative",
  ],
  INF103: [
    "Bases de donnees relationnelles",
    "Bases de donnees avancees",
    "Entreposage et donnees distribuees",
    "Administration, securite et gouvernance des donnees",
  ],
  INF104: [
    "Developpement Web I",
    "Developpement Web II",
    "Applications mobiles et interfaces",
    "Experience utilisateur et accessibilite",
  ],
  INF105: [
    "Genie logiciel et versionnement",
    "Methodes agiles et qualite logicielle",
    "Tests automatises et integration continue",
    "DevOps et observabilite",
  ],
  INF106: [
    "Systemes d'exploitation pour developpeurs",
    "Scripts et automatisation",
    "Conteneurs et orchestration",
    "Securite applicative et cloud",
  ],
  INF107: [
    "Projet integre en programmation I",
    "Projet integre en programmation II",
    "Projet client et analyse technique",
    "Projet de fin d'etudes en logiciel",
  ],
  CYB101: [
    "Fondements reseautiques",
    "Commutation et routage",
    "Infrastructure securisee",
    "Architecture de reseaux d'entreprise",
  ],
  CYB102: [
    "Administration des systemes",
    "Windows et Linux avances",
    "Services d'infrastructure et identite",
    "Automatisation et exploitation",
  ],
  CYB103: [
    "Securite des postes de travail",
    "Cyberdefense appliquee",
    "Analyse de vulnerabilites",
    "Reponse aux incidents",
  ],
  CYB104: [
    "Pare feux et segmentation",
    "Securite perimetrique et VPN",
    "Zero trust et journalisation",
    "Audit, conformite et gouvernance",
  ],
  CYB105: [
    "Virtualisation et services cloud",
    "Services cloud et conteneurs",
    "Haute disponibilite et resilience",
    "Continuite et reprise informatique",
  ],
  CYB106: [
    "Scripts d'automatisation",
    "Python et outils reseau",
    "Automatisation securitaire",
    "Orchestration d'infrastructures",
  ],
  CYB107: [
    "Projet integre reseaux I",
    "Projet integre cyber I",
    "Projet integre cyber II",
    "Projet de fin d'etudes infra et cyber",
  ],
  DAT101: [
    "Statistiques appliquees",
    "Modeles statistiques",
    "Analyse predictive",
    "Optimisation decisionnelle",
  ],
  DAT102: [
    "SQL analytique",
    "Modelisation de donnees",
    "Entreposage et ETL",
    "Gouvernance des donnees",
  ],
  DAT103: [
    "Python pour l'analyse de donnees",
    "Programmation analytique avancee",
    "Traitement distribue des donnees",
    "Industrialisation analytique",
  ],
  DAT104: [
    "Visualisation et tableaux de bord",
    "Visualisation avancee",
    "Storytelling de donnees",
    "Communication executive des analyses",
  ],
  DAT105: [
    "Qualite et nettoyage des donnees",
    "Collecte et integration des sources",
    "Lineage et qualite de reference",
    "Conformite et securite des donnees",
  ],
  DAT106: [
    "Methodes quantitatives d'affaires",
    "Experimentation et A/B testing",
    "Series temporelles et prevision",
    "Recherche operationnelle appliquee",
  ],
  DAT107: [
    "Projet analytique I",
    "Projet analytique II",
    "Projet de consultation en donnees",
    "Projet capstone analytique",
  ],
  AIA101: [
    "Fondements de l'intelligence artificielle",
    "Apprentissage automatique",
    "Apprentissage profond",
    "IA avancee et optimisation",
  ],
  AIA102: [
    "Python et notebooks pour l'IA",
    "Ingenierie des donnees pour l'IA",
    "Pipelines et experimentation ML",
    "MLOps et deploiement",
  ],
  AIA103: [
    "Methodes statistiques pour l'IA",
    "Evaluation de modeles",
    "Robustesse et calibration",
    "Optimisation experimentale",
  ],
  AIA104: [
    "Donnees, etiquetage et preparation",
    "Vision par ordinateur",
    "Traitement du langage naturel",
    "IA multimodale et systemes intelligents",
  ],
  AIA105: [
    "Preparation des jeux de donnees",
    "Acquisition et annotation",
    "Qualite des jeux de donnees",
    "Gouvernance des donnees d'IA",
  ],
  AIA106: [
    "Ethique et gouvernance de l'IA",
    "Cadre legal et conformite",
    "Explicabilite et audit de modeles",
    "Strategie et adoption de l'IA",
  ],
  AIA107: [
    "Projet IA I",
    "Projet IA II",
    "Projet client en IA",
    "Projet de fin d'etudes IA",
  ],
  ADM101: [
    "Gestion des organisations",
    "Gestion strategique",
    "Pilotage de la performance",
    "Gouvernance et direction",
  ],
  ADM102: [
    "Comptabilite d'entreprise",
    "Comptabilite de gestion",
    "Finance d'entreprise",
    "Analyse financiere et investissement",
  ],
  ADM103: [
    "Marketing operationnel",
    "Marketing numerique",
    "Analyse de marche et CRM",
    "Strategie de marque et croissance",
  ],
  ADM104: [
    "Ressources humaines et leadership",
    "Dotation et developpement du talent",
    "Relations de travail",
    "Leadership du changement",
  ],
  ADM105: [
    "Droit des affaires et conformite",
    "Fiscalite et reglementation",
    "Gestion des risques",
    "Audit interne et controle",
  ],
  ADM106: [
    "Analyse de donnees d'affaires",
    "Tableaux de bord de gestion",
    "Processus et amelioration continue",
    "Transformation numerique des affaires",
  ],
  ADM107: [
    "Projet integrateur en gestion I",
    "Projet coop et vente-conseil",
    "Projet integrateur en gestion II",
    "Projet capstone en administration",
  ],
  RES101: [
    "Hygiene et securite alimentaire",
    "Salubrite et normes HACCP",
    "Assurance qualite alimentaire",
    "Gestion avancee de la securite alimentaire",
  ],
  RES102: [
    "Techniques culinaires",
    "Techniques culinaires avancees",
    "Production pour grand volume",
    "Cuisine contemporaine et innovation",
  ],
  RES103: [
    "Production et service",
    "Service de salle et experience client",
    "Coordination des operations",
    "Supervision d'une brigade",
  ],
  RES104: [
    "Nutrition appliquee",
    "Menu et conception d'offres",
    "Approvisionnement responsable",
    "Developpement de produits alimentaires",
  ],
  RES105: [
    "Gestion des stocks",
    "Achats et fournisseurs",
    "Cout et rendement",
    "Controle budgetaire et rentabilite",
  ],
  RES106: [
    "Cout, rentabilite et achats",
    "Entrepreneuriat en restauration",
    "Marketing restauration",
    "Strategie d'exploitation",
  ],
  RES107: [
    "Organisation d'une brigade",
    "Atelier pratique cuisine II",
    "Stage pratique en restauration",
    "Projet de fin d'etudes restauration",
  ],
  SIA101: [
    "Anatomie et physiologie",
    "Pathophysiologie",
    "Soins medico chirurgicaux",
    "Soins complexes et integration clinique",
  ],
  SIA102: [
    "Soins de base",
    "Techniques de soins avances",
    "Soins en milieu specialise",
    "Soins en transition et retour a domicile",
  ],
  SIA103: [
    "Communication therapeutique",
    "Relation d'aide en sante",
    "Intervention interdisciplinaire",
    "Coordination clinique et education du patient",
  ],
  SIA104: [
    "Pharmacologie pratique",
    "Pharmacologie clinique",
    "Administration securitaire des medicaments",
    "Gestion therapeutique et surveillance",
  ],
  SIA105: [
    "Evaluation clinique",
    "Collecte et interpretation des donnees cliniques",
    "Jugement clinique",
    "Priorisation et securite des soins",
  ],
  SIA106: [
    "Sante communautaire",
    "Sante mentale et vulnerabilites",
    "Gerontologie et soins de longue duree",
    "Perinatalite et pediatrie appliquee",
  ],
  SIA107: [
    "Simulation clinique I",
    "Simulation clinique II",
    "Stage clinique integre I",
    "Stage clinique integre II",
  ],
  TSO101: [
    "Relation d'aide",
    "Intervention individuelle",
    "Intervention avancee",
    "Accompagnement complexe et supervision",
  ],
  TSO102: [
    "Intervention de groupe",
    "Animation communautaire",
    "Facilitation interprofessionnelle",
    "Intervention collective integree",
  ],
  TSO103: [
    "Diversite et inclusion",
    "Justice sociale et politiques",
    "Approches autochtones et interculturelles",
    "Enjeux contemporains et plaidoyer",
  ],
  TSO104: [
    "Reseaux communautaires",
    "Ressources et partenariats",
    "Developpement communautaire",
    "Concertation territoriale",
  ],
  TSO105: [
    "Ethique professionnelle",
    "Cadre legal et deontologie",
    "Gestion du risque psychosocial",
    "Gouvernance des services sociaux",
  ],
  TSO106: [
    "Documentation clinique et sociale",
    "Evaluation des besoins",
    "Plan d'intervention et suivi",
    "Mesure d'impact et reddition",
  ],
  TSO107: [
    "Projet terrain I",
    "Projet terrain II",
    "Stage pratique en travail social",
    "Projet integrateur de fin d'etudes",
  ],
};

function creerCodeCoursEtape(codeBase, etape) {
  const valeur = String(codeBase || "").trim().toUpperCase();
  const correspondance = /^([A-Z]+)(\d)(\d{2})$/.exec(valeur);

  if (!correspondance) {
    return valeur;
  }

  const [, prefixe, , suffixe] = correspondance;
  return `${prefixe}${String(etape)}${suffixe}`;
}

function lireNomCoursEtape(codeBase, etape, nomParDefaut) {
  const noms = ACADEMIC_STAGE_NAME_OVERRIDES[String(codeBase || "").trim().toUpperCase()];
  const indexEtape = Math.max(0, Number(etape || 1) - 1);

  if (!Array.isArray(noms) || !noms[indexEtape]) {
    return nomParDefaut;
  }

  return noms[indexEtape];
}

function lireChargeProgrammeEtape(requiredGroupsByProgram, programme, etape) {
  return lireNombreGroupesRequis(requiredGroupsByProgram, {
    programme,
    etape,
  });
}

function repartirChargeDansPlans(plans, charge, codeCours) {
  let chargeRestante = Math.max(0, Number(charge) || 0);

  while (chargeRestante > 0) {
    const planQuiPeutAbsorber = plans
      .filter(
        (plan) =>
          Number(plan.estimatedWeeklyLoad || 0) + chargeRestante <=
          MAX_WEEKLY_SESSIONS_PER_PROFESSOR
      )
      .sort(
        (planA, planB) =>
          Number(planB.estimatedWeeklyLoad || 0) -
          Number(planA.estimatedWeeklyLoad || 0)
      )[0];

    if (planQuiPeutAbsorber) {
      if (!planQuiPeutAbsorber.assignedCourseCodes.includes(codeCours)) {
        planQuiPeutAbsorber.assignedCourseCodes.push(codeCours);
      }
      planQuiPeutAbsorber.estimatedWeeklyLoad =
        Number(planQuiPeutAbsorber.estimatedWeeklyLoad || 0) + chargeRestante;
      chargeRestante = 0;
      continue;
    }

    if (chargeRestante <= MAX_WEEKLY_SESSIONS_PER_PROFESSOR) {
      plans.push({
        assignedCourseCodes: [codeCours],
        estimatedWeeklyLoad: chargeRestante,
      });
      chargeRestante = 0;
      continue;
    }

    plans.push({
      assignedCourseCodes: [codeCours],
      estimatedWeeklyLoad: MAX_WEEKLY_SESSIONS_PER_PROFESSOR,
    });
    chargeRestante -= MAX_WEEKLY_SESSIONS_PER_PROFESSOR;
  }
}

function creerCatalogueProgrammeEtape(programmeBase, etape) {
  return {
    programme: programmeBase.programme,
    etape: String(etape),
    profPrefix: programmeBase.profPrefix,
    courses: programmeBase.courses.map((course) => ({
      ...course,
      nom: lireNomCoursEtape(course.code, etape, course.nom),
      code: creerCodeCoursEtape(course.code, etape),
    })),
  };
}

export const ACADEMIC_PROGRAM_CATALOG = BASE_ACADEMIC_PROGRAM_CATALOG.flatMap(
  (programmeBase) =>
    ACADEMIC_STAGES.map((etape) =>
      creerCatalogueProgrammeEtape(programmeBase, etape)
    )
);

export const ACADEMIC_COURSE_CODES = new Set(
  ACADEMIC_PROGRAM_CATALOG.flatMap((program) =>
    program.courses.map((course) => course.code)
  )
);

export const ACADEMIC_PROGRAM_NAMES = new Set(
  ACADEMIC_PROGRAM_CATALOG.map((program) => program.programme)
);

const BOOTSTRAP_FIRST_NAMES = [
  "Sophie",
  "Marc",
  "Nadia",
  "Karim",
  "Lea",
  "Omar",
  "Amine",
  "Sara",
  "Yasmine",
  "Rayan",
  "Maya",
  "Samir",
  "Ines",
  "Nora",
  "Bilal",
  "Jade",
  "Farah",
  "Luca",
  "Adam",
  "Mia",
  "Hamza",
  "Aya",
  "Meriem",
  "Noah",
];

const BOOTSTRAP_LAST_NAMES = [
  "Tremblay",
  "Bouchard",
  "Gagnon",
  "Roy",
  "Lefebvre",
  "Morin",
  "Cote",
  "Pelletier",
  "Parent",
  "Nguyen",
  "Benali",
  "Rahmani",
  "Lavoie",
  "Garcia",
  "Park",
  "Ahmed",
  "Liu",
  "Simard",
  "Ali",
  "Chen",
  "Traore",
  "Yilmaz",
  "Garneau",
  "Benoit",
];

function buildProfessorIdentities(requiredCount) {
  const totalIdentities =
    BOOTSTRAP_FIRST_NAMES.length * BOOTSTRAP_LAST_NAMES.length;

  if (requiredCount > totalIdentities) {
    throw new Error(
      `Impossible de generer ${requiredCount} professeurs uniques avec ${totalIdentities} combinaisons de noms.`
    );
  }

  const identities = [];

  for (
    let cycleIndex = 0;
    cycleIndex < BOOTSTRAP_LAST_NAMES.length && identities.length < requiredCount;
    cycleIndex += 1
  ) {
    for (
      let firstNameIndex = 0;
      firstNameIndex < BOOTSTRAP_FIRST_NAMES.length &&
      identities.length < requiredCount;
      firstNameIndex += 1
    ) {
      identities.push({
        prenom: BOOTSTRAP_FIRST_NAMES[firstNameIndex],
        nom: BOOTSTRAP_LAST_NAMES[
          (firstNameIndex + cycleIndex) % BOOTSTRAP_LAST_NAMES.length
        ],
      });
    }
  }

  return identities;
}

function buildExistingProfessorReusePool(existingProfessors = []) {
  return existingProfessors
    .filter((professeur) => !/^AUTO-/i.test(String(professeur?.matricule || "")))
    .map((professeur) => ({
      ...professeur,
      cleIdentite: [
        normalizeAcademicText(professeur?.prenom),
        normalizeAcademicText(professeur?.nom),
        String(professeur?.matricule || "").trim().toUpperCase(),
      ].join("|"),
      specialiteNormalisee: normalizeAcademicText(professeur?.specialite),
      nbCoursAssignes: String(professeur?.cours_ids || "")
        .split(",")
        .filter(Boolean).length,
    }))
    .sort((professeurA, professeurB) => {
      if (professeurA.nbCoursAssignes !== professeurB.nbCoursAssignes) {
        return professeurB.nbCoursAssignes - professeurA.nbCoursAssignes;
      }

      return String(professeurA.matricule || "").localeCompare(
        String(professeurB.matricule || ""),
        "fr"
      );
    });
}

function professeurExistantCompatibleAvecPlan(professeur, plan) {
  const specialite = normalizeAcademicText(professeur?.specialiteNormalisee);
  const programme = normalizeAcademicText(plan?.programme);

  if (!specialite || !programme) {
    return false;
  }

  return (
    specialite === programme ||
    specialite.includes(programme) ||
    programme.includes(specialite)
  );
}

export function normalizeAcademicText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function buildAcademicTargetKey(programme, etape) {
  return `${normalizeAcademicText(programme)}|${String(etape ?? "").trim()}`;
}

export function buildAcademicCourses() {
  return ACADEMIC_PROGRAM_CATALOG.flatMap((program) =>
    program.courses.map((course) => ({
      ...course,
      duree: DEFAULT_COURSE_DURATION_HOURS,
      programme: program.programme,
      etape_etude: program.etape,
      est_en_ligne: 0,
      max_etudiants_par_groupe: TARGET_GROUP_SIZE,
      min_etudiants_par_groupe: 20,
      sessions_par_semaine: DEFAULT_SESSIONS_PER_WEEK,
    }))
  );
}

function buildInterleavedAcademicCourseCodes() {
  const orderedCourseCodes = [];
  const maxCourseCount = Math.max(
    ...ACADEMIC_PROGRAM_CATALOG.map((program) => program.courses.length)
  );

  for (let courseIndex = 0; courseIndex < maxCourseCount; courseIndex += 1) {
    for (const program of ACADEMIC_PROGRAM_CATALOG) {
      const course = program.courses[courseIndex];

      if (course?.code) {
        orderedCourseCodes.push(course.code);
      }
    }
  }

  return orderedCourseCodes;
}

function lireNombreGroupesRequis(requiredGroupsByProgram, programme) {
  if (!requiredGroupsByProgram) {
    return TARGET_GROUPS_PER_PROGRAM;
  }

  const cleNormalisee = buildAcademicTargetKey(
    programme?.programme,
    programme?.etape
  );
  const cleProgramme = normalizeAcademicText(programme?.programme);

  if (requiredGroupsByProgram instanceof Map) {
    const valeur =
      requiredGroupsByProgram.get(cleNormalisee) ??
      requiredGroupsByProgram.get(cleProgramme) ??
      requiredGroupsByProgram.get(programme?.programme);
    const nombre = Number(valeur);
    return Number.isInteger(nombre) && nombre > 0
      ? nombre
      : TARGET_GROUPS_PER_PROGRAM;
  }

  const valeur =
    requiredGroupsByProgram[cleNormalisee] ??
    requiredGroupsByProgram[cleProgramme] ??
    requiredGroupsByProgram[programme?.programme];
  const nombre = Number(valeur);
  return Number.isInteger(nombre) && nombre > 0
    ? nombre
    : TARGET_GROUPS_PER_PROGRAM;
}

/**
 * Algorithme de packing greedy des professeurs par programme.
 *
 * Stratégie enterprise  :
 *  1. Collecter TOUS les cours de toutes les étapes du programme
 *     avec leur charge hebdomadaire réelle (nbGroupes × sessions/sem).
 *  2. Trier : charge décroissante (étapes avec plus de groupes d'abord),
 *     puis par ordre d'étape (1 avant 4) pour la cohérence pédagogique.
 *  3. Greedy bin-packing dans des slots de MAX_WEEKLY_SESSIONS_PER_PROFESSOR :
 *     - Remplir le slot le plus chargé pouvant encore absorber le cours.
 *     - Créer un nouveau slot seulement si aucun existant ne peut absorber.
 *  4. Résultat : professeurs à 80-100% de charge, pas de sous-utilisation.
 *
 * Avant (par famille de cours) : 7 profs/programme × 8 programmes = 56 profs à 70%
 * Après (par programme complet) : ~12 profs/programme × 8 programmes = ~96 profs à 90%+
 */
function construirePlansProfesseursProgramme(programmeBase, requiredGroupsByProgram) {
  // 1. Collecter tous les items cours×étape avec leur charge
  const items = [];

  for (const etape of ACADEMIC_STAGES) {
    const nbGroupes = lireChargeProgrammeEtape(
      requiredGroupsByProgram,
      programmeBase.programme,
      etape
    );

    if (nbGroupes <= 0) {
      continue;
    }

    for (const courseBase of programmeBase.courses) {
      const codeCours = creerCodeCoursEtape(courseBase.code, etape);
      // Charge = nbGroupes × sessions_par_semaine (1 par défaut)
      items.push({
        code: codeCours,
        charge: nbGroupes * DEFAULT_SESSIONS_PER_WEEK,
        etape: Number(etape),
        estCoursCle: Boolean(courseBase.est_cours_cle),
      });
    }
  }

  if (items.length === 0) {
    return [];
  }

  // 2. Trier : charge décroissante d'abord, puis étape croissante (1→4)
  items.sort((a, b) => {
    if (b.charge !== a.charge) {
      return b.charge - a.charge;
    }
    return a.etape - b.etape;
  });

  // 3. Greedy bin-packing
  const slots = [];

  for (const item of items) {
    // Trouver le slot le plus chargé qui peut encore absorber ce cours
    const slotCible = slots
      .filter(
        (slot) =>
          slot.load + item.charge <= MAX_WEEKLY_SESSIONS_PER_PROFESSOR &&
          slot.codes.length < MAX_COURSES_PER_PROFESSOR
      )
      .sort((slotA, slotB) => slotB.load - slotA.load)[0];

    if (slotCible) {
      slotCible.codes.push(item.code);
      slotCible.load += item.charge;
    } else {
      // Nouveau professeur nécessaire
      slots.push({
        codes: [item.code],
        load: item.charge,
        programme: programmeBase.programme,
      });
    }
  }

  // 4. Convertir en plans
  return slots
    .filter((slot) => slot.codes.length > 0)
    .map((slot) => ({
      programme: slot.programme,
      assignedCourseCodes: [...new Set(slot.codes)],
      estimatedWeeklyLoad: slot.load,
    }));
}

function buildProfessorCoursePlans(options = {}) {
  const { requiredGroupsByProgram = null } = options;
  return BASE_ACADEMIC_PROGRAM_CATALOG.flatMap((programmeBase) =>
    construirePlansProfesseursProgramme(programmeBase, requiredGroupsByProgram)
  ).filter((plan) => plan.assignedCourseCodes.length > 0);
}

export function buildAcademicProfessors(options = {}) {
  const { existingProfessors = [] } = options;
  const coursePlans = buildProfessorCoursePlans(options);
  const professorIdentities = buildProfessorIdentities(coursePlans.length);
  const existingProfessorPool = buildExistingProfessorReusePool(existingProfessors);
  const existingProfesseursUtilises = new Set();
  const programmeByCourseCode = new Map(
    ACADEMIC_PROGRAM_CATALOG.flatMap((program) =>
      program.courses.map((course) => [course.code, program.programme])
    )
  );

  return coursePlans.map((plan, index) => {
    const assignedCourseCodes = [...new Set(plan.assignedCourseCodes || [])];
    const programmes = [...new Set(
      assignedCourseCodes
        .map((courseCode) => programmeByCourseCode.get(courseCode))
        .filter(Boolean)
    )];
    const professeurExistant = existingProfessorPool.find(
      (professeur) =>
        !existingProfesseursUtilises.has(professeur.cleIdentite) &&
        professeurExistantCompatibleAvecPlan(professeur, plan)
    );
    const identity = professeurExistant || professorIdentities[index];

    if (professeurExistant) {
      existingProfesseursUtilises.add(professeurExistant.cleIdentite);
    }

    return {
      matricule:
        professeurExistant?.matricule ||
        `AUTO-PROF-${String(index + 1).padStart(2, "0")}`,
      nom: identity.nom,
      prenom: identity.prenom,
      specialite:
        professeurExistant?.specialite ||
        (programmes.length === 1 ? programmes[0] : null),
      programme: programmes[0] || null,
      assignedCourseCodes,
      estimatedWeeklyLoad: Number(plan.estimatedWeeklyLoad || 0),
    };
  });
}

export function getAcademicBootstrapTargets() {
  // Peupler TOUTES les étapes 1, 2, 3, 4 avec des étudiants.
  // Un vrai collège a des cohortes actives à chaque niveau d'étude.
  // TARGET_STUDENTS_PER_PROGRAM = 4 groupes × 28 étudiants = 112 par programme×étape.
  // Total : 8 programmes × 4 étapes × 112 = 3584 étudiants.
  return ACADEMIC_PROGRAM_CATALOG.map((program) => ({
    programme: program.programme,
    etape: program.etape,
    targetStudentCount: TARGET_STUDENTS_PER_PROGRAM,
  }));
}

export function createProfessorAvailabilityRows(idProfesseur) {
  return [1, 2, 3, 4, 5].map((jour) => ({
    id_professeur: idProfesseur,
    jour_semaine: jour,
    heure_debut: "08:00:00",
    heure_fin: "20:00:00",
  }));
}
