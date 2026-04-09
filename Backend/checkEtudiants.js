import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

async function run() {
  const c = await createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "gdh5",
    port: 3306,
  });

  const [res] = await c.query("SELECT id_etudiant, nom, id_groupes_etudiants FROM etudiants LIMIT 10");
  console.log("Students:", res);

  const [groups] = await c.query("SELECT * FROM groupes_etudiants LIMIT 5");
  console.log("Groups:", groups);
  
  await c.end();
}
run();
