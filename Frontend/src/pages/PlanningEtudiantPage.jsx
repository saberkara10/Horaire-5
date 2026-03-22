import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { recupererPlanningEtudiant } from "../services/etudiantsService.js";
import "../styles/PlanningEtudiantPage.css";

export function PlanningEtudiantPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [etudiant, setEtudiant] = useState(null);
  const [horaire, setHoraire] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    async function charger() {
      try {
        const data = await recupererPlanningEtudiant(id);
        setEtudiant(data.etudiant);
        setHoraire(data.horaire);
      } catch (error) {
        setErreur("Impossible de charger le planning.");
      } finally {
        setLoading(false);
      }
    }
    charger();
  }, [id]);

  function formaterDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formaterHeure(heureStr) {
    return heureStr.slice(0, 5);
  }

  if (loading) return <p className="planning-message">Chargement...</p>;
  if (erreur) return <p className="planning-message planning-erreur">{erreur}</p>;
  if (!etudiant) return <p className="planning-message">Etudiant introuvable</p>;

  return (
    <div className="planning-container">
      <button className="planning-retour" onClick={() => navigate(-1)}>
        &larr; Retour
      </button>

      <h1 className="planning-titre">Planning etudiant</h1>

      <div className="planning-infos">
        <div className="planning-info-item">
          <span className="planning-label">Matricule</span>
          <span className="planning-valeur">{etudiant.matricule}</span>
        </div>
        <div className="planning-info-item">
          <span className="planning-label">Nom</span>
          <span className="planning-valeur">{etudiant.nom} {etudiant.prenom}</span>
        </div>
        <div className="planning-info-item">
          <span className="planning-label">Groupe</span>
          <span className="planning-valeur">{etudiant.groupe}</span>
        </div>
        <div className="planning-info-item">
          <span className="planning-label">Programme</span>
          <span className="planning-valeur">{etudiant.programme}</span>
        </div>
        <div className="planning-info-item">
          <span className="planning-label">Etape</span>
          <span className="planning-valeur">{etudiant.etape}</span>
        </div>
      </div>

      <h2 className="planning-sous-titre">Cours planifies</h2>

      {horaire.length === 0 ? (
        <p className="planning-vide">Aucun cours planifie pour ce groupe.</p>
      ) : (
        <div className="planning-table-wrapper">
          <table className="planning-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Debut</th>
                <th>Fin</th>
                <th>Cours</th>
                <th>Professeur</th>
                <th>Salle</th>
              </tr>
            </thead>
            <tbody>
              {horaire.map((seance) => (
                <tr key={seance.id_affectation_cours}>
                  <td>{formaterDate(seance.date)}</td>
                  <td>{formaterHeure(seance.heure_debut)}</td>
                  <td>{formaterHeure(seance.heure_fin)}</td>
                  <td>
                    <span className="planning-code">{seance.code_cours}</span>
                    <span className="planning-nom-cours">{seance.nom_cours}</span>
                  </td>
                  <td>{seance.nom_professeur} {seance.prenom_professeur}</td>
                  <td>
                    <span className="planning-salle">{seance.code_salle}</span>
                    <span className="planning-type-salle">{seance.type_salle}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}