import { connect, type Socket } from "node:net";
import { readFileSync } from "node:fs";
import {
  FrameDecoder,
  encodeFrame,
  isBridgeEvent,
  type BridgeFrame,
  type BridgeMethod,
  type BridgeRequest,
  type BridgeResponse,
} from "../shared/bridge/protocol";
import {
  bridgeSocketPath,
  bridgeTokenPath,
} from "../shared/bridge/bridge-paths";

export class BridgeUnavailableError extends Error {}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onEvent?: (event: string, payload: unknown) => void;
  responseResolved: boolean;
  terminalSeen: boolean;
}

export class BridgeClient {
  private socket?: Socket;
  private readonly decoder = new FrameDecoder();
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(private readonly userDataPath: string) {}

  async connect(): Promise<{ version: string; protocol: number }> {
    const token = this.readToken();
    const path = bridgeSocketPath(this.userDataPath);
    this.socket = await openSocket(path);
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk: string) => this.receive(chunk));
    this.socket.on("close", () =>
      this.failAll("Соединение с приложением закрыто"),
    );
    this.socket.on("error", (error) => this.failAll(error.message));
    return (await this.request("hello", { token })) as {
      version: string;
      protocol: number;
    };
  }

  disconnect() {
    this.socket?.end();
    this.socket = undefined;
  }

  request(
    method: BridgeMethod,
    params?: unknown,
    onEvent?: (event: string, payload: unknown) => void,
  ): Promise<unknown> {
    const socket = this.socket;
    if (!socket)
      throw new BridgeUnavailableError("Нет соединения с приложением");
    const id = this.nextId++;
    const frame: BridgeRequest = { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        onEvent,
        responseResolved: false,
        terminalSeen: false,
      });
      socket.write(encodeFrame(frame));
    });
  }

  private receive(chunk: string) {
    for (const raw of this.decoder.push(chunk)) {
      const frame = raw as BridgeFrame;
      const entry = this.pending.get(frame.id);
      if (!entry) continue;
      if (isBridgeEvent(frame)) {
        entry.onEvent?.(frame.event, frame.payload);
        if (isTerminalRunEvent(frame.event)) {
          entry.terminalSeen = true;
          if (entry.responseResolved) this.pending.delete(frame.id);
        }
        continue;
      }
      const response = frame as BridgeResponse;
      entry.responseResolved = true;
      if (response.ok) entry.resolve(response.result);
      else entry.reject(new Error(response.error ?? "Ошибка выполнения"));
      if (!entry.onEvent || entry.terminalSeen || !response.ok)
        this.pending.delete(frame.id);
    }
  }

  private failAll(message: string) {
    for (const [, entry] of this.pending) entry.reject(new Error(message));
    this.pending.clear();
  }

  private readToken(): string {
    try {
      return readFileSync(bridgeTokenPath(this.userDataPath), "utf8").trim();
    } catch {
      throw new BridgeUnavailableError(
        "Приложение ZVS не запущено: главное приложение не запущено",
      );
    }
  }
}

function isTerminalRunEvent(event: string): boolean {
  return (
    event === "run.completed" ||
    event === "run.failed" ||
    event === "run.cancelled"
  );
}

function openSocket(path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    const onError = (error: NodeJS.ErrnoException) => {
      socket.destroy();
      reject(
        new BridgeUnavailableError(
          error.code === "ENOENT" || error.code === "ECONNREFUSED"
            ? "Приложение ZVS не запущено"
            : `Не удалось подключиться к приложению: ${error.message}`,
        ),
      );
    };
    socket.once("error", onError);
    socket.once("connect", () => {
      socket.off("error", onError);
      resolve(socket);
    });
  });
}
