import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../src/infrastructure/migrations.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("migration runner", () => {
  it("applies migrations once and records their version", () => {
    const directory = mkdtempSync(join(tmpdir(), "cybersarah-migrations-"));
    temporaryDirectories.push(directory);
    writeFileSync(join(directory, "001_initial.sql"), "CREATE TABLE sample (id TEXT PRIMARY KEY);");
    const db = new DatabaseSync(":memory:");

    expect(migrate(db, directory)).toHaveLength(1);
    expect(migrate(db, directory)).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toEqual({ count: 1 });
    db.close();
  });

  it("rejects a changed migration after it was applied", () => {
    const directory = mkdtempSync(join(tmpdir(), "cybersarah-migrations-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "001_initial.sql");
    writeFileSync(file, "CREATE TABLE sample (id TEXT PRIMARY KEY);");
    const db = new DatabaseSync(":memory:");
    migrate(db, directory);
    writeFileSync(file, "CREATE TABLE sample (id TEXT PRIMARY KEY, value TEXT);");

    expect(() => migrate(db, directory)).toThrow(/does not match/);
    db.close();
  });
});
