/**
 * COMPONENT - Popup Provider
 *
 * Ce composant centralise les confirmations
 * et les notifications popup du frontend.
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import "../../styles/PopupFeedback.css";

const PopupContext = createContext(null);

let prochainIdNotification = 1;

function obtenirTitreParDefaut(type) {
  if (type === "success") {
    return "Succes";
  }

  if (type === "error") {
    return "Attention";
  }

  return "Information";
}

export function PopupProvider({ children }) {
  const [dialogue, setDialogue] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const timeoutsRef = useRef(new Map());

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsRef.current.clear();
    };
  }, []);

  function fermerNotification(idNotification) {
    const timeoutId = timeoutsRef.current.get(idNotification);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(idNotification);
    }

    setNotifications((valeursActuelles) =>
      valeursActuelles.filter(
        (notification) => notification.id !== idNotification
      )
    );
  }

  function afficherNotification({
    type = "info",
    title,
    message,
    duration = 4000,
  }) {
    if (!message) {
      return;
    }

    const idNotification = prochainIdNotification;
    prochainIdNotification += 1;

    setNotifications((valeursActuelles) => [
      ...valeursActuelles,
      {
        id: idNotification,
        type,
        title: title || obtenirTitreParDefaut(type),
        message,
      },
    ]);

    const timeoutId = window.setTimeout(() => {
      fermerNotification(idNotification);
    }, duration);

    timeoutsRef.current.set(idNotification, timeoutId);
  }

  function showSuccess(message, title = "Succes") {
    afficherNotification({ type: "success", title, message });
  }

  function showError(message, title = "Attention") {
    afficherNotification({ type: "error", title, message, duration: 5200 });
  }

  function showInfo(message, title = "Information") {
    afficherNotification({ type: "info", title, message });
  }

  function confirm({
    title = "Confirmation",
    message = "",
    confirmLabel = "Confirmer",
    cancelLabel = "Annuler",
    tone = "danger",
  }) {
    return new Promise((resolve) => {
      setDialogue({
        title,
        message,
        confirmLabel,
        cancelLabel,
        tone,
        resolve,
      });
    });
  }

  function fermerDialogue(resultat) {
    setDialogue((valeurActuelle) => {
      if (valeurActuelle?.resolve) {
        valeurActuelle.resolve(resultat);
      }

      return null;
    });
  }

  return (
    <PopupContext.Provider
      value={{ confirm, showError, showInfo, showSuccess }}
    >
      {children}

      {dialogue ? (
        <div
          className="popup-feedback__overlay"
          onClick={() => fermerDialogue(false)}
        >
          <div
            className="popup-feedback__dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="popup-feedback__dialog-header">
              <div>
                <h2>{dialogue.title}</h2>
                <p>{dialogue.message}</p>
              </div>
              <button
                type="button"
                className="popup-feedback__close"
                onClick={() => fermerDialogue(false)}
              >
                ×
              </button>
            </div>

            <div className="popup-feedback__dialog-actions">
              <button
                type="button"
                className="popup-feedback__button popup-feedback__button--secondary"
                onClick={() => fermerDialogue(false)}
              >
                {dialogue.cancelLabel}
              </button>
              <button
                type="button"
                className={`popup-feedback__button popup-feedback__button--${dialogue.tone}`}
                onClick={() => fermerDialogue(true)}
              >
                {dialogue.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="popup-feedback__stack">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`popup-feedback__toast popup-feedback__toast--${notification.type}`}
          >
            <div className="popup-feedback__toast-copy">
              <strong>{notification.title}</strong>
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              className="popup-feedback__toast-close"
              onClick={() => fermerNotification(notification.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const contexte = useContext(PopupContext);

  if (!contexte) {
    throw new Error("usePopup doit etre utilise a l'interieur de PopupProvider.");
  }

  return contexte;
}
