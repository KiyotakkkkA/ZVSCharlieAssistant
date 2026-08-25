import type Database from "better-sqlite3";
import type {
  ChatConversation,
  ChatMessage,
  ChatMessagePage,
  ChatSnapshot,
  ChatToolCall,
  ContextSegment,
  RunStatus,
} from "../../../shared/models/chat";
import {
  chatMessageContentDtoSchema,
  chatUsageDtoSchema,
  parseJsonDto,
} from "../../../shared/dto";
import { newEntityId } from "./entity-id";
import type {
  ChatMessageContentPart,
  ChatUsage,
  ModelSwitch,
  RunUsage,
} from "../../../shared/dto";
import {
  modelSwitchDtoSchema,
  textProviderModelDetailsDtoSchema,
} from "../../../shared/dto";
interface ConversationRow {
  id: string;
  title: string;
  last_usage: string;
  updated_at: string;
}
interface MessageRow {
  id: string;
  conversation_id: string;
  run_id: string | null;
  execution_run_id?: string | null;
  role: ChatMessage["role"];
  status: ChatMessage["status"];
  content_json: string;
  last_usage: string;
  compacted_into: string | null;
  token_count: number;
  created_at: string;
}
interface SegmentRow {
  id: string;
  conversation_id: string;
  from_message_id: string;
  to_message_id: string;
  summary: string;
  model_id: string | null;
  message_count: number;
  tokens_before: number;
  tokens_after: number;
  reason: ContextSegment["reason"];
  created_at: string;
}
export class ChatRepository {
  constructor(private readonly db: Database.Database) {}
  conversations(limit?: number): ChatConversation[] {
    const sql =
      limit === undefined
        ? "SELECT id,title,last_usage,updated_at FROM chat_conversations ORDER BY updated_at DESC"
        : "SELECT id,title,last_usage,updated_at FROM chat_conversations ORDER BY updated_at DESC LIMIT ?";
    const statement = this.db.prepare(sql);
    const rows = (limit === undefined
      ? statement.all()
      : statement.all(Math.max(0, Math.trunc(limit)))) as ConversationRow[];
    return rows.map(mapConversation);
  }

