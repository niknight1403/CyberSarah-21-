import { createApplication } from "./application.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApplication();
  const conversation = await app.conversationService.create("Lokaler MVP-Test");
  const message = await app.conversationService.sendUserMessage(
    conversation.id,
    "Hallo CyberSarah",
  );
  const history = await app.conversationService.getMessages(conversation.id);
  const reply = await app.ai.respond(history);
  await app.conversations.addMessage({
    conversationId: conversation.id,
    author: "assistant",
    content: reply.content,
  });
  console.log(JSON.stringify({ conversation, message, reply }, null, 2));
  app.conversations.close();
}
