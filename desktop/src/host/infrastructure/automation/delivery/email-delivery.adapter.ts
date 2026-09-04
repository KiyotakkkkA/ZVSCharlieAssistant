import { connect as connectTcp, type Socket } from "node:net";
import { connect as connectTls, type TLSSocket } from "node:tls";
import type { IntegrationRepository } from "../../database/integration.repository";
import type { SecretStorageRepository } from "../../database/secret-storage.repository";
import type { ScenarioDeliveryJob } from "../../database/scenario-delivery.repository";
import type { ScenarioFileReaderService } from "../scenario-file-reader.service";
import type { ScenarioBinaryRef } from "../../../../shared/scenario/items";
import type { ScenarioDeliveryAdapter } from "./scenario-delivery.adapter";
import type { ScenarioEffectRepository } from "../../database/scenario-effect.repository";
import { effectKey } from "../effect-key";

type MailSocket = Socket | TLSSocket;

interface MailAttachment {
  fileName: string;
  mimeType: string | null;
  buffer: Buffer;
}

export class EmailDeliveryAdapter implements ScenarioDeliveryAdapter {
  readonly channel = "email" as const;
  constructor(
    private integrations: IntegrationRepository,
    private secrets: SecretStorageRepository,
    private fileReader: ScenarioFileReaderService,
    private effects: ScenarioEffectRepository,
  ) {}

  async deliver(job: ScenarioDeliveryJob) {
    const profile = this.integrations.findProfile(job.integrationProfileId);
    if (
      !profile ||
      profile.kind !== "email_imap" ||
      !profile.enabled ||
      profile.status !== "connected"
    )
      throw new Error("Почтовая интеграция недоступна");
    const host = profile.config.smtpHost;
    const port = profile.config.smtpPort;
    const username = profile.config.username;
    const from = profile.config.smtpFrom ?? username;
    const passwordId = profile.secretBindings.password;
    const password = passwordId
      ? this.secrets.findSecret(passwordId)?.content
      : undefined;
    if (!host || !port || !username || !from || !password)
      throw new Error(
        "Заполните SMTP host, порт, отправителя и пароль интеграции",
      );
    const subject = String(job.payload.subject ?? "Ответ ZVS Assistant");
    const text = String(job.payload.text ?? "");
    const key = effectKey({
      executionId: job.executionId,
      nodeId: job.id,
      iteration: 0,
      kind: "delivery.email.message",
      payload: { recipient: job.recipient, subject, text },
    });
    if (this.effects.find(key)) return;

    const refs = Array.isArray(job.payload.attachments)
      ? (job.payload.attachments as ScenarioBinaryRef[])
      : [];
    const attachments: MailAttachment[] = await Promise.all(
      refs.map(async (ref) => ({
        fileName: ref.fileName,
        mimeType: ref.mimeType,
        buffer: await this.fileReader.readBinary(ref),
      })),
    );
    await sendSmtp({
      host,
      port,
      secure: profile.config.smtpSecure ?? port === 465,
      username,
      password,
      from,
      to: job.recipient,
      subject,
      text,
      inReplyTo:
        typeof job.payload.inReplyTo === "string"
          ? job.payload.inReplyTo
          : undefined,
      attachments,
    });
    this.effects.record({
      idempotencyKey: key,
      executionId: job.executionId,
      nodeId: job.id,
      kind: "delivery.email.message",
      result: null,
    });
  }
}

async function sendSmtp(mail: {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  attachments?: MailAttachment[];
}) {
  let socket: MailSocket = await connect(mail.host, mail.port, mail.secure);
  let reader = new SmtpReader(socket);
  await reader.expect(220);
  let hello = await command(socket, reader, `EHLO zvs-assistant`, 250);
  if (!mail.secure && /STARTTLS/i.test(hello)) {
    await command(socket, reader, "STARTTLS", 220);
    socket = await upgradeTls(socket, mail.host);
    reader.dispose();
    reader = new SmtpReader(socket);
    await command(socket, reader, "EHLO zvs-assistant", 250);
  }
  await command(socket, reader, "AUTH LOGIN", 334);
  await command(
    socket,
    reader,
    Buffer.from(mail.username).toString("base64"),
    334,
  );
  await command(
    socket,
    reader,
    Buffer.from(mail.password).toString("base64"),
    235,
  );
  await command(socket, reader, `MAIL FROM:<${mail.from}>`, 250);
  await command(socket, reader, `RCPT TO:<${mail.to}>`, 250);
  await command(socket, reader, "DATA", 354);
  socket.write(`${mimeMessage(mail)}\r\n.\r\n`);
  await reader.expect(250);
  try {
    await command(socket, reader, "QUIT", 221);
  } finally {
    reader.dispose();
    socket.end();
  }
}

