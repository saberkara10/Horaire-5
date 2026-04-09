/**
 * PAGE - Affectations
 *
 * Cette page pilote la generation
 * et la gestion des affectations.
 */
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import { recupererCours } from "../services/cours.api.js";
import { recupererEtudiants } from "../services/etudiantsService.js";
import { recupererGroupes } from "../services/groupes.api.js";
import {
  creerAffectation,
  modifierAffectation,
  recupererHoraires,
  resetHoraires,
  supprimerAffectation,
} from "../services/horaire.api.js";
import { recupererProfesseurs } from "../services/professeurs.api.js";
import { recupererProgrammes } from "../services/programmes.api.js";
import {
  genererSessionScheduler,
  recupererSessionsScheduler,
} from "../services/scheduler.api.js";
import { recupererSalles } from "../services/salles.api.js";
import { creerDateLocale } from "../utils/calendar.js";
import { ecouterSynchronisationPlanning } from "../utils/planningSync.js";
import {
  SESSIONS_ACADEMIQUES,
  formaterLibelleCohorte,
} from "../utils/sessions.js";
import "../styles/AffectationsPage.css";

const ETAPES_REFERENCE = ["1", "2", "3", "4", "5", "6", "7", "8"];
const CAPACITE_MAX_GROUPE = 30;
const TABLE_PAGE_SIZE_OPTIONS = [50, 100, 250];
const TABLE_DEFAULT_PAGE_SIZE = 100;
const ROOM_STATUS_ORDER = {
  AVAILABLE: 0,
  OCCUPIED: 1,
  INCOMPATIBLE_TYPE: 2,
  CAPACITY_TOO_SMALL: 3,
};

