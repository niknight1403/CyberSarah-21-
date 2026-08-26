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
