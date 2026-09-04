import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BrowserWindow, dialog, ipcMain } from "electron";
import type { VectorStoreService } from "../../host/infrastructure/vector-store/vector-store.service";
import type { NativeIndexerService } from "../../host/infrastructure/vector-store/native-indexer.service";
import type { ResourceMonitorService } from "../../host/infrastructure/system/resource-monitor.service";
import { VECTOR_STORE_IPC_CHANNELS } from "../contracts";
import {
  entityIdSchema,
  ocrProviderPreferenceSchema,
  parseIpcDto,
  uploadVectorDocumentDtoSchema,
  uploadVectorDirectoryDtoSchema,
  upsertVectorStoreDtoSchema,
  vectorSearchDtoSchema,
  type UploadVectorDocumentInput,
  type UploadVectorDirectoryInput,
  type UpsertVectorStoreInput,
  type VectorSearchInput,
} from "../../shared/dto";
import { scanVectorDirectory } from "./vector-directory";

export function registerVectorStoreHandlers(
  service: VectorStoreService,
  indexer: NativeIndexerService,
  monitor: ResourceMonitorService,
) {
  const selectedDirectories = new Set<string>();
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.getSnapshot, () =>
    service.snapshot(),
  );
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.getIndexingCapabilities, () =>
    indexer.capabilities(),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.setOcrProvider,
    (_event, preference: unknown) =>
      indexer.setProvider(parseIpcDto(ocrProviderPreferenceSchema, preference)),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.getDocuments,
    (_event, ids: string[]) =>
      service.documents(parseIpcDto(entityIdSchema.array().max(100), ids)),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.upsertStore,
    (_event, input: UpsertVectorStoreInput) =>
      service.upsert(parseIpcDto(upsertVectorStoreDtoSchema, input)),
  );
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.deleteStore, (_event, id: string) =>
    service.deleteStore(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.clearDocuments,
    (_event, id: string) =>
      service.clearDocuments(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.stopIndexing,
    () => service.stopIndexing(),
  );
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.resumeIndexing, () =>
    service.resumeIndexing(),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.getIngestProgress,
    (_event, id: string) => service.progress(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.startResourceMonitor, () => {
    monitor.subscribe();
  });
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.stopResourceMonitor, () => {
    monitor.unsubscribe();
  });
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.retryFailedDocuments,
    (_event, id: string) =>
      service.retryFailed(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.uploadDocuments,
    (_event, input: UploadVectorDocumentInput[]) =>
      service.upload(parseIpcDto(uploadVectorDocumentDtoSchema.array(), input)),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.selectDirectory,
    async (_event, rawMode) => {
      const mode = rawMode === "code" ? "code" : "documents";
      const result = await dialog.showOpenDialog({
        title: "Выберите папку для индексации",
        properties: ["openDirectory"],
      });
      const directoryPath = result.canceled ? undefined : result.filePaths[0];
      if (!directoryPath) return null;
      if (mode === "code") {
        const path = resolve(directoryPath);
        selectedDirectories.add(path);
        return {
          path,
          name: path.split(/[\\/]/).at(-1) || path,
          supportedFiles: 0,
          ignoredFiles: 0,
          totalBytes: 0,
          examples: [],
        };
      }
      const scanned = await scanVectorDirectory(directoryPath);
      selectedDirectories.add(scanned.preview.path);
      return scanned.preview;
    },
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.uploadDirectory,
    async (_event, rawInput: UploadVectorDirectoryInput) => {
      const input = parseIpcDto(uploadVectorDirectoryDtoSchema, rawInput);
      const directoryPath = resolve(input.directoryPath);
      if (!selectedDirectories.has(directoryPath))
        throw new Error("Выберите папку повторно");
      const { files } = await scanVectorDirectory(directoryPath);
      if (!files.length)
        throw new Error("В папке нет поддерживаемых документов");
      let queued = 0;
      for (const file of files) {
        const buffer = await readFile(file.absolutePath);
        try {
          await service.upload([
            {
              vectorStoreId: input.vectorStoreId,
              fileName: file.relativePath,
              mimeType: file.mimeType,
              data: buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength,
              ),
            },
          ]);
          queued += 1;
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message.includes("уже добавлен") ||
              error.message.includes("выбран повторно"))
          ) {
            continue;
          }
          throw error;
        }
      }
      if (!queued) throw new Error("Все документы из папки уже добавлены");
      return service.snapshot();
    },
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.deleteDocument,
    (_event, id: string) =>
      service.deleteDocument(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.search,
    (_event, input: VectorSearchInput) =>
      service.search(parseIpcDto(vectorSearchDtoSchema, input)),
  );
}

export function removeVectorStoreHandlers() {
  for (const channel of Object.values(VECTOR_STORE_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
