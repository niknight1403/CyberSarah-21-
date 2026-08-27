import type { IncomingMessage, ServerResponse } from "node:http";

export interface ApiSecurityConfig {
  readonly rateLimitWindowMs: number;
  readonly rateLimitMax: number;
  readonly authRateLimitMax: number;
  readonly corsOrigins: ReadonlySet<string>;
  readonly trustProxy: boolean;
  readonly forceHttps: boolean;
}

type RateLimitBucket = { count: number; resetAt: number };

export class ApiSecurity {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly config: ApiSecurityConfig) {}

  applyHeaders(response: ServerResponse, origin?: string): boolean {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    response.setHeader("Cache-Control", "no-store");
    if (this.config.forceHttps)
      response.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );

    if (!origin) return true;
    if (!this.config.corsOrigins.has(origin)) return false;
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization,Content-Type,X-Request-Id",
    );
    response.setHeader("Access-Control-Max-Age", "600");
    return true;
  }

  consume(
    request: IncomingMessage,
    bucketName: "auth" | "api",
  ): RateLimitResult {
    const now = Date.now();
    const key = `${bucketName}:${clientAddress(request, this.config.trustProxy)}`;
    const current = this.buckets.get(key);
    const max =
      bucketName === "auth"
        ? this.config.authRateLimitMax
        : this.config.rateLimitMax;
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + this.config.rateLimitWindowMs }
        : current;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    if (this.buckets.size > 10_000) this.prune(now);
    return {
      allowed: bucket.count <= max,
      limit: max,
      remaining: Math.max(0, max - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  clear(): void {
    this.buckets.clear();
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets)
      if (bucket.resetAt <= now) this.buckets.delete(key);
  }
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
}

export function securityConfigFromEnv(): ApiSecurityConfig {
  const origins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    rateLimitWindowMs: positiveInteger(
      process.env.RATE_LIMIT_WINDOW_MS,
      60_000,
    ),
    rateLimitMax: positiveInteger(process.env.RATE_LIMIT_MAX, 60),
    authRateLimitMax: positiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 5),
    corsOrigins: new Set(origins),
    trustProxy: process.env.TRUST_PROXY === "true",
    forceHttps: process.env.FORCE_HTTPS === "true",
  };
}

function clientAddress(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-for"]
      ?.toString()
      .split(",")[0]
      ?.trim();
    if (forwarded) return forwarded;
  }
  return request.socket.remoteAddress ?? "unknown";
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
