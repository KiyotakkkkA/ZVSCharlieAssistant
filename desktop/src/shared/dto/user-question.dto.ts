import { z } from "zod";
import { entityIdSchema } from "./ipc-dto";

export const answerQuestionDtoSchema = z.object({
  questionId: entityIdSchema,
  answer: z.array(z.string().trim().min(1).max(2_000)).min(1).max(10),
});

export type AnswerQuestionInput = z.infer<typeof answerQuestionDtoSchema>;
