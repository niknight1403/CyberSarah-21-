import { describe, expect, it } from "vitest";
import {
  issueAccessToken,
  verifyAccessToken,
  type JwtConfig,
} from "../src/api/jwt-auth.js";

const config: JwtConfig = {
  secret: "unit-test-secret-that-is-at-least-32-characters-long",
  issuer: "cybersarah-test",
  audience: "cybersarah-api",
  ttlSeconds: 60,
};

describe("JWT authentication", () => {
  it("issues and verifies a signed access token", () => {
    const issued = issueAccessToken("client-a", "user", config, 1_000);
    const claims = verifyAccessToken(issued.accessToken, config, 1_001);
    expect(claims).toMatchObject({
      sub: "client-a",
      role: "user",
      iss: config.issuer,
      aud: config.audience,
    });
  });

  it("rejects tampered, expired, and wrong-audience tokens", () => {
    const issued = issueAccessToken("client-a", "user", config, 1_000);
    const [header, payload, signature] = issued.accessToken.split(".");
    expect(() =>
      verifyAccessToken(`${header}.${payload}x.${signature}`, config, 1_001),
    ).toThrow(/Invalid/);
    expect(() => verifyAccessToken(issued.accessToken, config, 1_061)).toThrow(
      /Invalid/,
    );
    expect(() =>
      verifyAccessToken(
        issued.accessToken,
        { ...config, audience: "other" },
        1_001,
      ),
    ).toThrow(/Invalid/);
  });
});
