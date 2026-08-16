import { Worker } from "node:worker_threads";
import { join } from "node:path";
import type {
  TextExtractionRequest,
  TextExtractionResponse,
} from "./text-extraction.worker";

/** Через сколько простоя поток завершается, чтобы не держать память впустую. */
const IDLE_SHUTDOWN_MS = 60_000;

/**
 * Клиент к потоку разбора документов. Поток поднимается лениво при первой
 * загрузке и гасится после простоя; запросы обрабатываются по одному, что
 * заодно служит естественным ограничителем нагрузки на CPU.
 */
export class TextExtractionClient {
  private worker?: Worker;
  private nextId = 1;
  private idleTimer?: NodeJS.Timeout;
  private readonly pending = new Map<
    number,
    { resolve: (text: string) => void; reject: (error: Error) => void }
  >();

  extract(fileName: string, data: ArrayBuffer): Promise<string> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    this.cancelIdleShutdown();
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(
        { id, fileName, data } satisfies TextExtractionRequest,
        [data],
      );
    });
  }

  dispose(): void {
    this.cancelIdleShutdown();
    this.rejectAll(new Error("Разбор документов остановлен"));
    void this.worker?.terminate();
    this.worker = undefined;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(join(__dirname, "text-extraction.worker.js"));
    worker.on("message", (response: TextExtractionResponse) => {
      const request = this.pending.get(response.id);
      if (!request) return;
      this.pending.delete(response.id);
      if ("error" in response) request.reject(new Error(response.error));
      else request.resolve(response.text);
      if (!this.pending.size) this.scheduleIdleShutdown();
    });
    worker.on("error", (error) => {
      this.rejectAll(error);
      this.worker = undefined;
    });
    worker.on("exit", () => {
      this.rejectAll(new Error("Поток разбора документов завершился"));
      this.worker = undefined;
    });
    worker.unref();
    this.worker = worker;
    return worker;
  }

  private rejectAll(error: Error): void {
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }

  private scheduleIdleShutdown(): void {
    this.cancelIdleShutdown();
    this.idleTimer = setTimeout(() => {
      if (this.pending.size) return;
      void this.worker?.terminate();
      this.worker = undefined;
    }, IDLE_SHUTDOWN_MS);
    this.idleTimer.unref();
  }

  private cancelIdleShutdown(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }
}
