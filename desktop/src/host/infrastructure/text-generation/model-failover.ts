import type { ModelSwitch, ModelSwitchReason } from "../../../shared/dto";
import type { ProviderRegistry } from "./provider.registry";

export interface ModelDirectory {
  listEnabledTextModels(): Array<{
    id: string;
    kind: string;
    contextLength: number;
    maxCompletionTokens: number;
  }>;
  recordModelSwitch(runId: string, change: ModelSwitch): void;
}

export type FailureKind =
  | "transient"
  | "rate_limit"
  | "auth"
  | "context_overflow"
  | "output_limit"
  | "moderation"
  | "fatal";

export type FailoverDecision =
  | { kind: "retry"; delayMs: number }
  | { kind: "compact" }
  | {
      kind: "switch";
      modelId: string;
      reason: ModelSwitchReason;
      detail: string;
      required?: string[];
    }
  | { kind: "fail"; message?: string };

export interface ModelRequirements {
  tools?: boolean;
  structuredOutput?: boolean;
  vision?: boolean;
}

export interface FailoverState {
  activeModelId: string;
  attempt: number;
  compacted: boolean;
  requires?: ModelRequirements;
}

const REQUIREMENT_LABELS: Record<keyof ModelRequirements, string> = {
  tools: "вызов инструментов",
  structuredOutput: "ответ строго по схеме",
  vision: "работу с изображениями",
};

const REQUIREMENT_CAPABILITIES = {
  tools: "supportsTools",
  structuredOutput: "supportsStructuredOutput",
  vision: "supportsVision",
} as const;

export function requiredList(
  requires: ModelRequirements | undefined,
): string[] {
  if (!requires) return [];
  return (Object.keys(REQUIREMENT_LABELS) as Array<keyof ModelRequirements>)
    .filter((key) => requires[key] === true)
    .map((key) => key);
}

export function describeRequirements(
  requires: ModelRequirements | undefined,
): string {
  const names = (
    Object.keys(REQUIREMENT_LABELS) as Array<keyof ModelRequirements>
  )
    .filter((key) => requires?.[key] === true)
    .map((key) => REQUIREMENT_LABELS[key]);
  if (!names.length) return "";
  return `Ни одна из доступных моделей не поддерживает ${names.join(" и ")}. Включите подходящую модель в настройках провайдеров или отметьте её возможности вручную на карточке модели.`;
}

const RETRIES_PER_MODEL = 2;
const BASE_BACKOFF_MS = 500;
const DEGRADE_COOLDOWN_MS = 300_000;

export class ModelFailover {
  private readonly degradedUntil = new Map<string, number>();

  constructor(
    private readonly data: ModelDirectory,
    private readonly providers: ProviderRegistry,
  ) {}

  chain(primaryModelId: string, requires?: ModelRequirements): string[] {
    const now = Date.now();
    const others = this.data
      .listEnabledTextModels()
      .filter((model) => model.id !== primaryModelId)
      .filter((model) => (this.degradedUntil.get(model.id) ?? 0) <= now)
      .filter((model) => this.satisfies(model.id, requires))
      .sort(
        (left, right) => this.rank(right, requires) - this.rank(left, requires),
      )
      .map((model) => model.id);
    return [primaryModelId, ...others];
  }

  private capabilitiesOf(modelId: string) {
    try {
      return this.providers.modelInfo(modelId);
    } catch {
      return undefined;
    }
  }

  private satisfies(
    modelId: string,
    requires: ModelRequirements | undefined,
  ): boolean {
    if (!requires) return true;
    const info = this.capabilitiesOf(modelId);
    if (!info) return true;
    for (const [key, capability] of Object.entries(REQUIREMENT_CAPABILITIES)) {
      if (requires[key as keyof ModelRequirements] !== true) continue;
      if (info[capability] === false) return false;
    }
    return true;
  }

  private certainty(
    modelId: string,
    requires: ModelRequirements | undefined,
  ): number {
    if (!requires) return 0;
    const info = this.capabilitiesOf(modelId);
    if (!info) return 0;
    let known = 0;
    for (const [key, capability] of Object.entries(REQUIREMENT_CAPABILITIES)) {
      if (requires[key as keyof ModelRequirements] !== true) continue;
      if (info[capability] === true) known += 1;
    }
    return known;
  }

  private rank(
    model: { id: string; contextLength: number },
    requires: ModelRequirements | undefined,
  ): number {
    return this.certainty(model.id, requires) * 1e12 + model.contextLength;
  }

  classify(error: unknown): FailureKind {
    const status = statusOf(error);
    const text = messageOf(error).toLowerCase();

    if (status === 401 || status === 403) return "auth";
    if (status === 429) return "rate_limit";
    if (text.includes("rate limit") || text.includes("quota"))
      return "rate_limit";
    if (
      text.includes("context length") ||
      text.includes("context_length") ||
      text.includes("context window") ||
      text.includes("too many tokens") ||
      text.includes("maximum context") ||
      text.includes("prompt is too long") ||
      text.includes("input is too long") ||
      text.includes("input length") ||
      text.includes("num_ctx")
    )
      return "context_overflow";
    if (
      text.includes("max output tokens") ||
      text.includes("maximum output tokens") ||
      text.includes("max completion tokens")
    )
      return "output_limit";
    if (text.includes("moderation") || text.includes("content policy"))
      return "moderation";
    if (status !== undefined && status >= 500) return "transient";
    if (
      text.includes("timeout") ||
      text.includes("econnreset") ||
      text.includes("econnrefused") ||
      text.includes("etimedout") ||
      text.includes("socket hang up") ||
      text.includes("fetch failed") ||
      text.includes("network")
    )
      return "transient";
    return "fatal";
  }

