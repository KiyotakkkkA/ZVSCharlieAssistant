import type { TerminalConfirmationMode } from "../dto/terminal.dto";

export interface TerminalPolicy {
  enabled: boolean;
  confirmationMode: TerminalConfirmationMode;
  maxConcurrentSessions: number;
  defaultTimeoutSeconds: number;
  maxTimeoutSeconds: number;
  maxOutputBytes: number;
  allowNetwork: boolean;
  allowedCommands: string[];
  updatedAt: string;
}

export type CommandSessionStatus =
  | "pending_approval"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface TerminalApprovalRequest {
  id: string;
  sessionId: string;
  purpose: string;
  script: string;
  cwd: string;
  risk: "low" | "medium" | "high" | "critical";
  reasons: string[];
  expiresAt: string;
}
