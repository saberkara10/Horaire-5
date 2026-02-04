const db = require("./db");

(async () => {
  try {
    const [rows] = await db.query("SELECT 1 AS test");
    console.log("✅ Connexion MySQL OK :", rows);
    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur MySQL :", err.message);
    process.exit(1);
  }
})();
