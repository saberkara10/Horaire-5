/**
 * APP - Frontend Root
 *
 * Ce composant configure le routage
 * principal du frontend.
 */
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { CoursPage } from "./pages/CoursPage.jsx";
import { ProfesseursPage } from "./pages/ProfesseursPage.jsx";
import { DisponibilitesProfesseursPage } from "./pages/DisponibilitesProfesseursPage.jsx";
import { SallesPage } from "./pages/SallesPage.jsx";
import { EtudiantsImportPage } from "./pages/EtudiantsImportPage.jsx";
import { SchedulerPage } from "./pages/SchedulerPage.jsx";
import { AdminResponsablePage } from "./pages/AdminResponsablePage.jsx";
import {
  logoutUtilisateur,
  recupererUtilisateurConnecte,
} from "./services/auth.api.js";
import { AffectationsPage } from "./pages/AffectationsPage.jsx";
import { HorairesProfesseursPage } from "./pages/HorairesProfesseursPage.jsx";
import { HorairesGroupesPage } from "./pages/HorairesGroupesPage.jsx";
import { HorairesSallesPage } from "./pages/HorairesSallesPage.jsx";
import { EtudiantsPage } from "./pages/EtudiantsPage.jsx";
import { GestionGroupesPage } from "./pages/GestionGroupesPage.jsx";
import { AdminsPage } from "./pages/AdminsPage.jsx";
import { utilisateurEstResponsable } from "./utils/roles.js";
import { PopupProvider } from "./components/feedback/PopupProvider.jsx";

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
  const peutUtiliserScheduler =
    roles.includes("ADMIN") ||
    roles.includes("RESPONSABLE") ||
    isAdminResponsable;

  return (
    <PopupProvider>
      <BrowserRouter>
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
            path="/dashboard"
            element={
              utilisateur ? (
                <DashboardPage utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/cours"
            element={
              utilisateur ? (
                <CoursPage utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/professeurs"
            element={
              utilisateur ? (
                <ProfesseursPage utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/disponibilites-professeurs"
            element={
              utilisateur ? (
                <DisponibilitesProfesseursPage
                  utilisateur={utilisateur}
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/salles"
            element={
              utilisateur ? (
                <SallesPage utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/import-etudiants"
            element={
              utilisateur ? (
                <EtudiantsImportPage utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/generer"
            element={
              utilisateur ? (
                <AffectationsPage utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route path="/affectations" element={<Navigate to="/generer" replace />} />

          <Route
            path="/horaires-professeurs"
            element={
              utilisateur ? (
                <HorairesProfesseursPage
                  utilisateur={utilisateur}
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/horaires-groupes"
            element={
              utilisateur ? (
                <HorairesGroupesPage utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/horaires-salles"
            element={
              utilisateur ? (
                <HorairesSallesPage utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/horaires-etudiants"
            element={
              utilisateur ? (
                <EtudiantsPage utilisateur={utilisateur} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/gestion-groupes"
            element={
              utilisateur ? (
                peutUtiliserScheduler ? (
                  <GestionGroupesPage utilisateur={utilisateur} onLogout={handleLogout} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/admins"
            element={
              utilisateur ? (
                utilisateurEstResponsable(utilisateur) ? (
                  <AdminsPage utilisateur={utilisateur} onLogout={handleLogout} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/scheduler"
            element={
              utilisateur ? (
                peutUtiliserScheduler ? (
                  <SchedulerPage utilisateur={utilisateur} onLogout={handleLogout} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/admin-responsable"
            element={
              utilisateur ? (
                isAdminResponsable ? (
                  <AdminResponsablePage utilisateur={utilisateur} onLogout={handleLogout} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/"
            element={
              utilisateur ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="*"
            element={
              utilisateur ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </PopupProvider>
  );
}
