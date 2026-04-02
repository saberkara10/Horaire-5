/**
 * PAGE - Admins
 *
 * Cette page affiche la gestion
 * des sous-admins pour le responsable.
 */
import { Navigate } from "react-router-dom";
import { AdminManagementPanel } from "../components/admins/AdminManagementPanel.jsx";
import { AppShell } from "../components/layout/AppShell.jsx";
import { utilisateurEstResponsable } from "../utils/roles.js";
import "../styles/DashboardPage.css";

export function AdminsPage({ utilisateur, onLogout }) {
  if (!utilisateurEstResponsable(utilisateur)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Sous-admins"
      subtitle="Creation, modification et suivi des comptes admin."
    >
      <div className="dashboard-page">
        <AdminManagementPanel />
      </div>
    </AppShell>
  );
}
/**
 * PAGE - Admins
 *
 * Cette page affiche la gestion
 * des sous-admins pour le responsable.
 */
