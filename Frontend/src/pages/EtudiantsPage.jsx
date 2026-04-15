import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { CourseExchangePanel } from "../components/etudiants/CourseExchangePanel.jsx";
import { EtudiantDetails } from "../components/etudiants/EtudiantDetails.jsx";
import { EtudiantsFilters } from "../components/etudiants/EtudiantsFilters.jsx";
import { EtudiantsHero } from "../components/etudiants/EtudiantsHero.jsx";
import { EtudiantsTable } from "../components/etudiants/EtudiantsTable.jsx";
import { FeedbackBanner } from "../components/ui/FeedbackBanner.jsx";
import { useEtudiants } from "../hooks/useEtudiants.js";
import {
  calculerStatistiquesEtudiants,
  extraireEtapesEtudiants,
  extraireGroupes,
  extraireProgrammesEtudiants,
  extraireSessionsEtudiants,
  filtrerEtudiants,
} from "../utils/etudiants.utils.js";
import { ecouterSynchronisationPlanning } from "../utils/planningSync.js";
import "../styles/EtudiantsPage.css";
import "../styles/PlanningEtudiantPage.css";

/**
 * Page principale de gestion des etudiants.
 *
 * Cette page orchestre trois usages complementaires :
 * - importer un fichier d'etudiants ;
 * - parcourir et filtrer la liste ;
 * - consulter la fiche et l'horaire reconstitue d'un etudiant.
 */
