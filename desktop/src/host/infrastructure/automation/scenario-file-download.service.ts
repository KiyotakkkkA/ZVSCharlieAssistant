import { onWork } from "./background/work-signal";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { connect, type TLSSocket } from "node:tls";

import type {
  AttachmentReference,
  ScenarioFileReference,
} from "../../../shared/dto/scenario-trigger-event.dto";
import type { IntegrationRepository } from "../database/integration.repository";
import {
  ScenarioFileRepository,
  type ScenarioFileJob,
} from "../database/scenario-file.repository";
import { SecretStorageRepository } from "../database/secret-storage.repository";

type TriggerEnvelope = {
  trigger: "telegram" | "email" | "chat";
  integrationProfileId?: string;
  triggerBindingId: string;
  entity: Record<string, unknown> & { attachments?: AttachmentReference[] };
};

const FALLBACK_POLL_MS = 30_000;

export class ScenarioFileDownloadService {
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private unsubscribe?: () => void;
  private busy = false;

  constructor(
    private readonly data: ScenarioFileRepository,
    private readonly integrations: IntegrationRepository,
    private readonly secrets: SecretStorageRepository,
    private readonly root: string,
  ) {}

  start(): void {
    if (this.timer) return;
    this.data.recoverExpiredLeases();
    this.unsubscribe = onWork("scenario-file", () => void this.tick());
    this.timer = setInterval(() => void this.tick(), FALLBACK_POLL_MS);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async downloadForNode(input: {
    executionId: string;
    nodeRunId: string;
    nodeId: string;
    value: unknown;
    cleanupOnFinish: boolean;
    maxFileSizeBytes: number;
    signal: AbortSignal;
  }): Promise<ScenarioFileReference[]> {
    const envelopes = collectTriggerEnvelopes(input.value);
    for (const envelope of envelopes)
      for (const attachment of envelope.entity.attachments ?? [])
        this.data.enqueue({
          executionId: input.executionId,
          nodeRunId: input.nodeRunId,
          nodeId: input.nodeId,
          sourceKind: envelope.trigger,
          sourceExternalId: attachment.id,
          integrationProfileId: envelope.integrationProfileId ?? null,
          sourceScope: envelope.integrationProfileId
            ? `integration:${envelope.integrationProfileId}`
            : `chat:${String(envelope.entity.conversationId ?? "unknown")}`,
          cleanupOnFinish: input.cleanupOnFinish,
          payload: {
            attachment,
            entity: envelope.entity,
            triggerBindingId: envelope.triggerBindingId,
            maxFileSizeBytes: input.maxFileSizeBytes,
          },
        });
    if (!envelopes.some((item) => item.entity.attachments?.length)) return [];

    void this.tick();
    while (true) {
      if (input.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      const statuses = this.data.status(input.executionId, input.nodeRunId);
      const failed = statuses.find((item) => item.status === "failed");
      if (failed)
        throw new Error(failed.last_error ?? "Не удалось скачать вложение");
      if (
        statuses.length &&
        statuses.every((item) => item.status === "completed")
      )
        return this.data.files(input.executionId, input.nodeRunId);
      await delay(100);
    }
  }

  async cleanupExecution(executionId: string): Promise<void> {
    await this.cleanup(this.data.cleanupCandidates(executionId));
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      let job: ScenarioFileJob | undefined;
      while ((job = this.data.leaseNext(this.workerId))) {
        try {
          this.data.complete(job, await this.download(job));
        } catch (error) {
          this.data.fail(job, errorMessage(error));
        }
      }
      await this.cleanup(this.data.terminalCleanupCandidates());
    } finally {
      this.busy = false;
    }
  }

  private async cleanup(files: Array<{ id: string; localPath: string }>) {
    for (const file of files) {
      try {
        await rm(file.localPath, { force: true });
        this.data.markDeleted(file.id);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          this.data.markDeleted(file.id);
      }
    }
  }

  private async download(job: ScenarioFileJob) {
    const profile = job.integrationProfileId
      ? this.integrations.findProfile(job.integrationProfileId)
      : undefined;
    if (job.sourceKind !== "chat" && (!profile || !profile.enabled))
      throw new Error("Профиль интеграции недоступен");
    const content =
      job.sourceKind === "chat"
        ? await this.downloadChatAttachment(job)
        : job.sourceKind === "telegram" && profile
          ? await this.downloadTelegram(job, profile.secretBindings.botToken)
          : job.sourceKind === "email" && profile
            ? await this.downloadEmail(
                job,
                profile.secretBindings.password,
                profile.config,
              )
            : undefined;
    if (!content)
      throw new Error(`Источник файлов «${job.sourceKind}» не поддерживается`);
    if (content.byteLength > job.input.maxFileSizeBytes)
      throw new Error("Файл превышает ограничение размера ноды");

    const fileName = safeFileName(
      job.input.attachment.fileName ??
        `${job.sourceKind}-${job.sourceExternalId}`,
    );
    const persisted = await this.persistBytes(
      content,
      job.executionId,
      job.nodeRunId,
      fileName,
    );
    return {
      fileName,
      mimeType: job.input.attachment.mimeType,
      ...persisted,
    };
  }

  private async persistBytes(
    content: Buffer,
    executionId: string,
    nodeRunId: string,
    fileName: string,
  ): Promise<{
    size: number;
    sha256: string;
    storageKey: string;
    localPath: string;
  }> {
    const storageKey = `${executionId}/${nodeRunId}/${randomUUID()}-${fileName}`;
    const target = join(this.root, storageKey);
    const temporary = `${target}.part`;
    await mkdir(join(this.root, String(executionId), String(nodeRunId)), {
      recursive: true,
    });
    await writeFile(temporary, content);
    await rename(temporary, target);
    return {
      size: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
      storageKey,
      localPath: target,
    };
  }

  async registerGeneratedFile(input: {
    executionId: string;
    nodeRunId: string;
    nodeId: string;
    sourcePath: string;
    fileName: string;
  }): Promise<ScenarioFileReference> {
    const fileName = safeFileName(input.fileName);
    const content = await readFile(input.sourcePath);
    const persisted = await this.persistBytes(
      content,
      input.executionId,
      input.nodeRunId,
      fileName,
    );
    return this.data.registerGenerated({
      executionId: input.executionId,
      nodeRunId: input.nodeRunId,
      nodeId: input.nodeId,
      fileName,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ...persisted,
    });
  }

  private async downloadChatAttachment(job: ScenarioFileJob) {
    const attachmentId = job.sourceExternalId;
    const conversationId = String(job.input.entity.conversationId ?? "");
    if (!attachmentId || !conversationId)
      throw new Error("Некорректная ссылка на вложение из чата");
    const attachment = this.data.chatAttachment(attachmentId, conversationId);
    if (!attachment) throw new Error("Вложение из чата не найдено");
    return readFile(attachment.localPath);
  }

  private async downloadTelegram(job: ScenarioFileJob, secretId?: string) {
    const token = secretId
      ? this.secrets.findSecret(secretId)?.content
      : undefined;
    if (!token) throw new Error("Не найден токен Telegram-бота");
    const metadataResponse = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(job.sourceExternalId)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const metadata = (await metadataResponse.json()) as {
      ok?: boolean;
      description?: string;
      result?: { file_path?: string };
    };
    if (!metadataResponse.ok || !metadata.ok || !metadata.result?.file_path)
      throw new Error(metadata.description ?? "Telegram не вернул путь файла");
    const response = await fetch(
      `https://api.telegram.org/file/bot${token}/${metadata.result.file_path}`,
      { signal: AbortSignal.timeout(120_000) },
    );
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  private async downloadEmail(
    job: ScenarioFileJob,
    secretId: string | undefined,
    profileConfig: Record<string, unknown>,
  ) {
    const password = secretId
      ? this.secrets.findSecret(secretId)?.content
      : undefined;
    const host = String(profileConfig.host ?? "");
    const port = Number(profileConfig.port ?? 993);
    const username = String(profileConfig.username ?? "");
    const uid = Number(job.input.entity.uid);
    if (!password || !host || !username || !uid)
      throw new Error(
        "Профиль IMAP или идентификатор письма заполнены не полностью",
      );
    const binding = this.integrations.bindingConfig(job.input.triggerBindingId);
    const mailbox = String(binding.mailbox ?? profileConfig.mailbox ?? "INBOX");
    const client = await MinimalImapClient.connect(host, port);
    try {
      await client.command(`LOGIN ${quote(username)} ${quote(password)}`);
      await client.command(`SELECT ${quote(mailbox)}`);
      const raw = await client.command(`UID FETCH ${uid} (BODY.PEEK[])`);
      return extractAttachment(extractImapMessage(raw), job.sourceExternalId);
    } finally {
      client.close();
    }
  }
}

function collectTriggerEnvelopes(
  value: unknown,
  result: TriggerEnvelope[] = [],
): TriggerEnvelope[] {
  if (!value || typeof value !== "object") return result;
  const candidate = value as Partial<TriggerEnvelope>;
  if (
    (candidate.trigger === "telegram" ||
      candidate.trigger === "email" ||
      candidate.trigger === "chat") &&
    (candidate.trigger === "chat" ||
      typeof candidate.integrationProfileId === "string") &&
    typeof candidate.triggerBindingId === "string" &&
    candidate.entity &&
    typeof candidate.entity === "object"
  )
    result.push(candidate as TriggerEnvelope);
  else
    for (const nested of Object.values(value))
      collectTriggerEnvelopes(nested, result);
  return result;
}

class MinimalImapClient {
  private sequence = 0;
  private buffer = "";
  private waiter?: {
    tag: string;
    resolve(value: string): void;
    reject(error: Error): void;
  };
  private constructor(private readonly socket: TLSSocket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      const waiter = this.waiter;
      if (!waiter) return;
      const match = this.buffer.match(
        new RegExp(`^${waiter.tag} (OK|NO|BAD)[^\\r\\n]*`, "m"),
      );
      if (!match) return;
      const response = this.buffer;
      this.buffer = "";
      this.waiter = undefined;
      match[1] === "OK"
        ? waiter.resolve(response)
        : waiter.reject(new Error(match[0]));
    });
  }
  static connect(host: string, port: number): Promise<MinimalImapClient> {
    return new Promise((resolve, reject) => {
      const socket = connect(
        { host, port, servername: host, rejectUnauthorized: true },
        () => resolve(new MinimalImapClient(socket)),
      );
      socket.setTimeout(20_000, () =>
        socket.destroy(new Error("Таймаут IMAP")),
      );
      socket.once("error", reject);
    });
  }
  command(value: string): Promise<string> {
    const tag = `ZVS${++this.sequence}`;
    return new Promise((resolve, reject) => {
      this.waiter = { tag, resolve, reject };
      this.socket.write(`${tag} ${value}\r\n`);
    });
  }
  close(): void {
    this.socket.end();
  }
}

