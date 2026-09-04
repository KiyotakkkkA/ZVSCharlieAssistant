import { cpus, freemem, totalmem } from "node:os";

export interface GpuSample {
  available: boolean;
  utilizationPercent: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  temperatureCelsius: number | null;
  memoryBusPercent: number | null;
}

export interface ResourceSample {
  timestamp: number;
  cpuPercent: number;
  coreCount: number;
  ramUsedMb: number;
  ramTotalMb: number;
  processRssMb: number;
  gpu: GpuSample | null;
}

interface CpuTotals {
  idle: number;
  total: number;
}

const SAMPLE_INTERVAL_MS = 1000;
const MEGABYTE = 1_048_576;

export class ResourceMonitorService {
  private timer?: NodeJS.Timeout;
  private previous?: CpuTotals;
  private subscribers = 0;

  constructor(
    private readonly sampleGpu: () => GpuSample | null,
    private readonly emit: (sample: ResourceSample) => void,
  ) {}

  subscribe(): void {
    this.subscribers += 1;
    if (this.timer) return;
    this.previous = readCpuTotals();
    this.timer = setInterval(
      () => this.emit(this.sample()),
      SAMPLE_INTERVAL_MS,
    );
    this.timer.unref();
  }

  unsubscribe(): void {
    this.subscribers = Math.max(0, this.subscribers - 1);
    if (this.subscribers > 0 || !this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
    this.previous = undefined;
  }

  dispose(): void {
    this.subscribers = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.previous = undefined;
  }

  sample(): ResourceSample {
    const totals = readCpuTotals();
    const previous = this.previous;
    this.previous = totals;
    const idleDelta = previous ? totals.idle - previous.idle : 0;
    const totalDelta = previous ? totals.total - previous.total : 0;
    const cpuPercent =
      totalDelta > 0
        ? Math.min(100, Math.max(0, (1 - idleDelta / totalDelta) * 100))
        : 0;
    const total = totalmem();
    return {
      timestamp: Date.now(),
      cpuPercent: Math.round(cpuPercent * 10) / 10,
      coreCount: cpus().length,
      ramUsedMb: Math.round((total - freemem()) / MEGABYTE),
      ramTotalMb: Math.round(total / MEGABYTE),
      processRssMb: Math.round(process.memoryUsage().rss / MEGABYTE),
      gpu: this.readGpu(),
    };
  }

  private readGpu(): GpuSample | null {
    try {
      return this.sampleGpu();
    } catch {
      return null;
    }
  }
}

function readCpuTotals(): CpuTotals {
  let idle = 0;
  let total = 0;
  for (const core of cpus()) {
    idle += core.times.idle;
    total +=
      core.times.user +
      core.times.nice +
      core.times.sys +
      core.times.idle +
      core.times.irq;
  }
  return { idle, total };
}
