import { randomUUID } from "node:crypto";
import type {
  AutomationJob,
  AutomationJobRepository,
} from "@host/infrastructure/database/automation-job.repository";
import type { ScenarioRunEvent } from "../../../../shared/models/automation";
import { scenarioMessageTriggerInputDtoSchema } from "../../../../shared/dto/scenario-trigger-event.dto";
import { isRetryable } from "../../../../shared/scenario/errors";
import type { ScenarioRuntimeEngine } from "../engine/scenario-runtime-engine";
import { onWork } from "./work-signal";

const FALLBACK_POLL_MS = 30_000;
const REAPER_INTERVAL_MS = 60_000;
const LEASE_RENEW_MS = 60_000;

export interface ScenarioJobWorkerOptions {
  maxConcurrentRuns?: number;
}
export class ScenarioJobWorker {
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private reaperTimer?: NodeJS.Timeout;
  private unsubscribe?: () => void;
  private stopped = true;
  private readonly running = new Set<Promise<void>>();
  private readonly maxConcurrentRuns: number;

  constructor(
    private readonly jobs: AutomationJobRepository,
    private readonly scenarios: ScenarioRuntimeEngine,
    options: ScenarioJobWorkerOptions = {},
  ) {
    this.maxConcurrentRuns = Math.max(
      1,
      Math.min(16, options.maxConcurrentRuns ?? 3),
    );
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.jobs.recoverAllLeases();
    this.unsubscribe = onWork("scenario-job", () => this.pump());
    this.timer = setInterval(() => this.pump(), FALLBACK_POLL_MS);
    this.timer.unref();
    this.reaperTimer = setInterval(
      () => this.jobs.recoverExpiredLeases(),
      REAPER_INTERVAL_MS,
    );
    this.reaperTimer.unref();
    this.pump();
  }

  stop(): void {
    this.stopped = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (this.reaperTimer) clearInterval(this.reaperTimer);
    this.reaperTimer = undefined;
  }

  private pump(): void {
    if (this.stopped) return;
    while (this.running.size < this.maxConcurrentRuns) {
      const job = this.jobs.leaseNext(this.workerId);
      if (!job) return;
      const task = this.runToCompletion(job).finally(() =>
        this.running.delete(task),
      );
      this.running.add(task);
    }
  }

  private async runToCompletion(job: AutomationJob): Promise<void> {
    try {
      await this.execute(job);
    } finally {
      if (!this.stopped) this.pump();
    }
  }

  private async execute(job: AutomationJob): Promise<void> {
    const renew = setInterval(
      () => this.jobs.renewLease(job.id, this.workerId),
      LEASE_RENEW_MS,
    );
    try {
      const scenarioId = String(job.payload.scenarioId ?? "");
      if (!scenarioId) throw new Error("В задании отсутствует scenarioId");
      const input = parseJobInput(job.payload.input);

      await new Promise<void>((resolve, reject) => {
        const onEvent = (event: ScenarioRunEvent) => {
          if (
            event.type === "run.completed" ||
            event.type === "run.cancelled"
          ) {
            resolve();
          } else if (event.type === "run.failed") {
            reject(
              new Error(event.run.error ?? "Сценарий завершился с ошибкой"),
            );
          }
        };
        const executionId = Number(job.payload.executionId);
        if (executionId) {
          this.scenarios.resume(executionId, onEvent);
          return;
        }
        const run = this.scenarios.start(
          scenarioId,
          input,
          "background",
          onEvent,
          undefined,
          Number(job.payload.scenarioRevisionId) || undefined,
        );
        job.payload.executionId = run.id;
        this.jobs.updatePayload(job.id, job.payload);
      });

      this.jobs.complete(job.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      this.jobs.fail(job, message, isRetryable(error));
    } finally {
      clearInterval(renew);
    }
  }
}

function parseJobInput(input: unknown) {
  if (
    input &&
    typeof input === "object" &&
    "trigger" in input &&
    ((input as { trigger?: unknown }).trigger === "telegram" ||
      (input as { trigger?: unknown }).trigger === "email" ||
      (input as { trigger?: unknown }).trigger === "chat")
  ) {
    return scenarioMessageTriggerInputDtoSchema.parse(input);
  }
  return input;
}
