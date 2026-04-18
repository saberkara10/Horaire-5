import { Clapperboard, PlayCircle, Sparkles } from "lucide-react";

export function HelpVideoCard({ video, onOpen }) {
  function handleOpen() {
    onOpen(video);
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
      className="help-video-card"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      aria-label={`Voir la capsule ${video.title}`}
    >
      <div className="help-video-card__media">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={`Miniature ${video.title}`}
            className="help-video-card__image"
            loading="lazy"
          />
        ) : (
          <div className="help-video-card__placeholder" aria-hidden="true">
            <Clapperboard size={34} />
          </div>
        )}

        <span
          className={`help-video-card__status ${
            video.hasVideo
              ? "help-video-card__status--ready"
              : "help-video-card__status--coming"
          }`}
        >
          {video.hasVideo ? "Lecture disponible" : "A venir"}
        </span>
      </div>

      <div className="help-video-card__body">
        <div className="help-video-card__eyebrow">
          {video.categoryName ? <span>{video.categoryName}</span> : null}
          {video.levelLabel ? (
            <span className="help-video-card__eyebrow-tag">
              <Sparkles size={14} />
              {video.levelLabel}
            </span>
          ) : null}
        </div>

        <h3>{video.title}</h3>
        <p>{video.description}</p>

        <div className="help-video-card__footer">
          <span>{video.durationLabel || "Duree a preciser"}</span>
          <span className="help-video-card__action">
            <PlayCircle size={16} />
            Voir la video
          </span>
        </div>
      </div>
    </article>
  );
}
