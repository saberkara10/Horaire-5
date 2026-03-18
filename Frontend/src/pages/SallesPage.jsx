import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { SalleFormModal } from "../components/salles/SalleFormModal.jsx";
import { SallesFilters } from "../components/salles/SallesFilters.jsx";
import { SallesHero } from "../components/salles/SallesHero.jsx";
import { SallesTable } from "../components/salles/SallesTable.jsx";
import { FeedbackBanner } from "../components/ui/FeedbackBanner.jsx";
import { useSalles } from "../hooks/useSalles.js";
import { calculerStatistiques, extraireTypes, filtrerSalles } from "../utils/salles.utils.js";

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
  const types = useMemo(() => extraireTypes(salles), [salles]);
  const statistiques = useMemo(() => calculerStatistiques(salles), [salles]);

  const sallesFiltrees = useMemo(
    () => filtrerSalles(salles, rechercheDifferee, typeSelectionne),
    [salles, rechercheDifferee, typeSelectionne]
  );

  const salleSelectionnee = useMemo(
    () => salles.find((salle) => salle.id_salle === salleSelectionneeId) || null,
    [salles, salleSelectionneeId]
  );

  function ouvrirCreation() {
    setMessageSucces("");
    setEtatModal({ ouvert: true, mode: "creation" });
  }

  function ouvrirEdition(salle) {
    setMessageSucces("");
    setSalleSelectionneeId(salle.id_salle);
    setEtatModal({ ouvert: true, mode: "edition" });
  }

  function fermerModal() {
    setEtatModal((etatActuel) => ({ ...etatActuel, ouvert: false }));
  }

  async function soumettreSalle(donneesSalle) {
    if (etatModal.mode === "creation") {
      await creer(donneesSalle);
      setMessageSucces("La salle a ete ajoutee avec succes.");
      fermerModal();
      return;
    }

    if (!salleSelectionnee) {
      throw new Error("Aucune salle selectionnee.");
    }

    await modifier(salleSelectionnee.id_salle, donneesSalle);
    setMessageSucces("La salle a ete mise a jour avec succes.");
    fermerModal();
  }

  async function supprimerSalleSelectionnee(salle) {
    const suppressionConfirmee = window.confirm(
      `Supprimer la salle ${salle.code} ?`
    );

    if (!suppressionConfirmee) {
      return;
    }

    await supprimer(salle.id_salle);
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
          types={types}
          onTypeChange={setTypeSelectionne}
          totalAffiche={sallesFiltrees.length}
          totalGlobal={salles.length}
          onRecharger={recharger}
          surChargement={etatChargement === "loading"}
        />

        <SallesTable
          salles={sallesFiltrees}
          salleSelectionneeId={salleSelectionneeId}
          onSelectionner={(id) => startTransition(() => setSalleSelectionneeId(id))}
          onEditer={ouvrirEdition}
          onSupprimer={supprimerSalleSelectionnee}
          actionEnCours={actionEnCours}
          surChargement={etatChargement === "loading"}
          estEnErreur={etatChargement === "error"}
        />

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
