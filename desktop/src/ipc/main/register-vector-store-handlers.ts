import { ipcMain } from "electron";
import type { VectorStoreService } from "../../host/infrastructure/vector-store/vector-store.service";
import {
  VECTOR_STORE_IPC_CHANNELS,
  type UploadVectorDocumentInput,
  type UpsertVectorStoreInput,
  type VectorSearchInput,
} from "../contracts";

export function registerVectorStoreHandlers(service: VectorStoreService) {
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.getSnapshot, () =>
    service.snapshot(),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.upsertStore,
    (_event, input: UpsertVectorStoreInput) => service.upsert(input),
  );
  ipcMain.handle(VECTOR_STORE_IPC_CHANNELS.deleteStore, (_event, id: number) =>
    service.deleteStore(id),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.uploadDocuments,
    (_event, input: UploadVectorDocumentInput[]) => service.upload(input),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.deleteDocument,
    (_event, id: number) => service.deleteDocument(id),
  );
  ipcMain.handle(
    VECTOR_STORE_IPC_CHANNELS.search,
    (_event, input: VectorSearchInput) => service.search(input),
  );
}

export function removeVectorStoreHandlers() {
  for (const channel of Object.values(VECTOR_STORE_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
