import { createConnection } from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const c = await createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "gdh5",
  port: Number(process.env.DB_PORT) || 3306,
});

// Nettoyer les sessions de test
await c.query("DELETE FROM sessions WHERE nom = 'Test Session' OR nom = 'Test'");
console.log("Sessions de test supprimées");

// Vérifier les utilisateurs
const [users] = await c.query("SELECT id_utilisateur, email, role, actif FROM utilisateurs");
console.log("Utilisateurs:", JSON.stringify(users));

// Vérifier les sessions
const [sessions] = await c.query("SELECT * FROM sessions");
console.log("Sessions:", JSON.stringify(sessions));

// Vérifier rapports
const [rapports] = await c.query("SELECT COUNT(*) as n FROM rapports_generation");
console.log("Rapports:", JSON.stringify(rapports));

await c.end();
console.log("\nBase de données OK !");
