/**
 * Configuration UI des imports Excel integres dans les modules CRUD.
 *
 * Le backend reste la source de verite pour la validation reelle, mais cette
 * configuration permet de presenter un contrat lisible directement dans l'UI
 * sans disperser les informations dans chaque page.
 */
export const IMPORT_EXCEL_MODULES = {
  professeurs: {
    moduleKey: "professeurs",
    moduleLabel: "Professeurs",
    afficherDescription: false,
    afficherMeta: false,
    afficherDescriptionsColonnes: false,
    afficherNotes: false,
    description:
      "Importez ou mettez a jour les professeurs sans quitter cette page. Les lignes valides sont enregistrees et les lignes en erreur sont detaillees.",
    columns: [
      {
        key: "matricule",
        required: true,
        description: "Identifiant metier unique du professeur.",
      },
      {
        key: "nom",
        required: true,
        description: "Nom de famille du professeur.",
      },
      {
        key: "prenom",
        required: true,
        description: "Prenom du professeur.",
      },
      {
        key: "specialite",
        required: false,
        description:
          "Optionnel. Si la colonne est presente mais vide, la specialite existante est effacee.",
      },
      {
        key: "cours_codes",
        required: false,
        description:
          "Optionnel. Liste separee par ';', ',' ou retour ligne. Si la colonne est presente, elle remplace les cours existants.",
      },
    ],
    notes: [
      "Recherche d'un professeur existant par matricule, puis par combinaison nom + prenom.",
      "Si la colonne cours_codes est absente, les cours deja autorises sont conserves.",
      "Si la colonne specialite est absente, la specialite existante est conservee.",
      "Les codes cours importes doivent deja exister dans le module Cours.",
    ],
  },
  salles: {
    moduleKey: "salles",
    moduleLabel: "Salles",
    afficherDescription: false,
    afficherMeta: false,
    afficherDescriptionsColonnes: false,
    afficherNotes: false,
    description:
      "Importez les salles directement dans le module existant. Le systeme cree ou met a jour les salles a partir de leur code.",
    columns: [
      {
        key: "code",
        required: true,
        description: "Code unique de la salle.",
      },
      {
        key: "type",
        required: true,
        description: "Type metier de la salle.",
      },
      {
        key: "capacite",
        required: true,
        description: "Capacite maximale de la salle.",
      },
    ],
    notes: [
      "Le modele actuel des salles persiste uniquement code, type et capacite.",
      "Une salle existante est mise a jour si son code est deja present en base.",
      "Les colonnes campus, bloc ou batiment ne sont pas persistees dans la version actuelle.",
    ],
  },
  cours: {
    moduleKey: "cours",
    moduleLabel: "Cours",
    afficherDescription: false,
    afficherMeta: false,
    afficherDescriptionsColonnes: false,
    afficherNotes: false,
    description:
      "Importez ou mettez a jour les cours depuis Excel. Les cours references restent ensuite modifiables depuis le formulaire manuel actuel.",
    columns: [
      {
        key: "code",
        required: true,
        description: "Code unique du cours.",
      },
      {
        key: "nom",
        required: true,
        description: "Intitule du cours.",
      },
      {
        key: "duree",
        required: false,
        description: "Valeur fixe a 3 heures. Toute autre valeur est ignoree.",
      },
      {
        key: "programme",
        required: true,
        description: "Programme academique du cours.",
      },
      {
        key: "etape_etude",
        required: true,
        description: "Etape academique comprise entre 1 et 8.",
      },
      {
        key: "salle_reference_code",
        required: true,
        description: "Code d'une salle existante du module Salles.",
      },
      {
        key: "type_salle",
        required: false,
        description:
          "Controle optionnel de coherence avec la salle de reference.",
      },
    ],
    notes: [
      "La salle de reference doit deja exister avant l'import du cours.",
      "Si type_salle est fourni, il doit correspondre au type reel de la salle referencee.",
      "Le code cours sert d'identifiant de mise a jour lors d'un reimport.",
    ],
  },
};

export function recupererConfigurationImportExcel(moduleKey) {
  return IMPORT_EXCEL_MODULES[moduleKey] || null;
}
