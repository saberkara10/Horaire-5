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
import { EtudiantDetails } from "../components/etudiants/EtudiantDetails.jsx";
import { EtudiantsFilters } from "../components/etudiants/EtudiantsFilters.jsx";
import { EtudiantsHero } from "../components/etudiants/EtudiantsHero.jsx";
import { EtudiantsTable } from "../components/etudiants/EtudiantsTable.jsx";
import { FeedbackBanner } from "../components/ui/FeedbackBanner.jsx";
import { useEtudiants } from "../hooks/useEtudiants.js";
import {
  calculerStatistiquesEtudiants,
  extraireGroupes,
  filtrerEtudiants,
} from "../utils/etudiants.utils.js";

/**
 * Page principale de gestion des etudiants.
 *
 * Cette page orchestre trois usages complementaires :
 * - importer un fichier d'etudiants ;
 * - parcourir et filtrer la liste ;
 * - consulter la fiche et l'horaire reconstitue d'un etudiant.
 */
export function EtudiantsPage({ moduleActif, onChangerModule }) {
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
  } = useEtudiants();

  const [recherche, setRecherche] = useState("");
  const [groupeSelectionne, setGroupeSelectionne] = useState("tous");
  const [etudiantSelectionneId, setEtudiantSelectionneId] = useState(null);
  const [messageSucces, setMessageSucces] = useState("");
  const inputImportRef = useRef(null);

  const rechercheDifferee = useDeferredValue(recherche);
  const groupes = useMemo(() => extraireGroupes(etudiants), [etudiants]);
  const statistiques = useMemo(
    () => calculerStatistiquesEtudiants(etudiants),
    [etudiants]
  );

  const etudiantsFiltres = useMemo(
    () => filtrerEtudiants(etudiants, rechercheDifferee, groupeSelectionne),
    [etudiants, rechercheDifferee, groupeSelectionne]
  );

  const etudiantSelectionne = useMemo(
    () =>
      etudiants.find((etudiant) => etudiant.id_etudiant === etudiantSelectionneId) || null,
    [etudiants, etudiantSelectionneId]
  );

  useEffect(() => {
    // On maintient automatiquement une selection valide afin que le panneau
    // de details reste utile apres un filtrage ou un nouvel import.
    if (etudiantsFiltres.length === 0) {
      setEtudiantSelectionneId(null);
      return;
    }

    const selectionExisteEncore = etudiantsFiltres.some(
      (etudiant) => etudiant.id_etudiant === etudiantSelectionneId
    );

    if (!selectionExisteEncore) {
      setEtudiantSelectionneId(etudiantsFiltres[0].id_etudiant);
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
      setMessageSucces(
        `${resultat.message} ${resultat.nombre_importes} etudiant(s) ajoute(s).`
      );
    } finally {
      event.target.value = "";
    }
  }

  function selectionnerEtudiant(idEtudiant) {
    startTransition(() => {
      setEtudiantSelectionneId(idEtudiant);
      setMessageSucces("");
    });
  }

  async function rechargerHoraireSelectionne() {
    if (!etudiantSelectionneId) {
      return;
    }

    await consulter(etudiantSelectionneId, { forcer: true });
  }

  return (
    <AppShell moduleActif={moduleActif} onChangerModule={onChangerModule}>
      <div className="page-layout">
        <input
          ref={inputImportRef}
          type="file"
          accept=".xlsx,.csv"
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
          totalAffiche={etudiantsFiltres.length}
          totalGlobal={etudiants.length}
          onRecharger={recharger}
          surChargement={etatChargement === "loading"}
        />

        <div className="content-grid">
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

          <EtudiantDetails
            consultation={consultationSelectionnee}
            actionEnCours={actionEnCours}
            chargementConsultation={
              Boolean(etudiantSelectionneId) &&
              actionEnCours === `consultation-${etudiantSelectionneId}`
            }
            onRechargerHoraire={rechargerHoraireSelectionne}
          />
        </div>
      </div>
    </AppShell>
  );
}
