import { useState } from "react";
import { CoursPage } from "./pages/CoursPage.jsx";
import { ProfesseursPage } from "./pages/ProfesseursPage.jsx";
import { SallesPage } from "./pages/SallesPage.jsx";

export default function App() {
  const [moduleActif, setModuleActif] = useState("professeurs");

  if (moduleActif === "salles") {
    return (
      <SallesPage
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

  return (
    <ProfesseursPage
      moduleActif={moduleActif}
      onChangerModule={setModuleActif}
    />
  );
}
