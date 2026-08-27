import { connect, type TLSSocket } from "node:tls";

import type {
  DueTriggerBinding,
  IntegrationRepository,
} from "../../database/integration.repository";
import type { EmailMessageEntity } from "../../../../shared/dto/scenario-trigger-event.dto";
import { SecretStorageRepository } from "@host/infrastructure/database/secret-storage.repository";
import type { UserQuestionService } from "@host/application/services/user-question.service";
import { AutomationJobRepository } from "@host/infrastructure/database/automation-job.repository";

export class MailWatchListener {
  private readonly watches = new Map<string, WatchHandle>();
  private reconcileTimer?: NodeJS.Timeout;
  private stopped = true;

  constructor(
    private readonly integrations: IntegrationRepository,
    private readonly jobs: AutomationJobRepository,
    private readonly secrets: SecretStorageRepository,
    private readonly questions: UserQuestionService,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.reconcile();
    this.reconcileTimer = setInterval(() => this.reconcile(), 5_000);
    this.reconcileTimer.unref();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.reconcileTimer = undefined;
    for (const watch of this.watches.values()) watch.controller.abort();
    this.watches.clear();
  }

  private reconcile(): void {
    if (this.stopped) return;
    const groups = groupEmailBindings(this.integrations);
    for (const [key, watch] of this.watches) {
      if (groups.has(key)) continue;
      watch.controller.abort();
      this.watches.delete(key);
    }
    for (const [key, group] of groups) {
      if (this.watches.has(key)) continue;
      const controller = new AbortController();
      const task = this.watchMailbox(
        group.profileId,
        group.mailbox,
        controller.signal,
      ).finally(() => {
        if (this.watches.get(key)?.controller === controller)
          this.watches.delete(key);
      });
      this.watches.set(key, { controller, task });
    }
  }

  private async watchMailbox(
    profileId: string,
    mailbox: string,
    signal: AbortSignal,
  ): Promise<void> {
    let retryDelay = 1_000;
    while (!signal.aborted && !this.stopped) {
      const bindings = mailboxBindings(this.integrations, profileId, mailbox);
      if (!bindings.length) return;
      const profile = this.integrations
        .snapshot()
        .profiles.find((item) => item.id === profileId);
      const passwordId = profile?.secretBindings.password;
      const password = passwordId
        ? this.secrets.findSecret(passwordId)?.content
        : undefined;
      const host = profile?.config.host;
      const port = profile?.config.port ?? 993;
      const username = profile?.config.username;
      if (
        !profile ||
        !host ||
        !username ||
        !password ||
        profile.config.secure === false
      ) {
        this.setBindingsError(bindings, "Профиль IMAP настроен не полностью");
        await abortableDelay(5_000, signal);
        continue;
      }
      try {
        const client = await MinimalImapClient.connect(host, port, signal);
        try {
          await client.command(`LOGIN ${quote(username)} ${quote(password)}`);
          await client.command(`SELECT ${quote(mailbox)}`);
          await this.consumeAvailable(client, profileId, mailbox);
          retryDelay = 1_000;
          while (!signal.aborted) {
            await client.idle(signal);
            await this.consumeAvailable(client, profileId, mailbox);
          }
        } finally {
          client.close();
        }
      } catch (error) {
        if (signal.aborted) return;
        this.setBindingsError(
          bindings,
          error instanceof Error ? error.message : "Ошибка IMAP",
        );
        await abortableDelay(retryDelay, signal);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      }
    }
  }

