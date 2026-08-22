import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { createHash } from "node:crypto";
import { newEntityId } from "../database/entity-id";
import { isAbsolute, normalize, relative, resolve } from "node:path";
import type { CommandSessionStatus } from "../../../shared/models/terminal";
import type {
  AgentTerminalPolicy,
  AgentDirectoryPolicy,
  DirectoryGrant,
  DirectoryPermission,
} from "../../../shared/dto";
import type { TerminalPolicyRepository } from "../database/terminal-policy.repository";
import type { DirectoryPolicyRepository } from "../database/directory-policy.repository";
import { getTerminalCommandDefinition } from "../../../shared/terminal-capabilities";

type StartInput = {
  action: "start";
  script: string;
  purpose: string;
  cwd?: string;
  execution?: "foreground" | "background";
  timeoutSeconds?: number;
};
type SessionInput = {
  action: "status" | "output" | "wait" | "cancel";
  sessionId: string;
  timeoutSeconds?: number;
};
export type CommandExecutionInput = StartInput | SessionInput;

interface Session {
  id: string;
  status: CommandSessionStatus;
  process?: ChildProcessWithoutNullStreams;
  stdout: string;
  stderr: string;
  exitCode?: number;
  error?: string;
  finished?: Promise<void>;
}

interface PendingApproval {
  settle: (approved: boolean, reason: string) => void;
  expectedHash: string;
  currentHash: () => string;
  timer: NodeJS.Timeout;
}

const APPROVAL_TTL_MS = 15 * 60_000;

let resolvedShell: string | undefined;

function resolvePowerShell(): string {
  if (resolvedShell) return resolvedShell;
  for (const candidate of ["pwsh.exe", "powershell.exe"]) {
    const probe = spawnSync(
      candidate,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "exit 0"],
      { windowsHide: true, timeout: 10_000 },
    );
    if (!probe.error) return (resolvedShell = candidate);
  }
  throw new Error(
    "PowerShell не найден. Установите PowerShell 7 (pwsh) или убедитесь, что powershell.exe доступен в PATH",
  );
}

function terminateTree(child: ChildProcessWithoutNullStreams): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      windowsHide: true,
    });
    killer.on("error", () => child.kill());
    return;
  }
  child.kill();
}

const permissionByCommand = (command: string): DirectoryPermission => {
  const definition = getTerminalCommandDefinition(command);
  if (definition) return definition.permission;
  const value = command.toLowerCase();
  if (
    value.startsWith("get-") ||
    value === "select-string" ||
    value === "test-path"
  )
    return "read";
  if (value === "new-item") return "create";
  if (value === "remove-item") return "delete";
  if (
    value === "move-item" ||
    value === "copy-item" ||
    value === "set-content" ||
    value === "add-content"
  )
    return "modify";
  return "execute";
};

export class CommandExecutionService {
  private readonly sessions = new Map<string, Session>();
  private readonly approvals = new Map<string, PendingApproval>();

  private onApprovalsChanged?: () => void;

  constructor(
    private readonly policies: TerminalPolicyRepository,
    private readonly directories: DirectoryPolicyRepository,
  ) {
    this.policies.recoverInterruptedSessions();
  }

  watchApprovals(listener: () => void): void {
    this.onApprovalsChanged = listener;
  }

