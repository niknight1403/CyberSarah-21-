import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { AppError } from "../shared/errors.js";

export interface JwtConfig {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly ttlSeconds: number;
}

export interface JwtClaims {
  readonly sub: string;
  readonly role: "user" | "moderator" | "admin";
  readonly iss: string;
  readonly aud: string;
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
}

type JwtHeader = { readonly alg: "HS256"; readonly typ: "JWT" };

export function issueAccessToken(
  subject: string,
  role: JwtClaims["role"],
  config: JwtConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): { accessToken: string; expiresIn: number; claims: JwtClaims } {
  if (!config.secret || config.secret.length < 32) {
    throw new AppError(
      "PROVIDER_ERROR",
      "JWT_SECRET must contain at least 32 characters.",
    );
  }
  const claims: JwtClaims = {
    sub: subject,
    role,
    iss: config.issuer,
    aud: config.audience,
    iat: nowSeconds,
    exp: nowSeconds + config.ttlSeconds,
    jti: randomUUID(),
  };
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const encodedHeader = encodeJson(header);
  const encodedClaims = encodeJson(claims);
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  return {
    accessToken: `${signingInput}.${sign(signingInput, config.secret)}`,
    expiresIn: config.ttlSeconds,
    claims,
  };
}

export function verifyAccessToken(
  token: string,
  config: JwtConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): JwtClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw unauthorized();
  const [encodedHeader, encodedClaims, encodedSignature] = parts as [
    string,
    string,
    string,
  ];
  let header: unknown;
  let claims: unknown;
  try {
    header = JSON.parse(
      Buffer.from(encodedHeader, "base64url").toString("utf8"),
    );
    claims = JSON.parse(
      Buffer.from(encodedClaims, "base64url").toString("utf8"),
    );
  } catch {
    throw unauthorized();
  }
  if (!isJwtHeader(header) || !isClaims(claims)) throw unauthorized();
  const expectedSignature = sign(
    `${encodedHeader}.${encodedClaims}`,
    config.secret,
  );
  const provided = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  )
    throw unauthorized();
  if (claims.iss !== config.issuer || claims.aud !== config.audience)
    throw unauthorized();
  if (claims.exp <= nowSeconds || claims.iat > nowSeconds + 30)
    throw unauthorized();
  return claims;
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function isJwtHeader(value: unknown): value is JwtHeader {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Record<string, unknown>).alg === "HS256" &&
    (value as Record<string, unknown>).typ === "JWT"
  );
}

function isClaims(value: unknown): value is JwtClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Record<string, unknown>;
  return (
    typeof claims.sub === "string" &&
    claims.sub.length > 0 &&
    (claims.role === "user" ||
      claims.role === "moderator" ||
      claims.role === "admin") &&
    typeof claims.iss === "string" &&
    typeof claims.aud === "string" &&
    typeof claims.iat === "number" &&
    typeof claims.exp === "number" &&
    typeof claims.jti === "string"
  );
}

function unauthorized(): AppError {
  return new AppError("UNAUTHORIZED", "Invalid or expired access token.");
}