  decide(error: unknown, state: FailoverState): FailoverDecision {
    const kind = this.classify(error);
    const detail = messageOf(error).slice(0, 300);
    const required = requiredList(state.requires);

    if (kind === "moderation" || kind === "fatal") return { kind: "fail" };

    if (kind === "context_overflow") {
      if (!state.compacted) return { kind: "compact" };
      const wider = this.widerModel(state.activeModelId, state.requires);
      return wider
        ? {
            kind: "switch",
            modelId: wider,
            reason: "context_overflow",
            detail,
            required,
          }
        : this.exhausted(state.requires);
    }

    if (kind === "output_limit") {
      const wider = this.widerOutputModel(state.activeModelId, state.requires);
      return wider
        ? {
            kind: "switch",
            modelId: wider,
            reason: "output_limit",
            detail,
            required,
          }
        : this.exhausted(state.requires);
    }

    if (kind === "transient" && state.attempt < RETRIES_PER_MODEL)
      return {
        kind: "retry",
        delayMs: BASE_BACKOFF_MS * 2 ** state.attempt,
      };

    this.markDegraded(state.activeModelId);
    const next = this.nextHealthy(state.activeModelId, state.requires);
    if (!next) return this.exhausted(state.requires);
    return {
      kind: "switch",
      modelId: next,
      reason:
        kind === "rate_limit"
          ? "rate_limit"
          : kind === "auth"
            ? "auth"
            : "provider_error",
      detail,
      required,
    };
  }

  private exhausted(requires: ModelRequirements | undefined): FailoverDecision {
    const message = describeRequirements(requires);
    return message ? { kind: "fail", message } : { kind: "fail" };
  }

  widerOutputModel(
    modelId: string,
    requires?: ModelRequirements,
  ): string | undefined {
    const current = this.safeInfo(modelId);
    if (!current) return undefined;
    const now = Date.now();
    return this.data
      .listEnabledTextModels()
      .filter((model) => model.id !== modelId)
      .filter((model) => (this.degradedUntil.get(model.id) ?? 0) <= now)
      .filter((model) => model.maxCompletionTokens > current.maxOutput)
      .filter((model) => this.satisfies(model.id, requires))
      .sort(
        (left, right) =>
          this.certainty(right.id, requires) -
            this.certainty(left.id, requires) ||
          right.maxCompletionTokens - left.maxCompletionTokens,
      )
      .map((model) => model.id)[0];
  }

  widerContextModel(modelId: string, requires?: ModelRequirements) {
    return this.widerModel(modelId, requires);
  }

  markDegraded(modelId: string, cooldownMs = DEGRADE_COOLDOWN_MS) {
    this.degradedUntil.set(modelId, Date.now() + cooldownMs);
  }

  isDegraded(modelId: string): boolean {
    return (this.degradedUntil.get(modelId) ?? 0) > Date.now();
  }

  record(runId: string, change: Omit<ModelSwitch, "at">): ModelSwitch {
    const entry: ModelSwitch = { ...change, at: new Date().toISOString() };
    this.data.recordModelSwitch(runId, entry);
    return entry;
  }

  private widerModel(
    modelId: string,
    requires?: ModelRequirements,
  ): string | undefined {
    const current = this.safeInfo(modelId);
    const now = Date.now();
    const threshold = current?.contextLength ?? 0;
    return this.data
      .listEnabledTextModels()
      .filter((model) => model.id !== modelId)
      .filter((model) => (this.degradedUntil.get(model.id) ?? 0) <= now)
      .filter((model) => model.contextLength > threshold)
      .filter((model) => this.satisfies(model.id, requires))
      .sort(
        (left, right) => this.rank(right, requires) - this.rank(left, requires),
      )
      .map((model) => model.id)[0];
  }

  private nextHealthy(
    modelId: string,
    requires?: ModelRequirements,
  ): string | undefined {
    return this.chain(modelId, requires).find(
      (candidate) => candidate !== modelId && !this.isDegraded(candidate),
    );
  }

  private safeInfo(modelId: string) {
    try {
      const info = this.providers.modelInfo(modelId);
      const settings = this.providers.generationSettings(modelId);
      return {
        contextLength: info.contextLength ?? 0,
        maxOutput: info.maxCompletionTokens ?? settings.maxOutputTokens,
      };
    } catch {
      return undefined;
    }
  }
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    statusCode?: unknown;
    status?: unknown;
    responseStatus?: unknown;
  };
  for (const value of [
    candidate.statusCode,
    candidate.status,
    candidate.responseStatus,
  ]) {
    if (typeof value === "number") return value;
  }
  return undefined;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    const candidate = error as Error & {
      responseBody?: unknown;
      data?: unknown;
      cause?: unknown;
    };
    return [
      error.message,
      serializableText(candidate.responseBody),
      serializableText(candidate.data),
      candidate.cause === undefined || candidate.cause === error
        ? ""
        : messageOf(candidate.cause),
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      responseBody?: unknown;
      data?: unknown;
      cause?: unknown;
    };
    return [
      typeof candidate.message === "string" ? candidate.message : "",
      serializableText(candidate.responseBody),
      serializableText(candidate.data),
      candidate.cause === undefined || candidate.cause === error
        ? ""
        : messageOf(candidate.cause),
    ]
      .filter(Boolean)
      .join(" ");
  }
  return String(error);
}

function serializableText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