  private async consumeAvailable(
    client: MinimalImapClient,
    profileId: string,
    mailbox: string,
  ): Promise<void> {
    for (const binding of mailboxBindings(
      this.integrations,
      profileId,
      mailbox,
    )) {
      const cursor = this.integrations.cursor(binding.id);
      const lastUid = Number(cursor.lastUid ?? 0);
      const search = await client.command(`UID SEARCH UID ${lastUid + 1}:*`);
      const uids = [...search.matchAll(/^\* SEARCH(?: ([0-9 ]+))?/gm)]
        .flatMap((match) => (match[1] ?? "").split(" "))
        .map(Number)
        .filter((value) => value > lastUid);
      let newest = lastUid;
      for (const uid of uids) {
        const raw = await client.command(`UID FETCH ${uid} (BODY.PEEK[])`);
        newest = Math.max(newest, uid);
        const from = header(raw, "From");
        const subject = header(raw, "Subject");
        const entity = toEmailMessageEntity(uid, raw);
        if (
          this.questions.resolveExternal({
            channel: "email",
            recipient: entity.from[0]?.address ?? "",
            authorId: entity.from[0]?.address ?? null,
            replyToId: entity.inReplyTo,
            text: `${subject}\n${entity.text}`,
          })
        )
          continue;
        if (
          String(binding.config.from ?? "") &&
          !from
            .toLowerCase()
            .includes(String(binding.config.from).toLowerCase())
        )
          continue;
        if (
          String(binding.config.subjectContains ?? "") &&
          !subject
            .toLowerCase()
            .includes(String(binding.config.subjectContains).toLowerCase())
        )
          continue;
        this.jobs.enqueue(
          "scenario_run",
          `email:${profileId}:${binding.id}:${uid}`,
          {
            scenarioId: binding.scenarioId,
            scenarioRevisionId: binding.scenarioRevisionId,
            triggerBindingId: binding.id,
            input: {
              trigger: "email",
              integrationProfileId: profileId,
              triggerBindingId: binding.id,
              entity,
            },
          },
        );
      }
      this.integrations.setCursor(binding.id, { lastUid: newest });
    }
  }

  private setBindingsError(
    bindings: DueTriggerBinding[],
    message: string,
  ): void {
    for (const binding of bindings)
      this.integrations.setCursor(
        binding.id,
        this.integrations.cursor(binding.id),
        message,
      );
  }
}

type WatchHandle = { controller: AbortController; task: Promise<void> };

type MailboxGroup = { profileId: string; mailbox: string };

function groupEmailBindings(
  integrations: IntegrationRepository,
): Map<string, MailboxGroup> {
  const profiles = new Map(
    integrations.snapshot().profiles.map((profile) => [profile.id, profile]),
  );
  const result = new Map<string, MailboxGroup>();
  for (const binding of integrations.bindings("email")) {
    if (binding.integrationProfileId === null) continue;
    const profile = profiles.get(binding.integrationProfileId);
    const mailbox = String(
      binding.config.mailbox ?? profile?.config.mailbox ?? "INBOX",
    );
    result.set(
      `${binding.integrationProfileId}:${mailbox}:${profile?.updatedAt ?? ""}`,
      {
        profileId: binding.integrationProfileId,
        mailbox,
      },
    );
  }
  return result;
}

function mailboxBindings(
  integrations: IntegrationRepository,
  profileId: string,
  mailbox: string,
): DueTriggerBinding[] {
  const profile = integrations
    .snapshot()
    .profiles.find((item) => item.id === profileId);
  return integrations
    .bindings("email")
    .filter(
      (binding) =>
        binding.integrationProfileId === profileId &&
        String(binding.config.mailbox ?? profile?.config.mailbox ?? "INBOX") ===
          mailbox,
    );
}

