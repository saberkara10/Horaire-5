import {
  Suspense,
  lazy,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Compass,
  Filter,
  Layers3,
  Search,
} from "lucide-react";
import { GuideCard } from "../components/help/GuideCard.jsx";
import { GuideDetailModal } from "../components/help/GuideDetailModal.jsx";
import { HelpVideoCard } from "../components/help/HelpVideoCard.jsx";
import {
  getHelpCenter,
  getHelpDocumentDetail,
} from "../services/help.api.js";
import "../styles/CentreAidePage.css";

const HelpDocumentModal = lazy(() =>
  import("../components/help/HelpDocumentModal.jsx").then((module) => ({
    default: module.HelpDocumentModal,
  }))
);

const DEFAULT_FILTERS = {
  query: "",
  categoryId: "all",
  type: "all",
  level: "all",
  tag: "all",
  moduleKey: "all",
};

const SECTION_IDS = {
  categories: "categories",
  explorer: "explorer",
  videos: "videos",
  documents: "documents",
  faq: "faq",
  scenarios: "scenarios",
};

function SectionHeader({ eyebrow, title, description, actionLabel, onAction }) {
  return (
    <div className="centre-aide__section-head">
      <div>
        {eyebrow ? <span className="centre-aide__section-eyebrow">{eyebrow}</span> : null}
        <h2 className="centre-aide__section-title">{title}</h2>
        {description ? <p className="centre-aide__section-description">{description}</p> : null}
      </div>

      {actionLabel && onAction ? (
        <button
          type="button"
          className="centre-aide__section-link"
          onClick={onAction}
        >
          {actionLabel}
          <ArrowRight size={16} />
        </button>
      ) : null}
    </div>
  );
}

function FaqItem({ item, onOpen }) {
  return (
    <details className="help-faq-item">
      <summary>
        <span>{item.title}</span>
        <ArrowRight size={16} />
      </summary>
      <div className="help-faq-item__body">
        <p>{item.answer}</p>
        <button type="button" className="help-faq-item__link" onClick={() => onOpen(item)}>
          Voir la fiche associee
        </button>
      </div>
    </details>
  );
}

