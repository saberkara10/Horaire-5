import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { ProfesseurDetails } from "../components/professeurs/ProfesseurDetails.jsx";
import { ProfesseurFormModal } from "../components/professeurs/ProfesseurFormModal.jsx";
import { ProfesseursFilters } from "../components/professeurs/ProfesseursFilters.jsx";
import { ProfesseursHero } from "../components/professeurs/ProfesseursHero.jsx";
import { ProfesseursTable } from "../components/professeurs/ProfesseursTable.jsx";
import { FeedbackBanner } from "../components/ui/FeedbackBanner.jsx";
import { useProfesseurs } from "../hooks/useProfesseurs.js";
import {
  calculerStatistiques,
  extraireSpecialites,
  filtrerProfesseurs,
} from "../utils/professeurs.utils.js";

export function ProfesseursPage({ moduleActif, onChangerModule }) {
  const {
    professeurs,
    etatChargement,
    messageErreur,
    actionEnCours,
    recharger,
    creer,
    modifier,
    supprimer,
  } = useProfesseurs();

  const [recherche, setRecherche] = useState("");
  const [specialiteSelectionnee, setSpecialiteSelectionnee] = useState("toutes");
  const [professeurSelectionneId, setProfesseurSelectionneId] = useState(null);
  const [messageSucces, setMessageSucces] = useState("");
  const [etatModal, setEtatModal] = useState({ ouvert: false, mode: "creation" });

  // La recherche est differree pour garder une saisie fluide
  // si la liste grossit dans les prochains sprints.
  const rechercheDifferee = useDeferredValue(recherche);
  const specialites = useMemo(() => extraireSpecialites(professeurs), [professeurs]);
  const statistiques = useMemo(() => calculerStatistiques(professeurs), [professeurs]);

  const professeursFiltres = useMemo(
    () => filtrerProfesseurs(professeurs, rechercheDifferee, specialiteSelectionnee),
    [professeurs, rechercheDifferee, specialiteSelectionnee]
  );

  useEffect(() => {
    if (professeursFiltres.length === 0) {
      setProfesseurSelectionneId(null);
      return;
    }

    const selectionExisteEncore = professeursFiltres.some(
      (professeur) => professeur.id_professeur === professeurSelectionneId
    );

    if (!selectionExisteEncore) {
      setProfesseurSelectionneId(professeursFiltres[0].id_professeur);
    }
  }, [professeursFiltres, professeurSelectionneId]);

  const professeurSelectionne = useMemo(
    () =>
      professeurs.find(
        (professeur) => professeur.id_professeur === professeurSelectionneId
      ) || null,
    [professeurs, professeurSelectionneId]
  );

  function ouvrirCreation() {
    setMessageSucces("");
    setEtatModal({ ouvert: true, mode: "creation" });
  }

  function ouvrirEdition() {
    if (!professeurSelectionne) {
      return;
    }

    setMessageSucces("");
    setEtatModal({ ouvert: true, mode: "edition" });
  }

  function fermerModal() {
    setEtatModal((etatActuel) => ({ ...etatActuel, ouvert: false }));
  }

  function selectionnerProfesseur(idProfesseur) {
    startTransition(() => {
      setProfesseurSelectionneId(idProfesseur);
      setMessageSucces("");
    });
  }

  async function soumettreProfesseur(donneesProfesseur) {
    if (etatModal.mode === "creation") {
      const nouveauProfesseur = await creer(donneesProfesseur);
      setMessageSucces("Le professeur a ete ajoute avec succes.");
      fermerModal();
      startTransition(() => {
        setProfesseurSelectionneId(nouveauProfesseur.id_professeur);
      });
      return;
    }

    if (!professeurSelectionne) {
      throw new Error("Aucun professeur selectionne.");
    }

    const professeurModifie = await modifier(
      professeurSelectionne.id_professeur,
      donneesProfesseur
    );

    setMessageSucces("Le professeur a ete mis a jour avec succes.");
    fermerModal();
    startTransition(() => {
      setProfesseurSelectionneId(professeurModifie.id_professeur);
    });
  }

  async function supprimerProfesseurSelectionne() {
    if (!professeurSelectionne) {
      return;
    }

    const suppressionConfirmee = window.confirm(
      `Supprimer ${professeurSelectionne.prenom} ${professeurSelectionne.nom} ?`
    );

    if (!suppressionConfirmee) {
      return;
    }

    await supprimer(professeurSelectionne.id_professeur);
    setMessageSucces("Le professeur a ete supprime avec succes.");
  }

  return (
    <AppShell moduleActif={moduleActif} onChangerModule={onChangerModule}>
      <div className="page-layout">
        <ProfesseursHero
          statistiques={statistiques}
          onAjouter={ouvrirCreation}
          surChargement={etatChargement === "loading"}
        />

        <FeedbackBanner type="success" message={messageSucces} />
        <FeedbackBanner type="error" message={messageErreur} />

        <ProfesseursFilters
          recherche={recherche}
          onRechercheChange={setRecherche}
          specialiteSelectionnee={specialiteSelectionnee}
          specialites={specialites}
          onSpecialiteChange={setSpecialiteSelectionnee}
          totalAffiche={professeursFiltres.length}
          totalGlobal={professeurs.length}
          onRecharger={recharger}
          surChargement={etatChargement === "loading"}
        />

        <div className="content-grid">
          <ProfesseursTable
            professeurs={professeursFiltres}
            professeurSelectionneId={professeurSelectionneId}
            onSelectionner={selectionnerProfesseur}
            actionEnCours={actionEnCours}
            surChargement={etatChargement === "loading"}
            surRafraichissement={etatChargement === "refreshing"}
            estEnErreur={etatChargement === "error"}
            messageErreur={messageErreur}
          />

          <ProfesseurDetails
            professeur={professeurSelectionne}
            onEditer={ouvrirEdition}
            onSupprimer={supprimerProfesseurSelectionne}
            suppressionDesactivee={!professeurSelectionne || actionEnCours !== ""}
            actionEnCours={actionEnCours}
          />
        </div>

        <ProfesseurFormModal
          estOuvert={etatModal.ouvert}
          mode={etatModal.mode}
          professeur={etatModal.mode === "edition" ? professeurSelectionne : null}
          onFermer={fermerModal}
          onSoumettre={soumettreProfesseur}
          actionEnCours={actionEnCours}
        />
      </div>
    </AppShell>
  );
}
