import { useEffect, useState } from "react";
import {
  importerEtudiants,
  recupererEtudiants,
  recupererHoraireEtudiant,
} from "../services/etudiants.api.js";

const OPTIONS_ETUDIANTS_SESSION_ACTIVE = {
  sessionActive: true,
};

function aChamp(objet, champ) {
  return Boolean(objet) && Object.prototype.hasOwnProperty.call(objet, champ);
}

function verifierStructureListeEtudiants(listeEtudiants) {
  if (!Array.isArray(listeEtudiants) || listeEtudiants.length === 0) {
    return listeEtudiants;
  }

  const premierEtudiant = listeEtudiants[0];
  if (
    !aChamp(premierEtudiant, "nb_reprises") ||
    !aChamp(premierEtudiant, "nb_cours_normaux") ||
    !aChamp(premierEtudiant, "charge_cible")
  ) {
    const erreur = new Error(
      "Le backend actif n'est pas a jour pour les horaires etudiants. Redemarrez le serveur backend puis rechargez la page."
    );
    erreur.details = [
      "La liste etudiants recue ne contient pas les champs de charge academique attendus.",
    ];
    throw erreur;
  }

  return listeEtudiants;
}

function verifierStructureConsultationEtudiant(consultationHoraire) {
  const etudiant = consultationHoraire?.etudiant;

  if (!etudiant || !aChamp(etudiant, "charge_cible") || !aChamp(etudiant, "nb_reprises")) {
    const erreur = new Error(
      "Le backend actif n'est pas a jour pour l'horaire etudiant. Redemarrez le serveur backend puis rechargez la page."
    );
    erreur.details = [
      "La fiche etudiant recue ne contient pas les metadonnees de charge cible attendues.",
    ];
    throw erreur;
  }

  if (!aChamp(consultationHoraire, "resume")) {
    const erreur = new Error(
      "Le backend actif n'est pas a jour pour l'horaire etudiant. Redemarrez le serveur backend puis rechargez la page."
    );
    erreur.details = [
      "La reponse horaire recue ne contient pas le resume fusionne attendu.",
    ];
    throw erreur;
  }

  return consultationHoraire;
}

// Le tri par matricule est centralise ici pour garantir le meme ordre
// d'affichage apres un chargement initial, un import ou une actualisation.
function trierEtudiantsParMatricule(listeEtudiants) {
  return [...listeEtudiants].sort((etudiantA, etudiantB) =>
    String(etudiantA.matricule).localeCompare(String(etudiantB.matricule), "fr", {
      numeric: true,
      sensitivity: "base",
    })
  );
}

/**
 * Hook metier du module etudiants.
 *
 * Il encapsule :
 * - le chargement de la liste ;
 * - la consultation detaillee d'un etudiant et de son horaire ;
 * - l'import de fichier ;
 * - la transformation des erreurs backend en messages lisibles par l'UI.
 */
