import { z } from "zod";

const passwordSchema = z.string().max(256);

export const exportDataDtoSchema = z
  .object({
    password: passwordSchema,
    encryption: z.enum(["password", "none"]),
    entities: z.array(z.enum(["secretCategories", "secrets"])).min(1),
  })
  .superRefine((input, context) => {
    if (input.encryption === "password" && input.password.length < 8)
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Пароль должен содержать не менее 8 символов",
      });
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
export type PrepareImportInput = z.infer<typeof prepareImportDtoSchema>;
export type CommitImportInput = z.infer<typeof commitImportDtoSchema>;
