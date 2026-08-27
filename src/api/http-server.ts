import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { createApplication } from "../app/application.js";
import {
  issueAccessToken,
  verifyAccessToken,
  type JwtConfig,
} from "./jwt-auth.js";
import { AppError } from "../shared/errors.js";
import {
  ApiSecurity,
  securityConfigFromEnv,
  type ApiSecurityConfig,
} from "./security.js";

const MAX_BODY_BYTES = 1_000_000;
const API_PREFIX = "/api/v1";

type JsonObject = Record<string, unknown>;

export function createApiServer(
  jwtConfig = jwtConfigFromEnv(),
  securityConfig: ApiSecurityConfig = securityConfigFromEnv(),
): Server {
  const security = new ApiSecurity(securityConfig);
  return createServer((request, response) => {
    void handleRequest(request, response, jwtConfig, security);
  });
}

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  jwtConfig = jwtConfigFromEnv(),
  security = new ApiSecurity(securityConfigFromEnv()),
): Promise<void> {
  const requestId =
    request.headers["x-request-id"]?.toString() ?? cryptoRandomId();
  response.setHeader("x-request-id", requestId);
  response.setHeader("content-type", "application/json; charset=utf-8");

  try {
    const origin = request.headers.origin?.toString();
    if (!security.applyHeaders(response, origin)) {
      return sendError(
        response,
        403,
        "FORBIDDEN",
        "Origin is not allowed.",
        requestId,
      );
    }
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }
    const url = new URL(request.url ?? "/", "http://localhost");
    const rate = security.consume(
      request,
      url.pathname === `${API_PREFIX}/auth/token` ? "auth" : "api",
    );
    setRateLimitHeaders(response, rate);
    if (!rate.allowed) {
      response.setHeader(
        "Retry-After",
        Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)),
      );
      return sendError(
        response,
        429,
        "RATE_LIMITED",
        "Too many requests.",
        requestId,
      );
    }
    if (request.method === "GET" && url.pathname === `${API_PREFIX}/health`) {
      return sendJson(response, 200, { status: "ok", requestId });
    }
    if (!url.pathname.startsWith(`${API_PREFIX}/`)) {
      return sendError(
        response,
        404,
        "NOT_FOUND",
        "Route was not found.",
        requestId,
      );
    }
    if (
      request.method === "POST" &&
      url.pathname === `${API_PREFIX}/auth/token`
    ) {
      return issueToken(request, response, requestId);
    }
    if (!jwtConfig) {
      return sendError(
        response,
        503,
        "PROVIDER_ERROR",
        "JWT authentication is not configured.",
        requestId,
      );
    }
    const claims = authenticate(request.headers.authorization, jwtConfig);
    const app = createApplication(claims.sub);
    try {
      if (
        request.method === "GET" &&
        url.pathname === `${API_PREFIX}/conversations`
      ) {
        return sendJson(response, 200, {
          data: await app.conversationService.listMine(),
          requestId,
        });
      }
      if (
        request.method === "POST" &&
        url.pathname === `${API_PREFIX}/conversations`
      ) {
        const body = await readJson(request);
        const conversation = await app.conversationService.create(
          stringField(body, "title", false) ?? undefined,
        );
        return sendJson(response, 201, { data: conversation, requestId });
      }

      const match = new RegExp(
        `^${API_PREFIX}/conversations/([^/]+)(?:/messages)?$`,
      ).exec(url.pathname);
      if (!match)
        return sendError(
          response,
          404,
          "NOT_FOUND",
          "Route was not found.",
          requestId,
        );
      const conversationId = decodeURIComponent(match[1]!);
      const isMessagesRoute = url.pathname.endsWith("/messages");

      if (request.method === "GET" && isMessagesRoute) {
        return sendJson(response, 200, {
          data: await app.conversationService.getMessages(conversationId),
          requestId,
        });
      }
      if (request.method === "POST" && isMessagesRoute) {
        const body = await readJson(request);
        const message = await app.conversationService.sendUserMessage(
          conversationId,
          stringField(body, "content", true)!,
        );
        const history =
          await app.conversationService.getMessages(conversationId);
        const reply = await app.ai.respond(history);
        const assistantMessage = await app.conversations.addMessage({
          conversationId,
          author: "assistant",
          content: reply.content,
        });
        return sendJson(response, 201, {
          data: { message, assistantMessage, model: reply.model },
          requestId,
        });
      }
      return sendError(
        response,
        405,
        "VALIDATION_ERROR",
        "Method is not allowed.",
        requestId,
      );
    } finally {
      app.conversations.close();
    }
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(
        response,
        statusFor(error.code),
        error.code,
        error.message,
        requestId,
      );
    }
    return sendError(
      response,
      500,
      "PROVIDER_ERROR",
      "Internal server error.",
      requestId,
    );
  }
}

