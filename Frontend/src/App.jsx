import { useState, useEffect } from "react";
import { LoginPage } from "./pages/LoginPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { CoursPage } from "./pages/CoursPage.jsx";
import { ProfesseursPage } from "./pages/ProfesseursPage.jsx";
import { SallesPage } from "./pages/SallesPage.jsx";
import {HorairePage} from "./pages/HorairePage.jsx"
import { ImportExcelPage } from "./pages/ImportExcelPage.jsx";
import "./styles/salles.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moduleActif, setModuleActif] = useState("dashboard");

  useEffect(() => {
    async function verifierSession() {
      try {
        const response = await fetch("http://localhost:3000/auth/me", {
          credentials: "include",
        });

        if (response.ok) {
          const user = await response.json();
          setUser(user);
        }
      } catch (err) {
        // Pas de session
      } finally {
        setLoading(false);
      }
    }

    verifierSession();
  }, []);

  if (loading) {
    return <div>Chargement...</div>;
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  if (moduleActif === "dashboard") {
    return (
      <DashboardPage
        moduleActif={moduleActif}
        onChangerModule={setModuleActif}
      />
    );
  }

  if (moduleActif === "cours") {
    return (
      <CoursPage
        moduleActif={moduleActif}
        onChangerModule={setModuleActif}
      />
    );
  }

  if (moduleActif === "professeurs") {
    return (
      <ProfesseursPage
        moduleActif={moduleActif}
        onChangerModule={setModuleActif}
      />
    );
  }

 if (moduleActif === "horaire") {
  return (
    <HorairePage
      moduleActif={moduleActif}
      onChangerModule={setModuleActif}
    />
  );
 }
  
 if (moduleActif === "import") {
  return (
    <ImportExcelPage
      moduleActif={moduleActif}
      onChangerModule={setModuleActif}
    />
  );
 }



  return (
    <SallesPage
      moduleActif={moduleActif}
      onChangerModule={setModuleActif}
    />
  );
}