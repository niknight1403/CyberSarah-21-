import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors.js";
import type { IdentityContext, UserId } from "../identity/identity.js";

export type ConversationId = string;
export type MessageId = string;

export interface Conversation {
  readonly id: ConversationId;
  readonly ownerId: UserId;
  readonly title: string;
  readonly createdAt: Date;
}

export interface Message {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly author: "user" | "assistant";
  readonly content: string;
  readonly createdAt: Date;
}

export interface ConversationRepository {
  create(ownerId: UserId, title: string): Promise<Conversation>;
  findById(id: ConversationId): Promise<Conversation | undefined>;
  listByOwner(ownerId: UserId): Promise<Conversation[]>;
  addMessage(input: Omit<Message, "id" | "createdAt">): Promise<Message>;
  listMessages(conversationId: ConversationId): Promise<Message[]>;
}

export class ConversationService {
  constructor(
    private readonly identity: IdentityContext,
    private readonly repository: ConversationRepository,
  ) {}

  async create(title = "Neues Gespräch"): Promise<Conversation> {
    const user = this.identity.requireUser();
    const normalizedTitle = title.trim();
    if (!normalizedTitle || normalizedTitle.length > 120) {
      throw new AppError("VALIDATION_ERROR", "Conversation title is invalid.");
    }
    return this.repository.create(user.id, normalizedTitle);
  }

  async listMine(): Promise<Conversation[]> {
    return this.repository.listByOwner(this.identity.requireUser().id);
  }

  async getMessages(conversationId: ConversationId): Promise<Message[]> {
    await this.requireOwnedConversation(conversationId);
    return this.repository.listMessages(conversationId);
  }

  async sendUserMessage(conversationId: ConversationId, content: string): Promise<Message> {
    await this.requireOwnedConversation(conversationId);
    const normalizedContent = content.trim();
    if (!normalizedContent || normalizedContent.length > 8_000) {
      throw new AppError("VALIDATION_ERROR", "Message content is invalid.");
    }
    return this.repository.addMessage({
      conversationId,
      author: "user",
      content: normalizedContent,
    });
  }

  private async requireOwnedConversation(id: ConversationId): Promise<Conversation> {
    const conversation = await this.repository.findById(id);
    if (!conversation) {
      throw new AppError("NOT_FOUND", "Conversation was not found.");
    }
    if (conversation.ownerId !== this.identity.requireUser().id) {
      throw new AppError("FORBIDDEN", "Conversation access is forbidden.");
    }
    return conversation;
  }
}

export function newId(): string {
  return randomUUID();
}
