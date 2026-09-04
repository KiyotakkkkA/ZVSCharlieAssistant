import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ResourceMonitorService,
  type GpuSample,
  type ResourceSample,
} from "../../src/host/infrastructure/system/resource-monitor.service";

const gpu: GpuSample = {
  available: true,
  utilizationPercent: 64,
  memoryUsedMb: 3118,
  memoryTotalMb: 16311,
  temperatureCelsius: 41,
  memoryBusPercent: 12,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("ResourceMonitorService", () => {
  it("samples cpu, memory and gpu together", () => {
    const monitor = new ResourceMonitorService(
      () => gpu,
      () => undefined,
    );

    const sample = monitor.sample();

    expect(sample.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(sample.cpuPercent).toBeLessThanOrEqual(100);
    expect(sample.coreCount).toBeGreaterThan(0);
    expect(sample.ramTotalMb).toBeGreaterThan(0);
    expect(sample.ramUsedMb).toBeLessThanOrEqual(sample.ramTotalMb);
    expect(sample.processRssMb).toBeGreaterThan(0);
    expect(sample.gpu).toEqual(gpu);
  });

  it("reports a null gpu when the probe throws", () => {
    const monitor = new ResourceMonitorService(
      () => {
        throw new Error("NVML недоступна");
      },
      () => undefined,
    );

    expect(monitor.sample().gpu).toBeNull();
  });

  it("emits on an interval only while someone is subscribed", () => {
    vi.useFakeTimers();
    const emitted: ResourceSample[] = [];
    const monitor = new ResourceMonitorService(
      () => gpu,
      (sample) => emitted.push(sample),
    );

    monitor.subscribe();
    vi.advanceTimersByTime(3000);
    expect(emitted.length).toBe(3);

    monitor.unsubscribe();
    vi.advanceTimersByTime(3000);
    expect(emitted.length).toBe(3);
  });

  it("keeps sampling until the last subscriber leaves", () => {
    vi.useFakeTimers();
    const emitted: ResourceSample[] = [];
    const monitor = new ResourceMonitorService(
      () => gpu,
      (sample) => emitted.push(sample),
    );

    monitor.subscribe();
    monitor.subscribe();
    monitor.unsubscribe();
    vi.advanceTimersByTime(2000);
    expect(emitted.length).toBe(2);

    monitor.unsubscribe();
    vi.advanceTimersByTime(2000);
    expect(emitted.length).toBe(2);
  });

  it("stops everything on dispose", () => {
    vi.useFakeTimers();
    const emitted: ResourceSample[] = [];
    const monitor = new ResourceMonitorService(
      () => gpu,
      (sample) => emitted.push(sample),
    );

    monitor.subscribe();
    monitor.subscribe();
    monitor.dispose();
    vi.advanceTimersByTime(5000);

    expect(emitted).toHaveLength(0);
  });
});
