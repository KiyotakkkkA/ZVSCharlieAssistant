import { randomUUID } from "node:crypto";
import type { ScenarioDeliveryRepository } from "../../database/scenario-delivery.repository";
import type { ScenarioDeliveryAdapterRegistry } from "../delivery/scenario-delivery.adapter";

export class ScenarioDeliveryWorker {
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private busy = false;
  constructor(
    private jobs: ScenarioDeliveryRepository,
    private adapters: ScenarioDeliveryAdapterRegistry,
  ) {}
  start() {
    if (this.timer) return;
    this.jobs.recoverExpiredLeases();
    this.timer = setInterval(() => void this.tick(), 1_000);
    this.timer.unref();
    void this.tick();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  private async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      let job;
      while ((job = this.jobs.leaseNext(this.workerId))) {
        try {
          await this.adapters.resolve(job.channel).deliver(job);
          this.jobs.complete(job.id);
        } catch (error) {
          this.jobs.fail(
            job,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
