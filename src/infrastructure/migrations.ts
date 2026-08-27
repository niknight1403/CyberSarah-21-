import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export interface AppliedMigration {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

export function loadMigrations(
  directory = join(process.cwd(), "migrations"),
): Migration[] {
  return readdirSync(directory)
    .filter((file) => extname(file) === ".sql")
    .map((file) => {
      const match = /^(\d+)_([a-z0-9_-]+)\.sql$/i.exec(file);
      if (!match) throw new Error(`Invalid migration filename: ${file}`);
      return {
        version: Number(match[1]),
        name: match[2]!,
        sql: readFileSync(join(directory, file), "utf8"),
      };
    })
    .sort((a, b) => a.version - b.version);
}

export function migrate(
  db: DatabaseSync,
  directory = join(process.cwd(), "migrations"),
): AppliedMigration[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const migrations = loadMigrations(directory);
  assertUniqueVersions(migrations);
  const applied = db
    .prepare(
      "SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC",
    )
    .all() as unknown as AppliedMigration[];
  const appliedByVersion = new Map(
    applied.map((migration) => [migration.version, migration]),
  );

  for (const migration of migrations) {
    const existing = appliedByVersion.get(migration.version);
    const checksum = checksumOf(migration.sql);
    if (existing) {
      if (existing.name !== migration.name || existing.checksum !== checksum) {
        throw new Error(
          `Applied migration ${migration.version} does not match its local file.`,
        );
      }
      continue;
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
      ).run(
        migration.version,
        migration.name,
        checksum,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return db
    .prepare(
      "SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC",
    )
    .all() as unknown as AppliedMigration[];
}

function assertUniqueVersions(migrations: Migration[]): void {
  const seen = new Set<number>();
  for (const migration of migrations) {
    if (seen.has(migration.version))
      throw new Error(`Duplicate migration version: ${migration.version}`);
    seen.add(migration.version);
  }
}

function checksumOf(sql: string): string {
  // Stable, dependency-free checksum for tamper/change detection in the MVP.
  let hash = 2166136261;
  for (const byte of Buffer.from(sql)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function defaultMigrationsDirectory(): string {
  return join(dirname(new URL(import.meta.url).pathname), "../../migrations");
}