export function useEtudiants() {
  const [etudiants, setEtudiants] = useState([]);
  const [consultationsParId, setConsultationsParId] = useState({});
  const [etatChargement, setEtatChargement] = useState("idle");
  const [messageErreur, setMessageErreur] = useState("");
  const [detailsErreur, setDetailsErreur] = useState([]);
  const [actionEnCours, setActionEnCours] = useState("");

  async function chargerEtudiants({ conserverListe = false } = {}) {
    setEtatChargement(conserverListe ? "refreshing" : "loading");
    setMessageErreur("");
    setDetailsErreur([]);

    try {
      const listeEtudiants = verifierStructureListeEtudiants(
        await recupererEtudiants(OPTIONS_ETUDIANTS_SESSION_ACTIVE)
      );
      setEtudiants(trierEtudiantsParMatricule(listeEtudiants));
      setEtatChargement("success");
      return listeEtudiants;
    } catch (error) {
      setMessageErreur(error.message);
      setDetailsErreur(error.details ?? []);
      setEtatChargement("error");
      throw error;
    }
  }

  useEffect(() => {
    let estActif = true;

    async function chargerAuMontage() {
      try {
        const listeEtudiants = verifierStructureListeEtudiants(
          await recupererEtudiants(OPTIONS_ETUDIANTS_SESSION_ACTIVE)
        );

        if (!estActif) {
          return;
        }

        setEtudiants(trierEtudiantsParMatricule(listeEtudiants));
        setEtatChargement("success");
      } catch (error) {
        if (!estActif) {
          return;
        }

        setMessageErreur(error.message);
        setDetailsErreur(error.details ?? []);
        setEtatChargement("error");
      }
    }

    setEtatChargement("loading");
    setMessageErreur("");
    setDetailsErreur([]);
    void chargerAuMontage();

    return () => {
      estActif = false;
    };
  }, []);

  async function consulter(idEtudiant, { forcer = false } = {}) {
    // La consultation detaillee est mise en cache par identifiant pour eviter
    // de recharger inutilement le meme etudiant a chaque selection.
    if (!forcer && consultationsParId[idEtudiant]) {
      return consultationsParId[idEtudiant];
    }

    setActionEnCours(`consultation-${idEtudiant}`);
    setMessageErreur("");
    setDetailsErreur([]);

    try {
      const consultationHoraire = verifierStructureConsultationEtudiant(
        await recupererHoraireEtudiant(idEtudiant)
      );

      const consultation = {
        etudiant: consultationHoraire.etudiant ?? null,
        horaire: consultationHoraire.horaire ?? [],
        horaireGroupe: consultationHoraire.horaire_groupe ?? [],
        horaireReprises: consultationHoraire.horaire_reprises ?? [],
        horaireIndividuel: consultationHoraire.horaire_individuel ?? [],
        reprises: consultationHoraire.reprises ?? [],
        exceptionsIndividuelles:
          consultationHoraire.exceptions_individuelles ?? [],
        diagnosticReprises: consultationHoraire.diagnostic_reprises ?? [],
        resume: consultationHoraire.resume ?? null,
      };

      setConsultationsParId((consultationsActuelles) => ({
        ...consultationsActuelles,
        [idEtudiant]: consultation,
      }));

      return consultation;
    } catch (error) {
      setMessageErreur(error.message);
      setDetailsErreur(error.details ?? []);
      throw error;
    } finally {
      setActionEnCours("");
    }
  }

  async function importer(fichier) {
    setActionEnCours("import");
    setMessageErreur("");
    setDetailsErreur([]);

    try {
      const resultat = await importerEtudiants(fichier);
      const listeEtudiants = verifierStructureListeEtudiants(
        await recupererEtudiants(OPTIONS_ETUDIANTS_SESSION_ACTIVE)
      );

      // Apres un import reussi, on recharge la liste complete afin que
      // l'interface reflète l'etat reel de la base et les nouveaux groupes.
      setEtudiants(trierEtudiantsParMatricule(listeEtudiants));
      setConsultationsParId({});
      setEtatChargement("success");

      return resultat;
    } catch (error) {
      setMessageErreur(construireMessageErreurImport(error));
      setDetailsErreur(error.details ?? []);
      throw error;
    } finally {
      setActionEnCours("");
    }
  }

  function invaliderConsultations(idsEtudiants = []) {
    const ids = [...new Set(
      (Array.isArray(idsEtudiants) ? idsEtudiants : [])
        .map((idEtudiant) => Number(idEtudiant))
        .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0)
    )];

    if (ids.length === 0) {
      return;
    }

    setConsultationsParId((consultationsActuelles) => {
      const prochainEtat = { ...consultationsActuelles };

      for (const idEtudiant of ids) {
        delete prochainEtat[idEtudiant];
      }

      return prochainEtat;
    });
  }

  return {
    etudiants,
    consultationsParId,
    etatChargement,
    messageErreur,
    detailsErreur,
    actionEnCours,
    recharger: () => chargerEtudiants({ conserverListe: etudiants.length > 0 }),
    consulter,
    importer,
    invaliderConsultations,
  };
}

function construireMessageErreurImport(error) {
  // On convertit ici les erreurs techniques ou metier du backend en messages
  // concis pour la bannière principale. Les details complets restent affiches
  // a part afin d'eviter des blocs de texte trop lourds dans l'interface.
  if (error.status === 409 && (error.details?.length ?? 0) > 0) {
    return "Import refuse : certains etudiants sont deja presents dans la base de donnees.";
  }

  if (error.message === "Aucun fichier fourni.") {
    return "Import impossible : aucun fichier n'a ete selectionne.";
  }

  if (error.message === "Format de fichier non supporte.") {
    return "Import impossible : le fichier doit etre au format .xls, .xlsx ou .csv.";
  }

  if (error.message === "Fichier vide.") {
    return "Import impossible : le fichier ne contient aucune donnee etudiant exploitable.";
  }

  if (error.message === "Colonnes obligatoires manquantes.") {
    return "Import impossible : le fichier ne contient pas toutes les colonnes attendues.";
  }

  if (error.message === "Impossible de lire le fichier.") {
    return "Import impossible : le fichier envoye ne peut pas etre lu correctement.";
  }

  if (error.message === "Fichier trop volumineux.") {
    return "Import impossible : le fichier depasse la taille maximale autorisee.";
  }

  if ((error.details?.length ?? 0) > 0) {
    return error.message;
  }

  return error.message || "Import impossible.";
}
