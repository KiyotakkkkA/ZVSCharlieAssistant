export type WorkChannel =
  "scenario-job" | "scenario-delivery" | "scenario-file";

const listeners = new Map<WorkChannel, Set<() => void>>();

export function notifyWork(channel: WorkChannel): void {
  for (const listener of listeners.get(channel) ?? []) {
    try {
      listener();
    } catch {}
  }
}

export function onWork(channel: WorkChannel, listener: () => void): () => void {
  const existing = listeners.get(channel) ?? new Set<() => void>();
  existing.add(listener);
  listeners.set(channel, existing);
  return () => existing.delete(listener);
}
