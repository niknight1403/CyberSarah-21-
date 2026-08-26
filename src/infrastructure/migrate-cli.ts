import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { defaultMigrationsDirectory, migrate } from "./migrations.js";

const databasePath = process.env.DATABASE_PATH ?? "data/cybersarah.sqlite";
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
try {
  db.exec("PRAGMA foreign_keys = ON;");
  const applied = migrate(db, defaultMigrationsDirectory());
  console.log(`Applied migrations: ${applied.map(({ version, name }) => `${version}_${name}`).join(", ") || "none"}`);
} finally {
  db.close();
}
