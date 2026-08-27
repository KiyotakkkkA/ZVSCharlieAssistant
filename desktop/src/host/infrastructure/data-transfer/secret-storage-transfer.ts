import { z } from "zod";
import {
  agentDirectoryPolicyDtoSchema,
  agentTerminalPolicyDtoSchema,
  automationStatusSchema,
  automationScenarioToolSettingDtoSchema,
  entityIdSchema,
  integrationKindSchema,
  jsonValueSchema,
  textProviderGenerationSettingsDtoSchema,
  textProviderKindSchema,
  textProviderModelDetailsDtoSchema,
  textProviderTypeSchema,
  upsertMemoryPolicyDtoSchema,
  upsertTerminalPolicyDtoSchema,
  vectorSearchModeSchema,
} from "../../../shared/dto";
import { scenarioGraphSchema } from "../../../shared/scenario/graph";
import { SYSTEM_SECRET_CATEGORY_IDS } from "../../../shared/entity-ids";

const portableCategorySchema = z
  .object({
    id: entityIdSchema,
    systemKey: z.enum(["api-keys", "personal-data"]).optional(),
    label: z.string().trim().min(1).max(200),
  })
  .strict();

const portableSecretSchema = z
  .object({
    id: entityIdSchema,
    categoryId: entityIdSchema,
    label: z.string().trim().min(1).max(200),
    content: z.string().max(1_000_000),
  })
  .strict();

const portableProviderModelSchema = z
  .object({
    id: entityIdSchema,
    remoteId: z.string().min(1).max(1_000),
    name: z.string().min(1).max(1_000),
    modifiedAt: z.string().max(200),
    size: z.number().nonnegative(),
    digest: z.string().max(1_000),
    details: textProviderModelDetailsDtoSchema,
    enabled: z.boolean(),
  })
  .strict();

const portableProviderSchema = z
  .object({
    id: entityIdSchema,
    kind: textProviderKindSchema,
    providerType: textProviderTypeSchema,
    name: z.string().trim().min(1).max(120),
    baseUrl: z.string().max(2_000),
    apiKeySecretId: entityIdSchema.nullable(),
    enabled: z.boolean(),
    generationSettings: textProviderGenerationSettingsDtoSchema,
    models: z.array(portableProviderModelSchema).max(10_000),
  })
  .strict();

const portableIntegrationSchema = z
  .object({
    id: entityIdSchema,
    kind: integrationKindSchema,
    name: z.string().trim().min(1).max(120),
    enabled: z.boolean(),
    config: z.record(z.string(), jsonValueSchema),
    secretBindings: z.record(z.string(), entityIdSchema),
  })
  .strict();

const portableVectorStoreSchema = z
  .object({
    id: entityIdSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1_000),
    embeddingModelId: entityIdSchema.nullable(),
    searchMode: vectorSearchModeSchema,
    chunkSizeTokens: z.int().min(100).max(4_096),
    chunkOverlapTokens: z.int().nonnegative(),
  })
  .strict()
  .refine((value) => value.chunkOverlapTokens <= value.chunkSizeTokens / 2, {
    message: "Перекрытие чанков превышает половину размера чанка",
  });

const portableAgentSchema = z
  .object({
    id: entityIdSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().max(500),
    instructions: z.string().trim().min(1).max(50_000),
    textModelId: entityIdSchema.nullable(),
    status: automationStatusSchema,
    allowedToolIds: z.array(z.string().min(1)).max(1_000),
    allowedVectorStoreIds: z.array(entityIdSchema).max(10_000),
    allowedSkillIds: z.array(entityIdSchema).max(10_000),
    memoryRead: z.boolean(),
    memoryWrite: z.boolean(),
    retrievalLimit: z.int().min(1).max(20),
    maxToolCalls: z.int().min(1).max(10_000),
    timeoutSeconds: z.int().min(1).max(86_400),
    terminalPolicy: agentTerminalPolicyDtoSchema,
    directoryPolicy: agentDirectoryPolicyDtoSchema,
  })
  .strict();

const portableScenarioSchema = z
  .object({
    id: entityIdSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1_000),
    status: automationStatusSchema,
    graph: scenarioGraphSchema,
    toolSettings: z.array(automationScenarioToolSettingDtoSchema).max(10_000),
  })
  .strict();

const portableToolSecretBindingSchema = z
  .object({
    toolId: z.string().min(1).max(200),
    key: z.string().min(1).max(200),
    secretId: entityIdSchema,
  })
  .strict();

