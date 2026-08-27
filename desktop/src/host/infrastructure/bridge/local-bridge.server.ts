import { createServer, type Server, type Socket } from "node:net";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  BRIDGE_PROTOCOL_VERSION,
  FrameDecoder,
  encodeFrame,
  type BridgeRequest,
} from "../../../shared/bridge/protocol";
import {
  bridgeSocketPath,
  bridgeTokenPath,
} from "../../../shared/bridge/bridge-paths";
import {
  answerQuestionDtoSchema,
  entityIdSchema,
  parseIpcDto,
  startRunDtoSchema,
} from "../../../shared/dto";
import type { StartRunInput } from "../../../shared/dto";
import type { ChatRepository } from "../database/chat.repository";
import type { ProjectManagementService } from "../../application/services/project-management.service";
import type { FileEditRepository } from "../database/file-edit.repository";
import type { FileSystemService } from "../filesystem/file-system.service";
import type { RunEngine } from "../text-generation/run-engine";
import type { AutomationRepository } from "../database/automation.repository";
import type { TextProviderRepository } from "../database/text-provider.repository";
import type { RunEvent } from "../../../shared/models/chat";
import type { UserQuestionService } from "../../application/services/user-question.service";
import type { RecentChatSessionsService } from "../../application/services/recent-chat-sessions.service";

interface BridgeDependencies {
  userDataPath: string;
  appVersion: string;
  chat: ChatRepository;
  engine: RunEngine;
  projects: ProjectManagementService;
  fileEdits: FileEditRepository;
  files: FileSystemService;
  automation: AutomationRepository;
  providers: TextProviderRepository;
  questions: UserQuestionService;
  recentSessions: RecentChatSessionsService;
  publishChatEvent?: (event: RunEvent) => void;
  onStartError?: (error: Error) => void;
}

interface Session {
  socket: Socket;
  authorized: boolean;
  decoder: FrameDecoder;
}

export class LocalBridgeServer {
  private server?: Server;
  private token = "";
  private readonly sessions = new Set<Session>();

  constructor(private readonly deps: BridgeDependencies) {}

  start() {
    if (this.server) return;
    const path = bridgeSocketPath(this.deps.userDataPath);
    const tokenFile = bridgeTokenPath(this.deps.userDataPath);
    this.token = randomBytes(32).toString("hex");

    mkdirSync(dirname(tokenFile), { recursive: true });
    if (existsSync(tokenFile)) rmSync(tokenFile, { force: true });
    writeFileSync(tokenFile, this.token, { encoding: "utf8", mode: 0o600 });
    if (process.platform !== "win32" && existsSync(path))
      rmSync(path, { force: true });

    this.server = createServer((socket) => this.accept(socket));
    this.server.on("error", (error) => {
      console.error("Локальный мост CLI не запущен", error);
      this.deps.onStartError?.(error);
    });
    this.server.listen(path);
  }

  stop() {
    for (const session of this.sessions) session.socket.destroy();
    this.sessions.clear();
    this.server?.close();
    this.server = undefined;
    const tokenFile = bridgeTokenPath(this.deps.userDataPath);
    if (existsSync(tokenFile)) rmSync(tokenFile, { force: true });
    const path = bridgeSocketPath(this.deps.userDataPath);
    if (process.platform !== "win32" && existsSync(path))
      rmSync(path, { force: true });
  }

