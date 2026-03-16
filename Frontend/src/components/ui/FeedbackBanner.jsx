export function FeedbackBanner({ type = "info", message }) {
  if (!message) {
    return null;
  }

  return <p className={`feedback-banner feedback-banner--${type}`}>{message}</p>;
}
