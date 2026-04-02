/**
 * INIT - Utilisateur RESPONSABLE
 *
 * Ce script initialise un compte responsable
 * et lui associe le role RESPONSABLE.
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import pool from "../db.js";

function estErreurSchema(error) {
  return (
    error?.code === "ER_BAD_FIELD_ERROR" ||
    error?.code === "ER_NO_SUCH_TABLE" ||
    error?.code === "ER_BAD_TABLE_ERROR"
  );
}

(async () => {
  const email = "responsable@ecole.ca".toLowerCase().trim();
  const password = "Resp123!";

  try {
    const hash = await bcrypt.hash(password, 10);

    try {
      const [result] = await pool.query(
        `INSERT INTO utilisateurs (email, mot_de_passe_hash, nom, prenom, actif)
         VALUES (?, ?, ?, ?, 1)`,
        [email, hash, "Responsable", "General"]
      );

      await pool.query(
        `INSERT IGNORE INTO utilisateur_roles (utilisateur_id, role_id)
         SELECT ?, r.id FROM roles r WHERE r.code = 'RESPONSABLE'`,
        [result.insertId]
      );
    } catch (error) {
      if (!estErreurSchema(error)) {
        throw error;
      }

      await pool.query(
        `INSERT INTO utilisateurs (nom, prenom, email, motdepasse, role)
         VALUES (?, ?, ?, ?, ?)`,
        ["Responsable", "General", email, password, "RESPONSABLE"]
      );
    }

    console.log("Responsable cree :", email);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      console.log("Responsable existe deja.");
    } else {
      console.error("Erreur :", err.message);
    }
  } finally {
    await pool.end();
  }
})();
/**
 * INIT - Utilisateur RESPONSABLE
 *
 * Ce script initialise un compte responsable
 * et lui associe le role RESPONSABLE.
 */
