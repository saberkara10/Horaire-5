/**
 * COMPOSANT - ProfesseurSearchField
 *
 * Champ de recherche intelligente filtrable pour sélectionner un professeur.
 * Réutilisable dans tous les modules qui nécessitent une sélection de professeur
 * (Horaires professeurs, Disponibilités professeurs, etc.).
 *
 * Fonctionnement :
 *  - Affiche un champ texte libre avec filtrage en temps réel.
 *  - Recherche sur matricule, nom, prénom et spécialité.
 *  - Liste cliquable déroulante avec navigation clavier (↑↓ Entrée Échap).
 *  - Bouton "Effacer" quand une sélection est active.
 *  - Gestion des états : chargement, vide, aucun résultat.
 */
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/* ─── Normalisation ─── */
function normaliserTexte(valeur) {
  return String(valeur || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* ─── Formatage de l'étiquette affichée dans le champ une fois sélectionné ─── */
function construireLibelleSelection(professeur) {
  if (!professeur) return "";
  const matricule = String(professeur.matricule || "").trim();
  const prenom = String(professeur.prenom || "").trim();
  const nom = String(professeur.nom || "").trim();
  const nomComplet = [prenom, nom].filter(Boolean).join(" ");
  return matricule ? `${matricule} - ${nomComplet}` : nomComplet;
}

/* ─── Construction du corpus de recherche pour chaque professeur ─── */
function construireEntreeProfesseur(professeur, index) {
  const prenom = String(professeur?.prenom || "").trim();
  const nom = String(professeur?.nom || "").trim();
  const matricule = String(professeur?.matricule || "").trim();
  const specialite = String(professeur?.specialite || "").trim();
  const nomComplet = [prenom, nom].filter(Boolean).join(" ");

  return {
    professeur,
    index,
    nomComplet,
    matricule,
    specialite,
    prenom,
    nom,
    prenomNormalise: normaliserTexte(prenom),
    nomNormalise: normaliserTexte(nom),
    nomCompletNormalise: normaliserTexte(nomComplet),
    matriculeNormalise: normaliserTexte(matricule),
    specialiteNormalisee: normaliserTexte(specialite),
    rechercheNormalisee: normaliserTexte(
      [nomComplet, matricule, specialite].join(" ")
    ),
  };
}

/* ─── Score de pertinence (retourne null si aucun terme ne correspond) ─── */
function calculerScore(entree, termes) {
  if (termes.length === 0) return 0;

  let score = 0;

  for (const terme of termes) {
    if (!terme) continue;

    if (entree.matriculeNormalise === terme) { score += 180; continue; }
    if (entree.nomCompletNormalise === terme) { score += 160; continue; }
    if (entree.matriculeNormalise.startsWith(terme)) { score += 130; continue; }
    if (
      entree.prenomNormalise.startsWith(terme) ||
      entree.nomNormalise.startsWith(terme)
    ) { score += 120; continue; }
    if (entree.nomCompletNormalise.includes(terme)) { score += 90; continue; }
    if (entree.specialiteNormalisee.includes(terme)) { score += 70; continue; }
    if (entree.rechercheNormalisee.includes(terme)) { score += 50; continue; }

    return null; // terme non trouvé → exclure
  }

  return score;
}

/* ─── Composant principal ─── */
export function ProfesseurSearchField({
  /** Liste complète des professeurs disponibles. */
  professeurs = [],
  /** Identifiant du professeur actuellement sélectionné (id_professeur). */
  selectedId = null,
  /** Callback appelé lors de la sélection : onSelect(id, professeurObject). */
  onSelect,
  /** Désactive le champ. */
  disabled = false,
  /** Affiche un état de chargement dans le placeholder. */
  loading = false,
  /** Étiquette affichée au-dessus du champ. */
  label = "Professeur",
  /** Placeholder du champ texte. */
  placeholder = "Matricule, nom ou prénom…",
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const optionRefs = useRef([]);
  const preserverRechercheRef = useRef(false);

  const [estOuvert, setEstOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [indexActif, setIndexActif] = useState(-1);
  const rechercheDifferee = useDeferredValue(recherche);

  /* ─── Corpus enrichi (mémoïsé) ─── */
  const entrees = useMemo(
    () =>
      (Array.isArray(professeurs) ? professeurs : []).map(
        (professeur, index) => construireEntreeProfesseur(professeur, index)
      ),
    [professeurs]
  );

  /* ─── Professeur actuellement sélectionné ─── */
  const professeurSelectionne = useMemo(
    () =>
      entrees.find(
        (entree) =>
          String(entree.professeur.id_professeur) === String(selectedId)
      )?.professeur || null,
    [entrees, selectedId]
  );

  /* ─── Résultats filtrés par le texte saisi ─── */
  const resultats = useMemo(() => {
    const termes = normaliserTexte(rechercheDifferee)
      .split(/\s+/)
      .filter(Boolean);

    return entrees
      .map((entree) => {
        const score = calculerScore(entree, termes);
        return score === null ? null : { ...entree, score };
      })
      .filter(Boolean)
      .sort((entreeA, entreeB) => {
        if (entreeA.score !== entreeB.score) return entreeB.score - entreeA.score;
        const compareNom = entreeA.nomComplet.localeCompare(
          entreeB.nomComplet,
          "fr",
          { sensitivity: "base" }
        );
        if (compareNom !== 0) return compareNom;
        return entreeA.index - entreeB.index;
      });
  }, [entrees, rechercheDifferee]);

  /* ─── Limiter à 60 résultats pour les performances ─── */
  const resultatsVisibles = useMemo(() => resultats.slice(0, 60), [resultats]);

  /* ─── Synchronisation du champ texte avec la sélection externe ─── */
  useEffect(() => {
    if (professeurSelectionne) {
      setRecherche(construireLibelleSelection(professeurSelectionne));
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
  }, [professeurSelectionne, selectedId]);

  /* ─── Gestion de l'index actif quand la liste s'ouvre/se ferme ─── */
  useEffect(() => {
    if (!estOuvert) { setIndexActif(-1); return; }
    setIndexActif((actuel) => {
      if (resultatsVisibles.length === 0) return -1;
      if (actuel < 0 || actuel >= resultatsVisibles.length) return 0;
      return actuel;
    });
  }, [estOuvert, resultatsVisibles]);

  /* ─── Fermer la liste si clic en dehors ─── */
  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setEstOuvert(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  /* ─── Scroll vers l'option active ─── */
  useEffect(() => {
    if (indexActif < 0) return;
    optionRefs.current[indexActif]?.scrollIntoView({ block: "nearest" });
  }, [indexActif]);

  /* ─── Sélectionner un professeur ─── */
  function handleSelection(professeur) {
    if (!professeur || typeof onSelect !== "function") return;
    onSelect(professeur.id_professeur, professeur);
    setEstOuvert(false);
    setRecherche(construireLibelleSelection(professeur));
  }

  /* ─── Saisie libre ─── */
  function handleChange(event) {
    setRecherche(event.target.value);
    setEstOuvert(true);
    if (selectedId && typeof onSelect === "function") {
      preserverRechercheRef.current = true;
      onSelect(null, null);
    }
  }

  /* ─── Navigation clavier ─── */
  function handleKeyDown(event) {
    if (disabled) return;

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
      handleSelection(resultatsVisibles[indexActif]?.professeur);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setEstOuvert(false);
    }
  }

  return (
    <div className="prof-search">
      {/* Étiquette */}
      <span className="prof-search__label">{label}</span>

      <div
        ref={rootRef}
        className={`prof-search__root${estOuvert ? " prof-search__root--open" : ""}`}
      >
        {/* Champ de saisie + bouton Effacer */}
        <div className="prof-search__control">
          <input
            type="text"
            value={recherche}
            onChange={handleChange}
            onFocus={() => setEstOuvert(true)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? "Chargement…" : placeholder}
            disabled={disabled || loading}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={estOuvert}
            aria-controls={listboxId}
            aria-activedescendant={
              estOuvert && indexActif >= 0
                ? `${listboxId}-opt-${resultatsVisibles[indexActif]?.professeur?.id_professeur}`
                : undefined
            }
          />
          {selectedId && (
            <button
              type="button"
              className="prof-search__clear"
              onClick={() => {
                setRecherche("");
                setEstOuvert(true);
                if (typeof onSelect === "function") onSelect(null, null);
              }}
              disabled={disabled || loading}
              aria-label="Réinitialiser la sélection"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Compteur */}
        <div className="prof-search__hint">
          <span>{entrees.length} professeur(s) disponible(s).</span>
        </div>

        {/* Dropdown */}
        {estOuvert && (
          <div className="prof-search__dropdown">
            <div className="prof-search__summary">
              <strong>{resultats.length} résultat(s)</strong>
              <span>
                {resultats.length > resultatsVisibles.length
                  ? `Affichage des ${resultatsVisibles.length} premiers.`
                  : "Filtrage actif."}
              </span>
            </div>

            {resultatsVisibles.length === 0 ? (
              <p className="prof-search__empty">
                Aucun professeur ne correspond à cette recherche.
              </p>
            ) : (
              <ul
                id={listboxId}
                className="prof-search__results"
                role="listbox"
              >
                {resultatsVisibles.map((entree, index) => {
                  const estSelectionne =
                    String(entree.professeur.id_professeur) === String(selectedId);
                  const estActif = index === indexActif;

                  return (
                    <li
                      key={entree.professeur.id_professeur}
                      id={`${listboxId}-opt-${entree.professeur.id_professeur}`}
                      role="option"
                      aria-selected={estSelectionne}
                    >
                      <button
                        ref={(element) => {
                          optionRefs.current[index] = element;
                        }}
                        type="button"
                        className={[
                          "prof-search__option",
                          estSelectionne ? "prof-search__option--selected" : "",
                          estActif ? "prof-search__option--active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleSelection(entree.professeur)}
                        onMouseEnter={() => setIndexActif(index)}
                      >
                        <strong>
                          {entree.prenom} {entree.nom}
                        </strong>
                        <span>{entree.matricule || "—"}</span>
                        {entree.specialite ? (
                          <small>{entree.specialite}</small>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
