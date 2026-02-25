/**
 * Script d'initialisation de l'utilisateur ADMIN.
 *
 * Ce script est exécuté manuellement (node admin.js) afin de :
 * - créer un utilisateur administrateur par défaut
 * - hacher le mot de passe avec bcrypt
 * - insérer l'utilisateur dans la table utilisateurs
 * - associer le rôle ADMIN via la table utilisateur_roles
 *
 * 
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import pool from "../db.js";

(async () => {
  const email = "admin@ecole.ca".toLowerCase().trim();
  const password = "Admin123!";

  try {
    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO utilisateurs (email, mot_de_passe_hash, nom, prenom, actif)
       VALUES (?, ?, ?, ?, 1)`,
      [email, hash, "Admin", "Systeme"]
    );

    // Assigner le rôle ADMIN
    await pool.query(
      `INSERT IGNORE INTO utilisateur_roles (utilisateur_id, role_id)
       SELECT ?, r.id FROM roles r WHERE r.code = 'ADMIN'`,
      [result.insertId]
    );

    console.log(" Admin créé :", email);

  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      console.log(" Admin existe déjà.");

      const [rows] = await pool.query(
        "SELECT id FROM utilisateurs WHERE email = ?",
        [email]
      );

      if (!rows.length) {
        console.log(" Admin non trouvé  :", email);
      } else {
        await pool.query(
          `INSERT IGNORE INTO utilisateur_roles (utilisateur_id, role_id)
           SELECT ?, r.id FROM roles r WHERE r.code = 'ADMIN'`,
          [rows[0].id]
        );
        console.log(" Rôle ADMIN assuré pour :", email);
      }

    } else {
      console.error(" Erreur:", err.message);
    }
  } finally {
    await pool.end();
  }
})();
