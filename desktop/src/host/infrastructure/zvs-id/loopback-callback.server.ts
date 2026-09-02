import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface LoopbackCallback {
  code: string;
  state: string;
}

export interface LoopbackListener {
  redirectUri: string;
  waitForCallback(): Promise<LoopbackCallback>;
  close(): void;
}

const CALLBACK_PATH = "/callback";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const LOOPBACK_HOST = "127.0.0.1";

export class LoopbackCallbackServer {
  constructor(private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS) {}

  async listen(): Promise<LoopbackListener> {
    const server = createServer();
    const pending = createPendingCallback();
    const cleanUp = () => closeSoon(server);
    pending.promise.then(cleanUp, cleanUp);

    server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", `http://${LOOPBACK_HOST}`);

      if (request.method !== "GET" || url.pathname !== CALLBACK_PATH) {
        response.writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        response.end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (error) {
        respondWithPage(
          response,
          400,
          "Вход отменён",
          url.searchParams.get("error_description") ??
            "ZVS ID отклонил запрос авторизации.",
        );
        pending.reject(new Error(describeAuthorizationError(error)));
        return;
      }

      if (!code || !state) {
        respondWithPage(
          response,
          400,
          "Некорректный ответ",
          "ZVS ID вернул ответ без кода авторизации.",
        );
        pending.reject(new Error("ZVS ID вернул ответ без кода авторизации"));
        return;
      }

      respondWithPage(
        response,
        200,
        "Готово",
        "ZVS ID подключён. Можно вернуться в приложение — эту вкладку можно закрыть.",
      );
      pending.resolve({ code, state });
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, LOOPBACK_HOST, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });

    const address = server.address() as AddressInfo | null;
    if (!address) {
      server.close();
      throw new Error("Не удалось открыть локальный порт для входа в ZVS ID");
    }

    const timer = setTimeout(() => {
      pending.reject(
        new Error("Истекло время ожидания входа — попробуйте ещё раз"),
      );
    }, this.timeoutMs);
    timer.unref();

    const close = () => {
      clearTimeout(timer);
      server.closeAllConnections();
      server.close();
    };

    return {
      redirectUri: `http://${LOOPBACK_HOST}:${address.port}${CALLBACK_PATH}`,
      waitForCallback: () => pending.promise,
      close,
    };
  }
}

function createPendingCallback() {
  let resolve!: (value: LoopbackCallback) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<LoopbackCallback>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
}

function closeSoon(server: Server): void {
  setTimeout(() => {
    server.closeAllConnections();
    server.close();
  }, 500).unref();
}

function respondWithPage(
  response: ServerResponse,
  status: number,
  title: string,
  message: string,
): void {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(renderPage(title, message));
}

function renderPage(title: string, message: string): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} — ZVS ID</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #0f1115; color: #e7e9ee;
      }
      main { max-width: 30rem; padding: 2rem; text-align: center; }
      h1 { font-size: 1.15rem; margin: 0 0 .5rem; }
      p { margin: 0; color: #9aa1ae; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function describeAuthorizationError(error: string): string {
  if (error === "access_denied") return "Вы отклонили запрос на доступ";
  return `ZVS ID отклонил запрос авторизации (${error})`;
}