function extractAttachment(source: string, id: string): Buffer {
  const index = Number(id.replace("attachment-", "")) - 1;
  if (!Number.isInteger(index) || index < 0)
    throw new Error("Некорректный идентификатор вложения");
  const matches = [
    ...source.matchAll(
      /Content-Disposition:\s*attachment[^\r\n]*(?:\r?\n[ \t][^\r\n]*)*\r?\n([\s\S]*?)(?=\r?\n--[^\r\n]+|$)/gi,
    ),
  ];
  const part = matches[index]?.[0];
  if (!part) throw new Error("Вложение больше не найдено в письме");
  const split = part.search(/\r?\n\r?\n/);
  const headers = split >= 0 ? part.slice(0, split) : "";
  const body = split >= 0 ? part.slice(split).trim() : "";
  const encoding = header(headers, "Content-Transfer-Encoding").toLowerCase();
  if (encoding.includes("base64"))
    return Buffer.from(body.replace(/\s/g, ""), "base64");
  if (encoding.includes("quoted-printable"))
    return decodeQuotedPrintableBuffer(body);
  return Buffer.from(body, "utf8");
}

const extractImapMessage = (value: string) =>
  value.match(/BODY\[\][^{]*\{\d+\}\r?\n([\s\S]*?)\r?\n\)\r?\nZVS\d+ /i)?.[1] ??
  value;
const header = (raw: string, name: string) =>
  raw.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
const quote = (value: string) =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
function decodeQuotedPrintableBuffer(value: string) {
  const normalized = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < normalized.length; index++) {
    if (
      normalized[index] === "=" &&
      /^[0-9A-F]{2}$/i.test(normalized.slice(index + 1, index + 3))
    ) {
      bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
    } else bytes.push(normalized.charCodeAt(index));
  }
  return Buffer.from(bytes);
}
function safeFileName(value: string) {
  const cleaned = basename(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .trim();
  return cleaned || "attachment";
}
const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Неизвестная ошибка скачивания";
