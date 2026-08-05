export type TerminalConfirmationMode = "always" | "risky" | "policy";
export type TerminalPermission =
  | "read"
  | "create"
  | "modify"
  | "delete"
  | "execute";

export interface TerminalDirectoryGrant {
  id?: number;
  path: string;
  recursive: boolean;
  permissions: TerminalPermission[];
}

export interface TerminalPolicy {
  enabled: boolean;
  confirmationMode: TerminalConfirmationMode;
  maxConcurrentSessions: number;
  defaultTimeoutSeconds: number;
  maxTimeoutSeconds: number;
  maxOutputBytes: number;
  allowNetwork: boolean;
  allowedCommands: string[];
  directoryGrants: TerminalDirectoryGrant[];
  updatedAt: string;
}

export interface AgentTerminalPolicy {
  enabled: boolean;
  confirmationMode: TerminalConfirmationMode;
  timeoutSeconds: number;
  allowedCommands: string[];
  directoryGrants: TerminalDirectoryGrant[];
}

export interface UpsertTerminalPolicyInput
  extends Omit<TerminalPolicy, "updatedAt"> {}

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
