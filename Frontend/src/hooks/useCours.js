import { useEffect, useState } from "react";
import {
  creerCours,
  modifierCours,
  recupererCours,
  recupererOptionsCours,
  supprimerCours,
} from "../services/cours.api.js";

export function useCours() {
  const [cours, setCours] = useState([]);
  const [typesSalleDisponibles, setTypesSalleDisponibles] = useState([]);
  const [etatChargement, setEtatChargement] = useState("idle");
  const [messageErreur, setMessageErreur] = useState("");
  const [actionEnCours, setActionEnCours] = useState("");

  async function chargerCours({ conserverListe = false } = {}) {
    setEtatChargement(conserverListe ? "refreshing" : "loading");
    setMessageErreur("");

    try {
      const [listeCours, optionsCours] = await Promise.all([
        recupererCours(),
        recupererOptionsCours(),
      ]);

      setCours(listeCours);
      setTypesSalleDisponibles(optionsCours.types_salle || []);
      setEtatChargement("success");
      return listeCours;
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
        const [listeCours, optionsCours] = await Promise.all([
          recupererCours(),
          recupererOptionsCours(),
        ]);

        if (!estActif) {
          return;
        }

        setCours(listeCours);
        setTypesSalleDisponibles(optionsCours.types_salle || []);
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

  async function executerAction(action, identifiantAction) {
    setActionEnCours(identifiantAction);
    setMessageErreur("");

    try {
      const resultat = await action();
      await chargerCours({ conserverListe: true });
      return resultat;
    } catch (error) {
      setMessageErreur(error.message);
      throw error;
    } finally {
      setActionEnCours("");
    }
  }

  return {
    cours,
    typesSalleDisponibles,
    etatChargement,
    messageErreur,
    actionEnCours,
    recharger: () => chargerCours({ conserverListe: cours.length > 0 }),
    creer: (donneesCours) => executerAction(() => creerCours(donneesCours), "creation"),
    modifier: (idCours, donneesCours) =>
      executerAction(() => modifierCours(idCours, donneesCours), `modification-${idCours}`),
    supprimer: (idCours) =>
      executerAction(() => supprimerCours(idCours), `suppression-${idCours}`),
  };
}
