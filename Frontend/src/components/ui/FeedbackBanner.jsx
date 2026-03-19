/**
 * Bannière de feedback reutilisable.
 *
 * Elle sert surtout a l'import des etudiants, ou une erreur peut contenir
 * un message global et plusieurs details ligne par ligne.
 */
export function FeedbackBanner({
  type = "info",
  message,
  details = [],
  maxDetails = 6,
}) {
  if (!message) {
    return null;
  }

  const detailsAffiches = details.slice(0, maxDetails);
  const detailsRestants = Math.max(details.length - detailsAffiches.length, 0);

  return (
    <div className={`feedback-banner feedback-banner--${type}`}>
      <p className="feedback-banner__message">{message}</p>

      {detailsAffiches.length > 0 ? (
        <ul className="feedback-banner__details">
          {detailsAffiches.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}

      {detailsRestants > 0 ? (
        <p className="feedback-banner__more">
          {detailsRestants} erreur(s) supplementaire(s) non affichee(s).
        </p>
      ) : null}
    </div>
  );
}
