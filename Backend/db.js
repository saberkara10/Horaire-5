//Documenter la configuration MySQL : La base de données MySQL est installée localement sur la machine.
//Une base nommée gestion_horaires a été créée pour stocker les données du projet.
//La connexion est configurée via un fichier .env contenant l’hôte, l’utilisateur, mot de passe, le port et le nom de la base.
//Ces paramètres sont utilisés par le serveur Node.js pour accéder à la base.

//Le projet utilise une base de données relationnelle MySQL.
//La communication avec la base se fait via un serveur Node.js
//en utilisant le module mysql2 et un pool de connexions.
//Cette méthode permet une connexion sécurisée et réutilisable.




require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;



//Base de données – Gestion des horaires

//La base de données permet de gérer les horaires de cours.

//Chaque table possède une clé primaire (id) et des champs principaux :
//- utilisateurs (nom, prenom, email, role)
//- professeurs (matricule, nom, prenom, specialite)
//- salles (code, type, capacite)
//- cours (code, nom, duree, programme, etape_etude, type_salle, archive)
//- groupes_etudiants (nom_groupe)
//- plages_horaires (date, heure_debut, heure_fin)

//Les relations sont gérées par :
//- affectation_cours : relie un cours à une salle, un professeur et une plage horaire
//- affectation_groupes : relie les groupes d’étudiants aux cours
