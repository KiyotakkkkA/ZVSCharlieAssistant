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

  constructor(private readonly secrets: SecretStorageRepository) {}

  async exportData(input: ExportDataInput): Promise<boolean> {
    const result = await dialog.showSaveDialog({
      title: "Экспорт данных",
      defaultPath: `zvs-data-${new Date().toISOString().slice(0, 10)}.zvs-data`,
      filters: [{ name: "Данные ZVS", extensions: ["zvs-data"] }],
    });
    if (result.canceled || !result.filePath) return false;

    const secretStorage = this.secrets.exportPortable();
    const payload: DataTransferPayload = {
      sections: {
        secretStorage: {
          ...secretStorage,
          secrets: input.entities.includes("secrets")
            ? secretStorage.secrets
            : [],
        },
      },
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
      ...this.secrets.previewPortable(payload.sections.secretStorage),
    };
  }

  commitImport(input: CommitImportInput): ImportResult {
    this.removeExpiredSessions();
    const session = this.sessions.get(input.sessionId);
    if (!session)
      throw new Error("Сессия импорта истекла. Выберите файл повторно.");
    try {
      return this.secrets.importPortable(
        session.payload.sections.secretStorage,
        input.conflictPolicy,
      );
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
}
