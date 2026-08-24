import type { ModelSwitch, ModelSwitchReason } from "../../../shared/dto";
import type { ChatRepository } from "../database/chat.repository";
import type { ProviderRegistry } from "./provider.registry";

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
  | { kind: "switch"; modelId: string; reason: ModelSwitchReason; detail: string }
  | { kind: "fail" };

export interface FailoverState {
  activeModelId: string;
  attempt: number;
  compacted: boolean;
}

const RETRIES_PER_MODEL = 2;
const BASE_BACKOFF_MS = 500;
const DEGRADE_COOLDOWN_MS = 300_000;

export class ModelFailover {
  private readonly degradedUntil = new Map<string, number>();

  constructor(
    private readonly data: ChatRepository,
    private readonly providers: ProviderRegistry,
  ) {}

  chain(primaryModelId: string): string[] {
    const now = Date.now();
    const others = this.data
      .listEnabledTextModels()
      .filter((model) => model.id !== primaryModelId)
      .filter((model) => (this.degradedUntil.get(model.id) ?? 0) <= now)
      .sort((left, right) => right.contextLength - left.contextLength)
      .map((model) => model.id);
    return [primaryModelId, ...others];
  }

  classify(error: unknown): FailureKind {
    const status = statusOf(error);
    const text = messageOf(error).toLowerCase();

    if (status === 401 || status === 403) return "auth";
    if (status === 429) return "rate_limit";
    if (text.includes("rate limit") || text.includes("quota")) return "rate_limit";
    if (
      text.includes("context length") ||
      text.includes("context_length") ||
      text.includes("too many tokens") ||
      text.includes("maximum context") ||
      text.includes("prompt is too long")
    )
      return "context_overflow";
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

    if (kind === "moderation" || kind === "fatal") return { kind: "fail" };

    if (kind === "context_overflow") {
      if (!state.compacted) return { kind: "compact" };
      const wider = this.widerModel(state.activeModelId);
      return wider
        ? {
            kind: "switch",
            modelId: wider,
            reason: "context_overflow",
            detail,
          }
        : { kind: "fail" };
    }

    if (kind === "transient" && state.attempt < RETRIES_PER_MODEL)
      return {
        kind: "retry",
        delayMs: BASE_BACKOFF_MS * 2 ** state.attempt,
      };

    this.markDegraded(state.activeModelId);
    const next = this.nextHealthy(state.activeModelId);
    if (!next) return { kind: "fail" };
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
    };
  }

  widerOutputModel(modelId: string): string | undefined {
    const current = this.safeInfo(modelId);
    if (!current) return undefined;
    const now = Date.now();
    return this.data
      .listEnabledTextModels()
      .filter((model) => model.id !== modelId)
      .filter((model) => (this.degradedUntil.get(model.id) ?? 0) <= now)
      .filter((model) => model.maxCompletionTokens > current.maxOutput)
      .sort((left, right) => right.maxCompletionTokens - left.maxCompletionTokens)
      .map((model) => model.id)[0];
  }

  markDegraded(modelId: string, cooldownMs = DEGRADE_COOLDOWN_MS) {
    this.degradedUntil.set(modelId, Date.now() + cooldownMs);
  }

  isDegraded(modelId: string): boolean {
    return (this.degradedUntil.get(modelId) ?? 0) > Date.now();
  }

  record(
    runId: string,
    conversationId: string,
    change: Omit<ModelSwitch, "at">,
  ): ModelSwitch {
    const entry: ModelSwitch = { ...change, at: new Date().toISOString() };
    this.data.recordModelSwitch(runId, entry);
    return entry;
  }

  private widerModel(modelId: string): string | undefined {
    const current = this.safeInfo(modelId);
    const now = Date.now();
    const threshold = current?.contextLength ?? 0;
    return this.data
      .listEnabledTextModels()
      .filter((model) => model.id !== modelId)
      .filter((model) => (this.degradedUntil.get(model.id) ?? 0) <= now)
      .filter((model) => model.contextLength > threshold)
      .sort((left, right) => right.contextLength - left.contextLength)
      .map((model) => model.id)[0];
  }

  private nextHealthy(modelId: string): string | undefined {
    return this.chain(modelId).find(
      (candidate) => candidate !== modelId && !this.isDegraded(candidate),
    );
  }

  private safeInfo(modelId: string) {
    try {
      const info = this.providers.modelInfo(modelId);
      const settings = this.providers.generationSettings(modelId);
      return {
        contextLength: info.contextLength ?? 0,
        maxOutput: settings.maxOutputTokens,
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
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}
