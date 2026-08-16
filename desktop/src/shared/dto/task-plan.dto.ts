import { z } from "zod";

export const taskItemStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "skipped",
]);

export const taskItemInputDtoSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(1_000).default(""),
  status: taskItemStatusSchema.default("pending"),
});

export type TaskItemInput = z.infer<typeof taskItemInputDtoSchema>;
