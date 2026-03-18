import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { SalleDetails } from "../components/salles/SalleDetails.jsx";
import { SalleFormModal } from "../components/salles/SalleFormModal.jsx";
import { SallesFilters } from "../components/salles/SallesFilters.jsx";
import { SallesHero } from "../components/salles/SallesHero.jsx";
import { SallesTable } from "../components/salles/SallesTable.jsx";
import { FeedbackBanner } from "../components/ui/FeedbackBanner.jsx";
import { useSalles } from "../hooks/useSalles.js";
import {
  calculerStatistiquesSalles,
  extraireTypesSalle,
  filtrerSalles,
} from "../utils/salles.utils.js";

export function SallesPage({ moduleActif, onChangerModule }) {
  const {
    salles,
    etatChargement,
    messageErreur,
    actionEnCours,
    recharger,
    creer,
    modifier,
    supprimer,
  } = useSalles();

  const [recherche, setRecherche] = useState("");
  const [typeSelectionne, setTypeSelectionne] = useState("tous");
  const [salleSelectionneeId, setSalleSelectionneeId] = useState(null);
  const [messageSucces, setMessageSucces] = useState("");
  const [etatModal, setEtatModal] = useState({ ouvert: false, mode: "creation" });

  const rechercheDifferee = useDeferredValue(recherche);
  const typesSalle = useMemo(() => extraireTypesSalle(salles), [salles]);
  const statistiques = useMemo(() => calculerStatistiquesSalles(salles), [salles]);

  const sallesFiltrees = useMemo(
    () => filtrerSalles(salles, rechercheDifferee, typeSelectionne),
    [salles, rechercheDifferee, typeSelectionne]
  );

  useEffect(() => {
    if (sallesFiltrees.length === 0) {
      setSalleSelectionneeId(null);
      return;
    }

    const selectionExisteEncore = sallesFiltrees.some(
      (salle) => salle.id_salle === salleSelectionneeId
    );

    if (!selectionExisteEncore) {
      setSalleSelectionneeId(sallesFiltrees[0].id_salle);
    }
  }, [sallesFiltrees, salleSelectionneeId]);

  const salleSelectionnee = useMemo(
    () => salles.find((salle) => salle.id_salle === salleSelectionneeId) || null,
    [salles, salleSelectionneeId]
  );

  function ouvrirCreation() {
    setMessageSucces("");
    setEtatModal({ ouvert: true, mode: "creation" });
  }

  function ouvrirEdition() {
    if (!salleSelectionnee) {
      return;
    }

    setMessageSucces("");
    setEtatModal({ ouvert: true, mode: "edition" });
  }

  function fermerModal() {
    setEtatModal((etatActuel) => ({ ...etatActuel, ouvert: false }));
  }

  function selectionnerSalle(idSalle) {
    startTransition(() => {
      setSalleSelectionneeId(idSalle);
      setMessageSucces("");
    });
  }

  async function soumettreSalle(donneesSalle) {
    if (etatModal.mode === "creation") {
      const nouvelleSalle = await creer(donneesSalle);
      setMessageSucces("La salle a ete ajoutee avec succes.");
      fermerModal();
      startTransition(() => {
        setSalleSelectionneeId(nouvelleSalle.id_salle);
      });
      return;
    }

    if (!salleSelectionnee) {
      throw new Error("Aucune salle selectionnee.");
    }

    const salleModifiee = await modifier(salleSelectionnee.id_salle, donneesSalle);
    setMessageSucces("La salle a ete mise a jour avec succes.");
    fermerModal();
    startTransition(() => {
      setSalleSelectionneeId(salleModifiee.id_salle);
    });
  }

  async function supprimerSalleSelectionnee() {
    if (!salleSelectionnee) {
      return;
    }

    const suppressionConfirmee = window.confirm(
      `Supprimer la salle ${salleSelectionnee.code} ?`
    );

    if (!suppressionConfirmee) {
      return;
    }

    await supprimer(salleSelectionnee.id_salle);
    setMessageSucces("La salle a ete supprimee avec succes.");
  }

  return (
    <AppShell moduleActif={moduleActif} onChangerModule={onChangerModule}>
      <div className="page-layout">
        <SallesHero
          statistiques={statistiques}
          onAjouter={ouvrirCreation}
          surChargement={etatChargement === "loading"}
        />

        <FeedbackBanner type="success" message={messageSucces} />
        <FeedbackBanner type="error" message={messageErreur} />

        <SallesFilters
          recherche={recherche}
          onRechercheChange={setRecherche}
          typeSelectionne={typeSelectionne}
          typesSalle={typesSalle}
          onTypeChange={setTypeSelectionne}
          totalAffiche={sallesFiltrees.length}
          totalGlobal={salles.length}
          onRecharger={recharger}
          surChargement={etatChargement === "loading"}
        />

        <div className="content-grid">
          <SallesTable
            salles={sallesFiltrees}
            salleSelectionneeId={salleSelectionneeId}
            onSelectionner={selectionnerSalle}
            actionEnCours={actionEnCours}
            surChargement={etatChargement === "loading"}
            surRafraichissement={etatChargement === "refreshing"}
            estEnErreur={etatChargement === "error"}
            messageErreur={messageErreur}
          />

          <SalleDetails
            salle={salleSelectionnee}
            onEditer={ouvrirEdition}
            onSupprimer={supprimerSalleSelectionnee}
            suppressionDesactivee={!salleSelectionnee || actionEnCours !== ""}
            actionEnCours={actionEnCours}
          />
        </div>

        <SalleFormModal
          estOuvert={etatModal.ouvert}
          mode={etatModal.mode}
          salle={etatModal.mode === "edition" ? salleSelectionnee : null}
          onFermer={fermerModal}
          onSoumettre={soumettreSalle}
          actionEnCours={actionEnCours}
        />
      </div>
    </AppShell>
  );
}
