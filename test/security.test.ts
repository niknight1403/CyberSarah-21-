import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/http-server.js";
import { ApiSecurity, type ApiSecurityConfig } from "../src/api/security.js";

const securityConfig: ApiSecurityConfig = {
  rateLimitWindowMs: 60_000,
  rateLimitMax: 4,
  authRateLimitMax: 2,
  corsOrigins: new Set(["https://client.example"]),
  trustProxy: false,
  forceHttps: false,
};
const server = createApiServer(undefined, securityConfig);

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function url(path: string): string {
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Server address unavailable");
  return `http://127.0.0.1:${address.port}${path}`;
}

describe("API security", () => {
  it("sets Helmet-style headers and allows configured CORS origins", async () => {
    const response = await fetch(url("/api/v1/health"), {
      headers: { Origin: "https://client.example" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://client.example",
    );
  });

  it("rejects unconfigured CORS origins", async () => {
    const response = await fetch(url("/api/v1/health"), {
      headers: { Origin: "https://evil.example" },
    });
    expect(response.status).toBe(403);
  });

  it("returns 429 after the configured request limit", async () => {
    const first = await fetch(url("/api/v1/health"));
    const second = await fetch(url("/api/v1/health"));
    const third = await fetch(url("/api/v1/health"));
    const fourth = await fetch(url("/api/v1/health"));
    expect(
      [first, second, third].every((response) => response.status === 200),
    ).toBe(true);
    expect(fourth.status).toBe(429);
    expect(fourth.headers.get("retry-after")).not.toBeNull();
    expect(await fourth.json()).toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
  });
});

describe("ApiSecurity", () => {
  it("tracks separate buckets for authentication and API traffic", () => {
    const security = new ApiSecurity(securityConfig);
    const request = {
      socket: { remoteAddress: "127.0.0.1" },
      headers: {},
    } as never;
    expect(security.consume(request, "auth").allowed).toBe(true);
    expect(security.consume(request, "auth").allowed).toBe(true);
    expect(security.consume(request, "auth").allowed).toBe(false);
    expect(security.consume(request, "api").allowed).toBe(true);
  });
});
