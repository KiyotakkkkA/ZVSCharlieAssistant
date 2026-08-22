export type ScenarioErrorCode =
  | "config"
  | "expression"
  | "validation"
  | "not_found"
  | "disabled"
  | "cancelled"
  | "timeout"
  | "network"
  | "rate_limit"
  | "provider"
  | "internal"
  | "user_rejected";

export interface ScenarioErrorContext {
  scenarioId?: string;
  executionId?: string;
  nodeId?: string;
  nodeRunId?: string;
  attempt?: number;
  [key: string]: unknown;
}

export class ScenarioError extends Error {
  readonly code: ScenarioErrorCode;
  readonly retryable: boolean;
  readonly context: ScenarioErrorContext;

  constructor(
    message: string,
    options: {
      code: ScenarioErrorCode;
      retryable: boolean;
      cause?: unknown;
      context?: ScenarioErrorContext;
    },
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = new.target.name;
    this.code = options.code;
    this.retryable = options.retryable;
    this.context = options.context ?? {};
  }
}

export class PermanentError extends ScenarioError {
  constructor(
    message: string,
    options: {
      code?: ScenarioErrorCode;
      cause?: unknown;
      context?: ScenarioErrorContext;
    } = {},
  ) {
    super(message, {
      code: options.code ?? "config",
      retryable: false,
      cause: options.cause,
      context: options.context,
    });
  }
}

export class RetryableError extends ScenarioError {
  constructor(
    message: string,
    options: {
      code?: ScenarioErrorCode;
      cause?: unknown;
      context?: ScenarioErrorContext;
      retryAfterMs?: number;
    } = {},
  ) {
    super(message, {
      code: options.code ?? "network",
      retryable: true,
      cause: options.cause,
      context: options.context,
    });
    this.retryAfterMs = options.retryAfterMs;
  }

  readonly retryAfterMs?: number;
}

export class NodeTimeoutError extends RetryableError {
  constructor(message: string, context?: ScenarioErrorContext) {
    super(message, { code: "timeout", context });
  }
}

export class CancelledError extends ScenarioError {
  constructor(message = "Выполнение отменено", context?: ScenarioErrorContext) {
    super(message, { code: "cancelled", retryable: false, context });
  }
}

export class ScenarioSuspended extends Error {
  constructor(
    readonly questionId: string,
    readonly nodeId?: string,
  ) {
    super("Сценарий приостановлен до ответа пользователя");
    this.name = "ScenarioSuspended";
  }
}

const RETRYABLE_SYSTEM_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EBUSY",
  "SQLITE_BUSY",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const RETRYABLE_MESSAGE =
  /(timeout|timed out|socket hang up|network|temporar|try again|rate limit|too many requests|overloaded|503|502|504|429|connection (reset|closed))/i;

export function isCancellation(error: unknown): boolean {
  if (error instanceof CancelledError) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ScenarioError) return error.retryable;
  if (isCancellation(error)) return false;

  const candidate = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    message?: unknown;
  } | null;
  const code = candidate?.code;
  if (typeof code === "string" && RETRYABLE_SYSTEM_CODES.has(code)) return true;

  const status = Number(
    candidate?.status ?? candidate?.statusCode ?? Number.NaN,
  );
  if (Number.isFinite(status)) {
    if (status === 408 || status === 425 || status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    if (status >= 400 && status <= 499) return false;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof candidate?.message === "string"
        ? candidate.message
        : "";
  return RETRYABLE_MESSAGE.test(message);
}

export function errorCodeOf(error: unknown): ScenarioErrorCode {
  if (error instanceof ScenarioError) return error.code;
  if (isCancellation(error)) return "cancelled";
  return isRetryable(error) ? "network" : "internal";
}

export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? "Неизвестная ошибка";
  } catch {
    return "Неизвестная ошибка";
  }
}

export function toScenarioError(
  error: unknown,
  context?: ScenarioErrorContext,
): ScenarioError {
  if (error instanceof ScenarioError) return error;
  const message = errorMessageOf(error);
  return isRetryable(error)
    ? new RetryableError(message, {
        cause: error,
        context,
        code: errorCodeOf(error),
      })
    : new PermanentError(message, {
        cause: error,
        context,
        code: errorCodeOf(error),
      });
}
