/**
 * Composant — Champ de recherche filtrable pour sélectionner un étudiant.
 *
 * Utilisé dans le module d'échange ciblé de cours (CourseExchangePanel).
 * Ce composant remplace les listes déroulantes statiques par une interface
 * de recherche intelligente avec filtre en temps réel.
 *
 * Fonctionnalités :
 *  - Recherche multi-critères : nom, prénom, matricule, groupe, programme, étape
 *  - Score de pertinence : les résultats les plus précis remontent en tête
 *  - Exclusion mutuelle : `excludeId` empêche de sélectionner le même étudiant
 *    des deux côtés de l'échange (Étudiant A ≠ Étudiant B)
 *  - Navigation clavier : ArrowUp, ArrowDown, Enter, Escape
 *  - Accessibilité ARIA : combobox, listbox, aria-activedescendant
 *  - Performance : useDeferredValue + useMemo pour éviter les lags à la saisie
 *
 * Architecture du corpus de recherche :
 * Chaque étudiant est indexé en une "entree" qui pré-calcule toutes les
 * versions normalisées des champs (sans accents, en minuscules). Cette
 * pré-calculation est faite une seule fois (useMemo) et réutilisée à
 * chaque frappe pour filtrer sans recalcul coûteux.
 *
 * @module components/etudiants/EchangeEtudiantSearchField
 */
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Normalise un texte pour le rendre comparable sans tenir compte des accents,
 * de la casse ou des espaces superflus.
 *
 * @param {*} valeur - Valeur à normaliser
 * @returns {string} Texte normalisé : minuscules, sans diacritiques, sans espaces
 */
