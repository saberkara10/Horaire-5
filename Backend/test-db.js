import db from "./db.js";

(async () => {
  try {
    const [rows] = await db.query("SELECT 1 AS test");
    console.log("Connexion MySQL OK");
    process.exit(0);
  } catch (err) {
    console.error("Erreur MySQL :", err.message);
    process.exit(1);
  }
})();