class MinimalImapClient {
  private sequence = 0;
  private buffer = "";
  private waiter?: {
    tag: string;
    idle: boolean;
    doneSent: boolean;
    timer?: NodeJS.Timeout;
    resolve(value: string): void;
    reject(error: Error): void;
  };
  private constructor(private readonly socket: TLSSocket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      const waiter = this.waiter;
      if (!waiter) return;
      if (
        waiter.idle &&
        !waiter.doneSent &&
        (/^\+ /m.test(this.buffer) ||
          /^\* \d+ (?:EXISTS|EXPUNGE)/m.test(this.buffer))
      ) {
        if (/^\* \d+ (?:EXISTS|EXPUNGE)/m.test(this.buffer)) {
          waiter.doneSent = true;
          this.socket.write("DONE\r\n");
        }
      }
      const match = this.buffer.match(
        new RegExp(`^${waiter.tag} (OK|NO|BAD)[^\\r\\n]*`, "m"),
      );
      if (!match) return;
      const response = this.buffer;
      this.buffer = "";
      this.waiter = undefined;
      if (waiter.timer) clearTimeout(waiter.timer);
      match[1] === "OK"
        ? waiter.resolve(response)
        : waiter.reject(new Error(match[0]));
    });
    socket.on("error", (error) => this.rejectWaiter(error));
    socket.on("close", () =>
      this.rejectWaiter(new Error("IMAP-соединение закрыто")),
    );
  }
  static connect(
    host: string,
    port: number,
    signal: AbortSignal,
  ): Promise<MinimalImapClient> {
    return new Promise((resolve, reject) => {
      const socket = connect(
        { host, port, servername: host, rejectUnauthorized: true },
        () => {
          socket.setTimeout(0);
          resolve(new MinimalImapClient(socket));
        },
      );
      const timeout = setTimeout(
        () => socket.destroy(new Error("Таймаут подключения к IMAP")),
        15_000,
      );
      socket.once("secureConnect", () => clearTimeout(timeout));
      socket.once("error", reject);
      signal.addEventListener("abort", () => socket.destroy(), { once: true });
    });
  }
  command(value: string): Promise<string> {
    const tag = `ZVS${++this.sequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rejectWaiter(
          new Error(`Таймаут команды IMAP: ${value.split(" ")[0]}`),
        );
        this.socket.destroy();
      }, 30_000);
      this.waiter = {
        tag,
        idle: false,
        doneSent: false,
        timer,
        resolve,
        reject,
      };
      this.socket.write(`${tag} ${value}\r\n`);
    });
  }

  idle(signal: AbortSignal): Promise<string> {
    const tag = `ZVS${++this.sequence}`;
    return new Promise((resolve, reject) => {
      const finish = () => {
        const waiter = this.waiter;
        if (!waiter || waiter.tag !== tag || waiter.doneSent) return;
        waiter.doneSent = true;
        this.socket.write("DONE\r\n");
      };
      const timer = setTimeout(finish, 25 * 60_000);
      this.waiter = {
        tag,
        idle: true,
        doneSent: false,
        timer,
        resolve,
        reject,
      };
      signal.addEventListener(
        "abort",
        () => {
          finish();
          this.socket.destroy();
        },
        { once: true },
      );
      this.socket.write(`${tag} IDLE\r\n`);
    });
  }

  private rejectWaiter(error: Error): void {
    const waiter = this.waiter;
    if (!waiter) return;
    this.waiter = undefined;
    if (waiter.timer) clearTimeout(waiter.timer);
    waiter.reject(error);
  }
  close(): void {
    this.socket.end();
  }
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

const quote = (value: string) =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
const header = (raw: string, name: string) =>
  raw.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";

function toEmailMessageEntity(uid: number, raw: string): EmailMessageEntity {
  const source = extractImapMessage(raw);
  const headerEnd = source.search(/\r?\n\r?\n/);
  const headers = headerEnd >= 0 ? source.slice(0, headerEnd) : source;
  const body = headerEnd >= 0 ? source.slice(headerEnd).trimStart() : "";
  return {
    type: "email_message",
    uid,
    messageId: header(headers, "Message-ID") || null,
    sentAt: parseEmailDate(header(headers, "Date")),
    subject: decodeMimeWords(header(headers, "Subject")),
    from: parseAddresses(header(headers, "From")),
    to: parseAddresses(header(headers, "To")),
    cc: parseAddresses(header(headers, "Cc")),
    text: extractTextBody(headers, body),
    inReplyTo: header(headers, "In-Reply-To") || null,
    attachments: extractAttachmentMetadata(source),
  };
}

function extractImapMessage(value: string) {
  const start = value.match(/BODY\[\][^{]*\{(\d+)\}\r?\n/i);
  if (!start || start.index === undefined) return value;
  const literalStart = start.index + start[0].length;
  const declaredBytes = Number(start[1]);
  const minimumChars = Number.isFinite(declaredBytes)
    ? Math.floor(declaredBytes / 3)
    : 0;
  const rest = value.slice(literalStart);
  const closing = rest
    .slice(minimumChars)
    .match(/\r?\n\)\r?\nZVS\d+ /i);
  return closing?.index === undefined
    ? rest
    : rest.slice(0, minimumChars + closing.index);
}

function parseEmailDate(value: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function parseAddresses(value: string): EmailMessageEntity["from"] {
  if (!value) return [];
  return value.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((part) => {
    const match = part.trim().match(/^(?:\"?([^\"<]*)\"?\s*)?<([^>]+)>$/);
    return match
      ? {
          name: decodeMimeWords(match[1]?.trim() ?? "") || null,
          address: match[2]!.trim(),
        }
      : { name: null, address: part.trim() };
  });
}

function decodeMimeWords(value: string) {
  return value.replace(
    /=\?UTF-8\?([BQ])\?([^?]+)\?=/gi,
    (_all, encoding: string, data: string) => {
      try {
        return encoding.toUpperCase() === "B"
          ? Buffer.from(data, "base64").toString("utf8")
          : decodeQuotedPrintable(data.replaceAll("_", " "));
      } catch {
        return data;
      }
    },
  );
}

function decodeQuotedPrintable(value: string) {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index++) {
    if (
      value[index] === "=" &&
      /^[0-9A-F]{2}$/i.test(value.slice(index + 1, index + 3))
    ) {
      bytes.push(Number.parseInt(value.slice(index + 1, index + 3), 16));
      index += 2;
    } else bytes.push(value.charCodeAt(index));
  }
  return Buffer.from(bytes).toString("utf8");
}

function extractTextBody(headers: string, body: string) {
  const transferEncoding = header(
    headers,
    "Content-Transfer-Encoding",
  ).toLowerCase();
  const contentType = header(headers, "Content-Type").toLowerCase();
  if (contentType.includes("multipart/")) {
    const boundary = header(headers, "Content-Type").match(
      /boundary=\"?([^\";]+)\"?/i,
    )?.[1];
    if (boundary) {
      const part = body
        .split(`--${boundary}`)
        .find((item) => /content-type:\s*text\/plain/i.test(item));
      if (part) {
        const split = part.search(/\r?\n\r?\n/);
        if (split >= 0)
          return decodeBody(
            part.slice(split).trim(),
            header(part.slice(0, split), "Content-Transfer-Encoding"),
          );
      }
    }
  }
  const decoded = decodeBody(body, transferEncoding);
  return contentType.includes("text/html")
    ? decoded
        .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : decoded.trim();
}

function decodeBody(value: string, encoding: string) {
  if (/base64/i.test(encoding)) {
    try {
      return Buffer.from(value.replace(/\s/g, ""), "base64").toString("utf8");
    } catch {
      return value;
    }
  }
  return /quoted-printable/i.test(encoding)
    ? decodeQuotedPrintable(value.replace(/=\r?\n/g, ""))
    : value;
}

function extractAttachmentMetadata(
  source: string,
): EmailMessageEntity["attachments"] {
  return [
    ...source.matchAll(
      /Content-Disposition:\s*attachment(?:;[^\r\n]*)?(?:\r?\n[ \t][^\r\n]*)*/gi,
    ),
  ].map((match, index) => {
    const block = match[0];
    const fileName = block.match(
      /filename\*?=(?:UTF-8''|\")?([^\";\r\n]+)/i,
    )?.[1];
    return {
      kind: "file" as const,
      id: `attachment-${index + 1}`,
      uniqueId: null,
      fileName: fileName ? safeDecodeURIComponent(fileName.trim()) : null,
      mimeType: null,
      size: null,
    };
  });
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
