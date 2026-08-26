import { describe, expect, it } from "vitest";
import { ConversationService } from "../src/modules/conversations/conversations.js";
import { StaticIdentityContext } from "../src/modules/identity/identity.js";
import { InMemoryConversationRepository } from "../src/infrastructure/in-memory/in-memory-repository.js";

function serviceFor(userId: string) {
  return new ConversationService(
    new StaticIdentityContext({ id: userId, role: "user" }),
    new InMemoryConversationRepository(),
  );
}

describe("ConversationService", () => {
  it("creates a conversation and persists a user message", async () => {
    const service = serviceFor("user-a");
    const conversation = await service.create("Erstes Gespräch");

    await service.sendUserMessage(conversation.id, "Hallo");
    const messages = await service.getMessages(conversation.id);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe("Hallo");
    expect(messages[0]?.author).toBe("user");
  });

  it("rejects access to another user's conversation", async () => {
    const repository = new InMemoryConversationRepository();
    const owner = new ConversationService(
      new StaticIdentityContext({ id: "owner", role: "user" }),
      repository,
    );
    const foreign = new ConversationService(
      new StaticIdentityContext({ id: "foreign", role: "user" }),
      repository,
    );
    const conversation = await owner.create();

    await expect(foreign.getMessages(conversation.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
