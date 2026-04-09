-- ============================================================
-- GDH5 - Migration v3 : Optimisations scheduler
-- A executer apres migration_v2.sql
-- COMPATIBLE MySQL 5.7+ et MariaDB 10.3+
-- ============================================================

-- 1. Index simple sur plages_horaires
-- Le modele courant cree une plage distincte par affectation.
-- On accelere donc la recherche par date/heure sans bloquer
-- plusieurs cours au meme creneau dans des salles differentes.
ALTER TABLE plages_horaires
  ADD INDEX idx_plages_horaires_date_heure (date, heure_debut, heure_fin);

-- ============================================================
-- Fin migration v3
-- ============================================================
