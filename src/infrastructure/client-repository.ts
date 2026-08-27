import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { defaultMigrationsDirectory, migrate } from "./migrations.js";
import { newId } from "../modules/conversations/conversations.js";

export type ClientStatus = "active" | "revoked";
export interface ApiClient {
  readonly clientId: string;
  readonly name: string;
  readonly status: ClientStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastUsedAt?: Date;
  readonly expiresAt?: Date;
}
export interface IssuedClientSecret {
  readonly client: ApiClient;
  readonly clientSecret: string;
}

type ClientRow = {
  client_id: string;
  name: string;
  secret_hash: string;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string | null;
};

export function openSqliteClientStore(
  databasePath = process.env.DATABASE_PATH ?? "data/cybersarah.sqlite",
): { clients: SqliteClientRepository; close: () => void } {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db, defaultMigrationsDirectory());
  const clients = new SqliteClientRepository(db);
  const bootstrapId = process.env.JWT_CLIENT_ID;
  const bootstrapSecret = process.env.JWT_CLIENT_SECRET;
  if (bootstrapId && bootstrapSecret && !clients.find(bootstrapId)) {
    clients.create(
      "Bootstrapped environment client",
      bootstrapId,
      undefined,
      bootstrapSecret,
    );
  }
  return { clients, close: () => db.close() };
}

export class SqliteClientRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(
    name: string,
    clientId = `client_${newId()}`,
    expiresAt?: Date,
    suppliedSecret?: string,
  ): IssuedClientSecret {
    const now = new Date();
    const clientSecret =
      suppliedSecret ?? `csec_${randomBytes(32).toString("base64url")}`;
    this.db
      .prepare(
        "INSERT INTO api_clients (client_id, name, secret_hash, status, created_at, updated_at, expires_at) VALUES (?, ?, ?, 'active', ?, ?, ?)",
      )
      .run(
        clientId,
        name.trim(),
        hashSecret(clientSecret),
        now.toISOString(),
        now.toISOString(),
        expiresAt?.toISOString() ?? null,
      );
    return { client: this.toClient(this.getRequired(clientId)), clientSecret };
  }

  authenticate(clientId: string, clientSecret: string): ApiClient | undefined {
    const row = this.get(clientId);
    if (
      !row ||
      row.status !== "active" ||
      (row.expires_at && new Date(row.expires_at) <= new Date())
    )
      return undefined;
    if (!verifySecret(clientSecret, row.secret_hash)) return undefined;
    const now = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE api_clients SET last_used_at = ?, updated_at = ? WHERE client_id = ?",
      )
      .run(now, now, clientId);
    return this.toClient({ ...row, last_used_at: now, updated_at: now });
  }

  find(clientId: string): ApiClient | undefined {
    const row = this.get(clientId);
    return row ? this.toClient(row) : undefined;
  }

  findActive(clientId: string): ApiClient | undefined {
    const row = this.get(clientId);
    if (
      !row ||
      row.status !== "active" ||
      (row.expires_at && new Date(row.expires_at) <= new Date())
    )
      return undefined;
    return this.toClient(row);
  }

  rotate(
    clientId: string,
    currentSecret: string,
    expiresAt?: Date,
  ): IssuedClientSecret | undefined {
    const existing = this.get(clientId);
    if (!existing || !this.authenticate(clientId, currentSecret))
      return undefined;
    const clientSecret = `csec_${randomBytes(32).toString("base64url")}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE api_clients SET secret_hash = ?, updated_at = ?, expires_at = ? WHERE client_id = ? AND status = 'active'",
      )
      .run(
        hashSecret(clientSecret),
        now,
        expiresAt?.toISOString() ?? existing.expires_at,
        clientId,
      );
    return { client: this.toClient(this.getRequired(clientId)), clientSecret };
  }

  revoke(clientId: string): boolean {
    const result = this.db
      .prepare(
        "UPDATE api_clients SET status = 'revoked', updated_at = ? WHERE client_id = ? AND status = 'active'",
      )
      .run(new Date().toISOString(), clientId);
    return Number(result.changes) === 1;
  }

  list(): ApiClient[] {
    return (
      this.db
        .prepare("SELECT * FROM api_clients ORDER BY created_at DESC")
        .all() as unknown as ClientRow[]
    ).map((row) => this.toClient(row));
  }

  private get(clientId: string): ClientRow | undefined {
    return this.db
      .prepare("SELECT * FROM api_clients WHERE client_id = ?")
      .get(clientId) as ClientRow | undefined;
  }

  private getRequired(clientId: string): ClientRow {
    const row = this.get(clientId);
    if (!row) throw new Error(`Client ${clientId} was not created.`);
    return row;
  }

  private toClient(row: ClientRow): ApiClient {
    return {
      clientId: row.client_id,
      name: row.name,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      ...(row.last_used_at ? { lastUsedAt: new Date(row.last_used_at) } : {}),
      ...(row.expires_at ? { expiresAt: new Date(row.expires_at) } : {}),
    };
  }
}

export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifySecret(secret: string, encoded: string): boolean {
  const [, saltEncoded, hashEncoded] = encoded.split("$");
  if (!saltEncoded || !hashEncoded) return false;
  const expected = Buffer.from(hashEncoded, "base64url");
  const actual = scryptSync(
    secret,
    Buffer.from(saltEncoded, "base64url"),
    expected.length,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
