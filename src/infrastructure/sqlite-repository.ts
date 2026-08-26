import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Conversation,
  ConversationRepository,
  Message,
} from "../modules/conversations/conversations.js";
import { newId } from "../modules/conversations/conversations.js";
import type { UserId } from "../modules/identity/identity.js";

export class SqliteConversationRepository implements ConversationRepository {
  private readonly db: DatabaseSync;

  constructor(databasePath = process.env.DATABASE_PATH ?? "data/cybersarah.sqlite") {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        author TEXT NOT NULL CHECK (author IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    `);
  }

  async create(ownerId: UserId, title: string): Promise<Conversation> {
    const conversation: Conversation = { id: newId(), ownerId, title, createdAt: new Date() };
    this.db.prepare(
      "INSERT INTO conversations (id, owner_id, title, created_at) VALUES (?, ?, ?, ?)",
    ).run(conversation.id, conversation.ownerId, conversation.title, conversation.createdAt.toISOString());
    return conversation;
  }

  async findById(id: string): Promise<Conversation | undefined> {
    const row = this.db.prepare(
      "SELECT id, owner_id, title, created_at FROM conversations WHERE id = ?",
    ).get(id) as ConversationRow | undefined;
    return row ? toConversation(row) : undefined;
  }

  async listByOwner(ownerId: UserId): Promise<Conversation[]> {
    const rows = this.db.prepare(
      "SELECT id, owner_id, title, created_at FROM conversations WHERE owner_id = ? ORDER BY created_at DESC",
    ).all(ownerId) as unknown as ConversationRow[];
    return rows.map(toConversation);
  }

  async addMessage(input: Omit<Message, "id" | "createdAt">): Promise<Message> {
    const message: Message = { ...input, id: newId(), createdAt: new Date() };
    this.db.prepare(
      "INSERT INTO messages (id, conversation_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(message.id, message.conversationId, message.author, message.content, message.createdAt.toISOString());
    return message;
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const rows = this.db.prepare(
      "SELECT id, conversation_id, author, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    ).all(conversationId) as unknown as MessageRow[];
    return rows.map(toMessage);
  }

  close(): void {
    this.db.close();
  }
}

type ConversationRow = { id: string; owner_id: string; title: string; created_at: string };
type MessageRow = {
  id: string;
  conversation_id: string;
  author: "user" | "assistant";
  content: string;
  created_at: string;
};

function toConversation(row: ConversationRow): Conversation {
  return { id: row.id, ownerId: row.owner_id, title: row.title, createdAt: new Date(row.created_at) };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    author: row.author,
    content: row.content,
    createdAt: new Date(row.created_at),
  };
}
