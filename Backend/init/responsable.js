/**
 * Script d'initialisation de l'utilisateur RESPONSABLE.
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import pool from "../db.js";

(async () => {
  const email = "responsable@ecole.ca".toLowerCase().trim();
  const password = "Resp123!";

  try {
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO utilisateurs (email, motdepasse, nom, prenom, role)
       VALUES (?, ?, ?, ?, ?)`,
      [email, hash, "Responsable", "Admin", "RESPONSABLE"]
    );

    console.log("Responsable cree :", email);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      console.log("Responsable existe deja.");
    } else {
      console.error("Erreur :", error.message);
    }
  } finally {
    await pool.end();
  }
})();