function normaliserTexte(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formaterHeure(heure) {
  return heure ? heure.slice(0, 5) : "";
}

function heureVersMinutes(heure) {
  const [heures = "0", minutes = "0"] = formaterHeure(heure).split(":");
  return Number(heures) * 60 + Number(minutes);
}

function creneauxSeChevauchent(heureDebutA, heureFinA, heureDebutB, heureFinB) {
  return (
    heureVersMinutes(heureDebutA) < heureVersMinutes(heureFinB) &&
    heureVersMinutes(heureFinA) > heureVersMinutes(heureDebutB)
  );
}

function formaterDate(date) {
  if (!date) {
    return "";
  }

  const dateLocale = creerDateLocale(date);

  return dateLocale.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dateCouranteLocale() {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

function creerPlanificationInitiale() {
  return {
    id_groupes_etudiants: "",
    id_cours: "",
    id_professeur: "",
    id_salle: "",
    date: dateCouranteLocale(),
    heure_debut: "08:00",
    heure_fin: "11:00",
  };
}

function devinerSessionDepuisNomSession(nomSession) {
  const nomNormalise = normaliserTexte(nomSession);

  return (
    SESSIONS_ACADEMIQUES.find((session) =>
      nomNormalise.includes(normaliserTexte(session))
    ) || ""
  );
}

function extraireCoursIds(coursIds) {
  return String(coursIds || "")
    .split(",")
    .map((idCours) => Number(idCours.trim()))
    .filter((idCours) => Number.isInteger(idCours) && idCours > 0);
}

function creerCleSalleDate(idSalle, date) {
  return `${Number(idSalle) || 0}|${String(date || "").trim()}`;
}

function recupererSallesCompatiblesCours(cours, salles) {
  const idSalleReference = Number(cours?.id_salle_reference);

  if (Number.isInteger(idSalleReference) && idSalleReference > 0) {
    return salles.filter(
      (salle) => Number(salle.idSalleNombre ?? salle.id_salle) === idSalleReference
    );
  }

  const typeSalleCours =
    cours?.typeSalleNormalise || normaliserTexte(cours?.type_salle);

  if (!typeSalleCours) {
    return [];
  }

  return salles.filter(
    (salle) => (salle.typeNormalise || normaliserTexte(salle.type)) === typeSalleCours
  );
}

function determinerCapaciteMaximaleGroupes(cours, salles) {
  const capacitesParCours = cours
    .map((element) =>
      recupererSallesCompatiblesCours(element, salles)
        .map((salle) => Number(salle.capacite))
        .filter((capacite) => Number.isFinite(capacite) && capacite > 0)
    )
    .filter((capacites) => capacites.length > 0)
    .map((capacites) => Math.max(...capacites));

  if (capacitesParCours.length === 0) {
    return CAPACITE_MAX_GROUPE;
  }

  return Math.max(1, Math.min(CAPACITE_MAX_GROUPE, ...capacitesParCours));
}

function estimerGroupes(programme, etape, session, effectifTotal, capaciteMaximale) {
  if (!programme || !etape || !session || effectifTotal <= 0) {
    return [];
  }

  const capacite = Number(capaciteMaximale) > 0 ? Number(capaciteMaximale) : CAPACITE_MAX_GROUPE;
  const nombreGroupes = Math.max(1, Math.ceil(effectifTotal / capacite));
  const base = Math.floor(effectifTotal / nombreGroupes);
  const reste = effectifTotal % nombreGroupes;
  const prefixe = String(programme).replace(/\s+/g, " ").trim().slice(0, 70);

  return Array.from({ length: nombreGroupes }, (_, index) => ({
    id_groupes_etudiants: `preview-${index + 1}`,
    nom_groupe: `${prefixe} - E${etape} - ${session} - G${index + 1}`,
    etape,
    session,
    effectif: base + (index < reste ? 1 : 0),
    apercu: true,
  }));
}

export function AffectationsPage({ utilisateur, onLogout }) {
  const [cours, setCours] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [salles, setSalles] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [horaires, setHoraires] = useState([]);
  const [resumeGeneration, setResumeGeneration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [planificationEnCours, setPlanificationEnCours] = useState(false);
  const [resetEnCours, setResetEnCours] = useState(false);
  const [supprimerEtudiantsAuReset, setSupprimerEtudiantsAuReset] = useState(false);
  const [idAffectationEdition, setIdAffectationEdition] = useState(null);
  const { confirm, showError, showSuccess } = usePopup();
  const [filtresGeneration, setFiltresGeneration] = useState({
    programme: "",
    etape: "",
    session: "",
  });
  const [planificationManuelle, setPlanificationManuelle] = useState(
    creerPlanificationInitiale
  );
  const [filtresAffectations, setFiltresAffectations] = useState({
    recherche: "",
    professeur: "",
    groupe: "",
    date: "",
  });
  const [paginationAffectations, setPaginationAffectations] = useState({
    page: 1,
    pageSize: TABLE_DEFAULT_PAGE_SIZE,
  });
  const rechercheAffectationsDifferee = useDeferredValue(
    filtresAffectations.recherche
  );

  const chargerDonnees = useCallback(async () => {
    setLoading(true);

    try {
      const [
        coursData,
        etudiantsData,
        groupesData,
        professeursData,
        sallesData,
        programmesData,
        horairesData,
        sessionsData,
      ] = await Promise.all([
        recupererCours(),
        recupererEtudiants({ sessionActive: true }),
        recupererGroupes(true, {
          sessionActive: true,
          seulementAvecEffectif: true,
        }),
        recupererProfesseurs(),
        recupererSalles(),
        recupererProgrammes(),
        recupererHoraires({ sessionActive: true }),
        recupererSessionsScheduler(),
      ]);

      setCours(Array.isArray(coursData) ? coursData : []);
      setEtudiants(Array.isArray(etudiantsData) ? etudiantsData : []);
      setGroupes(Array.isArray(groupesData) ? groupesData : []);
      setProfesseurs(Array.isArray(professeursData) ? professeursData : []);
      setSalles(Array.isArray(sallesData) ? sallesData : []);
      setProgrammes(Array.isArray(programmesData) ? programmesData : []);
      setHoraires(Array.isArray(horairesData) ? horairesData : []);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
    } catch (error) {
      showError(error.message || "Impossible de charger les donnees.");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const rechargerHorairesActifs = useCallback(async () => {
    const horairesData = await recupererHoraires({ sessionActive: true });
    setHoraires(Array.isArray(horairesData) ? horairesData : []);
  }, []);

  const rechargerContexteActif = useCallback(async () => {
    const [horairesData, groupesData, etudiantsData] = await Promise.all([
      recupererHoraires({ sessionActive: true }),
      recupererGroupes(true, {
        sessionActive: true,
        seulementAvecEffectif: true,
      }),
      recupererEtudiants({ sessionActive: true }),
    ]);

    setHoraires(Array.isArray(horairesData) ? horairesData : []);
    setGroupes(Array.isArray(groupesData) ? groupesData : []);
    setEtudiants(Array.isArray(etudiantsData) ? etudiantsData : []);
  }, []);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  useEffect(() => {
    return ecouterSynchronisationPlanning(() => {
      rechargerHorairesActifs().catch(() => {});
    });
  }, [rechargerHorairesActifs]);

  const coursEnrichis = useMemo(
    () =>
      cours.map((element) => ({
        ...element,
        programmeNormalise: normaliserTexte(element.programme),
        etapeValeur: String(element.etape_etude || "").trim(),
        typeSalleNormalise: normaliserTexte(element.type_salle),
      })),
    [cours]
  );

  const etudiantsEnrichis = useMemo(
    () =>
      etudiants.map((etudiant) => ({
        ...etudiant,
        programmeNormalise: normaliserTexte(etudiant.programme),
        etapeValeur: String(etudiant.etape || "").trim(),
        sessionValeur: String(etudiant.session || "").trim(),
      })),
    [etudiants]
  );

  const groupesEnrichis = useMemo(
    () =>
      groupes.map((groupe) => ({
        ...groupe,
        programmeNormalise: normaliserTexte(groupe.programme),
        etapeValeur: String(groupe.etape || "").trim(),
        sessionValeur: String(groupe.session || "").trim(),
      })),
    [groupes]
  );

  const professeursEnrichis = useMemo(
    () =>
      professeurs.map((professeur) => ({
        ...professeur,
        nomComplet: `${professeur.prenom || ""} ${professeur.nom || ""}`.trim(),
        coursIdsSet: new Set(extraireCoursIds(professeur.cours_ids)),
      })),
    [professeurs]
  );

  const sallesEnrichies = useMemo(
    () =>
      salles.map((salle) => ({
        ...salle,
        idSalleNombre: Number(salle.id_salle) || 0,
        capaciteNombre: Number(salle.capacite) || 0,
        typeNormalise: normaliserTexte(salle.type),
      })),
    [salles]
  );

  const horairesEnrichis = useMemo(
    () =>
      horaires.map((affectation) => {
        const professeurNomComplet = `${affectation.professeur_prenom || ""} ${
          affectation.professeur_nom || ""
        }`.trim();

        return {
          ...affectation,
          idSalleNombre: Number(affectation.id_salle) || 0,
          professeurNomComplet,
          rechercheNormalisee: normaliserTexte(
            [
              affectation.cours_code,
              affectation.cours_nom,
              affectation.professeur_prenom,
              affectation.professeur_nom,
              affectation.salle_code,
              affectation.groupes,
            ].join(" ")
          ),
        };
      }),
    [horaires]
  );

  const horairesParSalleDate = useMemo(() => {
    const index = new Map();

    for (const affectation of horairesEnrichis) {
      const cle = creerCleSalleDate(affectation.id_salle, affectation.date);
      const existantes = index.get(cle);

      if (existantes) {
        existantes.push(affectation);
      } else {
        index.set(cle, [affectation]);
      }
    }

    return index;
  }, [horairesEnrichis]);

  const sessionActive = useMemo(
    () => sessions.find((session) => session.active) || null,
    [sessions]
  );

  useEffect(() => {
    if (!sessionActive || filtresGeneration.session) {
      return;
    }

    const sessionSuggeree = devinerSessionDepuisNomSession(sessionActive.nom);

    if (!sessionSuggeree) {
      return;
    }

    setFiltresGeneration((actuel) =>
      actuel.session ? actuel : { ...actuel, session: sessionSuggeree }
    );
  }, [filtresGeneration.session, sessionActive]);

  const programmeSelectionneNormalise = useMemo(
    () => normaliserTexte(filtresGeneration.programme),
    [filtresGeneration.programme]
  );

  const programmesDisponibles = useMemo(() => {
    return [...new Set(programmes.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "fr")
    );
  }, [programmes]);

  const etapesDisponibles = useMemo(() => {
    if (!programmeSelectionneNormalise) {
      return [];
    }

    const etapesCours = coursEnrichis
      .filter((element) => element.programmeNormalise === programmeSelectionneNormalise)
      .map((element) => element.etapeValeur);
    const etapesEtudiants = etudiantsEnrichis
      .filter((etudiant) => etudiant.programmeNormalise === programmeSelectionneNormalise)
      .map((etudiant) => etudiant.etapeValeur);

    return [...new Set([...etapesCours, ...etapesEtudiants].filter(Boolean))]
      .filter((etape) => ETAPES_REFERENCE.includes(etape))
      .sort((a, b) => Number(a) - Number(b));
  }, [coursEnrichis, etudiantsEnrichis, programmeSelectionneNormalise]);

  const sessionsDisponibles = useMemo(() => {
    if (!programmeSelectionneNormalise || !filtresGeneration.etape) {
      return [];
    }

    const sessionsEtudiant = new Set(
      etudiantsEnrichis
        .filter(
          (etudiant) =>
            etudiant.programmeNormalise === programmeSelectionneNormalise &&
            etudiant.etapeValeur === String(filtresGeneration.etape)
        )
        .map((etudiant) => etudiant.sessionValeur)
        .filter(Boolean)
    );

    return SESSIONS_ACADEMIQUES.filter((session) => sessionsEtudiant.has(session));
  }, [etudiantsEnrichis, filtresGeneration.etape, programmeSelectionneNormalise]);

  const coursFiltres = useMemo(() => {
    return coursEnrichis.filter((element) => {
      if (
        programmeSelectionneNormalise &&
        element.programmeNormalise !== programmeSelectionneNormalise
      ) {
        return false;
      }

      if (filtresGeneration.etape && element.etapeValeur !== String(filtresGeneration.etape)) {
        return false;
      }

      return true;
    });
  }, [coursEnrichis, filtresGeneration.etape, programmeSelectionneNormalise]);

  const capaciteMaximaleGroupes = useMemo(() => {
    return determinerCapaciteMaximaleGroupes(coursFiltres, sallesEnrichies);
  }, [coursFiltres, sallesEnrichies]);

  const etudiantsCohorte = useMemo(() => {
    return etudiantsEnrichis.filter((etudiant) => {
      if (
        programmeSelectionneNormalise &&
        etudiant.programmeNormalise !== programmeSelectionneNormalise
      ) {
        return false;
      }

      if (filtresGeneration.etape && etudiant.etapeValeur !== String(filtresGeneration.etape)) {
        return false;
      }

      if (
        filtresGeneration.session &&
        etudiant.sessionValeur !== String(filtresGeneration.session)
      ) {
        return false;
      }

      return true;
    });
  }, [
    etudiantsEnrichis,
    filtresGeneration.etape,
    filtresGeneration.session,
    programmeSelectionneNormalise,
  ]);

  const groupesFiltres = useMemo(() => {
    return groupesEnrichis.filter((groupe) => {
      if (
        programmeSelectionneNormalise &&
        groupe.programmeNormalise !== programmeSelectionneNormalise
      ) {
        return false;
      }

      if (filtresGeneration.etape && groupe.etapeValeur !== String(filtresGeneration.etape)) {
        return false;
      }

      if (
        filtresGeneration.session &&
        groupe.sessionValeur !== String(filtresGeneration.session)
      ) {
        return false;
      }

      return true;
    });
  }, [
    groupesEnrichis,
    filtresGeneration.etape,
    filtresGeneration.session,
    programmeSelectionneNormalise,
  ]);

  const groupesAPlanifier = useMemo(() => {
    return groupesFiltres.length > 0
      ? groupesFiltres
      : estimerGroupes(
          filtresGeneration.programme,
          filtresGeneration.etape,
          filtresGeneration.session,
          etudiantsCohorte.length,
          capaciteMaximaleGroupes
        );
  }, [
    capaciteMaximaleGroupes,
    etudiantsCohorte.length,
    filtresGeneration.etape,
    filtresGeneration.programme,
    filtresGeneration.session,
    groupesFiltres,
  ]);

  const groupesPlanificationManuelle = useMemo(() => {
    if (idAffectationEdition) {
      return groupesEnrichis
        .filter(
          (groupe) =>
            Number.isInteger(Number(groupe.id_groupes_etudiants)) &&
            Number(groupe.id_groupes_etudiants) > 0
        )
        .sort((groupeA, groupeB) =>
          String(groupeA.nom_groupe || "").localeCompare(
            String(groupeB.nom_groupe || ""),
            "fr"
          )
        );
    }

    const source =
      groupesFiltres.length > 0 || filtresGeneration.programme || filtresGeneration.etape
        ? groupesFiltres
        : groupesEnrichis;

    return source
      .filter(
        (groupe) =>
          Number.isInteger(Number(groupe.id_groupes_etudiants)) &&
          Number(groupe.id_groupes_etudiants) > 0
      )
      .sort((groupeA, groupeB) =>
        String(groupeA.nom_groupe || "").localeCompare(
          String(groupeB.nom_groupe || ""),
          "fr"
        )
      );
  }, [
    filtresGeneration.etape,
    filtresGeneration.programme,
    groupesEnrichis,
    groupesFiltres,
    idAffectationEdition,
  ]);

  const groupePlanificationActif = useMemo(() => {
    return (
      groupesPlanificationManuelle.find(
        (groupe) =>
          String(groupe.id_groupes_etudiants) ===
          String(planificationManuelle.id_groupes_etudiants)
      ) || null
    );
  }, [groupesPlanificationManuelle, planificationManuelle.id_groupes_etudiants]);

  const coursPlanificationManuelle = useMemo(() => {
    const programmeReference =
      groupePlanificationActif?.programme || filtresGeneration.programme;
    const etapeReference =
      groupePlanificationActif?.etape || filtresGeneration.etape;

    const programmeReferenceNormalise = normaliserTexte(programmeReference);

    return coursEnrichis
      .filter((element) => {
        if (
          programmeReferenceNormalise &&
          element.programmeNormalise !== programmeReferenceNormalise
        ) {
          return false;
        }

        if (etapeReference && element.etapeValeur !== String(etapeReference)) {
          return false;
        }

        return true;
      })
      .sort((coursA, coursB) =>
        `${coursA.code || ""} ${coursA.nom || ""}`.localeCompare(
          `${coursB.code || ""} ${coursB.nom || ""}`,
          "fr"
        )
      );
  }, [
    coursEnrichis,
    filtresGeneration.etape,
    filtresGeneration.programme,
    groupePlanificationActif,
  ]);

  const coursPlanificationActif = useMemo(() => {
    return (
      coursPlanificationManuelle.find(
        (element) => String(element.id_cours) === String(planificationManuelle.id_cours)
      ) || null
    );
  }, [coursPlanificationManuelle, planificationManuelle.id_cours]);

  const professeursPlanificationManuelle = useMemo(() => {
    const idCoursActif = Number(coursPlanificationActif?.id_cours);

    if (!Number.isInteger(idCoursActif) || idCoursActif <= 0) {
      return [];
    }

    return professeursEnrichis
      .filter((professeur) => professeur.coursIdsSet.has(idCoursActif))
      .sort((professeurA, professeurB) =>
        professeurA.nomComplet.localeCompare(professeurB.nomComplet, "fr")
      );
  }, [coursPlanificationActif, professeursEnrichis]);

  // NOTE : sallesPlanificationManuelle n'est plus utilisé directement —
  // sallesPlanificationManuelleAvecStatut travaille maintenant sur TOUTES les salles.
  // eslint-disable-next-line no-unused-vars


  // ── Statuts de salle enterprise (4 états) ──────────────────────────────
  // AVAILABLE         : libre, type compatible, capacité suffisante  → sélectionnable (vert)
  // OCCUPIED          : déjà prise à ce créneau              → bloquée (rouge)
  // INCOMPATIBLE_TYPE : type de salle ne correspond pas au cours  → bloquée (orange)
  // CAPACITY_TOO_SMALL: effectif > capacité                       → bloquée (gris)
  const disponibiliteSalles = useMemo(() => {
    const datePlanification = String(planificationManuelle.date || "").trim();
    const heureDebut = String(planificationManuelle.heure_debut || "").trim();
    const heureFin = String(planificationManuelle.heure_fin || "").trim();
    const creneauValide =
      Boolean(datePlanification && heureDebut && heureFin) &&
      heureVersMinutes(heureDebut) < heureVersMinutes(heureFin);
    const effectifGroupe = Number(groupePlanificationActif?.effectif) || 0;
    const typeSalleCours = coursPlanificationActif?.typeSalleNormalise || null;
    const idSalleReference = coursPlanificationActif
      ? Number(coursPlanificationActif.id_salle_reference)
      : null;
    const resume = {
      disponibles: 0,
      occupees: 0,
      incompatibles: 0,
      trop_petites: 0,
    };

    const sallesNotees = (coursPlanificationActif ? sallesEnrichies : []).map((salle) => {
      const typeSalle = salle.typeNormalise;
      const capacite = salle.capaciteNombre;

      // 1. Vérifier compatibilité de type
      let typeCompatible = false;
      if (
        Number.isInteger(idSalleReference) &&
        idSalleReference > 0 &&
        salle.idSalleNombre === idSalleReference
      ) {
        typeCompatible = true;
      } else if (typeSalleCours && typeSalle === typeSalleCours) {
        typeCompatible = true;
      }

      if (!typeCompatible) {
        resume.incompatibles += 1;
        return {
          ...salle,
          statut: "INCOMPATIBLE_TYPE",
          disponible: false,
          raison: `Type incompatible (cours: ${coursPlanificationActif?.type_salle || "standard"}, salle: ${salle.type || "?"})`,
          affectationExistante: null,
        };
      }

      // 2. Vérifier la capacité
      if (
        effectifGroupe > 0 &&
        salle.capaciteNombre > 0 &&
        salle.capaciteNombre < effectifGroupe
      ) {
        resume.trop_petites += 1;
        return {
          ...salle,
          statut: "CAPACITY_TOO_SMALL",
          disponible: false,
          raison: `Capacité insuffisante (${capacite} places pour ${effectifGroupe} étudiants)`,
          affectationExistante: null,
        };
      }

      // 3. Vérifier disponibilité au créneau
      if (!creneauValide) {
        resume.disponibles += 1;
        return {
          ...salle,
          statut: "AVAILABLE",
          disponible: true,
          raison: "Sélectionnez une date et un horaire pour vérifier la disponibilité.",
          affectationExistante: null,
        };
      }

      const affectationsSalle =
        horairesParSalleDate.get(creerCleSalleDate(salle.id_salle, datePlanification)) || [];
      const affectationExistante = affectationsSalle.find((affectation) => {
        if (
          idAffectationEdition &&
          Number(affectation.id_affectation_cours) === Number(idAffectationEdition)
        ) {
          return false;
        }
        return creneauxSeChevauchent(
          affectation.heure_debut,
          affectation.heure_fin,
          heureDebut,
          heureFin
        );
      });

      if (affectationExistante) {
        resume.occupees += 1;
        return {
          ...salle,
          statut: "OCCUPIED",
          disponible: false,
          raison: `Occupée — ${affectationExistante.cours_code || "cours"}${
            affectationExistante.groupes ? ` (${affectationExistante.groupes})` : ""
          } de ${formaterHeure(affectationExistante.heure_debut)} à ${formaterHeure(affectationExistante.heure_fin)}`,
          affectationExistante,
        };
      }

      resume.disponibles += 1;
      return {
        ...salle,
        statut: "AVAILABLE",
        disponible: true,
        raison: `Disponible — ${capacite} places${effectifGroupe > 0 ? ` pour ${effectifGroupe} étudiants` : ""}`,
        affectationExistante: null,
      };
    });

    // Tri enterprise : AVAILABLE d'abord (par capacité croissante), puis OCCUPIED, INCOMPATIBLE, CAPACITY
    const sallesPlanificationManuelleAvecStatut = [...sallesNotees].sort((salleA, salleB) => {
      const diff =
        (ROOM_STATUS_ORDER[salleA.statut] ?? 9) - (ROOM_STATUS_ORDER[salleB.statut] ?? 9);
      if (diff !== 0) {
        return diff;
      }
      // Parmi AVAILABLE : trier par capacité (la plus proche de l'effectif en premier)
      if (salleA.statut === "AVAILABLE" && effectifGroupe > 0) {
        return (
          Math.abs(Number(salleA.capacite) - effectifGroupe) -
          Math.abs(Number(salleB.capacite) - effectifGroupe)
        );
      }
      return String(salleA.code || "").localeCompare(String(salleB.code || ""), "fr");
    });
    return { sallesPlanificationManuelleAvecStatut, resumeDisponibiliteSalles: resume };
  }, [
    coursPlanificationActif,
    groupePlanificationActif,
    horairesParSalleDate,
    idAffectationEdition,
    planificationManuelle.date,
    planificationManuelle.heure_debut,
    planificationManuelle.heure_fin,
    sallesEnrichies,
  ]);


  const { sallesPlanificationManuelleAvecStatut, resumeDisponibiliteSalles } =
    disponibiliteSalles;

  const sallePlanificationSelectionnee = useMemo(() => {
    return (
      sallesPlanificationManuelleAvecStatut.find(
        (salle) => String(salle.id_salle) === String(planificationManuelle.id_salle)
      ) || null
    );
  }, [planificationManuelle.id_salle, sallesPlanificationManuelleAvecStatut]);


  const professeursCompatibles = useMemo(() => {
    const idsCoursSelectionnes = new Set(
      coursFiltres.map((element) => Number(element.id_cours)).filter(Boolean)
    );

    return professeursEnrichis.filter((professeur) => {
      for (const idCours of professeur.coursIdsSet) {
        if (idsCoursSelectionnes.has(idCours)) {
          return true;
        }
      }
      return false;
    });
  }, [coursFiltres, professeursEnrichis]);

  const resumeCohorte = useMemo(
    () => [
      { label: "Cours filtres", valeur: coursFiltres.length },
      { label: "Etudiants filtres", valeur: etudiantsCohorte.length },
      { label: "Groupes filtres", valeur: groupesAPlanifier.length },
      { label: "Professeurs compatibles", valeur: professeursCompatibles.length },
    ],
    [
      coursFiltres.length,
      etudiantsCohorte.length,
      groupesAPlanifier.length,
      professeursCompatibles.length,
    ]
  );

  const typesSallesRequis = useMemo(() => {
    return [...new Set(coursFiltres.map((element) => element.type_salle).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "fr")
    );
  }, [coursFiltres]);

  const sallesCompatibles = useMemo(() => {
    const idsSallesReference = new Set(
      coursFiltres
        .map((element) => Number(element.id_salle_reference))
        .filter((idSalle) => Number.isInteger(idSalle) && idSalle > 0)
    );
    const typesNormalises = new Set(typesSallesRequis.map((type) => normaliserTexte(type)));

    return sallesEnrichies
      .filter((salle) => {
        if (idsSallesReference.has(salle.idSalleNombre)) {
          return true;
        }

        return typesNormalises.has(salle.typeNormalise);
      })
      .sort((a, b) => {
        const compareType = String(a.type || "").localeCompare(String(b.type || ""), "fr");
        if (compareType !== 0) {
          return compareType;
        }

        return String(a.code || "").localeCompare(String(b.code || ""), "fr");
      });
  }, [coursFiltres, sallesEnrichies, typesSallesRequis]);

  const compteSallesCompatiblesParType = useMemo(() => {
    const compteurs = new Map();

    for (const salle of sallesCompatibles) {
      const cle = normaliserTexte(salle.type);
      compteurs.set(cle, (compteurs.get(cle) || 0) + 1);
    }

    return compteurs;
  }, [sallesCompatibles]);

  const horairesFiltres = useMemo(() => {
    const recherche = normaliserTexte(rechercheAffectationsDifferee);

    return horairesEnrichis.filter((affectation) => {
      if (
        filtresAffectations.professeur &&
        affectation.professeurNomComplet !== filtresAffectations.professeur
      ) {
        return false;
      }

      if (filtresAffectations.groupe && affectation.groupes !== filtresAffectations.groupe) {
        return false;
      }

      if (filtresAffectations.date && affectation.date !== filtresAffectations.date) {
        return false;
      }

      if (!recherche) {
        return true;
      }

      return affectation.rechercheNormalisee.includes(recherche);
    });
  }, [filtresAffectations, horairesEnrichis, rechercheAffectationsDifferee]);

  const groupesAffectationsDisponibles = useMemo(() => {
    return [...new Set(horairesEnrichis.map((affectation) => affectation.groupes).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "fr"));
  }, [horairesEnrichis]);

  const professeursAffectationsDisponibles = useMemo(() => {
    return [...new Set(horairesEnrichis.map((affectation) => affectation.professeurNomComplet).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "fr"));
  }, [horairesEnrichis]);

  const totalPagesAffectations = useMemo(
    () =>
      Math.max(1, Math.ceil(horairesFiltres.length / Math.max(1, paginationAffectations.pageSize))),
    [horairesFiltres.length, paginationAffectations.pageSize]
  );

  const pageAffectations = Math.min(paginationAffectations.page, totalPagesAffectations);

  const horairesVisibles = useMemo(() => {
    const indexDepart = (pageAffectations - 1) * paginationAffectations.pageSize;
    return horairesFiltres.slice(indexDepart, indexDepart + paginationAffectations.pageSize);
  }, [horairesFiltres, pageAffectations, paginationAffectations.pageSize]);

  const debutLigneAffectations =
    horairesFiltres.length === 0
      ? 0
      : (pageAffectations - 1) * paginationAffectations.pageSize + 1;
  const finLigneAffectations =
    horairesFiltres.length === 0
      ? 0
      : debutLigneAffectations + horairesVisibles.length - 1;

  useEffect(() => {
    setPaginationAffectations((actuel) =>
      actuel.page === 1 ? actuel : { ...actuel, page: 1 }
    );
  }, [
    filtresAffectations.recherche,
    filtresAffectations.professeur,
    filtresAffectations.groupe,
    filtresAffectations.date,
  ]);

  useEffect(() => {
    setPaginationAffectations((actuel) =>
      actuel.page > totalPagesAffectations
        ? { ...actuel, page: totalPagesAffectations }
        : actuel
    );
  }, [totalPagesAffectations]);

  useEffect(() => {
    setPlanificationManuelle((actuel) => {
      const groupeExiste = groupesPlanificationManuelle.some(
        (groupe) =>
          String(groupe.id_groupes_etudiants) === String(actuel.id_groupes_etudiants)
      );
      const prochainGroupe = groupeExiste
        ? actuel.id_groupes_etudiants
        : groupesPlanificationManuelle[0]
          ? String(groupesPlanificationManuelle[0].id_groupes_etudiants)
          : "";

      if (prochainGroupe === actuel.id_groupes_etudiants) {
        return actuel;
      }

      return {
        ...actuel,
        id_groupes_etudiants: prochainGroupe,
        id_cours: "",
        id_professeur: "",
        id_salle: "",
      };
    });
  }, [groupesPlanificationManuelle]);

  useEffect(() => {
    setPlanificationManuelle((actuel) => {
      const coursExiste = coursPlanificationManuelle.some(
        (element) => String(element.id_cours) === String(actuel.id_cours)
      );
      const prochainCours = coursExiste
        ? actuel.id_cours
        : coursPlanificationManuelle[0]
          ? String(coursPlanificationManuelle[0].id_cours)
          : "";

      if (prochainCours === actuel.id_cours) {
        return actuel;
      }

      return {
        ...actuel,
        id_cours: prochainCours,
        id_professeur: "",
        id_salle: "",
      };
    });
  }, [coursPlanificationManuelle]);

  useEffect(() => {
    setPlanificationManuelle((actuel) => {
      const professeurExiste = professeursPlanificationManuelle.some(
        (professeur) =>
          String(professeur.id_professeur) === String(actuel.id_professeur)
      );
      const prochainProfesseur = professeurExiste
        ? actuel.id_professeur
        : professeursPlanificationManuelle[0]
          ? String(professeursPlanificationManuelle[0].id_professeur)
          : "";

      if (prochainProfesseur === actuel.id_professeur) {
        return actuel;
      }

      return {
        ...actuel,
        id_professeur: prochainProfesseur,
      };
    });
  }, [professeursPlanificationManuelle]);

  useEffect(() => {
    setPlanificationManuelle((actuel) => {
      const salleSelectionneeDisponible = sallesPlanificationManuelleAvecStatut.some(
        (salle) =>
          String(salle.id_salle) === String(actuel.id_salle) && salle.disponible
      );
      const prochaineSalleDisponible = sallesPlanificationManuelleAvecStatut.find(
        (salle) => salle.disponible
      );
      const prochaineSalle = salleSelectionneeDisponible
        ? actuel.id_salle
        : prochaineSalleDisponible
          ? String(prochaineSalleDisponible.id_salle)
          : "";

      if (prochaineSalle === actuel.id_salle) {
        return actuel;
      }

      return {
        ...actuel,
        id_salle: prochaineSalle,
      };
    });
  }, [sallesPlanificationManuelleAvecStatut]);

  const handleChoisirSalle = useCallback((idSalle) => {
    setPlanificationManuelle((actuel) => ({
      ...actuel,
      id_salle: String(idSalle),
    }));
  }, []);

  const handleChangerFiltre = useCallback((event) => {
    const { name, value } = event.target;

    setFiltresGeneration((actuel) => ({
      ...actuel,
      [name]: value,
      ...(name === "programme" ? { etape: "", session: "" } : {}),
      ...(name === "etape" ? { session: "" } : {}),
    }));
  }, []);

  const handleChangerFiltreAffectation = useCallback((event) => {
    const { name, value } = event.target;
    setFiltresAffectations((actuel) => ({ ...actuel, [name]: value }));
  }, []);

  const handleChangerPageAffectations = useCallback((page) => {
    setPaginationAffectations((actuel) => ({
      ...actuel,
      page: Math.max(1, page),
    }));
  }, []);

  const handleChangerTaillePageAffectations = useCallback((event) => {
    const taille = Number(event.target.value) || TABLE_DEFAULT_PAGE_SIZE;
    setPaginationAffectations({
      page: 1,
      pageSize: taille,
    });
  }, []);

  const reinitialiserPlanification = useCallback(() => {
    setIdAffectationEdition(null);
    setPlanificationManuelle(creerPlanificationInitiale());
  }, []);

  const handleChangerPlanification = useCallback((event) => {
    const { name, value } = event.target;

    setPlanificationManuelle((actuel) => ({
      ...actuel,
      [name]: value,
      ...(name === "id_groupes_etudiants"
        ? { id_cours: "", id_professeur: "", id_salle: "" }
        : {}),
      ...(name === "id_cours" ? { id_professeur: "", id_salle: "" } : {}),
    }));
  }, []);

  const handleGenerer = useCallback(async () => {
    if (!sessionActive?.id_session) {
      showError("Aucune session active n'est disponible pour lancer la generation.");
      return;
    }

    setGenerationEnCours(true);

    try {
      const resultat = await genererSessionScheduler({
        id_session: sessionActive.id_session,
      });

      setResumeGeneration(resultat.rapport || null);
      showSuccess(resultat.message || "Generation terminee.");
      await rechargerContexteActif();
    } catch (error) {
      showError(error.message || "Erreur lors de la generation.");
    } finally {
      setGenerationEnCours(false);
    }
  }, [rechargerContexteActif, sessionActive, showError, showSuccess]);

  const handleEnregistrerPlanification = useCallback(async () => {
    if (
      !planificationManuelle.id_groupes_etudiants ||
      !planificationManuelle.id_cours ||
      !planificationManuelle.id_professeur ||
      !planificationManuelle.id_salle ||
      !planificationManuelle.date ||
      !planificationManuelle.heure_debut ||
      !planificationManuelle.heure_fin
    ) {
      showError("Completer le groupe, le cours, le professeur, la salle, la date et l'horaire.");
      return;
    }

    setPlanificationEnCours(true);

    try {
      const payload = {
        id_groupes_etudiants: Number(planificationManuelle.id_groupes_etudiants),
        id_cours: Number(planificationManuelle.id_cours),
        id_professeur: Number(planificationManuelle.id_professeur),
        id_salle: Number(planificationManuelle.id_salle),
        date: planificationManuelle.date,
        heure_debut: planificationManuelle.heure_debut,
        heure_fin: planificationManuelle.heure_fin,
      };

      if (idAffectationEdition) {
        await modifierAffectation(idAffectationEdition, payload);
      } else {
        await creerAffectation(payload);
      }

      await rechargerHorairesActifs();
      reinitialiserPlanification();
      showSuccess(
        idAffectationEdition
          ? "Affectation mise a jour."
          : "Cours planifie avec succes."
      );
    } catch (error) {
      showError(error.message || "Erreur lors de la planification manuelle.");
    } finally {
      setPlanificationEnCours(false);
    }
  }, [
    idAffectationEdition,
    planificationManuelle,
    rechargerHorairesActifs,
    reinitialiserPlanification,
    showError,
    showSuccess,
  ]);

  const handleReset = useCallback(async () => {
    const suppressionEtudiantsActive = Boolean(supprimerEtudiantsAuReset);
    const confirmation = await confirm({
      title: "Reinitialiser la session active",
      message: suppressionEtudiantsActive
        ? "Supprimer les horaires et tous les etudiants importes de la session active ?"
        : "Supprimer uniquement les horaires de la session active ?",
      confirmLabel: "Supprimer",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    setResetEnCours(true);

    try {
      await resetHoraires({
        sessionActive: true,
        deleteStudents: suppressionEtudiantsActive,
      });
      setResumeGeneration(null);
      setHoraires([]);
      reinitialiserPlanification();
      await rechargerContexteActif();
      showSuccess(
        suppressionEtudiantsActive
          ? "Horaires et etudiants de la session active reinitialises."
          : "Horaires de la session active reinitialises."
      );
    } catch (error) {
      showError(error.message || "Erreur lors de la reinitialisation.");
    } finally {
      setResetEnCours(false);
    }
  }, [
    confirm,
    rechargerContexteActif,
    reinitialiserPlanification,
    supprimerEtudiantsAuReset,
    showError,
    showSuccess,
  ]);

  const peutReinitialiserSessionActive =
    !resetEnCours &&
    (horaires.length > 0 || (supprimerEtudiantsAuReset && etudiants.length > 0));

  const handleSupprimer = useCallback(async (idAffectation) => {
    const confirmation = await confirm({
      title: "Supprimer l'affectation",
      message: "Supprimer cette affectation ?",
      confirmLabel: "Supprimer",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    try {
      await supprimerAffectation(idAffectation);
      await rechargerHorairesActifs();
      if (Number(idAffectationEdition) === Number(idAffectation)) {
        reinitialiserPlanification();
      }
      showSuccess("Affectation supprimee.");
    } catch (error) {
      showError(error.message || "Erreur lors de la suppression.");
    }
  }, [
    confirm,
    idAffectationEdition,
    rechargerHorairesActifs,
    reinitialiserPlanification,
    showError,
    showSuccess,
  ]);

  const handleModifier = useCallback((affectation) => {
    setIdAffectationEdition(Number(affectation.id_affectation_cours));
    setPlanificationManuelle({
      id_groupes_etudiants: String(affectation.id_groupes_etudiants || ""),
      id_cours: String(affectation.id_cours || ""),
      id_professeur: String(affectation.id_professeur || ""),
      id_salle: String(affectation.id_salle || ""),
      date: String(affectation.date || dateCouranteLocale()),
      heure_debut: formaterHeure(affectation.heure_debut) || "08:00",
      heure_fin: formaterHeure(affectation.heure_fin) || "10:00",
    });
  }, []);

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Generer"
      subtitle="Travaillez sur la session active, filtrez une cohorte et corrigez les seances manuellement."
    >
      <div className="affectations-page">
        <section className="affectations-page__hero">
          <div className="affectations-page__hero-card">
            <span className="affectations-page__eyebrow">Session active unifiee</span>
            <h2>Generation, controle et correction sur la meme session</h2>
            <p>
              Cette page travaille sur les memes donnees que les horaires groupes,
              les horaires professeurs et les disponibilites. La generation reconstruit
              toute la session active, puis les filtres ci-dessous servent a cibler
              une cohorte pour l'analyse et la planification manuelle.
            </p>
          </div>
          <div className="affectations-page__stats">
            <div className="affectations-page__stat-card">
              <strong>{sessionActive?.nom || "-"}</strong>
              <span>Session active</span>
            </div>
            <div className="affectations-page__stat-card">
              <strong>{etudiants.length}</strong>
              <span>Etudiants actifs</span>
            </div>
            <div className="affectations-page__stat-card">
              <strong>{groupes.length}</strong>
              <span>Groupes actifs</span>
            </div>
            <div className="affectations-page__stat-card">
              <strong>{horaires.length}</strong>
              <span>Affectations actives</span>
            </div>
          </div>
        </section>

        <section className="affectations-page__workspace">
          <div className="affectations-page__panel">
            <div className="affectations-page__panel-header">
              <div>
                <h2>Filtres de cohorte</h2>
                <p>
                  Session active: {sessionActive?.nom || "Aucune"}. Les filtres servent a
                  cibler la cohorte a inspecter, puis la planification manuelle.
                </p>
              </div>
            </div>

            {loading ? (
              <p className="crud-page__state">Chargement...</p>
            ) : (
              <div className="affectations-page__form">
                <div className="affectations-page__row">
                  <label className="crud-page__field">
                    <span>Programme</span>
                    <select
                      name="programme"
                      value={filtresGeneration.programme}
                      onChange={handleChangerFiltre}
                    >
                      <option value="">Choisir un programme</option>
                      {programmesDisponibles.map((programme) => (
                        <option key={programme} value={programme}>
                          {programme}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="crud-page__field">
                    <span>Etape</span>
                    <select
                      name="etape"
                      value={filtresGeneration.etape}
                      onChange={handleChangerFiltre}
                      disabled={!filtresGeneration.programme}
                    >
                      <option value="">Choisir une etape</option>
                      {etapesDisponibles.map((etape) => (
                        <option key={etape} value={etape}>
                          Etape {etape}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="affectations-page__row">
                  <label className="crud-page__field">
                    <span>Session</span>
                    <select
                      name="session"
                      value={filtresGeneration.session}
                      onChange={handleChangerFiltre}
                      disabled={!filtresGeneration.etape}
                    >
                      <option value="">Choisir une session</option>
                      {sessionsDisponibles.map((session) => (
                        <option key={session} value={session}>
                          {session}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="affectations-page__cohort-preview">
                  <span className="planning-label">Cohorte ciblee</span>
                  <strong>
                    {filtresGeneration.programme
                      ? `${filtresGeneration.programme} - E${filtresGeneration.etape || "-"}`
                      : "Toutes les cohortes de la session active"}
                  </strong>
                  <small>{formaterLibelleCohorte(filtresGeneration.session)}</small>
                </div>

                <div className="affectations-page__selection-stats">
                  {resumeCohorte.map((item) => (
                    <div key={item.label} className="affectations-page__selection-stat">
                      <strong>{item.valeur}</strong>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="affectations-page__actions">
                  <button
                    className="crud-page__primary-button"
                    type="button"
                    onClick={handleGenerer}
                    disabled={generationEnCours || loading || !sessionActive}
                  >
                    {generationEnCours
                      ? "Generation de la session active..."
                      : "Generer la session active"}
                  </button>
                  <button
                    className="crud-page__secondary-button"
                    type="button"
                    onClick={handleReset}
                    disabled={!peutReinitialiserSessionActive}
                  >
                    {resetEnCours
                      ? "Reinitialisation..."
                      : "Reinitialiser la session active"}
                  </button>
                </div>

                <label className="affectations-page__option">
                  <input
                    type="checkbox"
                    checked={supprimerEtudiantsAuReset}
                    onChange={(event) =>
                      setSupprimerEtudiantsAuReset(event.target.checked)
                    }
                    disabled={resetEnCours || etudiants.length === 0}
                  />
                  <span>
                    Supprimer aussi les etudiants importes de la session active
                    dans `Horaires etudiants`
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="affectations-page__panel">
            <div className="affectations-page__panel-header">
              <div>
                <h2>Lecture de la cohorte</h2>
                <p>
                  {groupesFiltres.length > 0
                    ? "Groupes deja disponibles dans la session active pour cette selection."
                    : "Apercu estime si la cohorte n'a pas encore de groupes persistants."}
                </p>
              </div>
            </div>

            {resumeGeneration ? (
              <div className="affectations-page__generation-summary">
                <div className="affectations-page__selection-stat">
                  <strong>{resumeGeneration.session?.nom || sessionActive?.nom || "-"}</strong>
                  <span>Session generee</span>
                </div>
                <div className="affectations-page__selection-stat">
                  <strong>{resumeGeneration.score_qualite ?? "-"}</strong>
                  <span>Score qualite</span>
                </div>
                <div className="affectations-page__selection-stat">
                  <strong>{resumeGeneration.nb_cours_planifies ?? 0}</strong>
                  <span>Seances planifiees</span>
                </div>
                <div className="affectations-page__selection-stat">
                  <strong>{resumeGeneration.nb_cours_non_planifies ?? 0}</strong>
                  <span>Seances non planifiees</span>
                </div>
              </div>
            ) : null}

            {!filtresGeneration.programme ||
            !filtresGeneration.etape ||
            !filtresGeneration.session ? (
              <p className="crud-page__state">
                Selectionnez un programme, une etape et une session.
              </p>
            ) : groupesAPlanifier.length === 0 ? (
              <p className="crud-page__state">Aucun etudiant importe pour cette cohorte.</p>
            ) : (
              <div className="affectations-page__group-list">
                {groupesAPlanifier.map((groupe) => (
                  <div key={groupe.id_groupes_etudiants} className="affectations-page__group-chip">
                    <strong>{groupe.nom_groupe}</strong>
                    <span>
                      Etape {groupe.etape || "-"} - {formaterLibelleCohorte(groupe.session)} - Effectif: {groupe.effectif || 0}
                    </span>
                    {groupe.apercu ? <small>Prevision avant generation</small> : null}
                  </div>
                ))}
              </div>
            )}

            <div className="affectations-page__issues">
              <h3>Types de salles utiles</h3>
              {typesSallesRequis.length === 0 ? (
                <p>Aucun type de salle requis pour la selection actuelle.</p>
              ) : (
                <ul>
                  {typesSallesRequis.map((typeSalle) => (
                    <li key={typeSalle}>
                      <strong>{typeSalle}</strong>
                      <span>
                        {compteSallesCompatiblesParType.get(normaliserTexte(typeSalle)) || 0}{" "}
                        salle(s) compatible(s)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {resumeGeneration?.non_planifies?.length ? (
              <div className="affectations-page__issues">
                <h3>Elements non planifies</h3>
                <ul>
                  {resumeGeneration.non_planifies.map((item) => (
                    <li
                      key={`${item.id_cours || item.code || item.code_cours}-${item.groupe || "all"}-${item.raison}`}
                    >
                      <strong>
                        {item.code_cours || item.code || "Cours"}
                        {item.groupe ? ` - ${item.groupe}` : ""}
                      </strong>
                      <span>{item.raison}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="affectations-page__panel">
          <div className="affectations-page__panel-header">
            <div>
              <h2>Planifier un cours manuellement</h2>
              <p>
                Utilisez ce formulaire pour ajouter ou corriger une seance precise
                pour un groupe deja cree.
              </p>
            </div>
            {idAffectationEdition ? (
              <span className="affectations-page__count">
                Edition #{idAffectationEdition}
              </span>
            ) : null}
          </div>

          {groupesPlanificationManuelle.length === 0 ? (
            <p className="crud-page__state">
              Aucun groupe disponible. Importez les etudiants de la cohorte pour que
              le systeme cree automatiquement les groupes.
            </p>
          ) : (
            <div className="affectations-page__form">
              <div className="affectations-page__row">
                <label className="crud-page__field">
                  <span>Groupe</span>
                  <select
                    name="id_groupes_etudiants"
                    value={planificationManuelle.id_groupes_etudiants}
                    onChange={handleChangerPlanification}
                  >
                    <option value="">Choisir un groupe</option>
                    {groupesPlanificationManuelle.map((groupe) => (
                      <option
                        key={groupe.id_groupes_etudiants}
                        value={groupe.id_groupes_etudiants}
                      >
                        {groupe.nom_groupe} ({groupe.effectif || 0} etudiants)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="crud-page__field">
                  <span>Cours</span>
                  <select
                    name="id_cours"
                    value={planificationManuelle.id_cours}
                    onChange={handleChangerPlanification}
                    disabled={!groupePlanificationActif}
                  >
                    <option value="">Choisir un cours</option>
                    {coursPlanificationManuelle.map((element) => (
                      <option key={element.id_cours} value={element.id_cours}>
                        {element.code} - {element.nom}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="affectations-page__row">
                <label className="crud-page__field">
                  <span>Professeur</span>
                  <select
                    name="id_professeur"
                    value={planificationManuelle.id_professeur}
                    onChange={handleChangerPlanification}
                    disabled={!coursPlanificationActif}
                  >
                    <option value="">Choisir un professeur</option>
                    {professeursPlanificationManuelle.map((professeur) => (
                      <option
                        key={professeur.id_professeur}
                        value={professeur.id_professeur}
                      >
                        {professeur.prenom} {professeur.nom}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="crud-page__field">
                  <span>Salle (sélection rapide)</span>
                  <select
                    name="id_salle"
                    value={planificationManuelle.id_salle}
                    onChange={handleChangerPlanification}
                    disabled={!coursPlanificationActif}
                  >
                    <option value="">Choisir une salle</option>
                    {sallesPlanificationManuelleAvecStatut.map((salle) => (
                      <option
                        key={salle.id_salle}
                        value={salle.id_salle}
                        disabled={!salle.disponible}
                      >
                        {salle.statut === "AVAILABLE" ? "✅" :
                         salle.statut === "OCCUPIED" ? "🔴" :
                         salle.statut === "INCOMPATIBLE_TYPE" ? "🟠" : "⚫"}{" "}
                        {salle.code} ({salle.type} — {salle.capacite}p)
                      </option>
                    ))}
                  </select>
                </label>
              </div>


              <div className="affectations-page__row affectations-page__row--triple">
                <label className="crud-page__field">
                  <span>Date</span>
                  <input
                    type="date"
                    name="date"
                    value={planificationManuelle.date}
                    onChange={handleChangerPlanification}
                  />
                </label>

                <label className="crud-page__field">
                  <span>Heure de debut</span>
                  <input
                    type="time"
                    name="heure_debut"
                    value={planificationManuelle.heure_debut}
                    onChange={handleChangerPlanification}
                  />
                </label>

                <label className="crud-page__field">
                  <span>Heure de fin</span>
                  <input
                    type="time"
                    name="heure_fin"
                    value={planificationManuelle.heure_fin}
                    onChange={handleChangerPlanification}
                  />
                </label>
              </div>

              <div className="affectations-page__manual-summary">
                <strong>
                  {groupePlanificationActif?.nom_groupe || "Aucun groupe sélectionné"}
                </strong>
                <span>
                  Effectif : {groupePlanificationActif?.effectif || 0} étudiants
                  {" — "}
                  {coursPlanificationActif
                    ? `Type de salle requis : ${coursPlanificationActif.type_salle || "standard"}`
                    : "Sélectionner un cours"}
                </span>
                <div className="affectations-page__room-status-legend">
                  <span className="affectations-page__room-legend-item affectations-page__room-legend-item--available">
                    <span className="affectations-page__room-legend-dot" /> {resumeDisponibiliteSalles.disponibles} disponible(s)
                  </span>
                  <span className="affectations-page__room-legend-item affectations-page__room-legend-item--occupied">
                    <span className="affectations-page__room-legend-dot" /> {resumeDisponibiliteSalles.occupees} occupée(s)
                  </span>
                  <span className="affectations-page__room-legend-item affectations-page__room-legend-item--incompatible">
                    <span className="affectations-page__room-legend-dot" /> {resumeDisponibiliteSalles.incompatibles} incompatible(s)
                  </span>
                  <span className="affectations-page__room-legend-item affectations-page__room-legend-item--small">
                    <span className="affectations-page__room-legend-dot" /> {resumeDisponibiliteSalles.trop_petites} trop petite(s)
                  </span>
                </div>
                {sallePlanificationSelectionnee ? (
                  <span className={`affectations-page__room-selected-info affectations-page__room-selected-info--${
                    sallePlanificationSelectionnee.statut === "AVAILABLE" ? "ok" : "error"
                  }`}>
                    {sallePlanificationSelectionnee.statut === "AVAILABLE" ? "✅" : "⚠️"}{" "}
                    {sallePlanificationSelectionnee.code} — {sallePlanificationSelectionnee.raison}
                  </span>
                ) : null}
              </div>


              {sallesPlanificationManuelleAvecStatut.length > 0 ? (
                <div className="affectations-page__rooms-panel">
                  <div className="affectations-page__rooms-panel-header">
                    <h3>Tableau de bord des salles</h3>
                    <p>
                      Toutes les salles disponibles pour ce type de cours, triées par disponibilité.
                      Cliquez sur une salle verte pour la sélectionner.
                    </p>
                  </div>

                  <div className="affectations-page__rooms-grid">
                    {sallesPlanificationManuelleAvecStatut.map((salle) => {
                      const statutClass =
                        salle.statut === "AVAILABLE" ? "available" :
                        salle.statut === "OCCUPIED" ? "busy" :
                        salle.statut === "INCOMPATIBLE_TYPE" ? "incompatible" :
                        "small";
                      const isSelected =
                        String(planificationManuelle.id_salle) === String(salle.id_salle);

                      return (
                        <button
                          key={salle.id_salle}
                          type="button"
                          className={[
                            "affectations-page__room-card",
                            `affectations-page__room-card--${statutClass}`,
                            isSelected ? "affectations-page__room-card--selected" : "",
                          ].join(" ").trim()}
                          onClick={() => salle.disponible && handleChoisirSalle(salle.id_salle)}
                          disabled={!salle.disponible}
                          title={salle.raison}
                        >
                          <div className="affectations-page__room-card-header">
                            <strong>{salle.code}</strong>
                            <span className={`affectations-page__room-badge affectations-page__room-badge--${statutClass}`}>
                              {salle.statut === "AVAILABLE" ? "DISPONIBLE" :
                               salle.statut === "OCCUPIED" ? "OCCUPÉE" :
                               salle.statut === "INCOMPATIBLE_TYPE" ? "INCOMPATIBLE" :
                               "TROP PETITE"}
                            </span>
                          </div>
                          <span className="affectations-page__room-type">
                            {salle.type} — {salle.capacite} places
                          </span>
                          <small className="affectations-page__room-reason">{salle.raison}</small>
                          {isSelected && (
                            <span className="affectations-page__room-selected-indicator">✓ Sélectionnée</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}


              <div className="affectations-page__actions">
                <button
                  className="crud-page__primary-button"
                  type="button"
                  onClick={handleEnregistrerPlanification}
                  disabled={
                    planificationEnCours ||
                    loading ||
                    !sallePlanificationSelectionnee?.disponible
                  }
                >
                  {planificationEnCours
                    ? "Enregistrement..."
                    : idAffectationEdition
                      ? "Mettre a jour"
                      : "Planifier le cours"}
                </button>
                {idAffectationEdition ? (
                  <button
                    className="crud-page__secondary-button"
                    type="button"
                    onClick={reinitialiserPlanification}
                    disabled={planificationEnCours}
                  >
                    Annuler l'edition
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section className="affectations-page__panel">
          <div className="affectations-page__panel-header">
            <div>
              <h2>Affectations planifiees</h2>
              <p>Chaque ligne correspond au planning exact d'un groupe, genere ou ajoute manuellement.</p>
            </div>
            <span className="affectations-page__count">
              {horairesFiltres.length} / {horaires.length} affectation(s)
            </span>
          </div>

          {horaires.length === 0 ? (
            <p className="crud-page__state">Aucune affectation generee pour le moment.</p>
          ) : (
            <>
              <div className="affectations-page__filters">
                <label className="crud-page__field">
                  <span>Recherche</span>
                  <input
                    type="text"
                    name="recherche"
                    placeholder="Cours, prof, salle ou groupe"
                    value={filtresAffectations.recherche}
                    onChange={handleChangerFiltreAffectation}
                  />
                </label>
                <label className="crud-page__field">
                  <span>Professeur</span>
                  <select
                    name="professeur"
                    value={filtresAffectations.professeur}
                    onChange={handleChangerFiltreAffectation}
                  >
                    <option value="">Tous les professeurs</option>
                    {professeursAffectationsDisponibles.map((professeur) => (
                      <option key={professeur} value={professeur}>
                        {professeur}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="crud-page__field">
                  <span>Groupe</span>
                  <select
                    name="groupe"
                    value={filtresAffectations.groupe}
                    onChange={handleChangerFiltreAffectation}
                  >
                    <option value="">Tous les groupes</option>
                    {groupesAffectationsDisponibles.map((groupe) => (
                      <option key={groupe} value={groupe}>
                        {groupe}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="crud-page__field">
                  <span>Date</span>
                  <input
                    type="date"
                    name="date"
                    value={filtresAffectations.date}
                    onChange={handleChangerFiltreAffectation}
                  />
                </label>
              </div>

              <div className="affectations-page__table-toolbar">
                <div className="affectations-page__table-meta">
                  <strong>
                    {horairesFiltres.length === 0
                      ? "0 resultat"
                      : `${debutLigneAffectations}-${finLigneAffectations} sur ${horairesFiltres.length}`}
                  </strong>
                  {filtresAffectations.recherche !== rechercheAffectationsDifferee ? (
                    <span>Filtrage en cours...</span>
                  ) : (
                    <span>Rendu limite a la page courante pour garder l'UI reactive.</span>
                  )}
                </div>

                <div className="affectations-page__pagination">
                  <label className="affectations-page__pagination-size">
                    <span>Lignes</span>
                    <select
                      value={paginationAffectations.pageSize}
                      onChange={handleChangerTaillePageAffectations}
                    >
                      {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="affectations-page__pagination-actions">
                    <button
                      type="button"
                      className="crud-page__secondary-button"
                      onClick={() => handleChangerPageAffectations(pageAffectations - 1)}
                      disabled={pageAffectations <= 1}
                    >
                      Precedent
                    </button>
                    <span>
                      Page {pageAffectations} / {totalPagesAffectations}
                    </span>
                    <button
                      type="button"
                      className="crud-page__secondary-button"
                      onClick={() => handleChangerPageAffectations(pageAffectations + 1)}
                      disabled={pageAffectations >= totalPagesAffectations}
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>

              {horairesFiltres.length === 0 ? (
                <p className="crud-page__state">Aucune affectation ne correspond aux filtres.</p>
              ) : (
              <div className="crud-page__table-card">
                <table className="crud-page__table">
                  <thead>
                    <tr>
                      <th>Cours</th>
                      <th>Professeur</th>
                      <th>Salle</th>
                      <th>Date</th>
                      <th>Horaire</th>
                      <th>Groupe</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {horairesVisibles.map((affectation) => (
                      <tr key={affectation.id_affectation_cours}>
                        <td>
                          <strong>{affectation.cours_code}</strong>
                          <br />
                          <small>{affectation.cours_nom}</small>
                        </td>
                        <td>
                          {affectation.professeur_prenom} {affectation.professeur_nom}
                        </td>
                        <td>{affectation.salle_code}</td>
                        <td>{formaterDate(affectation.date)}</td>
                        <td>
                          {formaterHeure(affectation.heure_debut)} -{" "}
                          {formaterHeure(affectation.heure_fin)}
                        </td>
                        <td>{affectation.groupes || "-"}</td>
                        <td>
                          <div className="crud-page__actions">
                            <button
                              type="button"
                              className="crud-page__action crud-page__action--edit"
                              onClick={() => handleModifier(affectation)}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              className="crud-page__action crud-page__action--delete"
                              onClick={() => handleSupprimer(affectation.id_affectation_cours)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
