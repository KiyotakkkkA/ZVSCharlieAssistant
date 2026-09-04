export const SYSTEM_SECRET_CATEGORY_IDS = {
  apiKeys: "00000000-0000-7000-8000-000000000001",
  personalData: "00000000-0000-7000-8000-000000000002",
} as const;

export const GLOBAL_ENTITY_IDS = {
  terminalPolicy: "00000000-0000-7000-8000-000000000101",
  directoryPolicy: "00000000-0000-7000-8000-000000000102",
  memoryPolicy: "00000000-0000-7000-8000-000000000103",
  userProfile: "00000000-0000-7000-8000-000000000104",
} as const;

export const BUILTIN_EMBEDDING_MODEL_IDS = {
  bgeM3: "00000000-0000-7000-8000-000000000301",
} as const;

export function isBuiltinEmbeddingModelId(modelId: string): boolean {
  return Object.values(BUILTIN_EMBEDDING_MODEL_IDS).some(
    (candidate) => candidate === modelId,
  );
}

export const SYSTEM_SKILL_IDS = {
  reportDocxGost: "00000000-0000-7000-8000-000000000201",
  managedPowerShell: "00000000-0000-7000-8000-000000000202",
  createAgent: "00000000-0000-7000-8000-000000000203",
  createSkill: "00000000-0000-7000-8000-000000000204",
  reportHtml: "00000000-0000-7000-8000-000000000205",
  scenarioCreation: "00000000-0000-7000-8000-000000000206",
} as const;
