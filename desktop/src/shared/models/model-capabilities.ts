import type { TextProviderModelDetails } from "../dto/text-provider.dto";

export const MODEL_CAPABILITY_KEYS = [
  "supportsTools",
  "supportsStructuredOutput",
  "supportsVision",
  "supportsReasoning",
] as const;

export type ModelCapabilityKey = (typeof MODEL_CAPABILITY_KEYS)[number];

export type ModelCapabilities = Record<ModelCapabilityKey, boolean | undefined>;

export const MODEL_CAPABILITY_LABELS: Record<ModelCapabilityKey, string> = {
  supportsTools: "Инструменты",
  supportsStructuredOutput: "Строгий формат",
  supportsVision: "Изображения",
  supportsReasoning: "Рассуждения",
};

export const MODEL_CAPABILITY_HINTS: Record<ModelCapabilityKey, string> = {
  supportsTools: "Модель умеет вызывать инструменты",
  supportsStructuredOutput: "Модель умеет отвечать строго по схеме",
  supportsVision: "Модель принимает изображения на вход",
  supportsReasoning: "Модель поддерживает расширенные рассуждения",
};

const TOOL_PARAMETERS = ["tools", "tool_choice", "function_calling"];
const STRUCTURED_PARAMETERS = ["structured_outputs", "response_format"];
const REASONING_PARAMETERS = ["reasoning", "include_reasoning", "thinking"];
const VISION_PARAMETERS = ["vision"];

export function resolveModelCapabilities(
  details: Partial<TextProviderModelDetails>,
): ModelCapabilities {
  const parameters = new Set(
    (details.supportedParameters ?? []).map((value) => value.toLowerCase()),
  );
  const modalities = new Set(
    (details.inputModalities ?? []).map((value) => value.toLowerCase()),
  );
  const known = parameters.size > 0;
  const has = (candidates: string[]) =>
    candidates.some((candidate) => parameters.has(candidate));

  return {
    supportsTools:
      details.supportsTools ?? (known ? has(TOOL_PARAMETERS) : undefined),
    supportsStructuredOutput:
      details.supportsStructuredOutput ??
      (known ? has(STRUCTURED_PARAMETERS) : undefined),
    supportsVision:
      details.supportsVision ??
      (modalities.size > 0
        ? modalities.has("image")
        : known
          ? has(VISION_PARAMETERS)
          : undefined),
    supportsReasoning:
      details.supportsReasoning ??
      (known ? has(REASONING_PARAMETERS) : undefined),
  };
}

export function pickCapabilityOverrides(
  details: Partial<TextProviderModelDetails>,
): Partial<ModelCapabilities> {
  const overrides: Partial<ModelCapabilities> = {};
  for (const key of MODEL_CAPABILITY_KEYS)
    if (details[key] !== undefined) overrides[key] = details[key];
  return overrides;
}
