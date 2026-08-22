import { z } from "zod";
import { entityIdSchema } from "./ipc-dto";

export const directoryPermissionSchema = z.enum([
  "read",
  "create",
  "modify",
  "delete",
  "execute",
]);

export const directoryGrantDtoSchema = z.object({
  id: entityIdSchema.optional(),
  path: z.string(),
  recursive: z.boolean(),
  permissions: z.array(directoryPermissionSchema),
});

export const agentDirectoryPolicyDtoSchema = z.object({
  grants: z.array(directoryGrantDtoSchema),
});

export const upsertDirectoryPolicyDtoSchema = z.object({
  grants: z.array(directoryGrantDtoSchema),
});

export type DirectoryPermission = z.infer<typeof directoryPermissionSchema>;
export type DirectoryGrant = z.infer<typeof directoryGrantDtoSchema>;
export type AgentDirectoryPolicy = z.infer<
  typeof agentDirectoryPolicyDtoSchema
>;
export type UpsertDirectoryPolicyInput = z.infer<
  typeof upsertDirectoryPolicyDtoSchema
>;
