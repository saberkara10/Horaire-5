import { useEffect } from "react";
import {
  AlertTriangle,
  BookOpen,
  CircleHelp,
  Clock3,
  FileText,
  Layers3,
  Lightbulb,
  PlayCircle,
  X,
} from "lucide-react";

function getTypeLabel(type) {
  switch (type) {
    case "video":
      return "Video";
    case "faq":
      return "FAQ";
    case "scenario":
      return "Scenario";
    default:
      return "Guide";
  }
}

function buildPrimaryVideo(item) {
  if (item.type === "video") {
    return item;
  }

  if (!Array.isArray(item.videos)) {
    return null;
  }

  return item.videos.find((video) => video.hasVideo) || item.videos[0] || null;
}

export function GuideDetailModal({
  item,
  onClose,
  onOpenDocument,
  onOpenContent,
}) {
  useEffect(() => {
    if (!item) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [item, onClose]);

  if (!item) {
    return null;
  }

  const primaryVideo = buildPrimaryVideo(item);
  const documents = Array.isArray(item.documents)
    ? item.documents
    : Array.isArray(item.relatedDocuments)
    ? item.relatedDocuments
    : [];
  const relatedGuides = Array.isArray(item.relatedGuides) ? item.relatedGuides : [];
  const steps = Array.isArray(item.steps) ? item.steps : [];
  const prerequisites = Array.isArray(item.prerequisites) ? item.prerequisites : [];
  const attentionPoints = Array.isArray(item.attentionPoints) ? item.attentionPoints : [];
  const commonErrors = Array.isArray(item.commonErrors) ? item.commonErrors : [];
  const practicalTips = Array.isArray(item.practicalTips) ? item.practicalTips : [];

  return (
    <div
      className="help-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="help-modal__panel">
        <div className="help-modal__header">
          <div className="help-modal__badges">
            <span className="help-modal__badge">{getTypeLabel(item.type)}</span>
            {item.categoryName ? (
              <span className="help-modal__badge help-modal__badge--soft">
                {item.categoryName}
              </span>
            ) : null}
            {item.levelLabel ? (
              <span className="help-modal__badge help-modal__badge--soft">
                <Layers3 size={14} />
                {item.levelLabel}
              </span>
            ) : null}
            {item.estimatedLabel || item.durationLabel ? (
              <span className="help-modal__badge help-modal__badge--soft">
                <Clock3 size={14} />
                {item.estimatedLabel || item.durationLabel}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            className="help-modal__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="help-modal__intro">
          <div>
            <h2 id="help-modal-title" className="help-modal__title">
              {item.title}
            </h2>
            <p className="help-modal__summary">{item.summary || item.description}</p>
          </div>

          {item.moduleKey ? (
            <div className="help-modal__module-card">
              <span>Module concerne</span>
              <strong>{item.moduleKey}</strong>
            </div>
          ) : null}
        </div>

        <div className="help-modal__layout">
          <div className="help-modal__main">
            {primaryVideo ? (
              <section className="help-modal__section">
                <div className="help-modal__media">
                  {primaryVideo.hasVideo ? (
                    <video
                      className="help-modal__video"
                      controls
                      controlsList="nodownload"
                      playsInline
                      preload="metadata"
                      poster={primaryVideo.thumbnailUrl || undefined}
                      src={primaryVideo.streamUrl}
                    >
                      Votre navigateur ne supporte pas la lecture video HTML5.
                    </video>
                  ) : (
                    <div className="help-modal__placeholder">
                      <PlayCircle size={34} />
                      <strong>Capsule video a venir</strong>
                      <span>
                        L'interface est deja prete pour accueillir la video de ce sujet.
                      </span>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {item.objective ? (
              <section className="help-modal__section">
                <div className="help-modal__section-head">
                  <Lightbulb size={18} />
                  <h3>Objectif</h3>
                </div>
                <p className="help-modal__paragraph">{item.objective}</p>
              </section>
            ) : null}

            {item.answer ? (
              <section className="help-modal__section">
                <div className="help-modal__section-head">
                  <CircleHelp size={18} />
                  <h3>Reponse</h3>
                </div>
                <p className="help-modal__paragraph">{item.answer}</p>
              </section>
            ) : null}

            {prerequisites.length > 0 ? (
              <section className="help-modal__section">
                <div className="help-modal__section-head">
                  <BookOpen size={18} />
                  <h3>Prerequis</h3>
                </div>
                <ul className="help-modal__list">
                  {prerequisites.map((prerequisite) => (
                    <li key={prerequisite}>{prerequisite}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {steps.length > 0 ? (
              <section className="help-modal__section">
                <div className="help-modal__section-head">
                  <PlayCircle size={18} />
                  <h3>Etapes</h3>
                </div>
                <ol className="help-modal__ordered-list">
                  {steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            {attentionPoints.length > 0 ? (
              <section className="help-modal__section">
                <div className="help-modal__section-head">
                  <AlertTriangle size={18} />
                  <h3>Points d'attention</h3>
                </div>
                <ul className="help-modal__list">
                  {attentionPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {commonErrors.length > 0 ? (
              <section className="help-modal__section">
                <div className="help-modal__section-head">
                  <AlertTriangle size={18} />
                  <h3>Erreurs frequentes</h3>
                </div>
                <ul className="help-modal__list">
                  {commonErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {practicalTips.length > 0 ? (
              <section className="help-modal__section">
                <div className="help-modal__section-head">
                  <BookOpen size={18} />
                  <h3>Conseils pratiques</h3>
                </div>
                <ul className="help-modal__list">
                  {practicalTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="help-modal__aside">
            {documents.length > 0 ? (
              <section className="help-modal__aside-card">
                <div className="help-modal__section-head">
                  <FileText size={18} />
                  <h3>Documentation</h3>
                </div>
                <div className="help-modal__resource-list">
                  {documents.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      className="help-modal__resource"
                      onClick={() => onOpenDocument(document.slug)}
                    >
                      <strong>{document.title}</strong>
                      <span>{document.kindLabel}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {Array.isArray(item.videos) && item.videos.length > 0 ? (
              <section className="help-modal__aside-card">
                <div className="help-modal__section-head">
                  <PlayCircle size={18} />
                  <h3>Capsules video</h3>
                </div>
                <div className="help-modal__resource-list">
                  {item.videos.map((video) => (
                    <div key={video.id} className="help-modal__resource help-modal__resource--static">
                      <strong>{video.title}</strong>
                      <span>
                        {video.durationLabel || "Duree a definir"} |{" "}
                        {video.hasVideo ? "Disponible" : "A venir"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {relatedGuides.length > 0 ? (
              <section className="help-modal__aside-card">
                <div className="help-modal__section-head">
                  <BookOpen size={18} />
                  <h3>Guides lies</h3>
                </div>
                <div className="help-modal__resource-list">
                  {relatedGuides.map((guide) => (
                    <button
                      key={guide.id}
                      type="button"
                      className="help-modal__resource"
                      onClick={() => onOpenContent(guide.id)}
                    >
                      <strong>{guide.title}</strong>
                      <span>{guide.categoryName}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {Array.isArray(item.tags) && item.tags.length > 0 ? (
              <section className="help-modal__aside-card">
                <div className="help-modal__section-head">
                  <Layers3 size={18} />
                  <h3>Mots-cles</h3>
                </div>
                <div className="help-modal__chip-list">
                  {item.tags.map((tag) => (
                    <span key={tag} className="help-modal__chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