export function EtudiantsPage({ utilisateur, onLogout }) {
  const {
    etudiants,
    consultationsParId,
    etatChargement,
    messageErreur,
    detailsErreur,
    actionEnCours,
    recharger,
    consulter,
    importer,
    invaliderConsultations,
  } = useEtudiants();

  const [recherche, setRecherche] = useState("");
  const [groupeSelectionne, setGroupeSelectionne] = useState("tous");
  const [programmeSelectionne, setProgrammeSelectionne] = useState("tous");
  const [sessionSelectionnee, setSessionSelectionnee] = useState("toutes");
  const [etapeSelectionnee, setEtapeSelectionnee] = useState("toutes");
  const [etudiantSelectionneId, setEtudiantSelectionneId] = useState(null);
  const [vueActive, setVueActive] = useState("liste");
  const [messageSucces, setMessageSucces] = useState("");
  const inputImportRef = useRef(null);

  const rechercheDifferee = useDeferredValue(recherche);
  const groupes = useMemo(() => extraireGroupes(etudiants), [etudiants]);
  const programmes = useMemo(
    () => extraireProgrammesEtudiants(etudiants),
    [etudiants]
  );
  const sessions = useMemo(() => extraireSessionsEtudiants(etudiants), [etudiants]);
  const etapes = useMemo(() => extraireEtapesEtudiants(etudiants), [etudiants]);
  const statistiques = useMemo(
    () => calculerStatistiquesEtudiants(etudiants),
    [etudiants]
  );

  const etudiantsFiltres = useMemo(
    () =>
      filtrerEtudiants(etudiants, rechercheDifferee, {
        groupeSelectionne,
        programmeSelectionne,
        sessionSelectionnee,
        etapeSelectionnee,
      }),
    [
      etudiants,
      rechercheDifferee,
      groupeSelectionne,
      programmeSelectionne,
      sessionSelectionnee,
      etapeSelectionnee,
    ]
  );

  const etudiantSelectionne = useMemo(
    () =>
      etudiants.find((etudiant) => etudiant.id_etudiant === etudiantSelectionneId) || null,
    [etudiants, etudiantSelectionneId]
  );

  useEffect(() => {
    if (etudiantsFiltres.length === 0) {
      setEtudiantSelectionneId(null);
      setVueActive("liste");
      return;
    }

    if (
      etudiantSelectionneId &&
      !etudiantsFiltres.some((etudiant) => etudiant.id_etudiant === etudiantSelectionneId)
    ) {
      setEtudiantSelectionneId(null);
      setVueActive("liste");
    }
  }, [etudiantsFiltres, etudiantSelectionneId]);

  const chargerConsultationSelectionnee = useEffectEvent((idEtudiant, options) => {
    void consulter(idEtudiant, options).catch(() => {});
  });

  useEffect(() => {
    if (!etudiantSelectionneId) {
      return;
    }

    chargerConsultationSelectionnee(etudiantSelectionneId);
  }, [chargerConsultationSelectionnee, etudiantSelectionneId]);

  useEffect(() => {
    return ecouterSynchronisationPlanning((payload) => {
      const etudiantsImpactes = [
        ...(Array.isArray(payload?.etudiants_impactes)
          ? payload.etudiants_impactes
          : []),
        ...(Array.isArray(payload?.etudiants_reprises_impactes)
          ? payload.etudiants_reprises_impactes
          : []),
      ].map((idEtudiant) => Number(idEtudiant));

      invaliderConsultations(etudiantsImpactes);

      if (etudiantsImpactes.length > 0) {
        // Un changement de groupe modifie le groupe principal affiche dans la
        // liste, pas seulement le detail horaire. On recharge donc la liste
        // pour garder l'UI alignée avec la base dès la synchronisation.
        void recharger();
      }

      if (!etudiantSelectionneId) {
        return;
      }

      const idActif = Number(etudiantSelectionneId);

      if (etudiantsImpactes.length > 0 && !etudiantsImpactes.includes(idActif)) {
        return;
      }

      chargerConsultationSelectionnee(idActif, { forcer: true });
    });
  }, [chargerConsultationSelectionnee, etudiantSelectionneId, invaliderConsultations, recharger]);

  const consultationSelectionnee = etudiantSelectionneId
    ? consultationsParId[etudiantSelectionneId] || {
        etudiant: etudiantSelectionne,
        horaire: null,
      }
    : null;

  function ouvrirImport() {
    setMessageSucces("");
    inputImportRef.current?.click();
  }

  async function gererSelectionFichier(event) {
    const fichier = event.target.files?.[0];

    if (!fichier) {
      return;
    }

    try {
      const resultat = await importer(fichier);
      const segments = [resultat.message];
      const nombreImportes = Number(resultat.nombre_importes || 0);
      const nombreMisAJour = Number(resultat.nombre_mis_a_jour || 0);
      const nombreCoursEchoues = Number(resultat.nombre_cours_echoues_importes || 0);

      if (nombreImportes > 0) {
        segments.push(`${nombreImportes} etudiant(s) ajoute(s).`);
      }

      if (nombreMisAJour > 0) {
        segments.push(`${nombreMisAJour} etudiant(s) mis a jour.`);
      }

      if (nombreCoursEchoues > 0) {
        segments.push(`${nombreCoursEchoues} cours echoue(s) importes.`);
      }

      const nombreEtudiantsIgnores = Number(resultat.nombre_etudiants_ignores || 0);
      const nombreCohortesIgnorees = Number(resultat.nombre_cohortes_ignorees || 0);

      if (nombreEtudiantsIgnores > 0) {
        segments.push(`${nombreEtudiantsIgnores} etudiant(s) non utilisable(s) ignore(s).`);
      }

      if (nombreCohortesIgnorees > 0) {
        segments.push(`${nombreCohortesIgnorees} cohorte(s) non exploitable(s) ignoree(s).`);
      }

      setEtudiantSelectionneId(null);
      setVueActive("liste");
      setMessageSucces(segments.join(" "));
    } finally {
      event.target.value = "";
    }
  }

  function selectionnerEtudiant(idEtudiant) {
    startTransition(() => {
      setEtudiantSelectionneId(idEtudiant);
      setVueActive("detail");
      setMessageSucces("");
    });
  }

  function retournerALaListe() {
    setVueActive("liste");
  }

  async function rechargerHoraireSelectionne() {
    if (!etudiantSelectionneId) {
      return;
    }

    await consulter(etudiantSelectionneId, { forcer: true });
  }

  const afficherVueDetail = vueActive === "detail" && Boolean(etudiantSelectionneId);

  return (
    <AppShell utilisateur={utilisateur} onLogout={onLogout} title="Horaires etudiants" subtitle="Consultez le groupe principal, les reprises et les exceptions individuelles de suivi dans un horaire fusionne.">
      <div className="page-layout">
        <input
          ref={inputImportRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={gererSelectionFichier}
        />

        <EtudiantsHero
          statistiques={statistiques}
          onImporter={ouvrirImport}
          importEnCours={actionEnCours === "import"}
          surChargement={etatChargement === "loading"}
        />

        <FeedbackBanner type="success" message={messageSucces} />
        <FeedbackBanner
          type="error"
          message={messageErreur}
          details={detailsErreur}
          maxDetails={8}
        />

        <EtudiantsFilters
          recherche={recherche}
          onRechercheChange={setRecherche}
          groupeSelectionne={groupeSelectionne}
          groupes={groupes}
          onGroupeChange={setGroupeSelectionne}
          programmeSelectionne={programmeSelectionne}
          programmes={programmes}
          onProgrammeChange={setProgrammeSelectionne}
          sessionSelectionnee={sessionSelectionnee}
          sessions={sessions}
          onSessionChange={setSessionSelectionnee}
          etapeSelectionnee={etapeSelectionnee}
          etapes={etapes}
          onEtapeChange={setEtapeSelectionnee}
          totalAffiche={etudiantsFiltres.length}
          totalGlobal={etudiants.length}
          onRecharger={recharger}
          surChargement={etatChargement === "loading"}
        />

        <CourseExchangePanel
          etudiants={etudiants}
          etudiantSelectionneId={etudiantSelectionneId}
        />

        <div className={`content-grid ${afficherVueDetail ? "content-grid--detail" : ""}`}>
          {!afficherVueDetail ? (
            <EtudiantsTable
              etudiants={etudiantsFiltres}
              etudiantSelectionneId={etudiantSelectionneId}
              onSelectionner={selectionnerEtudiant}
              actionEnCours={actionEnCours}
              surChargement={etatChargement === "loading"}
              surRafraichissement={etatChargement === "refreshing"}
              estEnErreur={etatChargement === "error"}
              messageErreur={messageErreur}
            />
          ) : null}

          {afficherVueDetail ? (
            <EtudiantDetails
              consultation={consultationSelectionnee}
              actionEnCours={actionEnCours}
              chargementConsultation={
                Boolean(etudiantSelectionneId) &&
                actionEnCours === `consultation-${etudiantSelectionneId}`
              }
              onRechargerHoraire={rechargerHoraireSelectionne}
              onRetourListe={retournerALaListe}
              affichagePleinEcran
            />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
