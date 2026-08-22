import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_PAYLOAD_THRESHOLD_BYTES = 32 * 1024;

export interface StoredPayload {
  json: string | null;
  ref: string | null;
}

export class PayloadStore {
  constructor(
    private readonly root: string,
    private readonly thresholdBytes: number = DEFAULT_PAYLOAD_THRESHOLD_BYTES,
  ) {}

  put(
    executionId: string,
    nodeRunId: string,
    label: string,
    value: unknown,
  ): StoredPayload {
    const serialized = JSON.stringify(value ?? null) ?? "null";
    if (serialized.length <= this.thresholdBytes)
      return { json: serialized, ref: null };
    const dir = join(this.root, String(executionId));
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${nodeRunId}-${label}.json`);
    writeFileSync(path, serialized, "utf8");
    return { json: null, ref: path };
  }

  get(
    json: string | null | undefined,
    ref: string | null | undefined,
  ): unknown {
    if (ref) return JSON.parse(readFileSync(ref, "utf8"));
    if (json) return JSON.parse(json);
    return undefined;
  }
}
