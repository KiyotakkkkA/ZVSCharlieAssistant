import { z } from "zod";

const passwordSchema = z.string().max(256);
const exportPasswordSchema = passwordSchema.min(8, {
  message: "Пароль должен содержать не менее 8 символов",
});

export const dataTransferEntitySchema = z.enum([
  "secretCategories",
  "secrets",
  "terminalPolicy",
  "memoryPolicy",
  "skills",
  "providers",
  "integrations",
  "vectorStores",
  "agents",
  "scenarios",
]);

export const exportDataDtoSchema = z
  .object({
    password: exportPasswordSchema,
    entities: z.array(dataTransferEntitySchema).min(1),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.entities.includes("secrets") &&
      !input.entities.includes("secretCategories")
    )
      context.addIssue({
        code: "custom",
        path: ["entities"],
        message: "Для экспорта секретов необходимо экспортировать категории",
      });
  });

export const prepareImportDtoSchema = z.object({
  password: passwordSchema,
});

export const commitImportDtoSchema = z.object({
  sessionId: z.uuid(),
  conflictPolicy: z.enum(["skip", "overwrite"]),
});

export type ExportDataInput = z.infer<typeof exportDataDtoSchema>;
export type DataTransferEntity = z.infer<typeof dataTransferEntitySchema>;
export type PrepareImportInput = z.infer<typeof prepareImportDtoSchema>;
export type CommitImportInput = z.infer<typeof commitImportDtoSchema>;

const DATA_TRANSFER_DEPENDENCIES: Record<
  DataTransferEntity,
  readonly DataTransferEntity[]
> = {
  secretCategories: [],
  secrets: ["secretCategories"],
  terminalPolicy: [],
  memoryPolicy: [],
  skills: [],
  providers: ["secrets", "secretCategories"],
  integrations: ["secrets", "secretCategories"],
  vectorStores: ["providers", "secrets", "secretCategories"],
  agents: [
    "vectorStores",
    "providers",
    "skills",
    "secrets",
    "secretCategories",
  ],
  scenarios: [
    "agents",
    "integrations",
    "vectorStores",
    "providers",
    "skills",
    "secrets",
    "secretCategories",
  ],
};

export function resolveDataTransferEntities(
  selected: readonly DataTransferEntity[],
): DataTransferEntity[] {
  const resolved = new Set<DataTransferEntity>(selected);
  const pending = [...selected];
  while (pending.length) {
    const entity = pending.pop()!;
    for (const dependency of DATA_TRANSFER_DEPENDENCIES[entity]) {
      if (resolved.has(dependency)) continue;
      resolved.add(dependency);
      pending.push(dependency);
    }
  }
  return dataTransferEntitySchema.options.filter((entity) =>
    resolved.has(entity),
  );
}

export function dataTransferRequiredBy(
  selected: readonly DataTransferEntity[],
  candidate: DataTransferEntity,
): DataTransferEntity[] {
  return selected.filter((entity) =>
    resolveDataTransferEntities([entity]).includes(candidate),
  );
}
