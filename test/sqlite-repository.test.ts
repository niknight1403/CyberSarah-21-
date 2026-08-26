import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteConversationRepository } from "../src/infrastructure/sqlite-repository.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("SqliteConversationRepository", () => {
  it("persists conversations and messages across repository instances", async () => {
    const directory = mkdtempSync(join(tmpdir(), "cybersarah-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "app.sqlite");

    const first = new SqliteConversationRepository(path);
    const conversation = await first.create("user-a", "Persistentes Gespräch");
    await first.addMessage({ conversationId: conversation.id, author: "user", content: "Gespeichert" });
    first.close();

    const second = new SqliteConversationRepository(path);
    expect(await second.listByOwner("user-a")).toHaveLength(1);
    expect((await second.listMessages(conversation.id))[0]?.content).toBe("Gespeichert");
    expect(await second.listByOwner("user-b")).toHaveLength(0);
    second.close();
  });
});