export const dataTransferPayloadSchema = z
  .object({
    sections: z
      .object({
        secretStorage: z
          .object({
            version: z.literal(2),
            categories: z.array(portableCategorySchema).max(10_000),
            secrets: z.array(portableSecretSchema).max(100_000),
          })
          .strict()
          .optional(),
        terminalPolicy: z
          .object({
            version: z.literal(1),
            value: upsertTerminalPolicyDtoSchema,
          })
          .strict()
          .optional(),
        memoryPolicy: z
          .object({
            version: z.literal(1),
            value: upsertMemoryPolicyDtoSchema,
          })
          .strict()
          .optional(),
        skills: z
          .object({
            version: z.literal(2),
            items: z
              .array(
                z
                  .object({
                    id: entityIdSchema,
                    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
                    name: z.string().trim().min(1).max(120),
                    description: z.string().max(500),
                    status: automationStatusSchema,
                    version: z.string().trim().min(1).max(30),
                    author: z.string().max(120),
                    instructions: z.string().trim().min(1).max(50_000),
                    requiredToolIds: z.array(z.string()).max(100),
                  })
                  .strict(),
              )
              .max(10_000),
          })
          .strict()
          .optional(),
        providers: z
          .object({
            version: z.literal(1),
            items: z.array(portableProviderSchema).max(10_000),
          })
          .strict()
          .optional(),
        integrations: z
          .object({
            version: z.literal(1),
            items: z.array(portableIntegrationSchema).max(10_000),
          })
          .strict()
          .optional(),
        vectorStores: z
          .object({
            version: z.literal(1),
            items: z.array(portableVectorStoreSchema).max(10_000),
          })
          .strict()
          .optional(),
        agents: z
          .object({
            version: z.literal(1),
            items: z.array(portableAgentSchema).max(10_000),
            toolSecretBindings: z
              .array(portableToolSecretBindingSchema)
              .max(10_000),
          })
          .strict()
          .optional(),
        scenarios: z
          .object({
            version: z.literal(1),
            items: z.array(portableScenarioSchema).max(10_000),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((payload, context) => {
    const section = payload.sections.secretStorage;
    if (!Object.values(payload.sections).some(Boolean))
      context.addIssue({ code: "custom", message: "Файл не содержит данных" });
    if (!section) {
      validateUniqueIds(payload, context);
      return;
    }
    const categoryIds = new Set<string>();
    const secretIds = new Set<string>();
    for (const category of section.categories) {
      if (categoryIds.has(category.id))
        context.addIssue({
          code: "custom",
          message: `Повторяющийся ID категории: ${category.id}`,
        });
      categoryIds.add(category.id);
      if (
        category.systemKey &&
        category.id !==
          SYSTEM_SECRET_CATEGORY_IDS[
            category.systemKey === "api-keys" ? "apiKeys" : "personalData"
          ]
      )
        context.addIssue({
          code: "custom",
          message: `Системная категория ${category.systemKey} имеет недопустимый ID`,
        });
    }
    for (const secret of section.secrets) {
      if (secretIds.has(secret.id))
        context.addIssue({
          code: "custom",
          message: `Повторяющийся ID секрета: ${secret.id}`,
        });
      if (!categoryIds.has(secret.categoryId))
        context.addIssue({
          code: "custom",
          message: `Категория секрета «${secret.label}» отсутствует`,
        });
      secretIds.add(secret.id);
    }
    validateUniqueIds(payload, context);
  });

export type DataTransferPayload = z.infer<typeof dataTransferPayloadSchema>;
export type PortableSecretStorage = NonNullable<
  DataTransferPayload["sections"]["secretStorage"]
>;
export type PortableSkill = NonNullable<
  DataTransferPayload["sections"]["skills"]
>["items"][number];
export type PortableProvider = NonNullable<
  DataTransferPayload["sections"]["providers"]
>["items"][number];
export type PortableIntegration = NonNullable<
  DataTransferPayload["sections"]["integrations"]
>["items"][number];
export type PortableVectorStore = NonNullable<
  DataTransferPayload["sections"]["vectorStores"]
>["items"][number];
export type PortableAgent = NonNullable<
  DataTransferPayload["sections"]["agents"]
>["items"][number];
export type PortableScenario = NonNullable<
  DataTransferPayload["sections"]["scenarios"]
>["items"][number];

function validateUniqueIds(
  payload: DataTransferPayload,
  context: z.RefinementCtx,
): void {
  const collections: Array<[string, Array<{ id: string }>]> = [
    ["провайдера", payload.sections.providers?.items ?? []],
    [
      "модели",
      payload.sections.providers?.items.flatMap((item) => item.models) ?? [],
    ],
    ["навыка", payload.sections.skills?.items ?? []],
    ["интеграции", payload.sections.integrations?.items ?? []],
    ["векторного хранилища", payload.sections.vectorStores?.items ?? []],
    ["агента", payload.sections.agents?.items ?? []],
    ["сценария", payload.sections.scenarios?.items ?? []],
  ];
  for (const [label, items] of collections) {
    const ids = new Set<string>();
    for (const item of items) {
      if (ids.has(item.id))
        context.addIssue({
          code: "custom",
          message: `Повторяющийся ID ${label}: ${item.id}`,
        });
      ids.add(item.id);
    }
  }
  validateUniqueNaturalKeys(
    payload.sections.skills?.items ?? [],
    (item) => item.slug,
    "slug навыка",
    context,
  );
  for (const provider of payload.sections.providers?.items ?? [])
    validateUniqueNaturalKeys(
      provider.models,
      (model) => model.remoteId,
      `remote ID модели провайдера ${provider.id}`,
      context,
    );
}

function validateUniqueNaturalKeys<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  label: string,
  context: z.RefinementCtx,
): void {
  const keys = new Set<string>();
  for (const item of items) {
    const key = keyOf(item).toLocaleLowerCase();
    if (keys.has(key))
      context.addIssue({
        code: "custom",
        message: `Повторяющийся ${label}: ${keyOf(item)}`,
      });
    keys.add(key);
  }
}
