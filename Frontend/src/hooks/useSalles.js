import { useEffect, useState } from "react";
import {
  creerSalle,
  modifierSalle,
  recupererSalles,
  supprimerSalle,
} from "../services/salles.api.js";

function trierSallesParCode(listeSalles) {
  return [...listeSalles].sort((salleA, salleB) =>
    String(salleA.code).localeCompare(String(salleB.code), "fr", {
      numeric: true,
      sensitivity: "base",
    })
  );
}

export function useSalles() {
  const [salles, setSalles] = useState([]);
  const [etatChargement, setEtatChargement] = useState("idle");
  const [messageErreur, setMessageErreur] = useState("");
  const [actionEnCours, setActionEnCours] = useState("");

  async function chargerSalles({ conserverListe = false } = {}) {
    setEtatChargement(conserverListe ? "refreshing" : "loading");
    setMessageErreur("");

    try {
      const listeSalles = await recupererSalles();
      setSalles(trierSallesParCode(listeSalles));
      setEtatChargement("success");
      return listeSalles;
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
        const listeSalles = await recupererSalles();

        if (!estActif) {
          return;
        }

        setSalles(trierSallesParCode(listeSalles));
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

  async function recharger() {
    return chargerSalles({ conserverListe: salles.length > 0 });
  }

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
    salles,
    etatChargement,
    messageErreur,
    actionEnCours,
    recharger,
    creer: (donneesSalle) =>
      executerAction(() => creerSalle(donneesSalle), "creation", (nouvelleSalle) => {
        setSalles((listeActuelle) =>
          trierSallesParCode([...listeActuelle, nouvelleSalle])
        );
      }),
    modifier: (idSalle, donneesSalle) =>
      executerAction(
        () => modifierSalle(idSalle, donneesSalle),
        `modification-${idSalle}`,
        (salleModifiee) => {
          setSalles((listeActuelle) =>
            trierSallesParCode(
              listeActuelle.map((salle) =>
                salle.id_salle === idSalle ? salleModifiee : salle
              )
            )
          );
        }
      ),
    supprimer: (idSalle) =>
      executerAction(
        () => supprimerSalle(idSalle),
        `suppression-${idSalle}`,
        () => {
          setSalles((listeActuelle) =>
            listeActuelle.filter((salle) => salle.id_salle !== idSalle)
          );
        }
      ),
  };
}
