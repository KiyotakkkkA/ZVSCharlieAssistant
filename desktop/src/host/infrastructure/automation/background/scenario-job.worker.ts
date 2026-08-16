import { randomUUID } from "node:crypto";
import type {
  AutomationJob,
  AutomationJobRepository,
} from "@host/infrastructure/database/automation-job.repository";
import type { ScenarioRunEvent } from "../../../../shared/models/automation";
import { scenarioMessageTriggerInputDtoSchema } from "../../../../shared/dto/scenario-trigger-event.dto";
import type { ScenarioRunEngine } from "../scenario-run-engine";
import { onWork } from "./work-signal";

/** Страховочный опрос на случай, если сигнал о работе был потерян. */
const FALLBACK_POLL_MS = 30_000;

export class ScenarioJobWorker {
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private unsubscribe?: () => void;
  private busy = false;

  constructor(
    private readonly jobs: AutomationJobRepository,
    private readonly scenarios: ScenarioRunEngine,
  ) {}

  start(): void {
    if (this.timer) return;
    this.jobs.recoverExpiredLeases();
    this.unsubscribe = onWork("scenario-job", () => void this.tick());
    this.timer = setInterval(() => void this.tick(), FALLBACK_POLL_MS);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      let job: AutomationJob | undefined;
      while ((job = this.jobs.leaseNext(this.workerId))) {
        await this.execute(job);
      }
    } finally {
      this.busy = false;
    }
  }

  private async execute(job: AutomationJob): Promise<void> {
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
      this.jobs.fail(
        job,
        error instanceof Error ? error.message : "Неизвестная ошибка",
      );
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
