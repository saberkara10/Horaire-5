/**
 * Script d'initialisation de l'utilisateur ADMIN.
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import pool from "../db.js";

(async () => {
  try {
    const email = (process.env.INITIAL_ADMIN_EMAIL || "admin@ecole.ca")
      .toLowerCase()
      .trim();
    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (!password || password.length < 8) {
      throw new Error(
        "INITIAL_ADMIN_PASSWORD doit etre defini dans .env avec au moins 8 caracteres."
      );
    }

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
