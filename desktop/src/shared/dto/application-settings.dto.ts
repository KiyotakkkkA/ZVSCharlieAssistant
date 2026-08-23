import { z } from "zod";

export const onboardingStateDtoSchema = z.object({
  version: z.number().int().nonnegative(),
  tourCompleted: z.boolean(),
  checklistDismissed: z.boolean(),
  completedSteps: z.array(z.string()),
  completedGuides: z.array(z.string()),
  firstLaunchAt: z.string().nullable(),
});

export const applicationSettingsDtoSchema = z.object({
  runInBackground: z.boolean(),
  onboarding: onboardingStateDtoSchema,
});

export const updateApplicationSettingsDtoSchema = z.object({
  runInBackground: z.boolean().optional(),
  onboarding: onboardingStateDtoSchema.partial().optional(),
});

export type OnboardingState = z.infer<typeof onboardingStateDtoSchema>;
export type ApplicationSettings = z.infer<typeof applicationSettingsDtoSchema>;
export type UpdateApplicationSettingsInput = z.infer<
  typeof updateApplicationSettingsDtoSchema
>;