function normaliserTexte(valeur) {
  return String(valeur || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Construit le libellé court affiché dans le champ une fois un étudiant sélectionné.
 *
 * Format : "Prénom Nom - Matricule"
 * Ce format court sert d'étiquette dans le champ de saisie, plus compact que
 * le libellé riche de la liste déroulante.
 *
 * @param {object|null} etudiant - L'étudiant sélectionné
 * @returns {string} Le libellé court, ou "" si etudiant est null
 */
function construireLibelleSelection(etudiant) {
  if (!etudiant) return "";
  const prenom = String(etudiant.prenom || "").trim();
  const nom = String(etudiant.nom || "").trim();
  const nomComplet = [prenom, nom].filter(Boolean).join(" ");
  const matricule = String(etudiant.matricule || "").trim();
  return [nomComplet, matricule].filter(Boolean).join(" - ");
}

/**
 * Construit le libellé long affiché pour chaque résultat dans la liste déroulante.
 *
 * Format : "Adam Ahmed - AUTO-ADD-0035 (GAD-E3-1) - Analyse de donnees"
 * Inclut toutes les informations utiles pour identifier un étudiant rapidement.
 *
 * @param {object|null} etudiant - L'étudiant à représenter
 * @returns {string} Le libellé complet, ou "" si etudiant est null
 */
function construireLibelleRiche(etudiant) {
  if (!etudiant) return "";
  const prenom = String(etudiant.prenom || "").trim();
  const nom = String(etudiant.nom || "").trim();
  const nomComplet = [prenom, nom].filter(Boolean).join(" ");
  const matricule = String(etudiant.matricule || "").trim();
  const groupe =
    String(etudiant.groupe || etudiant.groupe_principal || "").trim();
  const programme = String(etudiant.programme || "").trim();

  let libelle = nomComplet;
  if (matricule) libelle += ` - ${matricule}`;
  if (groupe) libelle += ` (${groupe})`;
  if (programme) libelle += ` - ${programme}`;
  return libelle;
}

/**
 * Formate l'étape d'un étudiant avec le préfixe "E" si nécessaire.
 *
 * Exemples :
 *  - "3"  → "E3"
 *  - "E3" → "E3" (déjà formaté)
 *  - ""   → "-"
 *
 * @param {object|null} etudiant - L'étudiant dont on formate l'étape
 * @returns {string} L'étape formatée (ex: "E3") ou "-"
 */
function formaterEtape(etudiant) {
  const etape = String(etudiant?.etape || "").trim();
  if (!etape) return "-";
  // Si l'étape commence par "E" ou "e", on la met juste en majuscule
  return /^e/i.test(etape) ? etape.toUpperCase() : `E${etape}`;
}

/**
 * Pré-calcule et indexe toutes les versions normalisées des champs d'un étudiant.
 *
 * Cette structure est créée une seule fois par étudiant (via useMemo) et
 * réutilisée à chaque recherche. Sans cette pré-calculation, chaque frappe
 * déclencherait un normaliserTexte() sur chaque champ de chaque étudiant.
 *
 * @param {object} etudiant - L'étudiant à indexer
 * @param {number} index - Position dans la liste (pour le tri stable)
 * @returns {object} L'entrée indexée avec toutes les versions normalisées
 */
function construireEntreeEtudiant(etudiant, index) {
  const prenom = String(etudiant?.prenom || "").trim();
  const nom = String(etudiant?.nom || "").trim();
  const nomComplet = [prenom, nom].filter(Boolean).join(" ");
  const matricule = String(etudiant?.matricule || "").trim();
  const groupe =
    String(etudiant?.groupe || etudiant?.groupe_principal || "").trim();
  const programme = String(etudiant?.programme || "").trim();
  const etape = String(etudiant?.etape || "").trim();
  const etapeAffichee = formaterEtape(etudiant);

  return {
    etudiant,
    index,
    nomComplet,
    matricule,
    groupe,
    programme,
    etapeAffichee,
    // Versions normalisées pour la comparaison rapide
    prenomNormalise: normaliserTexte(prenom),
    nomNormalise: normaliserTexte(nom),
    nomCompletNormalise: normaliserTexte(nomComplet),
    matriculeNormalise: normaliserTexte(matricule),
    groupeNormalise: normaliserTexte(groupe),
    programmeNormalise: normaliserTexte(programme),
    etapeNormalisee: normaliserTexte(etape),
    etapeAfficheeNormalisee: normaliserTexte(etapeAffichee),
    // Corpus complet pour la recherche de dernier recours
    rechercheNormalisee: normaliserTexte(
      [nomComplet, prenom, nom, matricule, groupe, programme, etape, etapeAffichee].join(" ")
    ),
  };
}

/**
 * Calcule un score de pertinence pour une entrée par rapport aux termes de recherche.
 *
 * Le score détermine le classement dans les résultats. Plus le score est élevé,
 * plus le résultat apparaît en tête de liste.
 *
 * Hiérarchie des scores (par ordre décroissant) :
 *  180 → Correspondance exacte sur le matricule
 *  160 → Correspondance exacte sur le nom complet
 *  130 → Début du nom ou prénom
 *  120 → Début du matricule
 *  115 → Début du groupe
 *  110 → Correspondance exacte sur le programme
 *  105 → Correspondance exacte sur l'étape
 *  85  → Nom complet contient le terme
 *  80  → Groupe contient le terme
 *  70  → Programme contient le terme
 *  55  → Corpus complet contient le terme
 *  null → Terme non trouvé → l'entrée est exclue des résultats
 *
 * @param {object} entree - L'entrée indexée de l'étudiant
 * @param {string[]} termes - Les termes de recherche normalisés
 * @returns {number|null} Le score de pertinence, ou null si au moins un terme n'est pas trouvé
 */
function calculerScore(entree, termes) {
  if (termes.length === 0) return 0; // Pas de filtre → inclure tous les étudiants

  let score = 0;

  for (const terme of termes) {
    if (!terme) continue;

    // Correspondances exactes (score le plus élevé)
    if (entree.matriculeNormalise === terme) { score += 180; continue; }
    if (entree.nomCompletNormalise === terme) { score += 160; continue; }

    // Correspondances de début (très pertinent — l'utilisateur tape le début du mot)
    if (
      entree.nomNormalise.startsWith(terme) ||
      entree.prenomNormalise.startsWith(terme)
    ) { score += 130; continue; }
    if (entree.matriculeNormalise.startsWith(terme)) { score += 120; continue; }
    if (entree.groupeNormalise.startsWith(terme)) { score += 115; continue; }

    // Correspondances exactes sur d'autres champs
    if (entree.programmeNormalise === terme) { score += 110; continue; }
    if (
      entree.etapeNormalisee === terme ||
      entree.etapeAfficheeNormalisee === terme
    ) { score += 105; continue; }

    // Correspondances partielles (le terme apparaît quelque part)
    if (entree.nomCompletNormalise.includes(terme)) { score += 85; continue; }
    if (entree.groupeNormalise.includes(terme)) { score += 80; continue; }
    if (entree.programmeNormalise.includes(terme)) { score += 70; continue; }
    if (entree.rechercheNormalisee.includes(terme)) { score += 55; continue; }

    return null; // Ce terme n'est nulle part → exclure cet étudiant
  }

  return score;
}

/**
 * Compare deux entrées pour le tri des résultats.
 *
 * Tri par ordre de priorité :
 *  1. Score décroissant (les plus pertinents en premier)
 *  2. Nom complet alphabétique (pour un ordre stable à score égal)
 *  3. Index original (pour la stabilité finale)
 *
 * @param {object} entreeA - Première entrée avec propriété `score`
 * @param {object} entreeB - Deuxième entrée avec propriété `score`
 * @returns {number} Négatif si A avant B, positif si B avant A
 */
function comparerEntrees(entreeA, entreeB) {
  if (entreeA.score !== entreeB.score) return entreeB.score - entreeA.score;

  const compareNom = entreeA.nomComplet.localeCompare(entreeB.nomComplet, "fr", {
    sensitivity: "base",
  });
  if (compareNom !== 0) return compareNom;

  return entreeA.index - entreeB.index;
}

/**
 * Champ de recherche filtrable pour sélectionner un étudiant dans un échange de cours.
 *
 * @param {object} props
 * @param {object[]} props.etudiants - Liste complète des étudiants disponibles
 * @param {string} props.selectedId - ID de l'étudiant actuellement sélectionné
 * @param {Function} props.onSelect - Callback : onSelect(id_etudiant) quand une sélection est faite
 * @param {string} [props.excludeId=""] - ID à exclure de la liste (l'autre côté de l'échange)
 * @param {boolean} [props.disabled=false] - Désactiver le champ
 * @param {boolean} [props.loading=false] - Afficher l'état chargement
 * @param {string} [props.label="Étudiant"] - Étiquette au-dessus du champ
 * @param {string} [props.placeholder] - Texte placeholder du champ
 * @returns {JSX.Element}
 */
export function EchangeEtudiantSearchField({
  etudiants = [],
  selectedId = "",
  onSelect,
  excludeId = "",
  disabled = false,
  loading = false,
  label = "Étudiant",
  placeholder = "Nom, prénom, matricule, groupe ou programme…",
}) {
  // ID unique pour l'accessibilité ARIA (listbox + options)
  const listboxId = useId();

  // Référence sur le conteneur racine — pour détecter les clics à l'extérieur
  const rootRef = useRef(null);

  // Références sur chaque option affichée — pour le scroll automatique
  const optionRefs = useRef([]);

  // Flag interne : true quand l'utilisateur a tapé quelque chose mais n'a pas encore
  // sélectionné → évite que le champ se vide si la `selectedId` parent est réinitialisée
  const preserverRechercheRef = useRef(false);

  const [estOuvert, setEstOuvert] = useState(false);    // Dropdown visible ou non
  const [recherche, setRecherche] = useState("");        // Texte du champ de saisie
  const [indexActif, setIndexActif] = useState(-1);     // Option courante (navigation clavier)

  // useDeferredValue : React peut traiter les autres mises à jour en priorité
  // et appliquer le filtre quand le navigateur est libre. Évite les freezes.
  const rechercheDifferee = useDeferredValue(recherche);

  // Pré-calcul du corpus — une seule fois quand la liste d'étudiants change
  const entrees = useMemo(
    () =>
      (Array.isArray(etudiants) ? etudiants : []).map((etudiant, index) =>
        construireEntreeEtudiant(etudiant, index)
      ),
    [etudiants]
  );

  // L'étudiant sélectionné (désormais identifié par selectedId)
  const etudiantSelectionne = useMemo(
    () =>
      entrees.find(
        (entree) => String(entree.etudiant.id_etudiant) === String(selectedId)
      )?.etudiant || null,
    [entrees, selectedId]
  );

  // Résultats filtrés — excluant excludeId et triés par score de pertinence
  const resultats = useMemo(() => {
    const termes = normaliserTexte(rechercheDifferee)
      .split(/\s+/)
      .filter(Boolean);

    return entrees
      .filter(
        (entree) =>
          !excludeId ||
          String(entree.etudiant.id_etudiant) !== String(excludeId)
      )
      .map((entree) => {
        const score = calculerScore(entree, termes);
        return score === null ? null : { ...entree, score };
      })
      .filter(Boolean)
      .sort(comparerEntrees);
  }, [entrees, rechercheDifferee, excludeId]);

  // On n'affiche que les 60 premiers résultats pour éviter un DOM surchargé
  const resultatsVisibles = useMemo(() => resultats.slice(0, 60), [resultats]);

  // Synchroniser le texte du champ avec la sélection externe
  // Si selectedId change depuis l'extérieur, mettre à jour le libellé du champ
  useEffect(() => {
    if (etudiantSelectionne) {
      setRecherche(construireLibelleSelection(etudiantSelectionne));
      preserverRechercheRef.current = false;
      return;
    }
    if (!selectedId) {
      if (preserverRechercheRef.current) {
        preserverRechercheRef.current = false;
        return; // L'utilisateur tape — ne pas effacer le champ
      }
      setRecherche("");
    }
  }, [etudiantSelectionne, selectedId]);

  // Réinitialiser l'index actif quand le dropdown s'ouvre/ferme ou les résultats changent
  useEffect(() => {
    if (!estOuvert) { setIndexActif(-1); return; }
    setIndexActif((actuel) => {
      if (resultatsVisibles.length === 0) return -1;
      if (actuel < 0 || actuel >= resultatsVisibles.length) return 0;
      return actuel;
    });
  }, [estOuvert, resultatsVisibles]);

  // Fermer le dropdown si l'utilisateur clique en dehors du composant
  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setEstOuvert(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Faire défiler automatiquement vers l'option active lors de la navigation clavier
  useEffect(() => {
    if (indexActif < 0) return;
    optionRefs.current[indexActif]?.scrollIntoView({ block: "nearest" });
  }, [indexActif]);

  /**
   * Gère la sélection d'un étudiant dans la liste.
   *
   * @param {object} etudiant - L'étudiant sélectionné
   */
  function handleSelection(etudiant) {
    if (!etudiant || typeof onSelect !== "function") return;
    onSelect(String(etudiant.id_etudiant));
    setEstOuvert(false);
    setRecherche(construireLibelleSelection(etudiant)); // Mettre le nom dans le champ
  }

  /**
   * Gère la saisie dans le champ de recherche.
   * Réinitialise la sélection si l'utilisateur modifie le texte après avoir sélectionné.
   *
   * @param {React.ChangeEvent} event
   */
  function handleChange(event) {
    setRecherche(event.target.value);
    setEstOuvert(true);
    if (selectedId && typeof onSelect === "function") {
      preserverRechercheRef.current = true; // Signaler de conserver le texte
      onSelect(""); // Effacer la sélection quand l'utilisateur retape
    }
  }

  /**
   * Gère la navigation clavier dans la liste déroulante.
   *
   * @param {React.KeyboardEvent} event
   */
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
      handleSelection(resultatsVisibles[indexActif]?.etudiant);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setEstOuvert(false); // Fermer sans sélectionner
    }
  }

  // Nombre d'étudiants disponibles après exclusion (compteur affiché)
  const nbDisponibles = useMemo(
    () =>
      entrees.filter(
        (entree) =>
          !excludeId ||
          String(entree.etudiant.id_etudiant) !== String(excludeId)
      ).length,
    [entrees, excludeId]
  );

  return (
    <div className="prof-search">
      {/* Étiquette au-dessus du champ */}
      <span className="prof-search__label">{label}</span>

      <div
        ref={rootRef}
        className={`prof-search__root${estOuvert ? " prof-search__root--open" : ""}`}
      >
        {/* Zone de saisie + bouton Effacer */}
        <div className="prof-search__control">
          <input
            type="text"
            value={recherche}
            onChange={handleChange}
            onFocus={() => setEstOuvert(true)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? "Chargement des étudiants…" : placeholder}
            disabled={disabled || loading}
            autoComplete="off"
            // Attributs ARIA pour l'accessibilité (lecteurs d'écran)
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={estOuvert}
            aria-controls={listboxId}
            aria-activedescendant={
              estOuvert && indexActif >= 0
                ? `${listboxId}-opt-${resultatsVisibles[indexActif]?.etudiant?.id_etudiant}`
                : undefined
            }
          />

          {/* Bouton "Effacer" visible uniquement si un étudiant est sélectionné */}
          {selectedId && (
            <button
              type="button"
              className="prof-search__clear"
              onClick={() => {
                setRecherche("");
                setEstOuvert(true);
                if (typeof onSelect === "function") onSelect("");
              }}
              disabled={disabled || loading}
              aria-label="Réinitialiser la sélection"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Compteur indicatif */}
        <div className="prof-search__hint">
          <span>{nbDisponibles} étudiant(s) disponible(s).</span>
        </div>

        {/* Liste déroulante de résultats */}
        {estOuvert && (
          <div className="prof-search__dropdown">
            <div className="prof-search__summary">
              <strong>{resultats.length} résultat(s)</strong>
              <span>
                {resultats.length > resultatsVisibles.length
                  ? `Affichage des ${resultatsVisibles.length} premiers.`
                  : "Filtrage multi-critères actif."}
              </span>
            </div>

            {resultatsVisibles.length === 0 ? (
              <p className="prof-search__empty">
                Aucun étudiant ne correspond à cette recherche.
              </p>
            ) : (
              <ul
                id={listboxId}
                className="prof-search__results"
                role="listbox"
              >
                {resultatsVisibles.map((entree, index) => {
                  const estSelectionne =
                    String(entree.etudiant.id_etudiant) === String(selectedId);
                  const estActif = index === indexActif;

                  return (
                    <li
                      key={entree.etudiant.id_etudiant}
                      id={`${listboxId}-opt-${entree.etudiant.id_etudiant}`}
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
                          "echange-etudiant-option",
                          estSelectionne ? "prof-search__option--selected" : "",
                          estActif ? "prof-search__option--active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleSelection(entree.etudiant)}
                        onMouseEnter={() => setIndexActif(index)}
                      >
                        {/* Ligne principale : nom complet en gras */}
                        <strong>{entree.nomComplet}</strong>
                        {/* Ligne secondaire : matricule + groupe */}
                        <span>
                          {entree.matricule || "—"}
                          {entree.groupe ? ` (${entree.groupe})` : ""}
                        </span>
                        {/* Ligne tertiaire : programme (petite police) */}
                        {entree.programme ? (
                          <small>{entree.programme}</small>
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
