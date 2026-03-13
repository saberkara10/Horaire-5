import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { CoursDetails } from "../components/cours/CoursDetails.jsx";
import { CoursFilters } from "../components/cours/CoursFilters.jsx";
import { CoursFormModal } from "../components/cours/CoursFormModal.jsx";
import { CoursHero } from "../components/cours/CoursHero.jsx";
import { CoursTable } from "../components/cours/CoursTable.jsx";
import { FeedbackBanner } from "../components/ui/FeedbackBanner.jsx";
import { useCours } from "../hooks/useCours.js";
import {
  calculerStatistiquesCours,
  extraireEtapes,
  extraireProgrammes,
  filtrerCours,
} from "../utils/cours.utils.js";

export function CoursPage({ moduleActif, onChangerModule }) {
  const {
    cours,
    typesSalleDisponibles,
    etatChargement,
    messageErreur,
    actionEnCours,
    recharger,
    creer,
    modifier,
    supprimer,
  } = useCours();

  const [recherche, setRecherche] = useState("");
  const [programmeSelectionne, setProgrammeSelectionne] = useState("tous");
  const [etapeSelectionnee, setEtapeSelectionnee] = useState("toutes");
  const [coursSelectionneId, setCoursSelectionneId] = useState(null);
  const [messageSucces, setMessageSucces] = useState("");
  const [etatModal, setEtatModal] = useState({ ouvert: false, mode: "creation" });

  const rechercheDifferee = useDeferredValue(recherche);
  const programmes = useMemo(() => extraireProgrammes(cours), [cours]);
  const etapes = useMemo(() => extraireEtapes(cours), [cours]);
  const statistiques = useMemo(() => calculerStatistiquesCours(cours), [cours]);

  const coursFiltres = useMemo(
    () => filtrerCours(cours, rechercheDifferee, programmeSelectionne, etapeSelectionnee),
    [cours, rechercheDifferee, programmeSelectionne, etapeSelectionnee]
  );

  useEffect(() => {
    if (coursFiltres.length === 0) {
      setCoursSelectionneId(null);
      return;
    }

    const selectionExisteEncore = coursFiltres.some(
      (element) => element.id_cours === coursSelectionneId
    );

    if (!selectionExisteEncore) {
      setCoursSelectionneId(coursFiltres[0].id_cours);
    }
  }, [coursFiltres, coursSelectionneId]);

  const coursSelectionne = useMemo(
    () => cours.find((element) => element.id_cours === coursSelectionneId) || null,
    [cours, coursSelectionneId]
  );

  function ouvrirCreation() {
    setMessageSucces("");
    setEtatModal({ ouvert: true, mode: "creation" });
  }

  function ouvrirEdition() {
    if (!coursSelectionne) {
      return;
    }

    setMessageSucces("");
    setEtatModal({ ouvert: true, mode: "edition" });
  }

  function fermerModal() {
    setEtatModal((etatActuel) => ({ ...etatActuel, ouvert: false }));
  }

  function selectionnerCours(idCours) {
    startTransition(() => {
      setCoursSelectionneId(idCours);
      setMessageSucces("");
    });
  }

  async function soumettreCours(donneesCours) {
    if (etatModal.mode === "creation") {
      const nouveauCours = await creer(donneesCours);
      setMessageSucces("Le cours a ete ajoute avec succes.");
      fermerModal();
      startTransition(() => {
        setCoursSelectionneId(nouveauCours.id_cours);
      });
      return;
    }

    if (!coursSelectionne) {
      throw new Error("Aucun cours selectionne.");
    }

    const coursModifie = await modifier(coursSelectionne.id_cours, donneesCours);
    setMessageSucces("Le cours a ete mis a jour avec succes.");
    fermerModal();
    startTransition(() => {
      setCoursSelectionneId(coursModifie.id_cours);
    });
  }

  async function supprimerCoursSelectionne() {
    if (!coursSelectionne) {
      return;
    }

    const suppressionConfirmee = window.confirm(
      `Supprimer le cours ${coursSelectionne.code} ?`
    );

    if (!suppressionConfirmee) {
      return;
    }

    await supprimer(coursSelectionne.id_cours);
    setMessageSucces("Le cours a ete supprime avec succes.");
  }

  return (
    <AppShell moduleActif={moduleActif} onChangerModule={onChangerModule}>
      <div className="page-layout">
        <CoursHero
          statistiques={statistiques}
          onAjouter={ouvrirCreation}
          surChargement={etatChargement === "loading"}
        />

        <FeedbackBanner type="success" message={messageSucces} />
        <FeedbackBanner type="error" message={messageErreur} />

        <CoursFilters
          recherche={recherche}
          onRechercheChange={setRecherche}
          programmeSelectionne={programmeSelectionne}
          programmes={programmes}
          onProgrammeChange={setProgrammeSelectionne}
          etapeSelectionnee={etapeSelectionnee}
          etapes={etapes}
          onEtapeChange={setEtapeSelectionnee}
          totalAffiche={coursFiltres.length}
          totalGlobal={cours.length}
          onRecharger={recharger}
          surChargement={etatChargement === "loading"}
        />

        <div className="content-grid">
          <CoursTable
            cours={coursFiltres}
            coursSelectionneId={coursSelectionneId}
            onSelectionner={selectionnerCours}
            actionEnCours={actionEnCours}
            surChargement={etatChargement === "loading"}
            surRafraichissement={etatChargement === "refreshing"}
            estEnErreur={etatChargement === "error"}
            messageErreur={messageErreur}
          />

          <CoursDetails
            cours={coursSelectionne}
            onEditer={ouvrirEdition}
            onSupprimer={supprimerCoursSelectionne}
            suppressionDesactivee={!coursSelectionne || actionEnCours !== ""}
            actionEnCours={actionEnCours}
          />
        </div>

        <CoursFormModal
          estOuvert={etatModal.ouvert}
          mode={etatModal.mode}
          cours={etatModal.mode === "edition" ? coursSelectionne : null}
          typesSalleDisponibles={typesSalleDisponibles}
          onFermer={fermerModal}
          onSoumettre={soumettreCours}
          actionEnCours={actionEnCours}
        />
      </div>
    </AppShell>
  );
}
