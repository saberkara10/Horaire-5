/**
 * Definitions centralisees des formats d'import Excel.
 *
 * Chaque definition sert a trois usages :
 * - valider les colonnes cote backend ;
 * - generer un modele Excel telechargeable ;
 * - documenter le contrat d'import dans l'UI et dans les docs.
 */

export const IMPORT_EXCEL_DEFINITIONS = {
  professeurs: {
    moduleKey: "professeurs",
    moduleLabel: "Professeurs",
    filename: "modele-import-professeurs.xlsx",
    sheetName: "Professeurs",
    preferredSheetNames: ["Professeurs", "professeurs", "Enseignants"],
    columns: [
      {
        key: "matricule",
        required: true,
        description: "Identifiant metier unique du professeur.",
        example: "P-2026-001",
        aliases: ["id_professeur", "code_professeur"],
      },
      {
        key: "nom",
        required: true,
        description: "Nom de famille du professeur.",
        example: "Diallo",
        aliases: [],
      },
      {
        key: "prenom",
        required: true,
        description: "Prenom du professeur.",
        example: "Aminata",
        aliases: ["prenom", "prenom_professeur"],
      },
      {
        key: "specialite",
        required: false,
        description:
          "Specialite libre. Si la colonne est presente mais vide, la valeur existante est effacee.",
        example: "Programmation informatique",
        aliases: ["specialite_programme", "programme", "programmes"],
      },
      {
        key: "cours_codes",
        required: false,
        description:
          "Liste de codes cours separes par ';', ',' ou retour ligne. Remplace les habilitations existantes si la colonne est presente.",
        example: "INF101; INF102",
        aliases: [
          "cours",
          "codes_cours",
          "cours_assignes",
          "cours_autorises",
          "cours_codes",
        ],
      },
    ],
    exampleRows: [
      {
        matricule: "P-2026-001",
        nom: "Diallo",
        prenom: "Aminata",
        specialite: "Programmation informatique",
        cours_codes: "INF101; INF102",
      },
      {
        matricule: "P-2026-002",
        nom: "Nguyen",
        prenom: "Thi",
        specialite: "",
        cours_codes: "WEB201",
      },
    ],
    notes: [
      "Chaque ligne cree ou met a jour un professeur existant.",
      "La recherche d'un professeur existant se fait d'abord par matricule, puis par combinaison nom + prenom.",
      "Si la colonne cours_codes est absente, les cours deja autorises sont conserves.",
      "Si la colonne specialite est absente, la specialite existante est conservee.",
    ],
  },
  salles: {
    moduleKey: "salles",
    moduleLabel: "Salles",
    filename: "modele-import-salles.xlsx",
    sheetName: "Salles",
    preferredSheetNames: ["Salles", "salles"],
    columns: [
      {
        key: "code",
        required: true,
        description: "Code unique de la salle.",
        example: "B204",
        aliases: ["code_salle", "salle"],
      },
      {
        key: "type",
        required: true,
        description: "Type metier de la salle.",
        example: "Laboratoire",
        aliases: ["type_salle"],
      },
      {
        key: "capacite",
        required: true,
        description: "Capacite maximale de la salle.",
        example: "24",
        aliases: ["capacite_max", "places", "nb_places"],
      },
    ],
    exampleRows: [
      {
        code: "B204",
        type: "Laboratoire",
        capacite: "24",
      },
      {
        code: "A101",
        type: "Salle de cours",
        capacite: "35",
      },
    ],
    notes: [
      "Le modele metier actuel des salles stocke uniquement code, type et capacite.",
      "Les colonnes campus, bloc ou batiment ne sont pas persistees dans la version actuelle du produit.",
      "Une salle existante est mise a jour sur sa capacite et son type si le code existe deja.",
    ],
  },
  cours: {
    moduleKey: "cours",
    moduleLabel: "Cours",
    filename: "modele-import-cours.xlsx",
    sheetName: "Cours",
    preferredSheetNames: ["Cours", "cours"],
    columns: [
      {
        key: "code",
        required: true,
        description: "Code unique du cours.",
        example: "INF301",
        aliases: ["code_cours"],
      },
      {
        key: "nom",
        required: true,
        description: "Intitule du cours.",
        example: "Reseaux",
        aliases: ["nom_cours"],
      },
      {
        key: "duree",
        required: true,
        description:
          "Duree du cours en heures. Pour rester editable dans l'UI actuelle, seules les valeurs entieres de 1 a 4 sont acceptees.",
        example: "2",
        aliases: ["duree_heures", "heures", "nb_heures"],
      },
      {
        key: "programme",
        required: true,
        description: "Programme academique rattache au cours.",
        example: "Programmation informatique",
        aliases: ["programme_cours"],
      },
      {
        key: "etape_etude",
        required: true,
        description: "Etape academique comprise entre 1 et 8.",
        example: "3",
        aliases: ["etape", "niveau", "session_niveau"],
      },
      {
        key: "salle_reference_code",
        required: true,
        description: "Code de la salle de reference existante.",
        example: "B204",
        aliases: [
          "salle_reference",
          "code_salle_reference",
          "salle_code",
          "salle_reference_code",
        ],
      },
      {
        key: "type_salle",
        required: false,
        description:
          "Controle optionnel du type de salle attendu. Si fourni, il doit correspondre au type reel de la salle de reference.",
        example: "Laboratoire",
        aliases: ["type_salle_reference"],
      },
    ],
    exampleRows: [
      {
        code: "INF301",
        nom: "Reseaux",
        duree: "2",
        programme: "Programmation informatique",
        etape_etude: "3",
        salle_reference_code: "B204",
        type_salle: "Laboratoire",
      },
      {
        code: "WEB201",
        nom: "API Web",
        duree: "3",
        programme: "Developpement Web",
        etape_etude: "2",
        salle_reference_code: "A101",
        type_salle: "salle de cours",
      },
    ],
    notes: [
      "La salle de reference doit deja exister dans le module Salles.",
      "Le type de salle du cours est toujours aligne sur la salle de reference reelle.",
      "Si la colonne type_salle est absente, le controle de coherence se fait uniquement via la salle de reference.",
    ],
  },
};

export function recupererDefinitionImportExcel(moduleKey) {
  return IMPORT_EXCEL_DEFINITIONS[moduleKey] || null;
}
