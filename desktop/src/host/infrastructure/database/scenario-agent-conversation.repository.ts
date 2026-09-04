import type Database from "better-sqlite3";
import type { ChatMessageContentPart } from "../../../shared/dto";
import type { ChatMessage, ContextSegment } from "../../../shared/models/chat";
import { newEntityId } from "./entity-id";

export interface StoredConversation {
  id: string;
  activeModelId: string;
  nextIndex: number;
  messages: ChatMessage[];
  segments: ContextSegment[];
}

export class ScenarioAgentConversationRepository {
  constructor(private readonly db: Database.Database) {}

  find(executionId: string, nodeId: string): StoredConversation | undefined {
    const row = this.db
      .prepare(
        `SELECT id,active_model_id,next_index FROM scenario_agent_conversations
       WHERE execution_id=? AND node_id=?`,
      )
      .get(executionId, nodeId) as
      | { id: string; active_model_id: string; next_index: number }
      | undefined;
    if (!row) return undefined;

    const segmentRows = this.db
      .prepare(
        `SELECT id,from_message_id,to_message_id,summary,model_id,message_count,
              tokens_before,tokens_after,reason,created_at
       FROM scenario_agent_segments WHERE conversation_id=? ORDER BY id`,
      )
      .all(row.id) as Array<{
      id: string;
      from_message_id: string;
      to_message_id: string;
      summary: string;
      model_id: string;
      message_count: number;
      tokens_before: number;
      tokens_after: number;
      reason: ContextSegment["reason"];
      created_at: string;
    }>;
    const segments: ContextSegment[] = segmentRows.map((segment) => ({
      id: segment.id,
      conversationId: row.id,
      fromMessageId: segment.from_message_id,
      toMessageId: segment.to_message_id,
      summary: segment.summary,
      modelId: segment.model_id,
      messageCount: segment.message_count,
      tokensBefore: segment.tokens_before,
      tokensAfter: segment.tokens_after,
      reason: segment.reason,
      createdAt: segment.created_at,
    }));

    const messageRows = this.db
      .prepare(
        `SELECT id,role,parts_json,compacted_into,created_at
       FROM scenario_agent_messages WHERE conversation_id=? ORDER BY step_index`,
      )
      .all(row.id) as Array<{
      id: string;
      role: "user" | "assistant";
      parts_json: string;
      compacted_into: string | null;
      created_at: string;
    }>;
    const messages: ChatMessage[] = messageRows.map((message) => {
      const parts = JSON.parse(message.parts_json) as ChatMessageContentPart[];
      return {
        id: message.id,
        conversationId: row.id,
        runId: null,
        scenarioRunId: executionId,
        role: message.role,
        status: "completed",
        parts,
        text: parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(""),
        reasoning: "",
        error: null,
        toolCalls: [],
        lastUsage: { mode: "agent" },
        compactedInto: message.compacted_into,
        tokenCount: 0,
        createdAt: message.created_at,
      };
    });

    return {
      id: row.id,
      activeModelId: row.active_model_id,
      nextIndex: row.next_index,
      messages,
      segments,
    };
  }

  create(executionId: string, nodeId: string, activeModelId: string): string {
    const id = newEntityId();
    this.db
      .prepare(
        `INSERT INTO scenario_agent_conversations(id,execution_id,node_id,active_model_id)
       VALUES(?,?,?,?)`,
      )
      .run(id, executionId, nodeId, activeModelId);
    return id;
  }

  appendMessage(conversationId: string, message: ChatMessage): void {
    this.db.transaction(() => {
      const stepIndex = (
        this.db
          .prepare(
            `SELECT COALESCE(MAX(step_index),-1)+1 AS next FROM scenario_agent_messages WHERE conversation_id=?`,
          )
          .get(conversationId) as { next: number }
      ).next;
      this.db
        .prepare(
          `INSERT INTO scenario_agent_messages(id,conversation_id,step_index,role,parts_json,compacted_into)
         VALUES(?,?,?,?,?,?)`,
        )
        .run(
          message.id,
          conversationId,
          stepIndex,
          message.role,
          JSON.stringify(message.parts),
          message.compactedInto,
        );
      this.db
        .prepare(
          `UPDATE scenario_agent_conversations SET next_index=next_index+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        )
        .run(conversationId);
    })();
  }

  persistCompaction(
    conversationId: string,
    segment: ContextSegment,
    compactedMessageIds: string[],
  ): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO scenario_agent_segments(
          id,conversation_id,from_message_id,to_message_id,summary,model_id,
          message_count,tokens_before,tokens_after,reason
        ) VALUES(?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          segment.id,
          conversationId,
          segment.fromMessageId,
          segment.toMessageId,
          segment.summary,
          segment.modelId,
          segment.messageCount,
          segment.tokensBefore,
          segment.tokensAfter,
          segment.reason,
        );
      if (compactedMessageIds.length) {
        const placeholders = compactedMessageIds.map(() => "?").join(",");
        this.db
          .prepare(
            `UPDATE scenario_agent_messages SET compacted_into=? WHERE conversation_id=? AND id IN (${placeholders})`,
          )
          .run(segment.id, conversationId, ...compactedMessageIds);
      }
      this.db
        .prepare(
          `UPDATE scenario_agent_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        )
        .run(conversationId);
    })();
  }

  setActiveModel(conversationId: string, modelId: string): void {
    this.db
      .prepare(
        `UPDATE scenario_agent_conversations SET active_model_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      )
      .run(modelId, conversationId);
  }

  markCompleted(conversationId: string): void {
    this.db
      .prepare(
        `UPDATE scenario_agent_conversations SET status='completed',updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      )
      .run(conversationId);
  }

  markFailed(conversationId: string): void {
    this.db
      .prepare(
        `UPDATE scenario_agent_conversations SET status='failed',updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      )
      .run(conversationId);
  }
}
