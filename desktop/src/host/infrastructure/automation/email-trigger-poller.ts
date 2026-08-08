import { connect, type TLSSocket } from "node:tls";
import type { SecretStorageRepository } from "../../application/ports/secret-storage.repository";
import type { AutomationJobDataSource } from "../database/automation-job.data-source";
import type { IntegrationDataSource } from "../database/integration.data-source";
import type { EmailMessageEntity } from "../../../shared/dto/scenario-trigger-event.dto";

export class EmailTriggerPoller {
  constructor(
    private readonly integrations: IntegrationDataSource,
    private readonly jobs: AutomationJobDataSource,
    private readonly secrets: SecretStorageRepository,
  ) {}

  async poll(): Promise<void> {
    const profiles = new Map(this.integrations.snapshot().profiles.map((item) => [item.id, item]));
    for (const binding of this.integrations.bindings("email")) {
      const profile = profiles.get(binding.integrationProfileId!);
      const passwordId = profile?.secretBindings.password;
      const password = passwordId ? this.secrets.getSecret(passwordId)?.content : undefined;
      const host = profile?.config.host;
      const port = profile?.config.port ?? 993;
      const username = profile?.config.username;
      if (!profile || !host || !username || !password || profile.config.secure === false) continue;
      const cursor = this.integrations.cursor(binding.id);
      try {
        const client = await MinimalImapClient.connect(host, port);
        try {
          await client.command(`LOGIN ${quote(username)} ${quote(password)}`);
          await client.command(`SELECT ${quote(String(binding.config.mailbox ?? profile.config.mailbox ?? "INBOX"))}`);
          const lastUid = Number(cursor.lastUid ?? 0);
          const search = await client.command(`UID SEARCH UNSEEN UID ${lastUid + 1}:*`);
          const uids = [...search.matchAll(/^\* SEARCH(?: ([0-9 ]+))?/gm)]
            .flatMap((match) => (match[1] ?? "").split(" "))
            .map(Number).filter((value) => value > lastUid);
          let newest = lastUid;
          for (const uid of uids) {
            const raw = await client.command(`UID FETCH ${uid} (BODY.PEEK[])`);
            newest = Math.max(newest, uid);
            const from = header(raw, "From");
            const subject = header(raw, "Subject");
            if (String(binding.config.from ?? "") && !from.toLowerCase().includes(String(binding.config.from).toLowerCase())) continue;
            if (String(binding.config.subjectContains ?? "") && !subject.toLowerCase().includes(String(binding.config.subjectContains).toLowerCase())) continue;
            this.jobs.enqueue("scenario_run", `email:${profile.id}:${uid}`, {
              scenarioId: binding.scenarioId,
              scenarioRevisionId: binding.scenarioRevisionId,
              triggerBindingId: binding.id,
              input: {
                trigger: "email",
                integrationProfileId: profile.id,
                triggerBindingId: binding.id,
                entity: toEmailMessageEntity(uid, raw),
              },
            });
          }
          this.integrations.setCursor(binding.id, { lastUid: newest });
        } finally { client.close(); }
      } catch (error) {
        this.integrations.setCursor(binding.id, cursor, error instanceof Error ? error.message : "Ошибка IMAP");
      }
    }
  }
}

class MinimalImapClient {
  private sequence = 0;
  private buffer = "";
  private waiter?: { tag: string; resolve(value: string): void; reject(error: Error): void };
  private constructor(private readonly socket: TLSSocket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      const waiter = this.waiter;
      if (!waiter) return;
      const match = this.buffer.match(new RegExp(`^${waiter.tag} (OK|NO|BAD)[^\\r\\n]*`, "m"));
      if (!match) return;
      const response = this.buffer;
      this.buffer = "";
      this.waiter = undefined;
      match[1] === "OK" ? waiter.resolve(response) : waiter.reject(new Error(match[0]));
    });
  }
  static connect(host: string, port: number): Promise<MinimalImapClient> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host, port, servername: host, rejectUnauthorized: true }, () => resolve(new MinimalImapClient(socket)));
      socket.setTimeout(15_000, () => socket.destroy(new Error("Таймаут IMAP")));
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
  close(): void { this.socket.end(); }
}

const quote = (value: string) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
const header = (raw: string, name: string) => raw.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";

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
  const literal = value.match(/BODY\[\][^{]*\{\d+\}\r?\n([\s\S]*?)\r?\n\)\r?\nZVS\d+ /i);
  return literal?.[1] ?? value;
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
      ? { name: decodeMimeWords(match[1]?.trim() ?? "") || null, address: match[2]!.trim() }
      : { name: null, address: part.trim() };
  });
}

function decodeMimeWords(value: string) {
  return value.replace(/=\?UTF-8\?([BQ])\?([^?]+)\?=/gi, (_all, encoding: string, data: string) => {
    try {
      return encoding.toUpperCase() === "B"
        ? Buffer.from(data, "base64").toString("utf8")
        : decodeQuotedPrintable(data.replaceAll("_", " "));
    } catch {
      return data;
    }
  });
}

function decodeQuotedPrintable(value: string) {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "=" && /^[0-9A-F]{2}$/i.test(value.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(value.slice(index + 1, index + 3), 16));
      index += 2;
    } else bytes.push(value.charCodeAt(index));
  }
  return Buffer.from(bytes).toString("utf8");
}

function extractTextBody(headers: string, body: string) {
  const transferEncoding = header(headers, "Content-Transfer-Encoding").toLowerCase();
  const contentType = header(headers, "Content-Type").toLowerCase();
  if (contentType.includes("multipart/")) {
    const boundary = header(headers, "Content-Type").match(/boundary=\"?([^\";]+)\"?/i)?.[1];
    if (boundary) {
      const part = body.split(`--${boundary}`).find((item) => /content-type:\s*text\/plain/i.test(item));
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
    ? decoded.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : decoded.trim();
}

function decodeBody(value: string, encoding: string) {
  if (/base64/i.test(encoding)) {
    try { return Buffer.from(value.replace(/\s/g, ""), "base64").toString("utf8"); } catch { return value; }
  }
  return /quoted-printable/i.test(encoding)
    ? decodeQuotedPrintable(value.replace(/=\r?\n/g, ""))
    : value;
}

function extractAttachmentMetadata(source: string): EmailMessageEntity["attachments"] {
  return [...source.matchAll(/Content-Disposition:\s*attachment(?:;[^\r\n]*)?(?:\r?\n[ \t][^\r\n]*)*/gi)].map((match, index) => {
    const block = match[0];
    const fileName = block.match(/filename\*?=(?:UTF-8''|\")?([^\";\r\n]+)/i)?.[1];
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
