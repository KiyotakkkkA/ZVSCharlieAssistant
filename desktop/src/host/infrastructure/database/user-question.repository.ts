import type Database from "better-sqlite3";
import { parseJsonDto, stringArrayDtoSchema } from "../../../shared/dto";
import type {
  QuestionChannel,
  QuestionMode,
  QuestionOption,
  QuestionScope,
  UserQuestion,
} from "../../../shared/models/user-question";

interface QuestionRow {
  id: number;
  scope: QuestionScope;
  conversation_id: number | null;
  run_id: number | null;
  execution_id: number | null;
  node_id: string | null;
  node_run_id: number | null;
  mode: QuestionMode;
  header: string;
  question: string;
  options_json: string;
  multi_select: number;
  default_answer: string | null;
  status: UserQuestion["status"];
  answer_json: string | null;
  answered_by: string | null;
  answered_via: UserQuestion["answeredVia"];
  channel: QuestionChannel;
  integration_profile_id: number | null;
  recipient: string | null;
  correlation_id: string | null;
  expected_author: string | null;
  expires_at: string | null;
  created_at: string;
  answered_at: string | null;
}

const mapQuestion = (row: QuestionRow): UserQuestion => ({
  id: row.id,
  scope: row.scope,
  conversationId: row.conversation_id,
  runId: row.run_id,
  executionId: row.execution_id,
  nodeId: row.node_id,
  mode: row.mode,
  header: row.header,
  question: row.question,
  options: JSON.parse(row.options_json) as QuestionOption[],
  multiSelect: Boolean(row.multi_select),
  defaultAnswer: row.default_answer,
  status: row.status,
  answer: row.answer_json
    ? parseJsonDto(stringArrayDtoSchema, row.answer_json)
    : null,
  answeredVia: row.answered_via,
  answeredBy: row.answered_by,
  channel: row.channel,
  recipient: row.recipient,
  correlationId: row.correlation_id,
  expectedAuthor: row.expected_author,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  answeredAt: row.answered_at,
});

export interface CreateQuestionInput {
  scope: QuestionScope;
  conversationId?: number | null;
  runId?: number | null;
  executionId?: number | null;
  nodeId?: string | null;
  nodeRunId?: number | null;
  mode: QuestionMode;
  header: string;
  question: string;
  options: QuestionOption[];
  multiSelect: boolean;
  defaultAnswer?: string | null;
  channel: QuestionChannel;
  integrationProfileId?: number | null;
  recipient?: string | null;
  correlationId?: string | null;
  expectedAuthor?: string | null;
  expiresAt?: string | null;
}

export class UserQuestionRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: CreateQuestionInput): UserQuestion {
    const result = this.db
      .prepare(
        `INSERT INTO user_questions(
           scope,conversation_id,run_id,execution_id,node_id,node_run_id,mode,
           header,question,options_json,multi_select,default_answer,channel,
           integration_profile_id,recipient,correlation_id,expected_author,expires_at
         ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        input.scope,
        input.conversationId ?? null,
        input.runId ?? null,
        input.executionId ?? null,
        input.nodeId ?? null,
        input.nodeRunId ?? null,
        input.mode,
        input.header,
        input.question,
        JSON.stringify(input.options),
        Number(input.multiSelect),
        input.defaultAnswer ?? null,
        input.channel,
        input.integrationProfileId ?? null,
        input.recipient ?? null,
        input.correlationId ?? null,
        input.expectedAuthor ?? null,
        input.expiresAt ?? null,
      );
    return this.find(Number(result.lastInsertRowid))!;
  }

  find(id: number): UserQuestion | undefined {
    const row = this.db
      .prepare("SELECT * FROM user_questions WHERE id=?")
      .get(id) as QuestionRow | undefined;
    return row ? mapQuestion(row) : undefined;
  }

  forNode(executionId: number, nodeId: string): UserQuestion | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM user_questions
         WHERE execution_id=? AND node_id=? ORDER BY id DESC LIMIT 1`,
      )
      .get(executionId, nodeId) as QuestionRow | undefined;
    return row ? mapQuestion(row) : undefined;
  }

  pendingForConversation(conversationId: number): UserQuestion[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM user_questions
           WHERE conversation_id=? AND status='pending' ORDER BY id`,
        )
        .all(conversationId) as QuestionRow[]
    ).map(mapQuestion);
  }

  pendingAll(): UserQuestion[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM user_questions WHERE status='pending' ORDER BY id",
        )
        .all() as QuestionRow[]
    ).map(mapQuestion);
  }

  pendingByCorrelation(
    channel: QuestionChannel,
    correlationId: string,
  ): UserQuestion | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM user_questions
         WHERE channel=? AND correlation_id=? AND status='pending'
         ORDER BY id DESC LIMIT 1`,
      )
      .get(channel, correlationId) as QuestionRow | undefined;
    return row ? mapQuestion(row) : undefined;
  }

  pendingByRecipient(
    channel: QuestionChannel,
    recipient: string,
  ): UserQuestion | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM user_questions
         WHERE channel=? AND recipient=? AND status='pending'
         ORDER BY id DESC LIMIT 1`,
      )
      .get(channel, recipient) as QuestionRow | undefined;
    return row ? mapQuestion(row) : undefined;
  }

  setCorrelation(id: number, correlationId: string): void {
    this.db
      .prepare("UPDATE user_questions SET correlation_id=? WHERE id=?")
      .run(correlationId, id);
  }

  answer(
    id: number,
    answer: string[],
    via: NonNullable<UserQuestion["answeredVia"]>,
    answeredBy?: string | null,
  ): UserQuestion {
    const result = this.db
      .prepare(
        `UPDATE user_questions
         SET status='answered', answer_json=?, answered_via=?, answered_by=?,
             answered_at=CURRENT_TIMESTAMP
         WHERE id=? AND status='pending'`,
      )
      .run(JSON.stringify(answer), via, answeredBy ?? null, id);
    if (!result.changes)
      throw new Error("Вопрос уже закрыт или больше не ожидает ответа");
    return this.find(id)!;
  }

  close(id: number, status: "timed_out" | "cancelled"): void {
    this.db
      .prepare(
        `UPDATE user_questions SET status=?, answered_at=CURRENT_TIMESTAMP
         WHERE id=? AND status='pending'`,
      )
      .run(status, id);
  }

  dueForTimeout(nowIso: string): UserQuestion[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM user_questions
           WHERE status='pending' AND expires_at IS NOT NULL AND expires_at <= ?
           ORDER BY id`,
        )
        .all(nowIso) as QuestionRow[]
    ).map(mapQuestion);
  }

  cancelForExecution(executionId: number): void {
    this.db
      .prepare(
        `UPDATE user_questions SET status='cancelled', answered_at=CURRENT_TIMESTAMP
         WHERE execution_id=? AND status='pending'`,
      )
      .run(executionId);
  }

  forExecution(executionId: number): UserQuestion[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM user_questions WHERE execution_id=? ORDER BY id",
        )
        .all(executionId) as QuestionRow[]
    ).map(mapQuestion);
  }
}
