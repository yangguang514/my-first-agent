import { sql } from "@vercel/postgres";
import { welcomeMessage } from "./jsonConversationRepository.js";

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toConversation(row, messages = []) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    messages
  };
}

function toMessage(row) {
  return {
    role: row.role,
    content: row.content,
    sources: Array.isArray(row.sources) ? row.sources : []
  };
}

export class PostgresConversationRepository {
  constructor() {
    this.ready = null;
  }

  async getSql() {
    if (
      !process.env.POSTGRES_URL &&
      !process.env.POSTGRES_PRISMA_URL &&
      !process.env.POSTGRES_URL_NON_POOLING &&
      !process.env.DATABASE_URL
    ) {
      throw new Error("STORAGE_PROVIDER=postgres requires Vercel Postgres env vars such as POSTGRES_URL.");
    }
    return sql;
  }

  async ensureSchema() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const sql = await this.getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS animal_conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS animal_messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES animal_conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          sources JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS animal_messages_conversation_created_idx
        ON animal_messages(conversation_id, created_at)
      `;
    })();
    return this.ready;
  }

  async list() {
    await this.ensureSchema();
    const sql = await this.getSql();
    const result = await sql`
      SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id)::int AS message_count
      FROM animal_conversations c
      LEFT JOIN animal_messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `;
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      messageCount: row.message_count
    }));
  }

  async get(id) {
    await this.ensureSchema();
    const sql = await this.getSql();
    const conversationResult = await sql`
      SELECT id, title, created_at, updated_at
      FROM animal_conversations
      WHERE id = ${id}
      LIMIT 1
    `;
    const row = conversationResult.rows[0];
    if (!row) return null;

    const messagesResult = await sql`
      SELECT role, content, sources
      FROM animal_messages
      WHERE conversation_id = ${id}
      ORDER BY created_at ASC
    `;
    return toConversation(row, messagesResult.rows.map(toMessage));
  }

  async create(title = "新的动物对话") {
    return this.import({ title, messages: [welcomeMessage()] });
  }

  async import({ title = "已迁移的对话", messages = [] }) {
    await this.ensureSchema();
    const sql = await this.getSql();
    const id = createId();
    await sql`
      INSERT INTO animal_conversations (id, title)
      VALUES (${id}, ${title})
    `;
    const conversation = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: messages.length ? messages : [welcomeMessage()]
    };
    await this.replaceMessages(conversation);
    return this.get(id);
  }

  async save(conversation) {
    await this.ensureSchema();
    const sql = await this.getSql();
    await sql`
      INSERT INTO animal_conversations (id, title, created_at, updated_at)
      VALUES (${conversation.id}, ${conversation.title}, ${conversation.createdAt || new Date().toISOString()}, NOW())
      ON CONFLICT (id)
      DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
    `;
    await this.replaceMessages(conversation);
    return this.get(conversation.id);
  }

  async replaceMessages(conversation) {
    const sql = await this.getSql();
    await sql`DELETE FROM animal_messages WHERE conversation_id = ${conversation.id}`;
    for (const message of conversation.messages || []) {
      await sql`
        INSERT INTO animal_messages (id, conversation_id, role, content, sources)
        VALUES (
          ${createId()},
          ${conversation.id},
          ${message.role},
          ${message.content},
          ${JSON.stringify(message.sources || [])}::jsonb
        )
      `;
    }
  }

  async delete(id) {
    await this.ensureSchema();
    const sql = await this.getSql();
    const result = await sql`DELETE FROM animal_conversations WHERE id = ${id}`;
    return result.rowCount > 0;
  }
}
