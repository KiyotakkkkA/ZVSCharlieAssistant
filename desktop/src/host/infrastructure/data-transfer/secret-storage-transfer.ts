import { z } from "zod";

const portableCategorySchema = z
  .object({
    portableId: z.uuid(),
    systemKey: z.enum(["api-keys", "personal-data"]).optional(),
    label: z.string().trim().min(1).max(200),
  })
  .strict();

const portableSecretSchema = z
  .object({
    portableId: z.uuid(),
    categoryPortableId: z.uuid(),
    label: z.string().trim().min(1).max(200),
    content: z.string().max(1_000_000),
  })
  .strict();

export const dataTransferPayloadSchema = z
  .object({
    sections: z
      .object({
        secretStorage: z
          .object({
            version: z.literal(1),
            categories: z.array(portableCategorySchema).max(10_000),
            secrets: z.array(portableSecretSchema).max(100_000),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((payload, context) => {
    const section = payload.sections.secretStorage;
    const categoryIds = new Set<string>();
    const secretIds = new Set<string>();
    for (const category of section.categories) {
      if (categoryIds.has(category.portableId))
        context.addIssue({
          code: "custom",
          message: `Повторяющийся ID категории: ${category.portableId}`,
        });
      categoryIds.add(category.portableId);
    }
    for (const secret of section.secrets) {
      if (secretIds.has(secret.portableId))
        context.addIssue({
          code: "custom",
          message: `Повторяющийся ID секрета: ${secret.portableId}`,
        });
      if (!categoryIds.has(secret.categoryPortableId))
        context.addIssue({
          code: "custom",
          message: `Категория секрета «${secret.label}» отсутствует`,
        });
      secretIds.add(secret.portableId);
    }
  });

export type DataTransferPayload = z.infer<typeof dataTransferPayloadSchema>;
export type PortableSecretStorage =
  DataTransferPayload["sections"]["secretStorage"];
