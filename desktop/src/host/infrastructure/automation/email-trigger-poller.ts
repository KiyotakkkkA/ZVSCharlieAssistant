import { connect, type TLSSocket } from "node:tls";
import type { SecretStorageRepository } from "../../application/ports/secret-storage.repository";
import type { AutomationJobDataSource } from "../database/automation-job.data-source";
import type { IntegrationDataSource } from "../database/integration.data-source";

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
              input: { trigger: "email", uid, from, subject, rawMessage: raw },
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
