import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Clock3, FileText, X } from "lucide-react";

export function HelpDocumentModal({
  documentDetail,
  isLoading,
  error,
  onClose,
  onOpenContent,
}) {
  useEffect(() => {
    if (!documentDetail && !isLoading && !error) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [documentDetail, error, isLoading, onClose]);

  if (!documentDetail && !isLoading && !error) {
    return null;
  }

  return (
    <div
      className="help-doc-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-doc-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="help-doc-modal__panel">
        <div className="help-doc-modal__header">
          <div className="help-doc-modal__header-copy">
            <div className="help-doc-modal__eyebrow">
              <FileText size={16} />
              <span>Documentation markdown</span>
            </div>

            {documentDetail ? (
              <>
                <h2 id="help-doc-modal-title">{documentDetail.title}</h2>
                <p>{documentDetail.summary}</p>

                <div className="help-doc-modal__meta">
                  {documentDetail.categoryName ? (
                    <span className="help-doc-modal__badge">{documentDetail.categoryName}</span>
                  ) : null}
                  {documentDetail.kindLabel ? (
                    <span className="help-doc-modal__badge">{documentDetail.kindLabel}</span>
                  ) : null}
                  {documentDetail.estimatedLabel ? (
                    <span className="help-doc-modal__badge">
                      <Clock3 size={14} />
                      {documentDetail.estimatedLabel}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <h2 id="help-doc-modal-title">Documentation</h2>
                <p>Chargement de la documentation...</p>
              </>
            )}
          </div>

          <button
            type="button"
            className="help-doc-modal__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="help-doc-modal__status">Chargement du markdown...</div>
        ) : null}

        {error ? <div className="help-doc-modal__error">{error}</div> : null}

        {documentDetail ? (
          <div className="help-doc-modal__layout">
            <article className="help-doc-modal__content markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {documentDetail.content || ""}
              </ReactMarkdown>
            </article>

            <aside className="help-doc-modal__aside">
              {Array.isArray(documentDetail.tags) && documentDetail.tags.length > 0 ? (
                <section className="help-doc-modal__aside-card">
                  <h3>Tags</h3>
                  <div className="help-doc-modal__chips">
                    {documentDetail.tags.map((tag) => (
                      <span key={tag} className="help-doc-modal__chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {documentDetail.lastModifiedAt || documentDetail.path ? (
                <section className="help-doc-modal__aside-card">
                  <h3>Informations</h3>
                  <div className="help-doc-modal__linked-guides">
                    {documentDetail.lastModifiedAt ? (
                      <div className="help-doc-modal__linked-guide">
                        <strong>Derniere mise a jour</strong>
                        <span>{new Date(documentDetail.lastModifiedAt).toLocaleString("fr-CA")}</span>
                      </div>
                    ) : null}

                    {documentDetail.path ? (
                      <div className="help-doc-modal__linked-guide">
                        <strong>Source</strong>
                        <span>{documentDetail.path}</span>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {Array.isArray(documentDetail.relatedGuides) &&
              documentDetail.relatedGuides.length > 0 ? (
                <section className="help-doc-modal__aside-card">
                  <h3>Guides relies</h3>
                  <div className="help-doc-modal__linked-guides">
                    {documentDetail.relatedGuides.map((guide) => (
                      <button
                        key={guide.id}
                        type="button"
                        className="help-doc-modal__linked-guide"
                        onClick={() => onOpenContent(guide.id)}
                      >
                        <strong>{guide.title}</strong>
                        <span>{guide.levelLabel || guide.categoryName}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
