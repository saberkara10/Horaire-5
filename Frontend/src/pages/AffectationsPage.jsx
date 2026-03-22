import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { recupererCours } from "../services/cours.api.js";
import { recupererProfesseurs } from "../services/professeurs.api.js";
import { recupererSalles } from "../services/salles.api.js";
import { apiRequest } from "../services/api.js";

export function AffectationsPage({ utilisateur, onLogout }) {
  const [cours, setCours] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [salles, setSalles] = useState([]);
  const [groupes, setGroupes] = useState([]);

  const [form, setForm] = useState({
    id_cours: "",
    id_professeur: "",
    id_salle: "",
    id_groupes: [],
    date: "",
    heure_debut: "",
    heure_fin: "",
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    async function chargerDonnees() {
      setLoading(true);
      setErreur("");
      try {
        const [coursData, profsData, sallesData, groupesData] = await Promise.all([
          recupererCours(),
          recupererProfesseurs(),
          recupererSalles(),
          apiRequest("/api/groupes"),
        ]);
        setCours(Array.isArray(coursData) ? coursData : []);
        setProfesseurs(Array.isArray(profsData) ? profsData : []);
        setSalles(Array.isArray(sallesData) ? sallesData : []);
        setGroupes(Array.isArray(groupesData) ? groupesData : []);
      } catch (error) {
        setErreur(error.message || "Impossible de charger les donnees.");
      } finally {
        setLoading(false);
      }
    }
    chargerDonnees();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleGroupeChange(event) {
    const options = Array.from(event.target.selectedOptions);
    const valeurs = options.map((o) => Number(o.value));
    setForm((prev) => ({ ...prev, id_groupes: valeurs }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setErreur("");

    try {
      await apiRequest("/api/affectations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_cours: Number(form.id_cours),
          id_professeur: Number(form.id_professeur),
          id_salle: Number(form.id_salle),
          id_groupes: form.id_groupes,
          date: form.date,
          heure_debut: form.heure_debut,
          heure_fin: form.heure_fin,
        }),
      });

      setMessage("Affectation creee avec succes !");
      setForm({
        id_cours: "",
        id_professeur: "",
        id_salle: "",
        id_groupes: [],
        date: "",
        heure_debut: "",
        heure_fin: "",
      });
    } catch (error) {
      setErreur(error.message || "Erreur lors de l'affectation.");
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Affectation des cours"
      subtitle="Associer un cours, un professeur, une salle et une plage horaire"
    >
      <div className="import-page">
        <section className="import-page__card import-page__card--upload">
          <h2>Creer une affectation</h2>

          {loading ? (
            <p className="import-page__text">Chargement des donnees...</p>
          ) : (
            <form className="import-page__form" onSubmit={handleSubmit}>

              <select name="id_cours" value={form.id_cours} onChange={handleChange}>
                <option value="">Choisir un cours</option>
                {cours.map((item) => (
                  <option key={item.id_cours} value={item.id_cours}>
                    {item.code} - {item.nom}
                  </option>
                ))}
              </select>

              <select name="id_professeur" value={form.id_professeur} onChange={handleChange}>
                <option value="">Choisir un professeur</option>
                {professeurs.map((item) => (
                  <option key={item.id_professeur} value={item.id_professeur}>
                    {item.matricule} - {item.prenom} {item.nom}
                  </option>
                ))}
              </select>

              <select name="id_salle" value={form.id_salle} onChange={handleChange}>
                <option value="">Choisir une salle</option>
                {salles.map((item) => (
                  <option key={item.id_salle} value={item.id_salle}>
                    {item.code} - {item.type}
                  </option>
                ))}
              </select>

              <select multiple onChange={handleGroupeChange} value={form.id_groupes.map(String)}>
                {groupes.map((item) => (
                  <option key={item.id_groupes_etudiants} value={item.id_groupes_etudiants}>
                    {item.nom_groupe}
                  </option>
                ))}
              </select>
              <small style={{ color: "#94a3b8" }}>Maintenez Ctrl pour selectionner plusieurs groupes</small>

              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
              />

              <input
                type="time"
                name="heure_debut"
                value={form.heure_debut}
                onChange={handleChange}
              />

              <input
                type="time"
                name="heure_fin"
                value={form.heure_fin}
                onChange={handleChange}
              />

              <button className="import-page__primary-button" type="submit">
                Affecter
              </button>
            </form>
          )}

          {message && (
            <div className="import-page__alert import-page__alert--success">
              <p>{message}</p>
            </div>
          )}

          {erreur && (
            <div className="import-page__alert import-page__alert--error">
              <p>{erreur}</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}