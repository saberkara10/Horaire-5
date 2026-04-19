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
import { CentreAidePage } from "./pages/CentreAidePage.jsx";
import { utilisateurEstResponsable } from "./utils/roles.js";
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
