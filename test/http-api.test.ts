import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/http-server.js";

const directory = mkdtempSync(join(tmpdir(), "cybersarah-api-"));
const previousDatabasePath = process.env.DATABASE_PATH;
const previousToken = process.env.CYBERSARAH_API_TOKEN;
process.env.DATABASE_PATH = join(directory, "api.sqlite");
process.env.CYBERSARAH_API_TOKEN = "test-api-token";
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
  if (previousToken === undefined) delete process.env.CYBERSARAH_API_TOKEN;
  else process.env.CYBERSARAH_API_TOKEN = previousToken;
});

function url(path: string): string {
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Server address unavailable");
  return `http://127.0.0.1:${address.port}${path}`;
}

describe("HTTP API", () => {
  it("exposes a public health endpoint", async () => {
    const response = await fetch(url("/api/v1/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });

  it("rejects protected requests without a valid token", async () => {
    const response = await fetch(url("/api/v1/conversations"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("creates and lists conversations for the authenticated client", async () => {
    const headers = {
      Authorization: "Bearer test-api-token",
      "Content-Type": "application/json",
      "X-Client-User-Id": "client-a",
    };
    const createResponse = await fetch(url("/api/v1/conversations"), {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "API-Test" }),
    });
    expect(createResponse.status).toBe(201);

    const listResponse = await fetch(url("/api/v1/conversations"), {
      headers: {
        Authorization: "Bearer test-api-token",
        "X-Client-User-Id": "client-a",
      },
    });
    expect(listResponse.status).toBe(200);
    expect((await listResponse.json()).data).toHaveLength(1);
  });
});
