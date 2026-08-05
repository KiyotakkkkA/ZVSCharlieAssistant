import { ipcMain } from "electron";
import type { VectorStoreService } from "../../host/infrastructure/vector-store/vector-store.service";
import {
  VECTOR_STORE_IPC_CHANNELS,
} from "../contracts";
import {
  parseIpcDto,
  uploadVectorDocumentDtoSchema,
  upsertVectorStoreDtoSchema,
  vectorSearchDtoSchema,
  type UploadVectorDocumentInput,
  type UpsertVectorStoreInput,
  type VectorSearchInput,
} from "../../shared/dto";

export function registerVectorStoreHandlers(service: VectorStoreService) {
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.getSnapshot, () =>
    service.snapshot(),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.getDocuments,
    (_event, ids: number[]) => service.documents(ids),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.upsertStore,
    (_event, input: UpsertVectorStoreInput) =>
      service.upsert(parseIpcDto(upsertVectorStoreDtoSchema, input)),
  );
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.deleteStore, (_event, id: number) =>
    service.deleteStore(id),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.uploadDocuments,
    (_event, input: UploadVectorDocumentInput[]) =>
      service.upload(parseIpcDto(uploadVectorDocumentDtoSchema.array(), input)),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.deleteDocument,
    (_event, id: number) => service.deleteDocument(id),
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
