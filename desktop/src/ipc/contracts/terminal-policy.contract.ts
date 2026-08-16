import type {
  TerminalPolicy,
  TerminalApprovalRequest,
} from "../../shared/models/terminal";
import type { UpsertTerminalPolicyInput } from "../../shared/dto";

export type * from "../../shared/models/terminal";

export interface TerminalPolicyApi {
  get(): Promise<TerminalPolicy>;
  upsert(input: UpsertTerminalPolicyInput): Promise<TerminalPolicy>;
  recommended(): Promise<UpsertTerminalPolicyInput>;
  pendingApprovals(): Promise<TerminalApprovalRequest[]>;
  decideApproval(id: string, approved: boolean): Promise<void>;
  subscribeApprovals(listener: () => void): () => void;
}

export const TERMINAL_POLICY_IPC_CHANNELS = {
  get: "terminal-policy:get",
  upsert: "terminal-policy:upsert",
  recommended: "terminal-policy:recommended",
  pendingApprovals: "terminal-policy:pending-approvals",
  decideApproval: "terminal-policy:decide-approval",
  approvalsChanged: "terminal-policy:approvals-changed",
} as const;
