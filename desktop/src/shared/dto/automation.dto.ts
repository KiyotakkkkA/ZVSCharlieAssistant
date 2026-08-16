import { z } from "zod";
import { agentTerminalPolicyDtoSchema } from "./terminal.dto";
import { agentDirectoryPolicyDtoSchema } from "./directory-policy.dto";
import { jsonValueSchema } from "./ipc-dto";

export const automationStatusSchema = z.enum(["draft", "active", "disabled"]);
export const stringArrayDtoSchema = z.array(z.string());
export const scenarioNodeKindSchema = z.enum([
  "trigger",
  "orchestrator",
  "agent",
  "knowledge_store",
  "download_files",
  "read_files",
  "condition",
  "approval",
  "output",
]);
export const scenarioEdgeKindSchema = z.enum([
  "text",
  "worker",
  "knowledge",
  "files",
]);
export const scenarioMisfirePolicySchema = z.enum([
  "skip",
  "run_once",
  "catch_up",
]);
export const scenarioTriggerConfigDtoSchema = z.object({
  manual: z.object({
    chatEnabled: z.boolean(),
    editorEnabled: z.boolean(),
  }),
  automatic: z.array(
    z.discriminatedUnion("kind", [
      z.object({
        id: z.string(),
        kind: z.literal("telegram"),
        enabled: z.boolean(),
        integrationProfileId: z.int().positive(),
        allowedChatIds: z.array(z.string()),
        command: z.string(),
        includeAttachments: z.boolean(),
      }),
      z.object({
        id: z.string(),
        kind: z.literal("email"),
        enabled: z.boolean(),
        integrationProfileId: z.int().positive(),
        mailbox: z.string(),
        from: z.string(),
        subjectContains: z.string(),
        unreadOnly: z.boolean(),
        includeAttachments: z.boolean(),
      }),
      z.object({
        id: z.string(),
        kind: z.literal("interval"),
        enabled: z.boolean(),
        intervalSeconds: z.int().min(60),
        timezone: z.string(),
        misfirePolicy: scenarioMisfirePolicySchema,
        preventOverlap: z.boolean(),
      }),
    ]),
  ),
});
export const scenarioResponseChannelDtoSchema = z.object({
  channel: z.enum(["telegram", "email"]),
  enabled: z.boolean(),
  mode: z.enum(["reply_to_trigger", "explicit_recipient"]),
  integrationProfileId: z.int().positive().nullable(),
  recipient: z.string().trim().max(320),
});
export const scenarioResponseConfigDtoSchema = z.object({
  channels: z.array(scenarioResponseChannelDtoSchema),
});
export const automationScenarioNodeDtoSchema = z.object({
  id: z.string(),
  kind: scenarioNodeKindSchema,
  title: z.string(),
  description: z.string(),
  x: z.number(),
  y: z.number(),
  config: z.record(z.string(), jsonValueSchema).optional(),
});
export const automationScenarioEdgeDtoSchema = z.object({
  id: z.string(),
  kind: scenarioEdgeKindSchema,
  source: z.string(),
  target: z.string(),
  sourcePort: z.string().optional(),
  targetPort: z.string().optional(),
  condition: z.record(z.string(), jsonValueSchema).optional(),
});
export const automationScenarioGraphDtoSchema = z.object({
  nodes: z.array(automationScenarioNodeDtoSchema),
  edges: z.array(automationScenarioEdgeDtoSchema),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .optional(),
});
export const upsertAutomationAgentDtoSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  textModelId: z.int().positive(),
  status: automationStatusSchema,
  allowedToolIds: z.array(z.string()),
  allowedVectorStoreIds: z.array(z.int().positive()),
  allowedSkillIds: z.array(z.int().positive()),
  retrievalLimit: z.int().positive(),
  maxToolCalls: z.int().positive(),
  timeoutSeconds: z.int().positive(),
  terminalPolicy: agentTerminalPolicyDtoSchema,
  directoryPolicy: agentDirectoryPolicyDtoSchema,
});
export const upsertAutomationSkillDtoSchema = z.object({
  id: z.int().positive().optional(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  status: automationStatusSchema,
  version: z.string(),
  author: z.string(),
  instructions: z.string(),
  requiredToolIds: z.array(z.string()),
});
export const automationScenarioToolSettingDtoSchema = z.object({
  toolId: z.string(),
  settings: z.record(z.string(), jsonValueSchema),
});
export const upsertAutomationScenarioDtoSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string(),
  status: automationStatusSchema,
  graph: automationScenarioGraphDtoSchema,
  toolSettings: z.array(automationScenarioToolSettingDtoSchema),
});
export const upsertAutomationToolSecretBindingDtoSchema = z.object({
  toolId: z.string(),
  key: z.string(),
  secretId: z.int().positive().nullable(),
});

export type AutomationStatus = z.infer<typeof automationStatusSchema>;
export type AutomationScenarioNode = z.infer<
  typeof automationScenarioNodeDtoSchema
>;
export type AutomationScenarioEdge = z.infer<
  typeof automationScenarioEdgeDtoSchema
>;
export type AutomationScenarioGraph = z.infer<
  typeof automationScenarioGraphDtoSchema
>;
export type ScenarioTriggerConfig = z.infer<
  typeof scenarioTriggerConfigDtoSchema
>;
export type ScenarioResponseChannel = z.infer<
  typeof scenarioResponseChannelDtoSchema
>;
export type ScenarioResponseConfig = z.infer<
  typeof scenarioResponseConfigDtoSchema
>;
export type AutomationScenarioToolSetting = z.infer<
  typeof automationScenarioToolSettingDtoSchema
>;
export type UpsertAutomationAgentInput = z.infer<
  typeof upsertAutomationAgentDtoSchema
>;
export type UpsertAutomationSkillInput = z.infer<
  typeof upsertAutomationSkillDtoSchema
>;
export type UpsertAutomationScenarioInput = z.infer<
  typeof upsertAutomationScenarioDtoSchema
>;
export type UpsertAutomationToolSecretBindingInput = z.infer<
  typeof upsertAutomationToolSecretBindingDtoSchema
>;
