import type Database from "better-sqlite3";
import type {
  ChatConversation,
  ChatMessage,
  ChatMessagePage,
  ChatMode,
  ChatSnapshot,
  RunStatus,
} from "../../../ipc/contracts";
interface ConversationRow {
  id: number;
  title: string;
  mode: ChatMode;
  agent_id: string | null;
  model_id: number | null;
  updated_at: string;
}
interface MessageRow {
  id: number;
  conversation_id: number;
  run_id: number | null;
  execution_run_id?: number | null;
  role: ChatMessage["role"];
  status: ChatMessage["status"];
  content_json: string;
  created_at: string;
}
export class ChatDataSource {
  constructor(private readonly db: Database.Database) {}
  snapshot(conversationId?: number): ChatSnapshot {
    const conversations = (
      this.db
        .prepare(
          "SELECT id,title,mode,agent_id,model_id,updated_at FROM chat_conversations ORDER BY updated_at DESC",
        )
        .all() as ConversationRow[]
    ).map(mapConversation);
    const targetId = conversationId ?? conversations[0]?.id;
    const page = targetId
      ? this.messagePage(targetId)
      : { messages: [], hasMore: false };
    return {
      conversations,
      messages: page.messages,
      hasMoreMessages: page.hasMore,
    };
  }
  messagePage(
    conversationId: number,
    beforeId?: number,
    limit = 30,
  ): ChatMessagePage {
    const rows = (
      beforeId === undefined
        ? this.db
            .prepare(
              "SELECT * FROM chat_messages WHERE conversation_id=? ORDER BY id DESC LIMIT ?",
            )
            .all(conversationId, limit + 1)
        : this.db
            .prepare(
              "SELECT * FROM chat_messages WHERE conversation_id=? AND id<? ORDER BY id DESC LIMIT ?",
            )
            .all(conversationId, beforeId, limit + 1)
    ) as MessageRow[];
    const hasMore = rows.length > limit;
    return {
      messages: rows.slice(0, limit).reverse().map(mapMessage),
      hasMore,
    };
  }
  messages(conversationId: number): ChatMessage[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM chat_messages WHERE conversation_id=? ORDER BY id",
        )
        .all(conversationId) as MessageRow[]
    ).map(mapMessage);
  }
  createConversation(
    mode: ChatMode,
    agentId: string | undefined,
    modelId: number | undefined,
  ): number {
    return Number(
      this.db
        .prepare(
          "INSERT INTO chat_conversations(mode,agent_id,model_id) VALUES(?,?,?)",
        )
        .run(mode, agentId ?? null, modelId ?? null).lastInsertRowid,
    );
  }
  createRun(
    conversationId: number,
    agentId: string | undefined,
    modelId: number,
    maxSteps: number,
  ): number {
    return Number(
      this.db
        .prepare(
          "INSERT INTO generation_runs(conversation_id,agent_id,model_id,status,max_steps) VALUES(?,?,?,'queued',?)",
        )
        .run(conversationId, agentId ?? null, modelId, maxSteps)
        .lastInsertRowid,
    );
  }
  addMessage(
    conversationId: number,
    runId: number | null,
    role: ChatMessage["role"],
    text: string,
    status: ChatMessage["status"],
  ): ChatMessage {
    const id = Number(
      this.db
        .prepare(
          "INSERT INTO chat_messages(conversation_id,run_id,role,status,content_json) VALUES(?,?,?,?,?)",
        )
        .run(
          conversationId,
          runId,
          role,
          status,
          JSON.stringify([{ type: "text", text }]),
        ).lastInsertRowid,
    );
    return mapMessage(
      this.db
        .prepare("SELECT * FROM chat_messages WHERE id=?")
        .get(id) as MessageRow,
    );
  }
  appendText(messageId: number, delta: string) {
    const row = this.db
      .prepare("SELECT content_json FROM chat_messages WHERE id=?")
      .get(messageId) as { content_json: string };

    const parts = JSON.parse(row.content_json) as Array<{
      type: string;
      text: string;
    }>;
    let part = parts.find((part) => part.type === "text");
    if (!part) {
      part = { type: "text", text: "" };
      parts.push(part);
    }
    part.text += delta;
    this.db
      .prepare("UPDATE chat_messages SET content_json=? WHERE id=?")
      .run(JSON.stringify(parts), messageId);
  }
  appendReasoning(messageId: number, delta: string) {
    const row = this.db
      .prepare("SELECT content_json FROM chat_messages WHERE id=?")
      .get(messageId) as { content_json: string };
    const parts = JSON.parse(row.content_json) as Array<{
      type: string;
      text: string;
    }>;
    let part = parts.find((item) => item.type === "reasoning");
    if (!part) {
      part = { type: "reasoning", text: "" };
      parts.unshift(part);
    }
    part.text += delta;
    this.db
      .prepare("UPDATE chat_messages SET content_json=? WHERE id=?")
      .run(JSON.stringify(parts), messageId);
  }
  replaceText(messageId: number, text: string) {
    this.db
      .prepare("UPDATE chat_messages SET content_json=? WHERE id=?")
      .run(JSON.stringify([{ type: "text", text }]), messageId);
  }
  setMessageStatus(id: number, status: ChatMessage["status"]) {
    this.db
      .prepare("UPDATE chat_messages SET status=? WHERE id=?")
      .run(status, id);
  }
  linkMessageToScenarioRun(messageId: number, executionRunId: number) {
    this.db
      .prepare("UPDATE chat_messages SET execution_run_id=? WHERE id=?")
      .run(executionRunId, messageId);
  }
  setRunStatus(id: number, status: RunStatus, error?: string) {
    this.db
      .prepare(
        "UPDATE generation_runs SET status=?, error_message=?, started_at=CASE WHEN ?='running' THEN CURRENT_TIMESTAMP ELSE started_at END, completed_at=CASE WHEN ? IN ('completed','failed','cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id=?",
      )
      .run(status, error ?? null, status, status, id);
  }
  addStep(
    runId: number,
    index: number,
    payload: unknown,
    finishReason?: string,
  ) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO generation_run_steps(run_id,step_index,finish_reason,payload_json) VALUES(?,?,?,?)",
      )
      .run(runId, index, finishReason ?? null, JSON.stringify(payload));
    this.db
      .prepare("UPDATE generation_runs SET current_step=? WHERE id=?")
      .run(index + 1, runId);
  }
  createToolCall(
    runId: number,
    providerCallId: string,
    toolId: string,
    risk: string,
    input: unknown,
    status: string,
  ): number {
    const row = this.db
      .prepare(
        "INSERT INTO generation_tool_calls(run_id,provider_call_id,tool_id,risk,status,input_json) VALUES(?,?,?,?,?,?) ON CONFLICT(run_id,provider_call_id) DO UPDATE SET status=excluded.status RETURNING id",
      )
      .get(
        runId,
        providerCallId,
        toolId,
        risk,
        status,
        JSON.stringify(input),
      ) as { id: number };
    return row.id;
  }
  finishToolCall(id: number, status: string, output?: unknown, error?: string) {
    this.db
      .prepare(
        "UPDATE generation_tool_calls SET status=?,output_json=?,error_message=?,completed_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(
        status,
        output === undefined ? null : JSON.stringify(output),
        error ?? null,
        id,
      );
  }
  updateTitle(id: number, text: string) {
    this.db
      .prepare(
        "UPDATE chat_conversations SET title=CASE WHEN title='Новый диалог' THEN ? ELSE title END,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(text.slice(0, 60), id);
  }
  deleteConversation(id: number) {
    this.db.prepare("DELETE FROM chat_conversations WHERE id=?").run(id);
  }
  renameConversation(id: number, title: string) {
    const normalized = title.trim();
    if (!normalized) throw new Error("Название не может быть пустым");
    if (normalized.length > 120)
      throw new Error("Название не может быть длиннее 120 символов");
    const result = this.db
      .prepare(
        "UPDATE chat_conversations SET title=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(normalized, id);
    if (!result.changes) throw new Error("Диалог не найден");
  }
  resolveModel(id: number) {
    return this.db
      .prepare(
        "SELECT m.id,m.remote_id,p.kind,p.base_url,p.api_key_secret_id FROM text_provider_models m JOIN text_provider_configs p ON p.id=m.provider_id WHERE m.id=? AND m.enabled=1 AND p.enabled=1",
      )
      .get(id) as
      | {
          id: number;
          remote_id: string;
          kind: string;
          base_url: string;
          api_key_secret_id: number | null;
        }
      | undefined;
  }
  resolveAgent(id: string | undefined) {
    if (!id) return undefined;
    const row = this.db
      .prepare(
        "SELECT instructions,max_tool_calls,timeout_seconds FROM automation_agents WHERE id=? AND status!='disabled'",
      )
      .get(id) as
      | {
          instructions: string;
          max_tool_calls: number;
          timeout_seconds: number;
        }
      | undefined;
    if (!row) return undefined;
    const allowedToolIds = (
      this.db
        .prepare("SELECT tool_id FROM automation_agent_tools WHERE agent_id=?")
        .all(id) as Array<{ tool_id: string }>
    ).map((item) => item.tool_id);
    return { ...row, allowedToolIds };
  }
}
const mapConversation = (r: ConversationRow): ChatConversation => ({
  id: r.id,
  title: r.title,
  mode: r.mode,
  agentId: r.agent_id,
  modelId: r.model_id,
  updatedAt: r.updated_at,
});
const mapMessage = (r: MessageRow): ChatMessage => {
  const parts = JSON.parse(r.content_json) as Array<{
    type: string;
    text?: string;
  }>;
  return {
    id: r.id,
    conversationId: r.conversation_id,
    runId: r.run_id,
    scenarioRunId: r.execution_run_id ?? null,
    role: r.role,
    status: r.status,
    text: parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(""),
    reasoning: parts
      .filter((p) => p.type === "reasoning")
      .map((p) => p.text ?? "")
      .join(""),
    createdAt: r.created_at,
  };
};
