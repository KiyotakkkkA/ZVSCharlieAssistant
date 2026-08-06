import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, normalize, relative, resolve } from "node:path";
import type {
  CommandSessionStatus,
} from "../../../shared/models/terminal";
import type {
  AgentTerminalPolicy,
  TerminalDirectoryGrant,
  TerminalPermission,
} from "../../../shared/dto";
import type { TerminalPolicyDataSource } from "../database/terminal-policy.data-source";
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

const permissionByCommand = (command: string): TerminalPermission => {
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
  private readonly approvals = new Map<string, (approved: boolean) => void>();

  constructor(private readonly policies: TerminalPolicyDataSource) {
    this.policies.recoverInterruptedSessions();
  }

  async execute(
    input: CommandExecutionInput,
    agent: AgentTerminalPolicy,
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
        throw new Error(`Команда ${command} не разрешена политикой`);
    if (
      !global.allowNetwork &&
      commands.some((command) => getTerminalCommandDefinition(command)?.network)
    )
      throw new Error("Сетевой доступ отключён глобальной политикой");

    const grants = this.intersectGrants(
      global.directoryGrants,
      agent.directoryGrants,
    );
    const requiredPermission = commands.reduce<TerminalPermission>(
      (current, command) => {
        const next = permissionByCommand(command);
        const rank: TerminalPermission[] = [
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
      id: randomUUID(),
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
      const approvalId = randomUUID();
      const payloadHash = createHash("sha256")
        .update(JSON.stringify({ script, cwd, agent, global }))
        .digest("hex");
      this.policies.createPendingSession({
        sessionId: session.id,
        approvalId,
        purpose: input.purpose,
        script,
        cwd,
        policy: { global, agent },
        risk: commands.some((command) => permissionByCommand(command) === "delete") ? "high" : "medium",
        reasons: ["Команда требует подтверждения согласно эффективной политике"],
        payloadHash,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      });
      const approved = await new Promise<boolean>((resolveApproval) => {
        this.approvals.set(approvalId, resolveApproval);
        signal?.addEventListener(
          "abort",
          () => {
            if (!this.approvals.delete(approvalId)) return;
            try {
              this.policies.decideApproval(approvalId, false);
            } catch {
              // Approval may already have been handled by the user.
            }
            resolveApproval(false);
          },
          { once: true },
        );
      });
      if (!approved) {
        session.status = "cancelled";
        this.policies.setSessionStatus(session.id, "cancelled");
        throw new Error("Выполнение команды отклонено пользователем");
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
        session.process?.kill();
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
    this.policies.decideApproval(id, approved);
    const resolveApproval = this.approvals.get(id);
    if (!resolveApproval) throw new Error("Ожидающее выполнение больше не активно");
    this.approvals.delete(id);
    resolveApproval(approved);
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
    return script
      .split(/[;|\r\n]+/)
      .map((part) => part.trim().match(/^([A-Za-z][\w-]*)/)?.[1])
      .filter((item): item is string => Boolean(item));
  }

  private absolutePaths(script: string): string[] {
    return [...script.matchAll(/(?:[A-Za-z]:\\|\\\\)[^\s"']+/g)].map(
      (match) => match[0],
    );
  }

  private intersectGrants(
    global: TerminalDirectoryGrant[],
    agent: TerminalDirectoryGrant[],
  ) {
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
    grants: TerminalDirectoryGrant[],
    permission: TerminalPermission,
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
      throw new Error(`Нет права ${permission} для пути ${candidate}`);
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
      "pwsh.exe",
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
      child.kill();
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
      session.process?.kill();
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
