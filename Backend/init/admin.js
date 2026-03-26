/**
 * Script d'initialisation de l'utilisateur ADMIN.
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import pool from "../db.js";

(async () => {
  const email = "admin@ecole.ca".toLowerCase().trim();
  const password = "Admin123!";

  try {
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO utilisateurs (email, motdepasse, nom, prenom, role)
       VALUES (?, ?, ?, ?, ?)`,
      [email, hash, "Admin", "Systeme", "ADMIN"]
    );

    console.log("Admin cree :", email);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      console.log("Admin existe deja.");
    } else {
      console.error("Erreur :", error.message);
    }
  } finally {
    await pool.end();
  }
})();
