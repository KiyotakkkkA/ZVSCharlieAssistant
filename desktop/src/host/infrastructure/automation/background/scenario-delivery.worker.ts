import { randomUUID } from "node:crypto";
import type {
  ScenarioDeliveryJob,
  ScenarioDeliveryRepository,
} from "../../database/scenario-delivery.repository";
import type { ScenarioDeliveryAdapterRegistry } from "../delivery/scenario-delivery.adapter";
import { onWork } from "./work-signal";

const FALLBACK_POLL_MS = 30_000;
const REAPER_INTERVAL_MS = 60_000;

export class ScenarioDeliveryWorker {
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private reaperTimer?: NodeJS.Timeout;
  private unsubscribe?: () => void;
  private stopped = true;
  private readonly running = new Set<Promise<void>>();
  private readonly maxConcurrentDeliveries: number;

  constructor(
    private jobs: ScenarioDeliveryRepository,
    private adapters: ScenarioDeliveryAdapterRegistry,
    options: { maxConcurrentDeliveries?: number } = {},
  ) {
    this.maxConcurrentDeliveries = Math.max(
      1,
      Math.min(16, options.maxConcurrentDeliveries ?? 4),
    );
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.jobs.recoverAllLeases();
    this.unsubscribe = onWork("scenario-delivery", () => this.pump());
    this.timer = setInterval(() => this.pump(), FALLBACK_POLL_MS);
    this.timer.unref();
    this.reaperTimer = setInterval(
      () => this.jobs.recoverExpiredLeases(),
      REAPER_INTERVAL_MS,
    );
    this.reaperTimer.unref();
    this.pump();
  }

  stop() {
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
    while (this.running.size < this.maxConcurrentDeliveries) {
      const job = this.jobs.leaseNext(this.workerId);
      if (!job) return;
      const task = this.deliver(job).finally(() => this.running.delete(task));
      this.running.add(task);
    }
  }

  private async deliver(job: ScenarioDeliveryJob): Promise<void> {
    try {
      await this.adapters.resolve(job.channel).deliver(job);
      this.jobs.complete(job.id);
    } catch (error) {
      this.jobs.fail(
        job,
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      if (!this.stopped) this.pump();
    }
  }
}
