export type MetricLabels = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface CounterSnapshot {
  name: string;
  labels: MetricLabels;
  value: number;
}

export interface HistogramSnapshot {
  name: string;
  labels: MetricLabels;
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface GaugeSnapshot {
  name: string;
  labels: MetricLabels;
  value: number | null;
}

export interface MetricsSnapshot {
  collectedAt: string;
  uptimeSeconds: number;
  counters: CounterSnapshot[];
  histograms: HistogramSnapshot[];
  gauges: GaugeSnapshot[];
}

const SAMPLE_LIMIT = 1_024;

function serializeLabels(labels: MetricLabels | undefined): string {
  if (!labels) return "";
  const entries = Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(",");
}

function parseLabels(serialized: string): MetricLabels {
  if (!serialized) return {};
  const result: MetricLabels = {};
  for (const pair of serialized.split(",")) {
    const separator = pair.indexOf("=");
    if (separator > 0)
      result[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  return result;
}

class Histogram {
  private readonly samples: number[] = [];
  private cursor = 0;
  count = 0;
  sum = 0;
  min = Number.POSITIVE_INFINITY;
  max = Number.NEGATIVE_INFINITY;

  observe(value: number): void {
    if (!Number.isFinite(value)) return;
    this.count += 1;
    this.sum += value;
    if (value < this.min) this.min = value;
    if (value > this.max) this.max = value;
    if (this.samples.length < SAMPLE_LIMIT) this.samples.push(value);
    else {
      this.samples[this.cursor] = value;
      this.cursor = (this.cursor + 1) % SAMPLE_LIMIT;
    }
  }

  quantile(fraction: number): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((left, right) => left - right);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(fraction * sorted.length) - 1),
    );
    return sorted[index] ?? 0;
  }
}

export class MetricsRegistry {
  private readonly counters = new Map<string, Map<string, number>>();
  private readonly histograms = new Map<string, Map<string, Histogram>>();
  private readonly gauges = new Map<string, Map<string, () => number | null>>();
  private readonly startedAt = Date.now();

  increment(name: string, labels?: MetricLabels, by = 1): void {
    const series = this.counters.get(name) ?? new Map<string, number>();
    const key = serializeLabels(labels);
    series.set(key, (series.get(key) ?? 0) + by);
    this.counters.set(name, series);
  }

  observe(name: string, value: number, labels?: MetricLabels): void {
    const series = this.histograms.get(name) ?? new Map<string, Histogram>();
    const key = serializeLabels(labels);
    const histogram = series.get(key) ?? new Histogram();
    histogram.observe(value);
    series.set(key, histogram);
    this.histograms.set(name, series);
  }

  startTimer(
    name: string,
    labels?: MetricLabels,
  ): (extra?: MetricLabels) => number {
    const startedAt = performance.now();
    return (extra) => {
      const elapsed = performance.now() - startedAt;
      this.observe(name, elapsed, { ...labels, ...extra });
      return elapsed;
    };
  }

  gauge(name: string, read: () => number | null, labels?: MetricLabels): void {
    const series =
      this.gauges.get(name) ?? new Map<string, () => number | null>();
    series.set(serializeLabels(labels), read);
    this.gauges.set(name, series);
  }

  snapshot(): MetricsSnapshot {
    const counters: CounterSnapshot[] = [];
    for (const [name, series] of this.counters)
      for (const [key, value] of series)
        counters.push({ name, labels: parseLabels(key), value });

    const histograms: HistogramSnapshot[] = [];
    for (const [name, series] of this.histograms)
      for (const [key, histogram] of series)
        histograms.push({
          name,
          labels: parseLabels(key),
          count: histogram.count,
          sum: Math.round(histogram.sum),
          min: histogram.count ? Math.round(histogram.min) : 0,
          max: histogram.count ? Math.round(histogram.max) : 0,
          p50: Math.round(histogram.quantile(0.5)),
          p95: Math.round(histogram.quantile(0.95)),
          p99: Math.round(histogram.quantile(0.99)),
        });

    const gauges: GaugeSnapshot[] = [];
    for (const [name, series] of this.gauges)
      for (const [key, read] of series) {
        let value: number | null = null;
        try {
          value = read();
        } catch {
          value = null;
        }
        gauges.push({ name, labels: parseLabels(key), value });
      }

    return {
      collectedAt: new Date().toISOString(),
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      counters: counters.sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      histograms: histograms.sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      gauges: gauges.sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

export const METRIC = {
  runStarted: "scenario.run.started",
  runFinished: "scenario.run.finished",
  runDuration: "scenario.run.duration_ms",
  nodeFinished: "scenario.node.finished",
  nodeDuration: "scenario.node.duration_ms",
  nodeRetry: "scenario.node.retry",
  llmCalls: "llm.calls",
  llmDuration: "llm.duration_ms",
  llmTokens: "llm.tokens",
  toolCalls: "tool.calls",
  queueDepth: "queue.depth",
  queueLeased: "queue.leased",
  queueLeaseRecovered: "queue.lease_recovered",
  deliveryDepth: "delivery.depth",
  deliverySent: "delivery.sent",
  triggerEvents: "trigger.events",
  triggerErrors: "trigger.errors",
  payloadOffloaded: "payload.offloaded",
  expressionErrors: "expression.errors",
} as const;

export const metrics = new MetricsRegistry();
