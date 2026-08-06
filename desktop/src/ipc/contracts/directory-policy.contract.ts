import type { DirectoryPolicy } from "../../shared/models/directory-policy";
import type { UpsertDirectoryPolicyInput } from "../../shared/dto";

export type * from "../../shared/models/directory-policy";

export interface DirectoryPolicyApi {
  get(): Promise<DirectoryPolicy>;
  upsert(input: UpsertDirectoryPolicyInput): Promise<DirectoryPolicy>;
  recommended(): Promise<UpsertDirectoryPolicyInput>;
}

export const DIRECTORY_POLICY_IPC_CHANNELS = {
  get: "directory-policy:get",
  upsert: "directory-policy:upsert",
  recommended: "directory-policy:recommended",
} as const;