  snapshot(conversationId?: string): ChatSnapshot {
    const conversations = this.conversations();
    const targetId = conversationId ?? conversations[0]?.id;
    const page = targetId
      ? this.messagePage(targetId)
      : { messages: [], hasMore: false };
    return {
      conversations,
      messages: page.messages,
      hasMoreMessages: page.hasMore,
      segments: targetId ? this.contextSegments(targetId) : [],
    };
  }
  messagePage(
    conversationId: string,
    beforeId?: string,
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
      messages: rows
        .slice(0, limit)
        .reverse()
        .map((row) => this.mapMessage(row)),
      hasMore,
    };
  }
  messages(conversationId: string): ChatMessage[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM chat_messages WHERE conversation_id=? ORDER BY id",
        )
        .all(conversationId) as MessageRow[]
    ).map((row) => this.mapMessage(row));
  }
  createConversation(
    usage: ChatUsage,
  ): string {
    const id = newEntityId();
    this.db
      .prepare(
        "INSERT INTO chat_conversations(id,mode,agent_id,last_usage) VALUES(?,?,?,?)",
      )
      .run(id, usage.mode, usage.agentId ?? null, JSON.stringify(usage));
    return id;
  }
  updateLastUsage(conversationId: string, usage: ChatUsage) {
    this.db
      .prepare(
        "UPDATE chat_conversations SET mode=?,agent_id=?,last_usage=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(
        usage.mode,
        usage.agentId ?? null,
        JSON.stringify(usage),
        conversationId,
      );
  }
  createRun(
    conversationId: string,
    agentId: string | undefined,
    modelId: string,
    maxSteps: number,
  ): string {
    const id = newEntityId();
    this.db
      .prepare(
        "INSERT INTO generation_runs(id,conversation_id,agent_id,model_id,status,max_steps) VALUES(?,?,?,?,'queued',?)",
      )
      .run(id, conversationId, agentId ?? null, modelId, maxSteps);
    return id;
  }
  addMessage(
    conversationId: string,
    runId: string | null,
    role: ChatMessage["role"],
    text: string,
    status: ChatMessage["status"],
    usage: ChatUsage,
  ): ChatMessage {
    const parts: ChatMessageContentPart[] = text
      ? [{ type: "text", text }]
      : [];
    return this.addMessageParts(
      conversationId,
      runId,
      role,
      parts,
      status,
      usage,
    );
  }
  addMessageParts(
    conversationId: string,
    runId: string | null,
    role: ChatMessage["role"],
    parts: ChatMessageContentPart[],
    status: ChatMessage["status"],
    usage: ChatUsage,
  ): ChatMessage {
    const id = newEntityId();
    this.db
      .prepare(
        "INSERT INTO chat_messages(id,conversation_id,run_id,role,status,content_json,last_usage) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        id,
        conversationId,
        runId,
        role,
        status,
        JSON.stringify(parts),
        JSON.stringify(usage),
      );
    return this.mapMessage(
      this.db
        .prepare("SELECT * FROM chat_messages WHERE id=?")
        .get(id) as MessageRow,
    );
  }
  messageAttachments(messageId: string) {
    return (
      this.db
        .prepare(
          `SELECT id,name,mime_type,size FROM chat_attachments
           WHERE message_id=? ORDER BY id`,
        )
        .all(messageId) as Array<{
        id: string;
        name: string;
        mime_type: string | null;
        size: number;
      }>
    ).map((row) => ({
      kind: "file" as const,
      id: String(row.id),
      uniqueId: null,
      fileName: row.name,
      mimeType: row.mime_type,
      size: row.size,
    }));
  }

  writeMessageParts(messageId: string, parts: ChatMessageContentPart[]) {
    this.db
      .prepare("UPDATE chat_messages SET content_json=? WHERE id=?")
      .run(JSON.stringify(parts), messageId);
  }

  journalMessages(conversationId: string): ChatMessage[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM chat_messages WHERE conversation_id=? ORDER BY id",
        )
        .all(conversationId) as MessageRow[]
    ).map((row) => mapMessage(row));
  }
  contextSegments(conversationId: string): ContextSegment[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM context_segments WHERE conversation_id=? ORDER BY from_message_id",
        )
        .all(conversationId) as SegmentRow[]
    ).map(mapSegment);
  }
  createContextSegment(input: {
    conversationId: string;
    fromMessageId: string;
    toMessageId: string;
    summary: string;
    modelId: string | null;
    messageCount: number;
    tokensBefore: number;
    tokensAfter: number;
    reason: ContextSegment["reason"];
  }): ContextSegment {
    const id = newEntityId();
    this.db
      .prepare(
        `INSERT INTO context_segments(id,conversation_id,from_message_id,to_message_id,summary,model_id,message_count,tokens_before,tokens_after,reason)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.conversationId,
        input.fromMessageId,
        input.toMessageId,
        input.summary,
        input.modelId,
        input.messageCount,
        input.tokensBefore,
        input.tokensAfter,
        input.reason,
      );
    return mapSegment(
      this.db
        .prepare("SELECT * FROM context_segments WHERE id=?")
        .get(id) as SegmentRow,
    );
  }
  markCompacted(messageIds: string[], segmentId: string) {
    if (!messageIds.length) return;
    const update = this.db.prepare(
      "UPDATE chat_messages SET compacted_into=? WHERE id=?",
    );
    this.db.transaction(() => {
      for (const id of messageIds) update.run(segmentId, id);
    })();
  }
  toolCallOutput(runId: string, providerCallId: string): unknown {
    const row = this.db
      .prepare(
        "SELECT output_json,error_message FROM generation_tool_calls WHERE run_id=? AND provider_call_id=?",
      )
      .get(runId, providerCallId) as
      | { output_json: string | null; error_message: string | null }
      | undefined;
    if (!row) return null;
    if (row.error_message) return { error: row.error_message };
    return row.output_json ? JSON.parse(row.output_json) : null;
  }
  addRunUsage(runId: string, usage: RunUsage) {
    this.db
      .prepare(
        `UPDATE generation_runs SET
           input_tokens=input_tokens+?,
           output_tokens=output_tokens+?,
           reasoning_tokens=reasoning_tokens+?,
           cached_input_tokens=cached_input_tokens+?,
           cost_usd=cost_usd+?
         WHERE id=?`,
      )
      .run(
        usage.inputTokens,
        usage.outputTokens,
        usage.reasoningTokens,
        usage.cachedInputTokens,
        usage.costUsd,
        runId,
      );
  }
  runUsage(runId: string): RunUsage {
    const row = this.db
      .prepare(
        "SELECT input_tokens,output_tokens,reasoning_tokens,cached_input_tokens,cost_usd FROM generation_runs WHERE id=?",
      )
      .get(runId) as
      | {
          input_tokens: number;
          output_tokens: number;
          reasoning_tokens: number;
          cached_input_tokens: number;
          cost_usd: number;
        }
      | undefined;
    return {
      inputTokens: row?.input_tokens ?? 0,
      outputTokens: row?.output_tokens ?? 0,
      reasoningTokens: row?.reasoning_tokens ?? 0,
      cachedInputTokens: row?.cached_input_tokens ?? 0,
      costUsd: row?.cost_usd ?? 0,
    };
  }
  replaceText(messageId: string, text: string) {
    this.db
      .prepare("UPDATE chat_messages SET content_json=? WHERE id=?")
      .run(JSON.stringify([{ type: "text", text }]), messageId);
  }
  setMessageStatus(id: string, status: ChatMessage["status"]) {
    this.db
      .prepare("UPDATE chat_messages SET status=? WHERE id=?")
      .run(status, id);
  }
  linkMessageToScenarioRun(messageId: string, executionRunId: string) {
    this.db
      .prepare("UPDATE chat_messages SET execution_run_id=? WHERE id=?")
      .run(executionRunId, messageId);
  }
  setRunStatus(id: string, status: RunStatus, error?: string) {
    this.db
      .prepare(
        "UPDATE generation_runs SET status=?, error_message=?, started_at=CASE WHEN ?='running' THEN CURRENT_TIMESTAMP ELSE started_at END, completed_at=CASE WHEN ? IN ('completed','failed','cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id=?",
      )
      .run(status, error ?? null, status, status, id);
  }
  addStep(
    runId: string,
    index: number,
    payload: unknown,
    finishReason?: string,
    usage?: RunUsage,
  ) {
    this.db
      .prepare(
        `INSERT INTO generation_run_steps(id,run_id,step_index,finish_reason,payload_json,input_tokens,output_tokens,reasoning_tokens)
         VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(run_id,step_index) DO UPDATE SET
         finish_reason=excluded.finish_reason,payload_json=excluded.payload_json,
         input_tokens=excluded.input_tokens,output_tokens=excluded.output_tokens,
         reasoning_tokens=excluded.reasoning_tokens`,
      )
      .run(
        newEntityId(),
        runId,
        index,
        finishReason ?? null,
        JSON.stringify(payload),
        usage?.inputTokens ?? 0,
        usage?.outputTokens ?? 0,
        usage?.reasoningTokens ?? 0,
      );
    this.db
      .prepare("UPDATE generation_runs SET current_step=? WHERE id=?")
      .run(index + 1, runId);
  }
  createToolCall(
    runId: string,
    providerCallId: string,
    toolId: string,
    risk: string,
    input: unknown,
    status: string,
  ): string {
    const row = this.db
      .prepare(
        "INSERT INTO generation_tool_calls(id,run_id,provider_call_id,tool_id,risk,status,input_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(run_id,provider_call_id) DO UPDATE SET status=excluded.status RETURNING id",
      )
      .get(
        newEntityId(),
        runId,
        providerCallId,
        toolId,
        risk,
        status,
        JSON.stringify(input),
      ) as { id: string };
    return row.id;
  }
  finishToolCall(id: string, status: string, output?: unknown, error?: string) {
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
  updateTitle(id: string, text: string) {
    this.db
      .prepare(
        "UPDATE chat_conversations SET title=CASE WHEN title='Новый диалог' THEN ? ELSE title END,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(text.slice(0, 60), id);
  }
  deleteConversation(id: string) {
    this.db.prepare("DELETE FROM chat_conversations WHERE id=?").run(id);
  }
  renameConversation(id: string, title: string) {
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
  truncateMessages(conversationId: string, fromMessageId: string) {
    const truncate = this.db.transaction(() => {
      const target = this.db
        .prepare(
          "SELECT id FROM chat_messages WHERE id=? AND conversation_id=?",
        )
        .get(fromMessageId, conversationId);
      if (!target) throw new Error("Сообщение не найдено");

      const suffix = this.db
        .prepare(
          "SELECT DISTINCT run_id,execution_run_id FROM chat_messages WHERE conversation_id=? AND id>=?",
        )
        .all(conversationId, fromMessageId) as Array<{
        run_id: string | null;
        execution_run_id: string | null;
      }>;
      const generationRunIds = suffix
        .map((row) => row.run_id)
        .filter((id): id is string => id !== null);
      const executionRunIds = suffix
        .map((row) => row.execution_run_id)
        .filter((id): id is string => id !== null);

      this.db
        .prepare("DELETE FROM chat_messages WHERE conversation_id=? AND id>=?")
        .run(conversationId, fromMessageId);
      const deleteByIds = (
        table: "generation_runs" | "execution_runs",
        ids: string[],
      ) => {
        if (!ids.length) return;
        const placeholders = ids.map(() => "?").join(",");
        this.db
          .prepare(`DELETE FROM ${table} WHERE id IN (${placeholders})`)
          .run(...ids);
      };
      deleteByIds("generation_runs", generationRunIds);
      deleteByIds("execution_runs", executionRunIds);
      this.db
        .prepare(
          "UPDATE chat_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .run(conversationId);
    });
    truncate();
  }
  listEnabledTextModels(): Array<{
    id: string;
    contextLength: number;
    maxCompletionTokens: number;
  }> {
    return (
      this.db
        .prepare(
          "SELECT m.id,m.details_json FROM text_provider_models m JOIN text_provider_configs p ON p.id=m.provider_id WHERE m.enabled=1 AND p.enabled=1 AND p.provider_type='text'",
        )
        .all() as Array<{ id: string; details_json: string }>
    ).map((row) => {
      const details = parseJsonDto(
        textProviderModelDetailsDtoSchema,
        row.details_json || "{}",
      );
      return {
        id: row.id,
        contextLength: details.contextLength ?? 0,
        maxCompletionTokens: details.maxCompletionTokens ?? 0,
      };
    });
  }
  recordModelSwitch(runId: string, change: ModelSwitch) {
    const history = this.modelSwitches(runId);
    this.db
      .prepare("UPDATE generation_runs SET model_switches_json=? WHERE id=?")
      .run(JSON.stringify([...history, change]), runId);
  }
  modelSwitches(runId: string): ModelSwitch[] {
    const row = this.db
      .prepare("SELECT model_switches_json FROM generation_runs WHERE id=?")
      .get(runId) as { model_switches_json: string } | undefined;
    if (!row) return [];
    return parseJsonDto(
      modelSwitchDtoSchema.array(),
      row.model_switches_json || "[]",
    );
  }
  resolveModel(id: string) {
    return this.db
      .prepare(
        "SELECT m.id,m.remote_id,m.details_json,p.kind,p.base_url,p.api_key_secret_id,p.generation_settings_json FROM text_provider_models m JOIN text_provider_configs p ON p.id=m.provider_id WHERE m.id=? AND m.enabled=1 AND p.enabled=1 AND p.provider_type='text'",
      )
      .get(id) as
      | {
          id: string;
          remote_id: string;
          kind: string;
          base_url: string;
          api_key_secret_id: string | null;
          details_json: string;
          generation_settings_json: string;
        }
      | undefined;
  }
  resolveAgent(id: string | undefined) {
    if (!id) return undefined;
    const row = this.db
      .prepare(
        "SELECT instructions,text_model_id,max_tool_calls,timeout_seconds,retrieval_limit,terminal_policy_json,directory_policy_json,memory_read,memory_write FROM automation_agents WHERE id=? AND status!='disabled'",
      )
      .get(id) as
      | {
          instructions: string;
          text_model_id: string | null;
          max_tool_calls: number;
          timeout_seconds: number;
          retrieval_limit: number;
          terminal_policy_json: string;
          directory_policy_json: string;
          memory_read: number;
          memory_write: number;
        }
      | undefined;
    if (!row) return undefined;
    const allowedToolIds = (
      this.db
        .prepare("SELECT tool_id FROM automation_agent_tools WHERE agent_id=?")
        .all(id) as Array<{ tool_id: string }>
    ).map((item) => item.tool_id);
    const allowedVectorStoreIds = (
      this.db
        .prepare(
          "SELECT vector_store_id FROM automation_agent_vector_stores WHERE agent_id=?",
        )
        .all(id) as Array<{ vector_store_id: string }>
    ).map((item) => item.vector_store_id);
    const allowedSkillIds = (
      this.db
        .prepare(
          "SELECT skill_id FROM automation_agent_skills WHERE agent_id=? ORDER BY skill_id",
        )
        .all(id) as Array<{ skill_id: string }>
    ).map((item) => item.skill_id);
    return {
      ...row,
      terminalPolicy: JSON.parse(row.terminal_policy_json),
      directoryPolicy: JSON.parse(row.directory_policy_json),
      memoryRead: Boolean(row.memory_read),
      memoryWrite: Boolean(row.memory_write),
      allowedToolIds,
      allowedVectorStoreIds,
      allowedSkillIds,
    };
  }
  private mapMessage(row: MessageRow): ChatMessage {
    const message = mapMessage(row);
    if (!row.run_id || row.role !== "assistant") return message;
    const run = this.db
      .prepare("SELECT error_message FROM generation_runs WHERE id=?")
      .get(row.run_id) as { error_message: string | null } | undefined;
    message.error = run?.error_message ?? null;
    const calls = this.db
      .prepare(
        "SELECT id,tool_id,status,input_json,output_json,error_message FROM generation_tool_calls WHERE run_id=? ORDER BY id",
      )
      .all(row.run_id) as Array<{
      id: string;
      tool_id: string;
      status: ChatToolCall["status"];
      input_json: string;
      output_json: string | null;
      error_message: string | null;
    }>;
    message.toolCalls = calls.map((call) => ({
      id: call.id,
      toolId: call.tool_id,
      status: call.status,
      input: JSON.parse(call.input_json),
      output: call.output_json ? JSON.parse(call.output_json) : null,
      error: call.error_message,
    }));
    return message;
  }
}
const mapConversation = (r: ConversationRow): ChatConversation => ({
  id: r.id,
  title: r.title,
  lastUsage: parseJsonDto(chatUsageDtoSchema, r.last_usage),
  updatedAt: r.updated_at,
});
const mapMessage = (r: MessageRow): ChatMessage => {
  const parts = parseJsonDto(chatMessageContentDtoSchema, r.content_json);
  return {
    id: r.id,
    conversationId: r.conversation_id,
    runId: r.run_id,
    scenarioRunId: r.execution_run_id ?? null,
    role: r.role,
    status: r.status,
    parts,
    text: parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(""),
    reasoning: parts
      .filter((p) => p.type === "reasoning")
      .map((p) => p.text)
      .join(""),
    error: null,
    toolCalls: [],
    lastUsage: parseJsonDto(chatUsageDtoSchema, r.last_usage),
    compactedInto: r.compacted_into ?? null,
    tokenCount: r.token_count ?? 0,
    createdAt: r.created_at,
  };
};
const mapSegment = (r: SegmentRow): ContextSegment => ({
  id: r.id,
  conversationId: r.conversation_id,
  fromMessageId: r.from_message_id,
  toMessageId: r.to_message_id,
  summary: r.summary,
  modelId: r.model_id,
  messageCount: r.message_count,
  tokensBefore: r.tokens_before,
  tokensAfter: r.tokens_after,
  reason: r.reason,
  createdAt: r.created_at,
});
