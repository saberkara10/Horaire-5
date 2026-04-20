/**
 * PAGE - Admins
 *
 * Cette page affiche la gestion
 * des sous-admins pour le responsable.
 */
import { Navigate } from "react-router-dom";
import { AdminManagementPanel } from "../components/admins/AdminManagementPanel.jsx";
import { utilisateurEstResponsable } from "../utils/roles.js";
import "../styles/DashboardPage.css";

export function AdminsPage({ utilisateur, onLogout }) {
  if (!utilisateurEstResponsable(utilisateur)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="dashboard-page">
      <AdminManagementPanel />
    </div>
  );
}
/**
 * PAGE - Admins
 *
 * Cette page affiche la gestion
 * des sous-admins pour le responsable.
 */