  async execute(
    input: CommandExecutionInput,
    agent: AgentTerminalPolicy,
    agentDirectories: AgentDirectoryPolicy,
    signal?: AbortSignal,
  ) {
    if (input.action !== "start") return this.sessionAction(input);
    const global = this.policies.get();
    if (!global.enabled || !agent.enabled)
      throw new Error("Работа с терминалом отключена политикой");
    const running = [...this.sessions.values()].filter(
      (item) => item.status === "running",
    ).length;
    if (running >= global.maxConcurrentSessions)
      throw new Error("Достигнут лимит параллельных терминальных сессий");
    const script = input.script.trim();
    if (!script || script.length > 20_000)
      throw new Error("Команда пуста или превышает допустимый размер");

    const effectiveCommands = new Set(
      global.allowedCommands
        .filter((item) =>
          agent.allowedCommands.some(
            (allowed) => allowed.toLowerCase() === item.toLowerCase(),
          ),
        )
        .map((item) => item.toLowerCase()),
    );
    const commands = this.parseCommands(script);
    if (!commands.length)
      throw new Error("Не удалось определить исполняемую команду");
    for (const command of commands)
      if (!effectiveCommands.has(command.toLowerCase()))
        throw new Error(
          `Команда ${command} не разрешена политикой. Разрешить её можно в «Настройки → Политики» — команда должна быть включена и в глобальной политике, и в политике агента.`,
        );
    if (
      !global.allowNetwork &&
      commands.some((command) => getTerminalCommandDefinition(command)?.network)
    )
      throw new Error("Сетевой доступ отключён глобальной политикой");

    const grants = this.intersectGrants(
      this.directories.get().grants,
      agentDirectories.grants,
    );
    const requiredPermission = commands.reduce<DirectoryPermission>(
      (current, command) => {
        const next = permissionByCommand(command);
        const rank: DirectoryPermission[] = [
          "read",
          "create",
          "modify",
          "delete",
          "execute",
        ];
        return rank.indexOf(next) > rank.indexOf(current) ? next : current;
      },
      "read",
    );
    const cwd = this.assertPath(
      input.cwd ?? grants[0]?.path ?? "",
      grants,
      requiredPermission,
    );
    const absolutePaths = this.absolutePaths(script);
    if (
      commands.some((command) =>
        ["start-process", "invoke-item"].includes(command.toLowerCase()),
      ) &&
      absolutePaths.length === 0
    )
      throw new Error(
        "Для запуска приложения или открытия документа требуется абсолютный разрешённый путь",
      );
    for (const path of absolutePaths) {
      this.assertPath(path, grants, requiredPermission);
    }
    const session: Session = {
      id: newEntityId(),
      status: "queued",
      stdout: "",
      stderr: "",
    };
    this.sessions.set(session.id, session);
    const requiresApproval =
      global.confirmationMode === "always" ||
      agent.confirmationMode === "always" ||
      commands.some((command) => permissionByCommand(command) !== "read");
    if (requiresApproval) {
      session.status = "pending_approval";
      const approvalId = newEntityId();
      const currentHash = () =>
        createHash("sha256")
          .update(
            JSON.stringify({
              script,
              cwd,
              agent,
              agentDirectories,
              global: this.policies.get(),
            }),
          )
          .digest("hex");
      const expiresAtMs = Date.now() + APPROVAL_TTL_MS;
      this.policies.createPendingSession({
        sessionId: session.id,
        approvalId,
        purpose: input.purpose,
        script,
        cwd,
        policy: { global, agent, directories: grants },
        risk: commands.some(
          (command) => permissionByCommand(command) === "delete",
        )
          ? "high"
          : "medium",
        reasons: [
          "Команда требует подтверждения согласно эффективной политике",
        ],
        payloadHash: currentHash(),
        expiresAt: new Date(expiresAtMs).toISOString(),
      });
      this.onApprovalsChanged?.();
      const decision = await this.awaitApproval(
        approvalId,
        currentHash,
        expiresAtMs,
        signal,
      );
      this.onApprovalsChanged?.();
      if (!decision.approved) {
        session.status = "cancelled";
        this.policies.setSessionStatus(session.id, "cancelled");
        throw new Error(decision.reason);
      }
    }
    this.startProcess(
      session,
      script,
      cwd,
      Math.min(
        input.timeoutSeconds ?? agent.timeoutSeconds,
        global.maxTimeoutSeconds,
      ),
      global.maxOutputBytes,
    );
    signal?.addEventListener(
      "abort",
      () => {
        if (session.status !== "running") return;
        session.status = "cancelled";
        if (session.process) terminateTree(session.process);
      },
      { once: true },
    );
    if (input.execution === "background") return this.result(session);
    await session.finished;
    return this.result(session);
  }

  pendingApprovals() {
    return this.policies.pendingApprovals();
  }

  decideApproval(id: string, approved: boolean) {
    const pending = this.approvals.get(id);
    if (!pending) throw new Error("Ожидающее выполнение больше не активно");
    if (approved && pending.currentHash() !== pending.expectedHash) {
      this.policies.decideApproval(id, false);
      pending.settle(false, "Политика изменилась после запроса подтверждения");
      throw new Error(
        "Политика доступа изменилась после запроса подтверждения — команда отклонена. Повторите запрос.",
      );
    }
    this.policies.decideApproval(id, approved);
    pending.settle(
      approved,
      approved ? "" : "Выполнение команды отклонено пользователем",
    );
  }

  private awaitApproval(
    approvalId: string,
    currentHash: () => string,
    expiresAtMs: number,
    signal?: AbortSignal,
  ): Promise<{ approved: boolean; reason: string }> {
    return new Promise((resolvePromise) => {
      const settle = (approved: boolean, reason: string) => {
        const pending = this.approvals.get(approvalId);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.approvals.delete(approvalId);
        resolvePromise({ approved, reason });
      };
      const decline = (reason: string) => {
        try {
          this.policies.decideApproval(approvalId, false);
        } catch {}
        settle(false, reason);
      };
      const timer = setTimeout(
        () => decline("Истёк срок подтверждения команды"),
        Math.max(1_000, expiresAtMs - Date.now()),
      );
      timer.unref();
      this.approvals.set(approvalId, {
        settle,
        expectedHash: currentHash(),
        currentHash,
        timer,
      });
      signal?.addEventListener("abort", () => decline("Выполнение отменено"), {
        once: true,
      });
    });
  }

