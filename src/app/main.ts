import { AiOrchestrator, EchoProvider, OpenAiCompatibleProvider } from "../modules/ai-orchestration/ai.js";
import { ConversationService } from "../modules/conversations/conversations.js";
import { StaticIdentityContext } from "../modules/identity/identity.js";
import { SqliteConversationRepository } from "../infrastructure/sqlite-repository.js";

export function createApplication() {
  const identity = new StaticIdentityContext({ id: process.env.DEV_USER_ID ?? "local-user", role: "user" });
  const conversations = new SqliteConversationRepository();
  const provider = process.env.OPENAI_API_KEY
    ? new OpenAiCompatibleProvider({
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_API_BASE ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        ...(process.env.AI_SYSTEM_PROMPT ? { systemPrompt: process.env.AI_SYSTEM_PROMPT } : {}),
      })
    : new EchoProvider();
  const conversationService = new ConversationService(identity, conversations);
  const ai = new AiOrchestrator(provider);
  return { conversations, conversationService, ai };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApplication();
  const conversation = await app.conversationService.create("Lokaler MVP-Test");
  const message = await app.conversationService.sendUserMessage(conversation.id, "Hallo CyberSarah");
  const history = await app.conversationService.getMessages(conversation.id);
  const reply = await app.ai.respond(history);
  await app.conversations.addMessage({ conversationId: conversation.id, author: "assistant", content: reply.content });
  console.log(JSON.stringify({ conversation, message, reply }, null, 2));
  app.conversations.close();
}
