import { z } from "zod";
import {
  automationStatusSchema,
  upsertMemoryPolicyDtoSchema,
  upsertTerminalPolicyDtoSchema,
} from "../../../shared/dto";

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
            version: z.literal(1),
            items: z
              .array(
                z
                  .object({
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
      })
      .strict(),
  })
  .strict()
  .superRefine((payload, context) => {
    const section = payload.sections.secretStorage;
    if (!Object.values(payload.sections).some(Boolean))
      context.addIssue({ code: "custom", message: "Файл не содержит данных" });
    if (!section) return;
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
  NonNullable<DataTransferPayload["sections"]["secretStorage"]>;
export type PortableSkill = NonNullable<
  DataTransferPayload["sections"]["skills"]
>["items"][number];
