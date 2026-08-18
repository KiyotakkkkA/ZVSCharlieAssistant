import { z } from "zod";
import { agentTerminalPolicyDtoSchema } from "./terminal.dto";
import { agentDirectoryPolicyDtoSchema } from "./directory-policy.dto";
import { jsonValueSchema } from "./ipc-dto";
import { scenarioGraphSchema } from "../scenario/graph";

export const automationStatusSchema = z.enum(["draft", "active", "disabled"]);
export const stringArrayDtoSchema = z.array(z.string());
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
  memoryRead: z.boolean(),
  memoryWrite: z.boolean(),
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
  graph: scenarioGraphSchema,
  toolSettings: z.array(automationScenarioToolSettingDtoSchema),
});
export const upsertAutomationToolSecretBindingDtoSchema = z.object({
  toolId: z.string(),
  key: z.string(),
  secretId: z.int().positive().nullable(),
});

export type AutomationStatus = z.infer<typeof automationStatusSchema>;
export type { ScenarioGraph as AutomationScenarioGraph } from "../scenario/graph";
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
