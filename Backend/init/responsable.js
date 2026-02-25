/**
 *Script d'initialisation de l'utilisateur RESPONSABLE.
 *
 * 
 * 
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import pool from "../db.js";

(async () => {

  const email = "responsable@ecole.ca".toLowerCase().trim();
  const password = "Resp123!";
  try {
    
    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO utilisateurs (email, mot_de_passe_hash, nom, prenom, actif)
       VALUES (?, ?, ?, ?, 1)`,
      [email, hash, "Responsable", "Admin"]
    );

    // Assigner le rôle RESPONSABLE
    await pool.query(
      `INSERT IGNORE INTO utilisateur_roles (utilisateur_id, role_id)
       SELECT ?, r.id FROM roles r WHERE r.code = 'RESPONSABLE'`,
      [result.insertId]
    );

    console.log("Responsable créé :", email);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      console.log("Responsable existe déjà. Assignation du rôle...");

      const [rows] = await pool.query(
        "SELECT id FROM utilisateurs WHERE email = ?",
        [email]
      );

      if (rows.length) {
        await pool.query(
          `INSERT IGNORE INTO utilisateur_roles (utilisateur_id, role_id)
           SELECT ?, r.id FROM roles r WHERE r.code = 'RESPONSABLE'`,
          [rows[0].id]
        );
      }
    } else {
      console.error("Erreur  :", err.message);
    }
  } finally {
    await pool.end();
  }
})();
