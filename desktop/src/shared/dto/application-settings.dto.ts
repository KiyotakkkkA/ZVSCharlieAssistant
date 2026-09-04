import { z } from "zod";

export const onboardingStateDtoSchema = z.object({
  version: z.number().int().nonnegative(),
  tourCompleted: z.boolean(),
  completedGuides: z.array(z.string()),
  firstLaunchAt: z.string().nullable(),
});

export const notificationPolicyDtoSchema = z.object({
  enabled: z.boolean(),
  chatGenerationCompleted: z.boolean(),
  agentQuestionAsked: z.boolean(),
  scenarioStarted: z.boolean(),
  scenarioCompleted: z.boolean(),
  vectorizationCompleted: z.boolean(),
  downloadCompleted: z.boolean(),
});

export const ocrProviderPreferenceSchema = z.enum([
  "auto",
  "cuda",
  "directml",
  "cpu",
]);

export const indexingPolicyDtoSchema = z.object({
  provider: ocrProviderPreferenceSchema,
});

export const applicationSettingsDtoSchema = z.object({
  runInBackground: z.boolean(),
  launchAtLogin: z.boolean(),
  notifications: notificationPolicyDtoSchema,
  onboarding: onboardingStateDtoSchema,
  indexing: indexingPolicyDtoSchema,
});

export const updateApplicationSettingsDtoSchema = z.object({
  runInBackground: z.boolean().optional(),
  launchAtLogin: z.boolean().optional(),
  notifications: notificationPolicyDtoSchema.partial().optional(),
  onboarding: onboardingStateDtoSchema.partial().optional(),
  indexing: indexingPolicyDtoSchema.partial().optional(),
});

export type OnboardingState = z.infer<typeof onboardingStateDtoSchema>;
export type NotificationPolicy = z.infer<typeof notificationPolicyDtoSchema>;
export type IndexingPolicy = z.infer<typeof indexingPolicyDtoSchema>;
export type OcrProviderPreference = z.infer<typeof ocrProviderPreferenceSchema>;
export type ApplicationSettings = z.infer<typeof applicationSettingsDtoSchema>;
export type UpdateApplicationSettingsInput = z.infer<
  typeof updateApplicationSettingsDtoSchema
>;
