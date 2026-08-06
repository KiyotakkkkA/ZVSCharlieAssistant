import type Database from "better-sqlite3";
import type {
  TerminalPolicy,
} from "../../../shared/models/terminal";
import type { TerminalApprovalRequest } from "../../../shared/models/terminal";
import {
  parseJsonDto,
  stringArrayDtoSchema,
  type UpsertTerminalPolicyInput,
} from "../../../shared/dto";

interface PolicyRow {
  enabled: number;
  confirmation_mode: TerminalPolicy["confirmationMode"];
  max_concurrent_sessions: number;
  default_timeout_seconds: number;
  max_timeout_seconds: number;
  max_output_bytes: number;
  allow_network: number;
  allowed_commands_json: string;
  updated_at: string;
}

export class TerminalPolicyDataSource {
  constructor(private readonly database: Database.Database) {}

  get(): TerminalPolicy {
    const row = this.database
      .prepare("SELECT * FROM terminal_policy WHERE id=1")
      .get() as PolicyRow;
    return {
      enabled: Boolean(row.enabled),
      confirmationMode: row.confirmation_mode,
      maxConcurrentSessions: row.max_concurrent_sessions,
      defaultTimeoutSeconds: row.default_timeout_seconds,
      maxTimeoutSeconds: row.max_timeout_seconds,
      maxOutputBytes: row.max_output_bytes,
      allowNetwork: Boolean(row.allow_network),
      allowedCommands: parseJsonDto(
        stringArrayDtoSchema,
        row.allowed_commands_json,
      ),
      updatedAt: row.updated_at,
    };
  }

  upsert(input: UpsertTerminalPolicyInput): TerminalPolicy {
    if (!Number.isInteger(input.maxConcurrentSessions) || input.maxConcurrentSessions < 1 || input.maxConcurrentSessions > 16)
      throw new Error("Некорректный лимит параллельных сессий");
    if (!Number.isInteger(input.defaultTimeoutSeconds) || input.defaultTimeoutSeconds < 1 || input.defaultTimeoutSeconds > 3600)
      throw new Error("Некорректный таймаут по умолчанию");
    if (!Number.isInteger(input.maxTimeoutSeconds) || input.maxTimeoutSeconds < input.defaultTimeoutSeconds || input.maxTimeoutSeconds > 86400)
      throw new Error("Максимальный таймаут должен быть не меньше таймаута по умолчанию");
    const forbidden = new Set(["invoke-expression", "add-type", "new-object", "set-executionpolicy"]);
    const allowedCommands = [...new Set(input.allowedCommands.map((item) => item.trim()).filter(Boolean))];
    for (const command of allowedCommands)
      if (!/^[A-Za-z]+-[A-Za-z]+$/.test(command) || forbidden.has(command.toLowerCase()))
        throw new Error(`Команда ${command} не может быть добавлена в политику`);
    this.database
      .prepare(
        `UPDATE terminal_policy SET
          enabled=?, confirmation_mode=?, max_concurrent_sessions=?,
          default_timeout_seconds=?, max_timeout_seconds=?, max_output_bytes=?,
          allow_network=?, allowed_commands_json=?,
          updated_at=CURRENT_TIMESTAMP
         WHERE id=1`,
      )
      .run(
        Number(input.enabled),
        input.confirmationMode,
        input.maxConcurrentSessions,
        input.defaultTimeoutSeconds,
        input.maxTimeoutSeconds,
        input.maxOutputBytes,
        Number(input.allowNetwork),
        JSON.stringify(allowedCommands),
      );
    return this.get();
  }

  createPendingSession(input: {
    sessionId: string;
    approvalId: string;
    purpose: string;
    script: string;
    cwd: string;
    policy: unknown;
    risk: TerminalApprovalRequest["risk"];
    reasons: string[];
    payloadHash: string;
    expiresAt: string;
  }) {
    this.database.transaction(() => {
      this.database.prepare(
        `INSERT INTO command_sessions(
          id,purpose,script,cwd,status,policy_snapshot_json,risk,decision_reasons_json
        ) VALUES(?,?,?,?,?,?,?,?)`,
      ).run(input.sessionId, input.purpose, input.script, input.cwd, "pending_approval", JSON.stringify(input.policy), input.risk, JSON.stringify(input.reasons));
      this.database.prepare(
        `INSERT INTO command_approval_requests(id,command_session_id,payload_hash,expires_at)
         VALUES(?,?,?,?)`,
      ).run(input.approvalId, input.sessionId, input.payloadHash, input.expiresAt);
    })();
  }

  pendingApprovals(): TerminalApprovalRequest[] {
    return (this.database.prepare(
      `SELECT a.id,s.id session_id,s.purpose,s.script,s.cwd,s.risk,
              s.decision_reasons_json,a.expires_at
       FROM command_approval_requests a
       JOIN command_sessions s ON s.id=a.command_session_id
       WHERE a.status='pending' AND a.expires_at > CURRENT_TIMESTAMP
       ORDER BY a.created_at`,
    ).all() as Array<{ id: string; session_id: string; purpose: string; script: string; cwd: string; risk: TerminalApprovalRequest["risk"]; decision_reasons_json: string; expires_at: string }>).map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      purpose: row.purpose,
      script: row.script,
      cwd: row.cwd,
      risk: row.risk,
      reasons: parseJsonDto(stringArrayDtoSchema, row.decision_reasons_json),
      expiresAt: row.expires_at,
    }));
  }

  decideApproval(id: string, approved: boolean) {
    const result = this.database.prepare(
      `UPDATE command_approval_requests
       SET status=?,decided_at=CURRENT_TIMESTAMP
       WHERE id=? AND status='pending'`,
    ).run(approved ? "approved" : "rejected", id);
    if (!result.changes) throw new Error("Запрос подтверждения не найден или уже обработан");
  }

  setSessionStatus(id: string, status: string) {
    this.database.prepare(
      `UPDATE command_sessions SET status=?,
       started_at=CASE WHEN ?='running' THEN CURRENT_TIMESTAMP ELSE started_at END,
       completed_at=CASE WHEN ? IN ('completed','failed','cancelled','timed_out') THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id=?`,
    ).run(status, status, status, id);
  }

  recoverInterruptedSessions() {
    this.database.transaction(() => {
      this.database.prepare(
        "UPDATE command_approval_requests SET status='expired',decided_at=CURRENT_TIMESTAMP WHERE status='pending'",
      ).run();
      this.database.prepare(
        `UPDATE command_sessions SET status='cancelled',completed_at=CURRENT_TIMESTAMP,
         error_message='Приложение было перезапущено'
         WHERE status IN ('pending_approval','queued','running')`,
      ).run();
    })();
  }
}
