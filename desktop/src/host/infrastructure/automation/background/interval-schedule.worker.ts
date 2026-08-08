import { AutomationJobRepository } from "@host/infrastructure/database/automation-job.repository";
import type { IntegrationRepository } from "../../database/integration.repository";

export class IntervalScheduleWorker {
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    private readonly jobs: AutomationJobRepository,
    private readonly integrations: IntegrationRepository,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1_000);
    this.timer.unref();
    this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private tick(): void {
    if (this.busy) return;
    this.busy = true;
    try {
      this.enqueueDueIntervals();
    } finally {
      this.busy = false;
    }
  }

  private enqueueDueIntervals(): void {
    const now = new Date();
    for (const binding of this.integrations.dueIntervalBindings(
      now.toISOString(),
    )) {
      const intervalSeconds = Number(binding.config.intervalSeconds);
      const plannedAt = binding.nextRunAt ?? now.toISOString();
      const preventOverlap = Boolean(binding.config.preventOverlap);
      const misfire = String(binding.config.misfirePolicy ?? "run_once");
      const elapsed = Math.max(
        0,
        now.getTime() - new Date(plannedAt).getTime(),
      );
      const missedCount = Math.floor(elapsed / (intervalSeconds * 1_000));
      const occurrences =
        misfire === "catch_up"
          ? Math.min(missedCount + 1, 100)
          : misfire === "skip" && missedCount > 0
            ? 0
            : 1;

      if (
        !(
          preventOverlap &&
          this.integrations.scenarioHasActiveRun(binding.scenarioId)
        )
      ) {
        for (let index = 0; index < occurrences; index++) {
          const occurrenceAt = new Date(
            new Date(plannedAt).getTime() + index * intervalSeconds * 1_000,
          ).toISOString();
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

      this.integrations.advanceInterval(
        binding.id,
        intervalSeconds,
        now.getTime(),
      );
    }
  }
}
