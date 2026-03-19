const MODULES = [
  { id: "professeurs", label: "Professeurs", disabled: false },
  { id: "cours", label: "Cours", disabled: false },
  { id: "salles", label: "Salles", disabled: false },
  { id: "etudiants", label: "Etudiants", disabled: false },
  { id: "horaire", label: "Horaire", disabled: true },
];

export function AppShell({ children, moduleActif, onChangerModule }) {
  return (
    <div className="app-shell">
      <aside className="app-shell__rail" aria-label="Navigation principale">
        <div className="brand-mark">
          <span className="brand-mark__title">Responsable</span>
          <span className="brand-mark__subtitle">administrative</span>
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
      </aside>

      <main className="app-shell__content">{children}</main>
    </div>
  );
}
