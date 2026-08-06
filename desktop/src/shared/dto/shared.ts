import z from "zod";

export const providedEntityStatusSchema = z.enum([
  "unchecked",
  "connected",
  "error",
]);

export type ProvidedEntityStatus = z.infer<typeof providedEntityStatusSchema>;