async function readJson(request: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES)
      throw new AppError("VALIDATION_ERROR", "Request body is too large.");
    chunks.push(buffer);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("object required");
    return parsed as JsonObject;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

function stringField(
  body: JsonObject,
  key: string,
  required: boolean,
): string | undefined {
  const value = body[key];
  if (typeof value !== "string" || (required && !value.trim())) {
    if (required) throw new AppError("VALIDATION_ERROR", `${key} is required.`);
    return undefined;
  }
  return value;
}

function authenticate(header: string | undefined, config: JwtConfig) {
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token)
    throw new AppError("UNAUTHORIZED", "A valid Bearer token is required.");
  return verifyAccessToken(token, config);
}

async function issueToken(
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
): Promise<void> {
  const clientId = process.env.JWT_CLIENT_ID;
  const clientSecret = process.env.JWT_CLIENT_SECRET;
  const jwtConfig = jwtConfigFromEnv();
  if (!clientId || !clientSecret || !jwtConfig) {
    return sendError(
      response,
      503,
      "PROVIDER_ERROR",
      "JWT token issuing is not configured.",
      requestId,
    );
  }
  const body = await readJson(request);
  if (
    body.grant_type !== "client_credentials" ||
    body.client_id !== clientId ||
    body.client_secret !== clientSecret
  ) {
    throw new AppError("UNAUTHORIZED", "Invalid client credentials.");
  }
  const token = issueAccessToken(clientId, "user", jwtConfig);
  return sendJson(response, 200, {
    access_token: token.accessToken,
    token_type: "Bearer",
    expires_in: token.expiresIn,
    requestId,
  });
}

function jwtConfigFromEnv(): JwtConfig | undefined {
  const secret = process.env.JWT_SECRET;
  if (!secret) return undefined;
  return {
    secret,
    issuer: process.env.JWT_ISSUER ?? "cybersarah-21",
    audience: process.env.JWT_AUDIENCE ?? "cybersarah-api",
    ttlSeconds: Number(process.env.JWT_TTL_SECONDS ?? 3600),
  };
}

function setRateLimitHeaders(
  response: ServerResponse,
  rate: { limit: number; remaining: number; resetAt: number },
): void {
  response.setHeader("X-RateLimit-Limit", rate.limit);
  response.setHeader("X-RateLimit-Remaining", rate.remaining);
  response.setHeader("X-RateLimit-Reset", Math.ceil(rate.resetAt / 1000));
}

function statusFor(code: AppError["code"]): number {
  return code === "UNAUTHORIZED"
    ? 401
    : code === "FORBIDDEN"
      ? 403
      : code === "NOT_FOUND"
        ? 404
        : code === "VALIDATION_ERROR"
          ? 400
          : 502;
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: JsonObject,
): void {
  response.statusCode = status;
  response.end(JSON.stringify(payload));
}

function sendError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
  requestId: string,
): void {
  sendJson(response, status, { error: { code, message }, requestId });
}

function cryptoRandomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  createApiServer().listen(port, () =>
    console.log(`CyberSarah API listening on http://localhost:${port}`),
  );
}
