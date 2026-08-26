import { AppError } from "../../shared/errors.js";
import type { Message } from "../conversations/conversations.js";

export interface GenerateRequest {
  readonly messages: ReadonlyArray<Pick<Message, "author" | "content">>;
  readonly maxOutputTokens: number;
}

export interface GenerateResponse {
  readonly content: string;
  readonly model: string;
  readonly usage?: { readonly inputTokens?: number; readonly outputTokens?: number };
}

export interface AiProvider {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}

export interface AiPolicy {
  readonly maxContextMessages: number;
  readonly maxOutputTokens: number;
}

export class AiOrchestrator {
  constructor(
    private readonly provider: AiProvider,
    private readonly policy: AiPolicy = { maxContextMessages: 20, maxOutputTokens: 800 },
  ) {}

  async respond(history: Message[]): Promise<GenerateResponse> {
    const context = history.slice(-this.policy.maxContextMessages);
    try {
      const response = await this.provider.generate({
        messages: context.map(({ author, content }) => ({ author, content })),
        maxOutputTokens: this.policy.maxOutputTokens,
      });
      if (!response.content.trim()) {
        throw new AppError("PROVIDER_ERROR", "AI provider returned an empty response.");
      }
      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("PROVIDER_ERROR", "AI provider request failed.", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

export class EchoProvider implements AiProvider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const latest = request.messages.at(-1);
    return {
      content: latest ? `Entwurf einer Antwort auf: ${latest.content}` : "Bitte beginne ein Gespräch.",
      model: "echo-development-double",
    };
  }
}


export interface OpenAiCompatibleConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs?: number;
  readonly systemPrompt?: string;
}

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly config: OpenAiCompatibleConfig) {
    if (!config.apiKey) throw new Error("OPENAI_API_KEY is required.");
    if (!config.model) throw new Error("OPENAI_MODEL is required.");
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30_000);
    const messages = [
      ...(this.config.systemPrompt
        ? [{ role: "system", content: this.config.systemPrompt }]
        : []),
      ...request.messages.map((message) => ({
        role: message.author === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    ];

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: request.maxOutputTokens,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new AppError("PROVIDER_ERROR", `AI provider returned HTTP ${response.status}.`, {
          status: response.status,
        });
      }
      const content = extractContent(payload);
      const usage = extractUsage(payload);
      return usage ? { content, model: this.config.model, usage } : { content, model: this.config.model };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("PROVIDER_ERROR", "AI provider request failed.", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractContent(payload: unknown): string {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })
    .choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AppError("PROVIDER_ERROR", "AI provider returned no usable content.");
  }
  return content;
}

function extractUsage(payload: unknown): GenerateResponse["usage"] {
  const usage = (payload as {
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
  }).usage;
  if (!usage) return undefined;
  const inputTokens = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
  const outputTokens = typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined;
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  };
}
