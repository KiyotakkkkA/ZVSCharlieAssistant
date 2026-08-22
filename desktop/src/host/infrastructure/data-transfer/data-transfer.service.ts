import { app, dialog } from "electron";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { readFile, stat, writeFile } from "node:fs/promises";
import type {
  CommitImportInput,
  ExportDataInput,
  PrepareImportInput,
} from "../../../shared/dto";
import type {
  ImportPreview,
  ImportResult,
} from "../../../shared/models/data-transfer";
import type { SecretStorageRepository } from "../database/secret-storage.repository";
import type { TerminalPolicyRepository } from "../database/terminal-policy.repository";
import type { MemoryRepository } from "../database/memory.repository";
import type { AutomationRepository } from "../database/automation.repository";
import {
  decryptJsonContainer,
  createJsonContainer,
} from "./encrypted-json-container";
import {
  dataTransferPayloadSchema,
  type DataTransferPayload,
} from "./secret-storage-transfer";

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const SESSION_TTL_MS = 10 * 60 * 1000;

interface ImportSession {
  payload: DataTransferPayload;
  expiresAt: number;
}

export class DataTransferService {
  private readonly sessions = new Map<string, ImportSession>();

  constructor(
    private readonly secrets: SecretStorageRepository,
    private readonly terminalPolicy: TerminalPolicyRepository,
    private readonly memory: MemoryRepository,
    private readonly automation: AutomationRepository,
  ) {}

  async exportData(input: ExportDataInput): Promise<boolean> {
    const result = await dialog.showSaveDialog({
      title: "Экспорт данных",
      defaultPath: `zvs-data-${new Date().toISOString().slice(0, 10)}.zvs-data`,
      filters: [{ name: "Данные ZVS", extensions: ["zvs-data"] }],
    });
    if (result.canceled || !result.filePath) return false;

    const sections: DataTransferPayload["sections"] = {};
    if (
      input.entities.includes("secretCategories") ||
      input.entities.includes("secrets")
    ) {
      const secretStorage = this.secrets.exportPortable();
      sections.secretStorage = {
        ...secretStorage,
        secrets: input.entities.includes("secrets")
          ? secretStorage.secrets
          : [],
      };
    }
    if (input.entities.includes("terminalPolicy")) {
      const { updatedAt: _updatedAt, ...value } = this.terminalPolicy.get();
      sections.terminalPolicy = { version: 1, value };
    }
    if (input.entities.includes("memoryPolicy")) {
      const { updatedAt: _updatedAt, ...value } = this.memory.policy();
      sections.memoryPolicy = { version: 1, value };
    }
    if (input.entities.includes("skills")) {
      sections.skills = {
        version: 1,
        items: this.automation
          .getSnapshot()
          .skills.filter((skill) => !skill.builtin)
          .map(
            ({
              id: _id,
              builtin: _builtin,
              assignedAgentsCount: _assignedAgentsCount,
              updatedAt: _updatedAt,
              ...skill
            }) => skill,
          ),
      };
    }
    const payload: DataTransferPayload = {
      sections,
    };
    const serialized = createJsonContainer(
      payload,
      input.encryption === "password" ? input.password : null,
      app.getVersion(),
    );
    await writeFile(result.filePath, serialized, {
      encoding: "utf8",
      mode: 0o600,
    });
    return true;
  }

  async prepareImport(input: PrepareImportInput): Promise<ImportPreview | null> {
    this.removeExpiredSessions();
    const result = await dialog.showOpenDialog({
      title: "Импорт данных",
      properties: ["openFile"],
      filters: [{ name: "Данные ZVS", extensions: ["zvs-data"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const filePath = result.filePaths[0];
    if ((await stat(filePath)).size > MAX_IMPORT_BYTES)
      throw new Error("Файл импорта превышает допустимый размер 20 МБ");
    const source = await readFile(filePath, "utf8");
    const payload = dataTransferPayloadSchema.parse(
      decryptJsonContainer(source, input.password),
    );
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      payload,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return {
      sessionId,
      fileName: basename(filePath),
      ...(payload.sections.secretStorage
        ? this.secrets.previewPortable(payload.sections.secretStorage)
        : {
            categories: { create: 0, update: 0, conflict: 0 },
            secrets: { create: 0, update: 0, conflict: 0 },
            conflicts: [],
          }),
      policies: {
        terminal: Boolean(payload.sections.terminalPolicy),
        memory: Boolean(payload.sections.memoryPolicy),
      },
      skills: this.previewSkills(payload),
    };
  }

  commitImport(input: CommitImportInput): ImportResult {
    this.removeExpiredSessions();
    const session = this.sessions.get(input.sessionId);
    if (!session)
      throw new Error("Сессия импорта истекла. Выберите файл повторно.");
    try {
      const result: ImportResult = {
        categories: { create: 0, update: 0 },
        secrets: { create: 0, update: 0 },
        policies: 0,
        skills: { create: 0, update: 0 },
        skipped: 0,
      };
      const sections = session.payload.sections;
      if (sections.secretStorage) {
        const secretResult = this.secrets.importPortable(
          sections.secretStorage,
          input.conflictPolicy,
        );
        result.categories = secretResult.categories;
        result.secrets = secretResult.secrets;
        result.skipped += secretResult.skipped;
      }
      if (sections.terminalPolicy) {
        this.terminalPolicy.upsert(sections.terminalPolicy.value);
        result.policies++;
      }
      if (sections.memoryPolicy) {
        this.memory.upsertPolicy(sections.memoryPolicy.value);
        result.policies++;
      }
      if (sections.skills) {
        const existing = new Map(
          this.automation.getSnapshot().skills.map((skill) => [skill.slug, skill]),
        );
        for (const skill of sections.skills.items) {
          const current = existing.get(skill.slug);
          if (current?.builtin || (current && input.conflictPolicy === "skip")) {
            result.skipped++;
            continue;
          }
          this.automation.upsertSkill({
            ...skill,
            ...(current ? { id: current.id } : {}),
          });
          if (current) result.skills.update++;
          else result.skills.create++;
        }
      }
      return result;
    } finally {
      this.sessions.delete(input.sessionId);
    }
  }

  cancelImport(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private removeExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions)
      if (session.expiresAt <= now) this.sessions.delete(id);
  }

  private previewSkills(payload: DataTransferPayload) {
    const counts = { create: 0, update: 0, conflict: 0 };
    const section = payload.sections.skills;
    if (!section) return counts;
    const existing = new Map(
      this.automation.getSnapshot().skills.map((skill) => [skill.slug, skill]),
    );
    for (const skill of section.items) {
      const current = existing.get(skill.slug);
      if (!current) counts.create++;
      else if (current.builtin) counts.conflict++;
      else counts.update++;
    }
    return counts;
  }
}
