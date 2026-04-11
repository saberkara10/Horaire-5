import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

function normaliserTexte(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formaterNomEtudiant(etudiant) {
  const nomComplet = `${etudiant?.prenom || ""} ${etudiant?.nom || ""}`.trim();
  return nomComplet || `Etudiant #${etudiant?.id_etudiant || "?"}`;
}

function formaterEtape(etudiant) {
  const etape = String(etudiant?.etape || "").trim();

  if (!etape) {
    return "-";
  }

  return /^e/i.test(etape) ? etape.toUpperCase() : `E${etape}`;
}

function construireLibelleSelection(etudiant) {
  if (!etudiant) {
    return "";
  }

  const matricule = String(etudiant.matricule || "").trim();
  return `${formaterNomEtudiant(etudiant)}${matricule ? ` - ${matricule}` : ""}`;
}

function formaterStatutReprise(etudiant) {
  const resume = etudiant?.reprise_manuelle || {};
  const nbNonPlanifies = Number(resume.nb_non_planifies || 0);
  const nbTotal = Number(resume.nb_total || 0);

  if (nbNonPlanifies > 0) {
    return `${nbNonPlanifies} cours a traiter`;
  }

  if (nbTotal > 0) {
    return `${nbTotal} cours deja planifie${nbTotal > 1 ? "s" : ""}`;
  }

  return "Aucun cours echoue";
}

function construireEntreeRecherche(etudiant, index) {
  const nom = String(etudiant?.nom || "").trim();
  const prenom = String(etudiant?.prenom || "").trim();
  const nomComplet = formaterNomEtudiant(etudiant);
  const matricule = String(etudiant?.matricule || "").trim();
  const groupe = String(etudiant?.groupe || "").trim();
  const programme = String(etudiant?.programme || "").trim();
  const etape = String(etudiant?.etape || "").trim();
  const etapeAffichee = formaterEtape(etudiant);
  const statut = etudiant?.reprise_manuelle || {};

  return {
    etudiant,
    index,
    nomComplet,
    matricule,
    groupe,
    programme,
    etapeAffichee,
    aTraiter: Boolean(statut.a_traiter),
    nbNonPlanifies: Number(statut.nb_non_planifies || 0),
    nomNormalise: normaliserTexte(nom),
    prenomNormalise: normaliserTexte(prenom),
    nomCompletNormalise: normaliserTexte(nomComplet),
    matriculeNormalise: normaliserTexte(matricule),
    groupeNormalise: normaliserTexte(groupe),
    programmeNormalise: normaliserTexte(programme),
    etapeNormalisee: normaliserTexte(etape),
    etapeAfficheeNormalisee: normaliserTexte(etapeAffichee),
    rechercheNormalisee: normaliserTexte(
      [
        nomComplet,
        prenom,
        nom,
        matricule,
        groupe,
        programme,
        etape,
        etapeAffichee,
      ].join(" ")
    ),
  };
}

function calculerScoreRecherche(entree, termes) {
  if (termes.length === 0) {
    return 0;
  }

  let score = 0;

  for (const terme of termes) {
    if (!terme) {
      continue;
    }

    if (entree.matriculeNormalise === terme) {
      score += 180;
      continue;
    }

    if (entree.nomCompletNormalise === terme) {
      score += 160;
      continue;
    }

    if (
      entree.nomNormalise.startsWith(terme) ||
      entree.prenomNormalise.startsWith(terme)
    ) {
      score += 130;
      continue;
    }

    if (entree.matriculeNormalise.startsWith(terme)) {
      score += 120;
      continue;
    }

    if (entree.groupeNormalise.startsWith(terme)) {
      score += 115;
      continue;
    }

    if (entree.programmeNormalise === terme) {
      score += 110;
      continue;
    }

    if (
      entree.etapeNormalisee === terme ||
      entree.etapeAfficheeNormalisee === terme
    ) {
      score += 105;
      continue;
    }

    if (entree.nomCompletNormalise.includes(terme)) {
      score += 85;
      continue;
    }

    if (entree.groupeNormalise.includes(terme)) {
      score += 80;
      continue;
    }

    if (entree.programmeNormalise.includes(terme)) {
      score += 70;
      continue;
    }

    if (entree.rechercheNormalisee.includes(terme)) {
      score += 55;
      continue;
    }

    return null;
  }

  return score;
}

function comparerEntreesRecherche(entreeA, entreeB) {
  if (entreeA.aTraiter !== entreeB.aTraiter) {
    return entreeA.aTraiter ? -1 : 1;
  }

  if (entreeA.score !== entreeB.score) {
    return entreeB.score - entreeA.score;
  }

  const compareNom = entreeA.nomComplet.localeCompare(entreeB.nomComplet, "fr", {
    sensitivity: "base",
  });
  if (compareNom !== 0) {
    return compareNom;
  }

  const compareMatricule = String(entreeA.matricule || "").localeCompare(
    String(entreeB.matricule || ""),
    "fr",
    {
      numeric: true,
      sensitivity: "base",
    }
  );
  if (compareMatricule !== 0) {
    return compareMatricule;
  }

  return entreeA.index - entreeB.index;
}

export function RepriseStudentSearchField({
  etudiants = [],
  selectedId = "",
  onSelect,
  disabled = false,
  loading = false,
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const optionRefs = useRef([]);
  const preserverRechercheRef = useRef(false);
  const [estOuvert, setEstOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [indexActif, setIndexActif] = useState(-1);
  const rechercheDifferee = useDeferredValue(recherche);

  const entrees = useMemo(
    () =>
      (Array.isArray(etudiants) ? etudiants : []).map((etudiant, index) =>
        construireEntreeRecherche(etudiant, index)
      ),
    [etudiants]
  );

  const etudiantSelectionne = useMemo(
    () =>
      entrees.find(
        (entree) => String(entree.etudiant.id_etudiant) === String(selectedId)
      )?.etudiant || null,
    [entrees, selectedId]
  );

  const resultats = useMemo(() => {
    const termes = normaliserTexte(rechercheDifferee)
      .split(/\s+/)
      .filter(Boolean);

    return entrees
      .map((entree) => {
        const score = calculerScoreRecherche(entree, termes);
        if (score === null) {
          return null;
        }

        return {
          ...entree,
          score,
        };
      })
      .filter(Boolean)
      .sort(comparerEntreesRecherche);
  }, [entrees, rechercheDifferee]);

  const resultatsVisibles = useMemo(() => resultats.slice(0, 60), [resultats]);

  useEffect(() => {
    if (etudiantSelectionne) {
      setRecherche(construireLibelleSelection(etudiantSelectionne));
      preserverRechercheRef.current = false;
      return;
    }

    if (!selectedId) {
      if (preserverRechercheRef.current) {
        preserverRechercheRef.current = false;
        return;
      }

      setRecherche("");
    }
  }, [etudiantSelectionne, selectedId]);

  useEffect(() => {
    if (!estOuvert) {
      setIndexActif(-1);
      return;
    }

    setIndexActif((actuel) => {
      if (resultatsVisibles.length === 0) {
        return -1;
      }

      if (actuel < 0 || actuel >= resultatsVisibles.length) {
        return 0;
      }

      return actuel;
    });
  }, [estOuvert, resultatsVisibles]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setEstOuvert(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (indexActif < 0) {
      return;
    }

    optionRefs.current[indexActif]?.scrollIntoView({
      block: "nearest",
    });
  }, [indexActif]);

  function handleSelection(etudiant) {
    if (!etudiant || typeof onSelect !== "function") {
      return;
    }

    onSelect(String(etudiant.id_etudiant), etudiant);
    setEstOuvert(false);
    setRecherche(construireLibelleSelection(etudiant));
  }

  function handleChange(event) {
    const prochaineRecherche = event.target.value;

    setRecherche(prochaineRecherche);
    setEstOuvert(true);

    if (selectedId && typeof onSelect === "function") {
      preserverRechercheRef.current = true;
      onSelect("", null);
    }
  }

  function handleKeyDown(event) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setEstOuvert(true);
      setIndexActif((actuel) =>
        resultatsVisibles.length === 0
          ? -1
          : Math.min(resultatsVisibles.length - 1, actuel + 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setEstOuvert(true);
      setIndexActif((actuel) =>
        resultatsVisibles.length === 0 ? -1 : Math.max(0, actuel - 1)
      );
      return;
    }

    if (event.key === "Enter" && estOuvert && indexActif >= 0) {
      event.preventDefault();
      handleSelection(resultatsVisibles[indexActif]?.etudiant);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setEstOuvert(false);
    }
  }

  return (
    <label className="crud-page__field">
      <span>Etudiant</span>

      <div
        ref={rootRef}
        className={`affectations-page__student-search${
          estOuvert ? " affectations-page__student-search--open" : ""
        }`}
      >
        <div className="affectations-page__student-search-control">
          <input
            type="text"
            value={recherche}
            onChange={handleChange}
            onFocus={() => setEstOuvert(true)}
            onKeyDown={handleKeyDown}
            placeholder={
              loading
                ? "Chargement des etudiants..."
                : "Nom, prenom, matricule, groupe, programme ou etape"
            }
            disabled={disabled || loading}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={estOuvert}
            aria-controls={listboxId}
            aria-activedescendant={
              estOuvert && indexActif >= 0
                ? `${listboxId}-option-${resultatsVisibles[indexActif]?.etudiant?.id_etudiant}`
                : undefined
            }
          />

          {selectedId ? (
            <button
              type="button"
              className="affectations-page__student-search-clear"
              onClick={() => {
                setRecherche("");
                setEstOuvert(true);
                if (typeof onSelect === "function") {
                  onSelect("", null);
                }
              }}
              disabled={disabled || loading}
              aria-label="Reinitialiser l'etudiant selectionne"
            >
              Effacer
            </button>
          ) : null}
        </div>

        <div className="affectations-page__student-search-hint">
          <span>
            Priorite aux etudiants ayant encore des cours echoues non planifies.
          </span>
          <span>{entrees.length} etudiant(s) actifs dans la session.</span>
        </div>

        {estOuvert ? (
          <div className="affectations-page__student-search-dropdown">
            <div className="affectations-page__student-search-summary">
              <strong>{resultats.length} resultat(s)</strong>
              <span>
                {resultats.length > resultatsVisibles.length
                  ? `Affichage des ${resultatsVisibles.length} premiers.`
                  : "Filtrage multi-criteres actif."}
              </span>
            </div>

            {resultatsVisibles.length === 0 ? (
              <p className="affectations-page__student-search-empty">
                Aucun etudiant ne correspond a cette recherche.
              </p>
            ) : (
              <ul
                id={listboxId}
                className="affectations-page__student-search-results"
                role="listbox"
              >
                {resultatsVisibles.map((entree, index) => {
                  const estSelectionne =
                    String(entree.etudiant.id_etudiant) === String(selectedId);
                  const estActif = index === indexActif;

                  return (
                    <li
                      key={entree.etudiant.id_etudiant}
                      id={`${listboxId}-option-${entree.etudiant.id_etudiant}`}
                      role="option"
                      aria-selected={estSelectionne}
                    >
                      <button
                        ref={(element) => {
                          optionRefs.current[index] = element;
                        }}
                        type="button"
                        className={`affectations-page__student-option${
                          entree.aTraiter
                            ? " affectations-page__student-option--attention"
                            : ""
                        }${
                          estSelectionne
                            ? " affectations-page__student-option--selected"
                            : ""
                        }${
                          estActif ? " affectations-page__student-option--active" : ""
                        }`}
                        onClick={() => handleSelection(entree.etudiant)}
                        onMouseEnter={() => setIndexActif(index)}
                      >
                        <div className="affectations-page__student-option-main">
                          <strong>{entree.nomComplet}</strong>
                          <span>
                            Matricule: {entree.matricule || "-"} - Groupe:{" "}
                            {entree.groupe || "Non assigne"}
                          </span>
                          <span>
                            Programme: {entree.programme || "-"} - Etape:{" "}
                            {entree.etapeAffichee}
                          </span>
                        </div>

                        <div className="affectations-page__student-option-side">
                          <span
                            className={`affectations-page__student-badge${
                              entree.aTraiter
                                ? " affectations-page__student-badge--warning"
                                : " affectations-page__student-badge--neutral"
                            }`}
                          >
                            {formaterStatutReprise(entree.etudiant)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}
