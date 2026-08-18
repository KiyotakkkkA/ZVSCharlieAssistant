import { z } from "zod";

export const answerQuestionDtoSchema = z.object({
  questionId: z.int().positive(),
  answer: z.array(z.string().trim().min(1).max(2_000)).min(1).max(10),
});

export type AnswerQuestionInput = z.infer<typeof answerQuestionDtoSchema>;
