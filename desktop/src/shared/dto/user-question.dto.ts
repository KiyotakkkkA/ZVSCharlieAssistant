import { z } from "zod";

export const questionOptionDtoSchema = z.object({
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional(),
});

export const answerQuestionDtoSchema = z.object({
  questionId: z.int().positive(),
  answer: z.array(z.string().trim().min(1).max(2_000)).min(1).max(10),
});

export type AnswerQuestionInput = z.infer<typeof answerQuestionDtoSchema>;
export type QuestionOptionInput = z.infer<typeof questionOptionDtoSchema>;
