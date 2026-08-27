import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/http-server.js";

const directory = mkdtempSync(join(tmpdir(), "cybersarah-api-"));
const previousDatabasePath = process.env.DATABASE_PATH;
const previousJwtSecret = process.env.JWT_SECRET;
const previousClientId = process.env.JWT_CLIENT_ID;
const previousClientSecret = process.env.JWT_CLIENT_SECRET;
process.env.DATABASE_PATH = join(directory, "api.sqlite");
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";
process.env.JWT_CLIENT_ID = "client-a";
process.env.JWT_CLIENT_SECRET = "client-secret";
const server = createApiServer();

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  rmSync(directory, { recursive: true, force: true });
  if (previousDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = previousDatabasePath;
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
  if (previousClientId === undefined) delete process.env.JWT_CLIENT_ID;
  else process.env.JWT_CLIENT_ID = previousClientId;
  if (previousClientSecret === undefined) delete process.env.JWT_CLIENT_SECRET;
  else process.env.JWT_CLIENT_SECRET = previousClientSecret;
});

function url(path: string): string {
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Server address unavailable");
  return `http://127.0.0.1:${address.port}${path}`;
}

async function getToken(): Promise<string> {
  const response = await fetch(url("/api/v1/auth/token"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: "client-a",
      client_secret: "client-secret",
    }),
  });
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

describe("HTTP API", () => {
  it("exposes a public health endpoint", async () => {
    const response = await fetch(url("/api/v1/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });

  it("issues a JWT and rejects protected requests without it", async () => {
    const unauthorized = await fetch(url("/api/v1/conversations"));
    expect(unauthorized.status).toBe(401);

    const token = await getToken();
    expect(token.split(".")).toHaveLength(3);
  });

  it("creates and lists conversations for the JWT subject", async () => {
    const accessToken = await getToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    const createResponse = await fetch(url("/api/v1/conversations"), {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "API-Test" }),
    });
    expect(createResponse.status).toBe(201);

    const listResponse = await fetch(url("/api/v1/conversations"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(listResponse.status).toBe(200);
    expect((await listResponse.json()).data).toHaveLength(1);
  });
});
