/**
 * APP - Frontend Root
 *
 * Ce composant configure le routage
 * principal du frontend.
 */
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.jsx";
import { LoginHelpPage } from "./pages/LoginHelpPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { CoursPage } from "./pages/CoursPage.jsx";
import { ProfesseursPage } from "./pages/ProfesseursPage.jsx";
import { DisponibilitesProfesseursPage } from "./pages/DisponibilitesProfesseursPage.jsx";
import { SallesPage } from "./pages/SallesPage.jsx";
import { EtudiantsImportPage } from "./pages/EtudiantsImportPage.jsx";
import { SchedulerPage } from "./pages/SchedulerPage.jsx";
import {
  logoutUtilisateur,
  recupererUtilisateurConnecte,
} from "./services/auth.api.js";
import { SESSION_EXPIREE_EVENT } from "./services/api.js";
import { envoyerHeartbeatPresence } from "./services/concurrency.api.js";
import { AffectationsPage } from "./pages/AffectationsPage.jsx";
import { HorairesProfesseursPage } from "./pages/HorairesProfesseursPage.jsx";
import { HorairesGroupesPage } from "./pages/HorairesGroupesPage.jsx";
import { HorairesSallesPage } from "./pages/HorairesSallesPage.jsx";
import { EtudiantsPage } from "./pages/EtudiantsPage.jsx";
import { GestionGroupesPage } from "./pages/GestionGroupesPage.jsx";
import { AdminsPage } from "./pages/AdminsPage.jsx";
import { ActivityLogsPage } from "./pages/ActivityLogsPage.jsx";
import { AdminConcurrencePage } from "./pages/AdminConcurrencePage.jsx";
import { CentreAidePage } from "./pages/CentreAidePage.jsx";
import {
  utilisateurEstAdminResponsable,
  utilisateurEstResponsable,
} from "./utils/roles.js";
import { PopupProvider } from "./components/feedback/PopupProvider.jsx";
import { MainLayout } from "./components/layout/MainLayout.jsx";

export default function App() {
  const [utilisateur, setUtilisateur] = useState(null);
  const [verificationSession, setVerificationSession] = useState(true);

  useEffect(() => {
    async function verifierSession() {
      try {
        const user = await recupererUtilisateurConnecte();
        setUtilisateur(user);
      } catch {
        setUtilisateur(null);
      } finally {
        setVerificationSession(false);
      }
    }

    verifierSession();
  }, []);

  useEffect(() => {
    function handleSessionExpiree() {
      setUtilisateur(null);
      setVerificationSession(false);
    }

    window.addEventListener(SESSION_EXPIREE_EVENT, handleSessionExpiree);

    return () => {
      window.removeEventListener(SESSION_EXPIREE_EVENT, handleSessionExpiree);
    };
  }, []);

  async function handleLogout() {
    try {
      await logoutUtilisateur();
    } catch {
      // ignore
    } finally {
      setUtilisateur(null);
    }
  }

  function handleLogin(user) {
    setUtilisateur(user);
  }

  if (verificationSession) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-screen__card">
          <div className="app-loading-screen__spinner" />
          <p>Verification de la session...</p>
        </div>
      </div>
    );
  }

  const roles = Array.isArray(utilisateur?.roles) ? utilisateur.roles : [];
  const isAdminResponsable = roles.includes("ADMIN_RESPONSABLE");
  const estAdminGeneral = utilisateurEstAdminResponsable(utilisateur);
  const peutUtiliserScheduler =
    roles.includes("ADMIN") ||
    roles.includes("RESPONSABLE") ||
    isAdminResponsable;

  return (
    <PopupProvider>
      <BrowserRouter>
        {utilisateur ? <PresenceHeartbeat /> : null}
        <Routes>
          <Route
            path="/login"
            element={
              utilisateur ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/login/aide"
            element={
              utilisateur ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginHelpPage />
              )
            }
          />

          <Route
            path="/"
            element={
              utilisateur ? (
                <MainLayout utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            {/* Centralized protected routes keep the AppShell mounted across modules. */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="cours" element={<CoursPage />} />
            <Route path="professeurs" element={<ProfesseursPage />} />
            <Route
              path="disponibilites-professeurs"
              element={<DisponibilitesProfesseursPage />}
            />
            <Route path="salles" element={<SallesPage />} />
            <Route path="import-etudiants" element={<EtudiantsImportPage />} />
            <Route path="generer" element={<AffectationsPage />} />
            <Route path="affectations" element={<Navigate to="/generer" replace />} />
            <Route
              path="horaires-professeurs"
              element={<HorairesProfesseursPage />}
            />
            <Route path="horaires-groupes" element={<HorairesGroupesPage />} />
            <Route path="horaires-salles" element={<HorairesSallesPage />} />
            <Route path="horaires-etudiants" element={<EtudiantsPage />} />
            <Route
              path="gestion-groupes"
              element={
                peutUtiliserScheduler ? (
                  <GestionGroupesPage />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route path="centre-aide" element={<CentreAidePage />} />
            <Route path="help" element={<Navigate to="/centre-aide" replace />} />
            <Route
              path="admins"
              element={
                utilisateurEstResponsable(utilisateur) ? (
                  <AdminsPage utilisateur={utilisateur} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="journal-activite"
              element={
                estAdminGeneral ? (
                  <ActivityLogsPage utilisateur={utilisateur} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="admin-concurrence"
              element={
                estAdminGeneral ? (
                  <AdminConcurrencePage />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="scheduler"
              element={
                peutUtiliserScheduler ? (
                  <SchedulerPage />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PopupProvider>
  );
}

function PresenceHeartbeat() {
  const location = useLocation();

  useEffect(() => {
    function envoyer() {
      envoyerHeartbeatPresence({
        page: location.pathname,
        module: location.pathname.replace("/", "") || "dashboard",
        status: "actif",
      }).catch(() => {
        // La presence ne doit jamais interrompre la navigation.
      });
    }

    envoyer();
    const intervalId = window.setInterval(envoyer, 60000);
    return () => window.clearInterval(intervalId);
  }, [location.pathname]);

  return null;
}