  private accept(socket: Socket) {
    const session: Session = {
      socket,
      authorized: false,
      decoder: new FrameDecoder(),
    };
    this.sessions.add(session);
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      for (const frame of session.decoder.push(chunk))
        void this.dispatch(session, frame as BridgeRequest);
    });
    socket.on("close", () => this.sessions.delete(session));
    socket.on("error", () => this.sessions.delete(session));
  }

  private send(session: Session, frame: unknown) {
    if (session.socket.destroyed) return;
    session.socket.write(encodeFrame(frame));
  }

  private tokenMatches(candidate: string): boolean {
    const expected = Buffer.from(this.token, "utf8");
    const actual = Buffer.from(candidate, "utf8");
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }

  private async dispatch(session: Session, request: BridgeRequest) {
    if (typeof request?.id !== "number" || typeof request.method !== "string")
      return;
    try {
      if (request.method === "hello") {
        const params = request.params as { token?: string } | undefined;
        if (typeof params?.token !== "string" || !this.tokenMatches(params.token))
          throw new Error("Неверный токен доступа к локальному мосту");
        session.authorized = true;
        this.send(session, {
          id: request.id,
          ok: true,
          result: {
            protocol: BRIDGE_PROTOCOL_VERSION,
            version: this.deps.appVersion,
          },
        });
        return;
      }
      if (!session.authorized)
        throw new Error("Сессия не авторизована: сначала отправьте hello");

      const result = await this.handle(session, request);
      if (result !== SKIP_RESPONSE)
        this.send(session, { id: request.id, ok: true, result });
    } catch (error) {
      this.send(session, {
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handle(
    session: Session,
    request: BridgeRequest,
  ): Promise<unknown> {
    switch (request.method) {
      case "status":
        return {
          version: this.deps.appVersion,
          protocol: BRIDGE_PROTOCOL_VERSION,
          conversations: this.deps.chat.snapshot().conversations.length,
        };
      case "projects.list":
        return this.deps.projects.list();
      case "projects.ensure-directory": {
        const params = request.params as { path?: unknown } | undefined;
        if (typeof params?.path !== "string")
          throw new Error("Не указан каталог проекта");
        return this.deps.projects.ensureForDirectory(params.path);
      }
      case "projects.assign": {
        const params = request.params as {
          conversationId: string;
          projectId: string | null;
        };
        this.deps.projects.assignConversation(
          params.conversationId,
          params.projectId,
        );
        return { ok: true };
      }
      case "models.list":
        return this.deps.providers
          .getSnapshot()
          .models.filter((model) => model.enabled);
      case "agents.list":
        return this.deps.automation.listAgents();
      case "conversations.list":
        return this.deps.chat.snapshot().conversations;
      case "sessions.recent":
        return this.deps.recentSessions.list();
      case "conversations.rename": {
        const params = request.params as
          { conversationId?: unknown; title?: unknown } | undefined;
        const conversationId = parseIpcDto(
          entityIdSchema,
          params?.conversationId,
        );
        if (typeof params?.title !== "string" || !params.title.trim())
          throw new Error("Не указано название диалога");
        this.deps.chat.renameConversation(
          conversationId,
          params.title.trim().slice(0, 120),
        );
        return { id: conversationId, title: params.title.trim().slice(0, 120) };
      }
      case "chat.start": {
        const input: StartRunInput = parseIpcDto(
          startRunDtoSchema,
          request.params,
        );
        const started = await this.deps.engine.start(input, (event) => {
          this.sendRunEvent(session, request.id, event);
        });
        this.send(session, { id: request.id, ok: true, result: started });
        return SKIP_RESPONSE;
      }
      case "chat.cancel": {
        const params = request.params as { runId: string };
        this.deps.engine.cancel(params.runId);
        return { ok: true };
      }
      case "chat.compact": {
        const params = request.params as {
          conversationId: string;
          modelId: string;
          focus?: string;
        };
        return this.deps.engine.compactConversation(
          params.conversationId,
          params.modelId,
          params.focus,
          (event) => this.sendRunEvent(session, request.id, event),
        );
      }
      case "chat.context": {
        const params = request.params as {
          conversationId: string;
          modelId: string;
        };
        return this.deps.engine.contextWindow(
          params.conversationId,
          params.modelId,
        );
      }
      case "questions.pending": {
        const params = request.params as
          { conversationId?: unknown } | undefined;
        return this.deps.questions.pendingForConversation(
          parseIpcDto(entityIdSchema, params?.conversationId),
        );
      }
      case "questions.answer": {
        const input = parseIpcDto(answerQuestionDtoSchema, request.params);
        return this.deps.questions.answer(input.questionId, input.answer, "ui");
      }
      case "files.edits": {
        const params = request.params as { conversationId: string };
        return this.deps.fileEdits.listByConversation(params.conversationId);
      }
      case "files.revert": {
        const params = request.params as { runId: string };
        return this.deps.files.revertRun(params.runId);
      }
      default:
        throw new Error(`Неизвестный метод моста: ${request.method}`);
    }
  }

  private sendRunEvent(session: Session, requestId: number, event: RunEvent) {
    this.send(session, {
      id: requestId,
      event: event.type,
      payload: event,
    });
    this.deps.publishChatEvent?.(event);
  }
}

const SKIP_RESPONSE = Symbol("skip");
