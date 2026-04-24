import pool from "../db.js";
import { up } from "./migration_v17.js";

try {
  await up(pool);
  console.log("Migration v17 appliquee.");
} finally {
  await pool.end();
}
