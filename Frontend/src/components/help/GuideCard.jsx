import {
  BookOpen,
  CircleHelp,
  Clapperboard,
  FileText,
  Lightbulb,
  PlayCircle,
  Sparkles,
} from "lucide-react";

const TYPE_CONFIG = {
  guide: {
    icon: BookOpen,
    label: "Guide",
    action: "Voir le guide",
  },
  video: {
    icon: PlayCircle,
    label: "Video",
    action: "Voir la video",
  },
  documentation: {
    icon: FileText,
    label: "Markdown",
    action: "Voir la documentation",
  },
  faq: {
    icon: CircleHelp,
    label: "FAQ",
    action: "Voir la reponse",
  },
  scenario: {
    icon: Lightbulb,
    label: "Scenario",
    action: "Voir le scenario",
  },
};

function getStatusLabel(item) {
  if (item.type !== "video") {
    return null;
  }

  return item.hasVideo ? "Disponible" : "A venir";
}

function getSecondaryMeta(item) {
  if (item.type === "documentation") {
    return item.kindLabel || null;
  }

  if (item.type === "video") {
    return item.durationLabel || null;
  }

  return item.estimatedLabel || item.levelLabel || null;
}

function getResourceSummary(item) {
  if (item.type !== "guide") {
    return null;
  }

  const documentsCount = Array.isArray(item.documents) ? item.documents.length : 0;
  const videosCount = Array.isArray(item.videos) ? item.videos.length : 0;

  return `${documentsCount} doc${documentsCount > 1 ? "s" : ""} | ${videosCount} video${videosCount > 1 ? "s" : ""}`;
}

export function GuideCard({ item, onOpen, variant = "default" }) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.guide;
  const Icon = config.icon;
  const secondaryMeta = getSecondaryMeta(item);
  const statusLabel = getStatusLabel(item);
  const resourceSummary = getResourceSummary(item);
  const cardClassName =
    variant === "feature" ? "help-card help-card--feature" : "help-card";

  function handleOpen() {
    onOpen(item);
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleOpen();
  }

  return (
    <article
      className={cardClassName}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      aria-label={`${config.action} ${item.title}`}
    >
      <div className="help-card__top">
        <div className="help-card__type">
          <span className="help-card__type-icon" aria-hidden="true">
            <Icon size={17} />
          </span>
          <span>{config.label}</span>
        </div>

        {statusLabel ? (
          <span
            className={`help-card__status ${
              item.hasVideo ? "help-card__status--ready" : "help-card__status--coming"
            }`}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="help-card__eyebrow">
        {item.categoryName ? (
          <span className="help-card__badge">{item.categoryName}</span>
        ) : null}
        {item.moduleKey ? (
          <span className="help-card__module">{item.moduleKey}</span>
        ) : null}
      </div>

      <h3 className="help-card__title">{item.title}</h3>
      <p className="help-card__summary">{item.summary || item.description}</p>

      {Array.isArray(item.tags) && item.tags.length > 0 ? (
        <div className="help-card__tags">
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="help-card__tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="help-card__meta">
        {item.levelLabel ? (
          <span className="help-card__meta-item">
            <Sparkles size={15} />
            {item.levelLabel}
          </span>
        ) : null}

        {secondaryMeta ? (
          <span className="help-card__meta-item">
            {item.type === "video" ? <Clapperboard size={15} /> : <BookOpen size={15} />}
            {secondaryMeta}
          </span>
        ) : null}
      </div>

      <div className="help-card__footer">
        <span className="help-card__action">{config.action}</span>
        {resourceSummary ? (
          <span className="help-card__resource-summary">{resourceSummary}</span>
        ) : null}
      </div>
    </article>
  );
}
