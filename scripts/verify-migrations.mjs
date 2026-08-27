import { DatabaseSync } from "node:sqlite";

const databasePath = process.env.DATABASE_PATH;
if (!databasePath) throw new Error("DATABASE_PATH is required");

const db = new DatabaseSync(databasePath);
try {
  const migration = db
    .prepare("SELECT version, name FROM schema_migrations ORDER BY version")
    .get();
  const table = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'conversations'",
    )
    .get();
  if (!migration || migration.version !== 1 || migration.name !== "initial") {
    throw new Error("Migration journal is invalid");
  }
  if (!table) throw new Error("Conversations table is missing");
  console.log("Migration journal and schema verified.");
} finally {
  db.close();
}
