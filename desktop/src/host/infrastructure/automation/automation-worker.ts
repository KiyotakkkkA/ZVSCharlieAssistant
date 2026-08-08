import { randomUUID } from "node:crypto";
import type { AutomationJobDataSource, AutomationJob } from "../database/automation-job.data-source";
import type { IntegrationDataSource } from "../database/integration.data-source";
import type { ScenarioRunEngine } from "./scenario-run-engine";
import type { TelegramTriggerPoller } from "./telegram-trigger-poller";
import type { EmailTriggerPoller } from "./email-trigger-poller";
import type { ScenarioRunEvent } from "../../../shared/models/automation";
import { scenarioMessageTriggerInputDtoSchema } from "../../../shared/dto/scenario-trigger-event.dto";

export class AutomationWorker {
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private busy = false;
  private lastTelegramPoll = 0;
  private lastEmailPoll = 0;

  constructor(
    private readonly jobs: AutomationJobDataSource,
    private readonly integrations: IntegrationDataSource,
    private readonly scenarios: ScenarioRunEngine,
    private readonly telegram: TelegramTriggerPoller,
    private readonly email: EmailTriggerPoller,
  ) {}

  start(): void {
    this.jobs.recoverExpiredLeases();
    this.timer = setInterval(() => void this.tick(), 1_000);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.enqueueDueIntervals();
      if (Date.now() - this.lastTelegramPoll >= 5_000) {
        this.lastTelegramPoll = Date.now();
        await this.telegram.poll();
      }
      if (Date.now() - this.lastEmailPoll >= 30_000) {
        this.lastEmailPoll = Date.now();
        await this.email.poll();
      }
      let job: AutomationJob | undefined;
      while ((job = this.jobs.leaseNext(this.workerId))) await this.execute(job);
    } finally {
      this.busy = false;
    }
  }

  private enqueueDueIntervals(): void {
    const now = new Date();
    for (const binding of this.integrations.dueIntervalBindings(now.toISOString())) {
      const intervalSeconds = Number(binding.config.intervalSeconds);
      const plannedAt = binding.nextRunAt ?? now.toISOString();
      const preventOverlap = Boolean(binding.config.preventOverlap);
      const misfire = String(binding.config.misfirePolicy ?? "run_once");
      const elapsed = Math.max(0, now.getTime() - new Date(plannedAt).getTime());
      const missedCount = Math.floor(elapsed / (intervalSeconds * 1000));
      const occurrences = misfire === "catch_up" ? Math.min(missedCount + 1, 100) : misfire === "skip" && missedCount > 0 ? 0 : 1;
      if (!(preventOverlap && this.integrations.scenarioHasActiveRun(binding.scenarioId))) {
        for (let index = 0; index < occurrences; index++) {
          const occurrenceAt = new Date(new Date(plannedAt).getTime() + index * intervalSeconds * 1000).toISOString();
          this.jobs.enqueue(
            "scenario_run",
            `schedule:${binding.id}:${occurrenceAt}`,
            {
              scenarioId: binding.scenarioId,
              scenarioRevisionId: binding.scenarioRevisionId,
              triggerBindingId: binding.id,
              input: { trigger: "interval", plannedAt: occurrenceAt },
            },
          );
        }
      }
      this.integrations.advanceInterval(binding.id, intervalSeconds, now.getTime());
    }
  }

  private async execute(job: AutomationJob): Promise<void> {
    try {
      if (job.kind === "scenario_run") {
        const scenarioId = String(job.payload.scenarioId ?? "");
        if (!scenarioId) throw new Error("В задании отсутствует scenarioId");
        const input = parseJobInput(job.payload.input);
        await new Promise<void>((resolve, reject) => {
          const onEvent = (event: ScenarioRunEvent) => {
              if (event.type === "run.completed" || event.type === "run.cancelled") resolve();
              if (event.type === "run.failed") reject(new Error(event.run.error ?? "Сценарий завершился с ошибкой"));
          };
          const executionId = Number(job.payload.executionId);
          if (executionId) this.scenarios.resume(executionId, onEvent);
          else {
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
          }
        });
      }
      this.jobs.complete(job.id);
    } catch (error) {
      this.jobs.fail(job, error instanceof Error ? error.message : "Неизвестная ошибка");
    }
  }
}

function parseJobInput(input: unknown) {
  if (
    input &&
    typeof input === "object" &&
    "trigger" in input &&
    ((input as { trigger?: unknown }).trigger === "telegram" ||
      (input as { trigger?: unknown }).trigger === "email")
  )
    return scenarioMessageTriggerInputDtoSchema.parse(input);
  return input;
}
