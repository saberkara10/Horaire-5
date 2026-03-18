const MODULES = [
  { id: "dashboard", label: "Tableau de bord", disabled: false },
  { id: "professeurs", label: "Professeurs", disabled: false },
  { id: "cours", label: "Cours", disabled: false },
  { id: "salles", label: "Salles", disabled: false },
  { id: "horaire", label: "Générer Horaire", disabled: false },
  { id: "import", label: "Import Excel", disabled: false },
];

export function AppShell({ children, moduleActif, onChangerModule }) {

  async function handleLogout() {
    try {
      await fetch("http://localhost:3000/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.reload();
    } catch (err) {
      console.error("Erreur déconnexion:", err);
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-shell__rail" aria-label="Navigation principale">
        <div className="brand-mark">
          <span className="brand-mark__title">Gestion Horaires</span>
          <span className="brand-mark__subtitle">Admin</span>
        </div>

        <nav className="app-shell__nav">
          {MODULES.map((module) => (
            <button
              key={module.id}
              className={`app-shell__nav-item ${
                moduleActif === module.id ? "app-shell__nav-item--active" : ""
              }`}
              type="button"
              disabled={module.disabled}
              onClick={() => onChangerModule?.(module.id)}
            >
              {module.label}
            </button>
          ))}
        </nav>

        <button className="app-shell__logout" onClick={handleLogout}>
          Déconnexion
        </button>
      </aside>

      <main className="app-shell__content">{children}</main>
    </div>
  );
}