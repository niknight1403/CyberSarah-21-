import type {
  Conversation,
  ConversationRepository,
  Message,
} from "../../modules/conversations/conversations.js";
import { newId } from "../../modules/conversations/conversations.js";
import type { UserId } from "../../modules/identity/identity.js";

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<string, Conversation>();
  private readonly messages: Message[] = [];

  async create(ownerId: UserId, title: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: newId(),
      ownerId,
      title,
      createdAt: new Date(),
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async findById(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async listByOwner(ownerId: UserId): Promise<Conversation[]> {
    return [...this.conversations.values()].filter((conversation) => conversation.ownerId === ownerId);
  }

  async addMessage(input: Omit<Message, "id" | "createdAt">): Promise<Message> {
    const message: Message = { ...input, id: newId(), createdAt: new Date() };
    this.messages.push(message);
    return message;
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    return this.messages.filter((message) => message.conversationId === conversationId);
  }
}
