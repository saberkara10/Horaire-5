import { useEffect, useState } from "react";
import {
  creerProfesseur,
  modifierProfesseur,
  recupererProfesseurs,
  supprimerProfesseur,
} from "../services/professeurs.api.js";

function trierProfesseursParMatricule(listeProfesseurs) {
  return [...listeProfesseurs].sort((professeurA, professeurB) =>
    String(professeurA.matricule).localeCompare(
      String(professeurB.matricule),
      "fr",
      { numeric: true, sensitivity: "base" }
    )
  );
}

export function useProfesseurs() {
  const [professeurs, setProfesseurs] = useState([]);
  const [etatChargement, setEtatChargement] = useState("idle");
  const [messageErreur, setMessageErreur] = useState("");
  const [actionEnCours, setActionEnCours] = useState("");

  async function chargerProfesseurs({ conserverListe = false } = {}) {
    setEtatChargement(conserverListe ? "refreshing" : "loading");
    setMessageErreur("");

    try {
      const listeProfesseurs = await recupererProfesseurs();
      setProfesseurs(listeProfesseurs);
      setEtatChargement("success");
      return listeProfesseurs;
    } catch (error) {
      setMessageErreur(error.message);
      setEtatChargement("error");
      throw error;
    }
  }

  useEffect(() => {
    let estActif = true;

    async function chargerAuMontage() {
      try {
        const listeProfesseurs = await recupererProfesseurs();

        if (!estActif) {
          return;
        }

        setProfesseurs(listeProfesseurs);
        setEtatChargement("success");
      } catch (error) {
        if (!estActif) {
          return;
        }

        setMessageErreur(error.message);
        setEtatChargement("error");
      }
    }

    setEtatChargement("loading");
    setMessageErreur("");
    void chargerAuMontage();

    return () => {
      estActif = false;
    };
  }, []);

  async function executerAction(action, identifiantAction, appliquerResultat) {
    setActionEnCours(identifiantAction);
    setMessageErreur("");

    try {
      const resultat = await action();
      appliquerResultat(resultat);
      setEtatChargement("success");
      return resultat;
    } catch (error) {
      setMessageErreur(error.message);
      throw error;
    } finally {
      setActionEnCours("");
    }
  }

  return {
    professeurs,
    etatChargement,
    messageErreur,
    actionEnCours,
    recharger: () => chargerProfesseurs({ conserverListe: professeurs.length > 0 }),
    creer: (donneesProfesseur) =>
      executerAction(
        () => creerProfesseur(donneesProfesseur),
        "creation",
        (nouveauProfesseur) => {
          setProfesseurs((listeActuelle) =>
            trierProfesseursParMatricule([...listeActuelle, nouveauProfesseur])
          );
        }
      ),
    modifier: (idProfesseur, donneesProfesseur) =>
      executerAction(
        () => modifierProfesseur(idProfesseur, donneesProfesseur),
        `modification-${idProfesseur}`,
        (professeurModifie) => {
          setProfesseurs((listeActuelle) =>
            trierProfesseursParMatricule(
              listeActuelle.map((professeur) =>
                professeur.id_professeur === idProfesseur
                  ? professeurModifie
                  : professeur
              )
            )
          );
        }
      ),
    supprimer: (idProfesseur) =>
      executerAction(
        () => supprimerProfesseur(idProfesseur),
        `suppression-${idProfesseur}`,
        () => {
          setProfesseurs((listeActuelle) =>
            listeActuelle.filter(
              (professeur) => professeur.id_professeur !== idProfesseur
            )
          );
        }
      ),
  };
}