function connect(
  host: string,
  port: number,
  secure: boolean,
): Promise<MailSocket> {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? connectTls({ host, port, servername: host })
      : connectTcp({ host, port });
    socket.setTimeout(20_000, () => socket.destroy(new Error("Таймаут SMTP")));
    socket.once("error", reject);
    socket.once(secure ? "secureConnect" : "connect", () => resolve(socket));
  });
}
function upgradeTls(socket: Socket, host: string): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const tls = connectTls({ socket, servername: host });
    tls.once("secureConnect", () => resolve(tls));
    tls.once("error", reject);
  });
}
async function command(
  socket: MailSocket,
  reader: SmtpReader,
  value: string,
  code: number,
) {
  socket.write(`${value}\r\n`);
  return reader.expect(code);
}
function base64Body(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n")
    .trimEnd();
}

function mimeMessage(mail: {
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  attachments?: MailAttachment[];
}) {
  const headers = [
    `From: <${mail.from}>`,
    `To: <${mail.to}>`,
    `Subject: =?UTF-8?B?${Buffer.from(mail.subject).toString("base64")}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@zvs-assistant>`,
    "MIME-Version: 1.0",
  ];
  if (mail.inReplyTo)
    headers.push(
      `In-Reply-To: ${mail.inReplyTo}`,
      `References: ${mail.inReplyTo}`,
    );

  const attachments = mail.attachments ?? [];
  if (attachments.length === 0) {
    headers.push(
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
    );
    return `${headers.join("\r\n")}\r\n\r\n${base64Body(Buffer.from(mail.text))}`;
  }

  const boundary = `zvs-${crypto.randomUUID()}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const parts = [
    [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Body(Buffer.from(mail.text)),
    ].join("\r\n"),
    ...attachments.map((attachment) =>
      [
        `--${boundary}`,
        `Content-Type: ${attachment.mimeType ?? "application/octet-stream"}; name="${attachment.fileName}"`,
        `Content-Disposition: attachment; filename="${attachment.fileName}"`,
        "Content-Transfer-Encoding: base64",
        "",
        base64Body(attachment.buffer),
      ].join("\r\n"),
    ),
    `--${boundary}--`,
  ];
  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}

class SmtpReader {
  private buffer = "";
  private pending?: {
    resolve(value: string): void;
    reject(error: Error): void;
  };
  constructor(private socket: MailSocket) {
    socket.on("data", this.onData);
    socket.on("error", this.onError);
  }
  expect(code: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.flush(code);
    });
  }
  dispose() {
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onError);
  }
  private onData = (data: Buffer) => {
    this.buffer += data.toString("utf8");
  };
  private onError = (error: Error) => {
    this.pending?.reject(error);
    this.pending = undefined;
  };
  private flush(expected: number) {
    const poll = () => {
      const lines = this.buffer.split("\r\n");
      const end = lines.findIndex((line) => /^\d{3} /.test(line));
      if (end < 0) {
        setTimeout(poll, 5);
        return;
      }
      const response = lines.slice(0, end + 1).join("\r\n");
      this.buffer = lines.slice(end + 1).join("\r\n");
      const actual = Number(
        response.slice(-lines[end]!.length, -lines[end]!.length + 3),
      );
      const pending = this.pending;
      this.pending = undefined;
      if (actual !== expected) pending?.reject(new Error(`SMTP ${response}`));
      else pending?.resolve(response);
    };
    poll();
  }
}