  private parseCommands(script: string): string[] {
    if (
      /\b(Invoke-Expression|Add-Type|New-Object|Set-ExecutionPolicy)\b|\$|::|--%|-EncodedCommand|\.\.|[{}<>]|\b(RunAs|Registry::|HKLM:|HKCU:|Cert:|WSMan:)\b/i.test(
        script,
      )
    )
      throw new Error("Команда содержит запрещённую конструкцию PowerShell");
    if (/[&`]/.test(script))
      throw new Error("Операторы динамического выполнения запрещены");
    if (/~|%[A-Za-z_][A-Za-z0-9_()]*%/.test(script))
      throw new Error(
        "Пути с «~» или переменными окружения запрещены: укажите абсолютный путь",
      );
    const segments = script
      .split(/[;|\r\n]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const commands = segments.map(
      (segment) => segment.match(/^([A-Za-z][\w-]*)/)?.[1],
    );
    const unrecognized = segments.find((_, index) => !commands[index]);
    if (unrecognized !== undefined)
      throw new Error(
        `Не удалось определить команду во фрагменте «${unrecognized.slice(0, 80)}»`,
      );
    return commands.filter((item): item is string => Boolean(item));
  }

  private absolutePaths(script: string): string[] {
    return [...script.matchAll(/(?:[A-Za-z]:\\|\\\\)[^\s"']+/g)].map(
      (match) => match[0],
    );
  }

  private intersectGrants(global: DirectoryGrant[], agent: DirectoryGrant[]) {
    const byPath = new Map(
      global.map((item) => [normalize(item.path).toLowerCase(), item]),
    );
    return agent.flatMap((item) => {
      const parent = byPath.get(normalize(item.path).toLowerCase());
      if (!parent) return [];
      return [
        {
          path: normalize(parent.path),
          recursive: parent.recursive && item.recursive,
          permissions: item.permissions.filter((permission) =>
            parent.permissions.includes(permission),
          ),
        },
      ];
    });
  }

  private assertPath(
    path: string,
    grants: DirectoryGrant[],
    permission: DirectoryPermission,
  ) {
    if (!path || !isAbsolute(path))
      throw new Error(
        "Рабочая директория должна быть абсолютным разрешённым путём",
      );
    const candidate = normalize(resolve(path));
    const grant = grants.find((item) => {
      const root = normalize(resolve(item.path));
      const child = relative(root, candidate);
      return (
        (child === "" ||
          (item.recursive && !child.startsWith("..") && !isAbsolute(child))) &&
        item.permissions.includes(permission)
      );
    });
    if (!grant)
      throw new Error(
        `Нет права «${permission}» для пути ${candidate}. Выдать доступ можно в «Настройки → Политики → Директории».`,
      );
    return candidate;
  }

  private startProcess(
    session: Session,
    script: string,
    cwd: string,
    timeoutSeconds: number,
    maxOutputBytes: number,
  ) {
    const child = spawn(
      resolvePowerShell(),
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "-"],
      {
        cwd,
        windowsHide: true,
        shell: false,
        env: {
          PATH: process.env.PATH ?? "",
          SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
          TEMP: process.env.TEMP ?? "",
        },
      },
    );
    session.process = child;
    session.status = "running";
    this.policies.setSessionStatus(session.id, "running");
    const append = (key: "stdout" | "stderr", chunk: Buffer) => {
      session[key] = (session[key] + chunk.toString("utf8")).slice(
        -maxOutputBytes,
      );
    };
    child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
    const timer = setTimeout(() => {
      session.status = "timed_out";
      terminateTree(child);
    }, timeoutSeconds * 1000);
    session.finished = new Promise((resolveFinished) => {
      child.once("error", (error) => {
        clearTimeout(timer);
        session.status = "failed";
        this.policies.setSessionStatus(session.id, "failed");
        session.error = error.message;
        resolveFinished();
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        session.exitCode = code ?? undefined;
        if (session.status === "running")
          session.status = code === 0 ? "completed" : "failed";
        this.policies.setSessionStatus(session.id, session.status);
        resolveFinished();
      });
    });
    child.stdin.end(script);
  }

  private async sessionAction(input: SessionInput) {
    const session = this.sessions.get(input.sessionId);
    if (!session) throw new Error("Терминальная сессия не найдена");
    if (input.action === "cancel" && session.status === "running") {
      session.status = "cancelled";
      if (session.process) terminateTree(session.process);
    } else if (input.action === "wait" && session.finished) {
      await Promise.race([
        session.finished,
        new Promise((resolveWait) =>
          setTimeout(
            resolveWait,
            Math.min(input.timeoutSeconds ?? 10, 30) * 1000,
          ),
        ),
      ]);
    }
    return this.result(session);
  }

  private result(session: Session) {
    return {
      sessionId: session.id,
      status: session.status,
      exitCode: session.exitCode,
      stdout: session.stdout,
      stderr: session.stderr,
      error: session.error,
    };
  }
}
