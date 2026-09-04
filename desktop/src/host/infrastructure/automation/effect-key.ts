import { createHash } from "node:crypto";

export interface EffectIdentity {
  executionId: string;
  nodeId: string;
  iteration: number;
  kind: string;
  payload: unknown;
}

export function effectKey(identity: EffectIdentity): string {
  const digest = createHash("sha256")
    .update(stableStringify(identity.payload))
    .digest("hex")
    .slice(0, 32);
  return `${identity.kind}:${identity.executionId}:${identity.nodeId}:${identity.iteration}:${digest}`;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}