function getSearchableText(item) {
  return [
    item.title,
    item.summary,
    item.description,
    item.objective,
    item.answer,
    item.categoryName,
    item.moduleKey,
    ...(item.tags || []),
    ...(item.keywords || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getContentPriority(item) {
  switch (item.type) {
    case "guide":
      return 5;
    case "scenario":
      return 4;
    case "video":
      return item.hasVideo ? 3 : 2;
    case "documentation":
      return 3;
    case "faq":
      return 2;
    default:
      return 1;
  }
}

function sortContent(content) {
  return [...content].sort((itemA, itemB) => {
    const priorityDifference = getContentPriority(itemB) - getContentPriority(itemA);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const popularityDifference =
      Number(itemB.popularityScore || 0) - Number(itemA.popularityScore || 0);

    if (popularityDifference !== 0) {
      return popularityDifference;
    }

    return String(itemA.title || "").localeCompare(String(itemB.title || ""), "fr");
  });
}

export function CentreAidePage({ utilisateur, onLogout }) {
  const [helpCenter, setHelpCenter] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedContent, setSelectedContent] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const explorerRef = useRef(null);
  const categoriesRef = useRef(null);
  const videosRef = useRef(null);
  const documentsRef = useRef(null);
  const faqRef = useRef(null);
  const scenariosRef = useRef(null);

  const deferredQuery = useDeferredValue(filters.query.trim().toLowerCase());

  useEffect(() => {
    let cancelled = false;

    async function loadHelpCenter() {
      try {
        setIsLoading(true);
        setError("");

        const payload = await getHelpCenter();

        if (cancelled) {
          return;
        }

        setHelpCenter(payload);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setHelpCenter(null);
        setError(
          loadError.message ||
            "Impossible de charger le catalogue du centre d'aide."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadHelpCenter();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const allContent = useMemo(() => {
    if (!helpCenter) {
      return [];
    }

    return sortContent([
      ...(helpCenter.guides || []),
      ...(helpCenter.documents || []),
      ...(helpCenter.videos || []),
      ...(helpCenter.faqs || []),
      ...(helpCenter.scenarios || []),
    ]);
  }, [helpCenter]);

  const contentById = useMemo(
    () => new Map(allContent.map((item) => [item.id, item])),
    [allContent]
  );

  const filteredContent = useMemo(() => {
    return allContent.filter((item) => {
      if (filters.categoryId !== "all" && item.categoryId !== filters.categoryId) {
        return false;
      }

      if (filters.type !== "all" && item.type !== filters.type) {
        return false;
      }

      if (filters.level !== "all" && item.level !== filters.level) {
        return false;
      }

      if (filters.tag !== "all" && !(item.tags || []).includes(filters.tag)) {
        return false;
      }

      if (filters.moduleKey !== "all" && item.moduleKey !== filters.moduleKey) {
        return false;
      }

      if (deferredQuery && !getSearchableText(item).includes(deferredQuery)) {
        return false;
      }

      return true;
    });
  }, [allContent, deferredQuery, filters.categoryId, filters.level, filters.moduleKey, filters.tag, filters.type]);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === "query") {
        return value.trim().length > 0;
      }

      return value !== "all";
    });
  }, [filters]);

  const displayedResults = hasActiveFilters
    ? filteredContent
    : helpCenter?.featured?.recommendedGuides || [];

  const featuredVideos = useMemo(() => {
    const sourceVideos = Array.isArray(helpCenter?.videos) ? helpCenter.videos : [];

    if (sourceVideos.length === 0) {
      return [];
    }

    const sortedVideos = sortContent(sourceVideos);
    const readyVideos = sortedVideos.filter((video) => video.hasVideo);
    const baseVideos = readyVideos.length > 0 ? readyVideos : sortedVideos.slice(0, 6);
    const seenKeys = new Set();

    return baseVideos.filter((video) => {
      const uniqueKey = video.backendVideoId || video.streamUrl || video.id;

      if (seenKeys.has(uniqueKey)) {
        return false;
      }

      seenKeys.add(uniqueKey);
      return true;
    });
  }, [helpCenter]);

  function scrollToSection(sectionId) {
    const refMap = {
      [SECTION_IDS.categories]: categoriesRef,
      [SECTION_IDS.explorer]: explorerRef,
      [SECTION_IDS.videos]: videosRef,
      [SECTION_IDS.documents]: documentsRef,
      [SECTION_IDS.faq]: faqRef,
      [SECTION_IDS.scenarios]: scenariosRef,
    };

    refMap[sectionId]?.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function updateFilters(patch) {
    startTransition(() => {
      setFilters((currentFilters) => ({
        ...currentFilters,
        ...patch,
      }));
    });
  }

  function handleOpenContent(item) {
    if (!item) {
      return;
    }

    if (item.type === "documentation") {
      void handleOpenDocument(item.slug);
      return;
    }

    setSelectedDocument(null);
    setDocumentError("");
    setSelectedContent(item);
  }

  function handleOpenContentById(contentId) {
    const item = contentById.get(contentId);

    if (!item) {
      return;
    }

    handleOpenContent(item);
  }

  async function handleOpenDocument(slug) {
    setSelectedContent(null);
    setSelectedDocument(null);
    setDocumentError("");
    setIsLoadingDocument(true);

    try {
      const documentDetail = await getHelpDocumentDetail(slug);
      setSelectedDocument(documentDetail);
    } catch (loadError) {
      setDocumentError(
        loadError.message || "Impossible de charger la documentation demandee."
      );
    } finally {
      setIsLoadingDocument(false);
    }
  }

  function handleCloseDocument() {
    setSelectedDocument(null);
    setDocumentError("");
    setIsLoadingDocument(false);
  }

  function handleExploreCategory(categoryId) {
    updateFilters({
      categoryId,
      type: "all",
      level: "all",
      tag: "all",
      moduleKey: "all",
    });
    scrollToSection(SECTION_IDS.explorer);
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  if (isLoading) {
    return (
      <div className="centre-aide__loading">
        <div className="centre-aide__loading-card">
          <div className="centre-aide__spinner" />
          <p>Chargement du catalogue d'assistance...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="centre-aide">
        <section className="centre-aide__hero">
          <div className="centre-aide__hero-main">
            <span className="centre-aide__hero-pill">
              <Layers3 size={16} />
              Support produit premium
            </span>

            <h2 className="centre-aide__hero-title">
              Tout retrouver sans se perdre, du premier clic a la resolution d'un blocage
            </h2>

            <p className="centre-aide__hero-text">
              Le Centre d'aide rassemble guides, videos, markdowns, FAQ et
              scenarios concrets pour accompagner l'administration academique
              sans jargon technique.
            </p>

            <div className="centre-aide__search-shell">
              <Search size={18} className="centre-aide__search-icon" />
              <input
                type="search"
                className="centre-aide__search-input"
                placeholder="Rechercher par module, mot-cle ou action: generation, export, disponibilite..."
                value={filters.query}
                onChange={(event) => updateFilters({ query: event.target.value })}
                aria-label="Rechercher dans le centre d'aide"
              />
            </div>

            <div className="centre-aide__jump-links">
              <button type="button" onClick={() => scrollToSection(SECTION_IDS.categories)}>
                Modules
              </button>
              <button type="button" onClick={() => scrollToSection(SECTION_IDS.explorer)}>
                Recherche avancee
              </button>
              <button type="button" onClick={() => scrollToSection(SECTION_IDS.videos)}>
                Videos
              </button>
              <button type="button" onClick={() => scrollToSection(SECTION_IDS.documents)}>
                Markdown
              </button>
              <button type="button" onClick={() => scrollToSection(SECTION_IDS.faq)}>
                FAQ
              </button>
            </div>
          </div>

          <div className="centre-aide__hero-aside">
            <div className="centre-aide__metric-grid">
              <article className="centre-aide__metric-card">
                <strong>{helpCenter?.summary?.guides || 0}</strong>
                <span>guides structures</span>
              </article>
              <article className="centre-aide__metric-card">
                <strong>{helpCenter?.summary?.documents || 0}</strong>
                <span>documents markdown</span>
              </article>
              <article className="centre-aide__metric-card">
                <strong>{helpCenter?.summary?.videosReady || 0}</strong>
                <span>capsules disponibles</span>
              </article>
              <article className="centre-aide__metric-card">
                <strong>{helpCenter?.summary?.faqs || 0}</strong>
                <span>reponses rapides</span>
              </article>
            </div>

            <div className="centre-aide__hero-note">
              <h3>Progression recommandee</h3>
              <p>
                Commencez par les guides d'onboarding, passez par les donnees de
                reference, puis montez vers la generation, la correction et les
                exports.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <section className="centre-aide__error" role="alert">
            <h3>Le centre d'aide n'a pas pu etre charge.</h3>
            <p>{error}</p>
            <button
              type="button"
              className="centre-aide__primary-btn"
              onClick={() => setReloadToken((currentValue) => currentValue + 1)}
            >
              Recharger
            </button>
          </section>
        ) : null}

        {!error ? (
          <>
            <section className="centre-aide__section">
              <SectionHeader
                eyebrow="Acces rapide"
                title="Les demandes les plus frequentes"
                description="Des scenarios orientes action pour les operations les plus critiques de la plateforme."
                actionLabel="Explorer les scenarios"
                onAction={() => scrollToSection(SECTION_IDS.scenarios)}
              />

              <div className="centre-aide__grid centre-aide__grid--feature">
                {(helpCenter?.featured?.quickAccess || []).map((item) => (
                  <GuideCard
                    key={item.id}
                    item={item}
                    variant="feature"
                    onOpen={handleOpenContent}
                  />
                ))}
              </div>
            </section>

            <section className="centre-aide__section">
              <SectionHeader
                eyebrow="Parcours d'apprentissage"
                title="Etapes recommandees pour un nouvel utilisateur"
                description="Une progression simple pour apprendre la plateforme sans etre noye dans toutes les options."
              />

              <div className="help-learning-path">
                {(helpCenter?.featured?.learningPath || []).map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    className="help-learning-path__step"
                    onClick={() => handleOpenContentById(step.content.id)}
                  >
                    <span className="help-learning-path__index">{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.description}</p>
                      <span>{step.content.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section
              ref={categoriesRef}
              id={SECTION_IDS.categories}
              className="centre-aide__section"
            >
              <SectionHeader
                eyebrow="Modules"
                title="Besoin d'aide sur un module precis ?"
                description="Chaque categorie rassemble guides, videos, documentation et FAQ relies au meme contexte metier."
              />

              <div className="centre-aide__categories-grid">
                {(helpCenter?.categories || []).map((category) => (
                  <article key={category.id} className="help-category-card">
                    <div className="help-category-card__head">
                      <div className="help-category-card__icon">
                        <Layers3 size={20} />
                      </div>
                      <span className="help-category-card__module">
                        {category.moduleKey}
                      </span>
                    </div>

                    <h3>{category.name}</h3>
                    <p>{category.description}</p>

                    <div className="help-category-card__counts">
                      <span>{category.counts.guides} guides</span>
                      <span>{category.counts.documents} docs</span>
                      <span>{category.counts.videos} videos</span>
                    </div>

                    <button
                      type="button"
                      className="help-category-card__action"
                      onClick={() => handleExploreCategory(category.id)}
                    >
                      Explorer ce module
                      <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section
              ref={explorerRef}
              id={SECTION_IDS.explorer}
              className="centre-aide__section centre-aide__section--panel"
            >
              <SectionHeader
                eyebrow="Recherche & filtrage"
                title="Explorer tout le catalogue d'aide"
                description="Recherche par module, mot-cle, type de contenu, niveau ou tag. Les resultats couvrent guides, videos, markdowns, FAQ et scenarios."
              />

              <div className="help-filters">
                <label className="help-filters__search">
                  <Search size={17} />
                  <input
                    type="search"
                    placeholder="Ex: groupe frere, rapport, planning manuel, professeur indisponible"
                    value={filters.query}
                    onChange={(event) => updateFilters({ query: event.target.value })}
                  />
                </label>

                <div className="help-filters__grid">
                  <label>
                    <span>Module</span>
                    <select
                      value={filters.categoryId}
                      onChange={(event) => updateFilters({ categoryId: event.target.value })}
                    >
                      <option value="all">Tous les modules</option>
                      {(helpCenter?.meta?.filters?.categories || []).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Type</span>
                    <select
                      value={filters.type}
                      onChange={(event) => updateFilters({ type: event.target.value })}
                    >
                      <option value="all">Tous les contenus</option>
                      {(helpCenter?.meta?.filters?.types || []).map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Niveau</span>
                    <select
                      value={filters.level}
                      onChange={(event) => updateFilters({ level: event.target.value })}
                    >
                      <option value="all">Tous les niveaux</option>
                      {(helpCenter?.meta?.filters?.levels || []).map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Tag</span>
                    <select
                      value={filters.tag}
                      onChange={(event) => updateFilters({ tag: event.target.value })}
                    >
                      <option value="all">Tous les tags</option>
                      {(helpCenter?.meta?.filters?.tags || []).map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Cle module</span>
                    <select
                      value={filters.moduleKey}
                      onChange={(event) => updateFilters({ moduleKey: event.target.value })}
                    >
                      <option value="all">Toutes les cles</option>
                      {(helpCenter?.meta?.filters?.modules || []).map((moduleItem) => (
                        <option key={moduleItem.id} value={moduleItem.id}>
                          {moduleItem.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="help-filters__footer">
                  <div className="help-filters__summary">
                    <Filter size={15} />
                    <span>
                      {hasActiveFilters
                        ? `${filteredContent.length} resultat${filteredContent.length > 1 ? "s" : ""}`
                        : "Guides recommandes"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="centre-aide__secondary-btn"
                    onClick={handleResetFilters}
                  >
                    Reinitialiser les filtres
                  </button>
                </div>
              </div>

              {displayedResults.length === 0 ? (
                <div className="centre-aide__empty">
                  <Compass size={28} />
                  <h3>Aucun contenu ne correspond a vos filtres.</h3>
                  <p>
                    Essayez un autre mot-cle, un niveau plus large ou supprimez un tag
                    trop restrictif.
                  </p>
                </div>
              ) : (
                <div className="centre-aide__grid">
                  {displayedResults.map((item) => (
                    <GuideCard key={item.id} item={item} onOpen={handleOpenContent} />
                  ))}
                </div>
              )}
            </section>

            <section className="centre-aide__section">
              <SectionHeader
                eyebrow="Popularite"
                title="Guides les plus consultes"
                description="Les fiches les plus utiles pour la preparation, la generation et la correction."
              />

              <div className="centre-aide__grid">
                {(helpCenter?.featured?.popularGuides || []).map((item) => (
                  <GuideCard key={item.id} item={item} onOpen={handleOpenContent} />
                ))}
              </div>
            </section>

            <section
              ref={videosRef}
              id={SECTION_IDS.videos}
              className="centre-aide__section"
            >
              <SectionHeader
                eyebrow="Capsules video"
                title="Tutoriels video disponibles dans le centre d'aide"
                description="Les capsules actives couvrent deja les horaires, les disponibilites, la gestion des groupes, la generation et le pilotage de session."
              />

              <div className="centre-aide__video-grid">
                {featuredVideos.map((video) => (
                  <HelpVideoCard key={video.id} video={video} onOpen={handleOpenContent} />
                ))}
              </div>
            </section>

            <section
              ref={documentsRef}
              id={SECTION_IDS.documents}
              className="centre-aide__section"
            >
              <SectionHeader
                eyebrow="Documentation markdown"
                title="Des documents relies au produit"
                description="Guides pas a pas, explications metier, procedures detaillees, resolution de problemes et bonnes pratiques."
              />

              <div className="centre-aide__grid">
                {(helpCenter?.documents || []).slice(0, 8).map((item) => (
                  <GuideCard key={item.id} item={item} onOpen={handleOpenContent} />
                ))}
              </div>
            </section>

            <section
              ref={scenariosRef}
              id={SECTION_IDS.scenarios}
              className="centre-aide__section"
            >
              <SectionHeader
                eyebrow="Scenarios d'utilisation"
                title="Cas concrets pour les operations metier"
                description="Des parcours guides pour les situations les plus frequentes pendant une session de planification."
              />

              <div className="centre-aide__grid">
                {(helpCenter?.scenarios || []).map((item) => (
                  <GuideCard key={item.id} item={item} onOpen={handleOpenContent} />
                ))}
              </div>
            </section>

            <section
              ref={faqRef}
              id={SECTION_IDS.faq}
              className="centre-aide__section centre-aide__section--panel"
            >
              <SectionHeader
                eyebrow="FAQ intelligente"
                title="Reponses rapides aux blocages les plus courants"
                description="Une FAQ orientee action pour diagnostiquer, corriger et reprendre la main sans perdre de temps."
              />

              <div className="help-faq-list">
                {(helpCenter?.faqs || []).map((item) => (
                  <FaqItem key={item.id} item={item} onOpen={handleOpenContent} />
                ))}
              </div>
            </section>

            <section className="centre-aide__section">
              <SectionHeader
                eyebrow="Nouveautes"
                title="Contenus recemment ajoutes"
                description="Des contenus de demonstration qui enrichissent progressivement la base d'aide."
              />

              <div className="centre-aide__grid">
                {(helpCenter?.featured?.recentContent || []).map((item) => (
                  <GuideCard key={item.id} item={item} onOpen={handleOpenContent} />
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <GuideDetailModal
        item={selectedContent}
        onClose={() => setSelectedContent(null)}
        onOpenDocument={(slug) => void handleOpenDocument(slug)}
        onOpenContent={handleOpenContentById}
      />

      <Suspense fallback={null}>
        <HelpDocumentModal
          documentDetail={selectedDocument}
          isLoading={isLoadingDocument}
          error={documentError}
          onClose={handleCloseDocument}
          onOpenContent={handleOpenContentById}
        />
      </Suspense>
    </>
  );
}
