import { app, dialog } from "electron";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { readFile, stat, writeFile } from "node:fs/promises";
import type {
  CommitImportInput,
  DataTransferEntity,
  ExportDataInput,
  PrepareImportInput,
} from "../../../shared/dto";
import { resolveDataTransferEntities } from "../../../shared/dto";
import type {
  ImportPreview,
  ImportResult,
} from "../../../shared/models/data-transfer";
import type { SecretStorageRepository } from "../database/secret-storage.repository";
import type { TerminalPolicyRepository } from "../database/terminal-policy.repository";
import type { MemoryRepository } from "../database/memory.repository";
import type { AutomationRepository } from "../database/automation.repository";
import type { ConfigurationTransferRepository } from "./configuration-transfer.repository";
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
    private readonly configuration: ConfigurationTransferRepository,
  ) {}

  async exportData(input: ExportDataInput): Promise<boolean> {
    const result = await dialog.showSaveDialog({
      title: "Экспорт данных",
      defaultPath: `zvs-data-${new Date().toISOString().slice(0, 10)}.zvs-data`,
      filters: [{ name: "Данные ZVS", extensions: ["zvs-data"] }],
    });
    if (result.canceled || !result.filePath) return false;

    const entities = new Set<DataTransferEntity>(
      resolveDataTransferEntities(input.entities),
    );
    const sections: DataTransferPayload["sections"] = {
      ...this.configuration.exportSections(entities),
    };
    if (
      entities.has("secretCategories") ||
      entities.has("secrets")
    ) {
      const secretStorage = this.secrets.exportPortable();
      sections.secretStorage = {
        ...secretStorage,
        secrets: entities.has("secrets")
          ? secretStorage.secrets
          : [],
      };
    }
    if (entities.has("terminalPolicy")) {
      const { updatedAt: _updatedAt, ...value } = this.terminalPolicy.get();
      sections.terminalPolicy = { version: 1, value };
    }
    if (entities.has("memoryPolicy")) {
      const { updatedAt: _updatedAt, ...value } = this.memory.policy();
      sections.memoryPolicy = { version: 1, value };
    }
    if (entities.has("skills")) {
      sections.skills = {
        version: 2,
        items: this.automation
          .getSnapshot()
          .skills.filter((skill) => !skill.builtin)
          .map(
            ({
              builtin: _builtin,
              assignedAgentsCount: _assignedAgentsCount,
              updatedAt: _updatedAt,
              ...skill
            }) => skill,
          ),
      };
    }
    const payload = dataTransferPayloadSchema.parse({
      sections,
    });
    const serialized = createJsonContainer(
      payload,
      input.encryption === "password" ? input.password : null,
      app.getVersion(),
    );
    if (Buffer.byteLength(serialized, "utf8") > MAX_IMPORT_BYTES)
      throw new Error("Размер экспортируемой копии превышает допустимые 20 МБ");
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
    const secretPreview = payload.sections.secretStorage
      ? this.secrets.previewPortable(payload.sections.secretStorage)
      : {
          categories: { create: 0, update: 0, conflict: 0 },
          secrets: { create: 0, update: 0, conflict: 0 },
          conflicts: [],
        };
    const skillPreview = this.previewSkills(payload);
    const skillConflicts = this.previewSkillConflicts(payload);
    const configurationPreview = this.configuration.preview(payload);
    return {
      sessionId,
      fileName: basename(filePath),
      ...secretPreview,
      policies: {
        terminal: Boolean(payload.sections.terminalPolicy),
        memory: Boolean(payload.sections.memoryPolicy),
      },
      skills: skillPreview,
      entities: {
        ...(payload.sections.secretStorage
          ? {
              secretCategories: secretPreview.categories,
              secrets: secretPreview.secrets,
            }
          : {}),
        ...(payload.sections.skills ? { skills: skillPreview } : {}),
        ...configurationPreview.entities,
      },
      missingDependencies: configurationPreview.missingDependencies,
      conflicts: [
        ...secretPreview.conflicts,
        ...skillConflicts,
        ...configurationPreview.conflicts,
      ],
    };
  }

  commitImport(input: CommitImportInput): ImportResult {
    this.removeExpiredSessions();
    const session = this.sessions.get(input.sessionId);
    if (!session)
      throw new Error("Сессия импорта истекла. Выберите файл повторно.");
    try {
      const blockingConflicts = [
        ...(session.payload.sections.secretStorage
          ? this.secrets.previewPortable(session.payload.sections.secretStorage)
              .conflicts
          : []),
        ...this.previewSkillConflicts(session.payload),
        ...this.configuration.preview(session.payload).conflicts,
      ];
      if (blockingConflicts.length)
        throw new Error(
          `Импорт заблокирован конфликтом идентификаторов: ${blockingConflicts[0]!.reason}`,
        );
      return this.configuration.transaction(() => {
        const result: ImportResult = {
          categories: { create: 0, update: 0 },
          secrets: { create: 0, update: 0 },
          policies: 0,
          skills: { create: 0, update: 0 },
          entities: {},
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
            this.automation
              .getSnapshot()
              .skills.map((skill) => [skill.slug, skill]),
          );
          const existingById = new Map(
            this.automation
              .getSnapshot()
              .skills.map((skill) => [skill.id, skill]),
          );
          for (const skill of sections.skills.items) {
            const current =
              existingById.get(skill.id) ?? existing.get(skill.slug);
            if (
              current?.builtin ||
              (current && input.conflictPolicy === "skip")
            ) {
              result.skipped++;
              continue;
            }
            this.automation.upsertSkill({
              ...skill,
              id: current?.id ?? skill.id,
            });
            if (current) result.skills.update++;
            else result.skills.create++;
          }
        }
        const configurationResult = this.configuration.import(
          session.payload,
          input.conflictPolicy,
        );
        result.entities = {
          secretCategories: result.categories,
          secrets: result.secrets,
          skills: result.skills,
          ...configurationResult.entities,
        };
        result.skipped += configurationResult.skipped;
        return result;
      });
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
    const existingById = new Map(
      this.automation.getSnapshot().skills.map((skill) => [skill.id, skill]),
    );
    for (const skill of section.items) {
      const byId = existingById.get(skill.id);
      const bySlug = existing.get(skill.slug);
      if (!byId && !bySlug) counts.create++;
      else if (byId?.builtin || (bySlug && bySlug.id !== skill.id))
        counts.conflict++;
      else counts.update++;
    }
    return counts;
  }

  private previewSkillConflicts(
    payload: DataTransferPayload,
  ): ImportPreview["conflicts"] {
    const section = payload.sections.skills;
    if (!section) return [];
    const snapshot = this.automation.getSnapshot().skills;
    const byId = new Map(snapshot.map((skill) => [skill.id, skill]));
    const bySlug = new Map(snapshot.map((skill) => [skill.slug, skill]));
    return section.items.flatMap((skill) => {
      const idMatch = byId.get(skill.id);
      const slugMatch = bySlug.get(skill.slug);
      if (idMatch?.builtin)
        return [
          {
            kind: "skills",
            label: skill.name,
            reason: "UUID принадлежит системному навыку",
          },
        ];
      if (slugMatch && slugMatch.id !== skill.id)
        return [
          {
            kind: "skills",
            label: skill.name,
            reason: "Навык с таким slug уже имеет другой UUID",
          },
        ];
      return [];
    });
  }
}
