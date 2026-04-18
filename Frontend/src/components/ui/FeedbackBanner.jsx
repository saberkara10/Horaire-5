export function FeedbackBanner({
  type = "info",
  message = "",
  details = [],
  maxDetails = 5,
}) {
  const detailsVisibles = Array.isArray(details) ? details.slice(0, maxDetails) : [];

  if (!message) {
    return null;
  }

  const paletteParType = {
    success: {
      border: "#14532d",
      background: "#ecfdf3",
      color: "#14532d",
      title: "Succes",
    },
    error: {
      border: "#991b1b",
      background: "#fef2f2",
      color: "#991b1b",
      title: "Erreur",
    },
    info: {
      border: "#1d4ed8",
      background: "#eff6ff",
      color: "#1d4ed8",
      title: "Information",
    },
    warning: {
      border: "#b45309",
      background: "#fffbeb",
      color: "#b45309",
      title: "Attention",
    },
  };

  const palette = paletteParType[type] || paletteParType.info;

  return (
    <section
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      style={{
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.background,
        color: palette.color,
        borderRadius: "12px",
        padding: "0.9rem 1rem",
        marginBottom: "1rem",
      }}
    >
      <strong style={{ display: "block", marginBottom: "0.35rem" }}>{palette.title}</strong>
      <p style={{ margin: 0 }}>{message}</p>
      {detailsVisibles.length > 0 ? (
        <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.15rem" }}>
          {detailsVisibles.map((detail, index) => (
            <li key={`${detail}-${index}`}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
