import { AiOrchestrator, EchoProvider } from "../modules/ai-orchestration/ai.js";
import { ConversationService } from "../modules/conversations/conversations.js";
import { StaticIdentityContext } from "../modules/identity/identity.js";
import { InMemoryConversationRepository } from "../infrastructure/in-memory/in-memory-repository.js";

export function createApplication() {
  const identity = new StaticIdentityContext({ id: "local-user", role: "user" });
  const conversations = new InMemoryConversationRepository();
  const conversationService = new ConversationService(identity, conversations);
  const ai = new AiOrchestrator(new EchoProvider());
  return { conversations, conversationService, ai };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApplication();
  const conversation = await app.conversationService.create("Lokaler MVP-Test");
  const message = await app.conversationService.sendUserMessage(conversation.id, "Hallo CyberSarah");
  const reply = await app.ai.respond([message]);
  console.log(JSON.stringify({ conversation, message, reply }, null, 2));
}
