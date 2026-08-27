import {
  AiOrchestrator,
  EchoProvider,
  OpenAiCompatibleProvider,
} from "../modules/ai-orchestration/ai.js";
import { ConversationService } from "../modules/conversations/conversations.js";
import {
  StaticIdentityContext,
  type UserId,
} from "../modules/identity/identity.js";
import { SqliteConversationRepository } from "../infrastructure/sqlite-repository.js";

export function createApplication(
  userId: UserId = process.env.DEV_USER_ID ?? "local-user",
) {
  const identity = new StaticIdentityContext({ id: userId, role: "user" });
  const conversations = new SqliteConversationRepository();
  const provider = process.env.OPENAI_API_KEY
    ? new OpenAiCompatibleProvider({
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl:
          process.env.OPENAI_API_BASE ??
          process.env.OPENAI_BASE_URL ??
          "https://api.openai.com/v1",
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        ...(process.env.AI_SYSTEM_PROMPT
          ? { systemPrompt: process.env.AI_SYSTEM_PROMPT }
          : {}),
      })
    : new EchoProvider();
  return {
    conversations,
    conversationService: new ConversationService(identity, conversations),
    ai: new AiOrchestrator(provider),
  };
}

export type Application = ReturnType<typeof createApplication>;
