import { clipboard, ipcMain } from "electron";
import type { SecretStorageRepository } from "../../host/application/ports/secret-storage.repository";
import {
  SECRET_IPC_CHANNELS,
} from "../contracts";
import {
  parseIpcDto,
  upsertSecretCategoryDtoSchema,
  upsertSecretDtoSchema,
  type UpsertSecretCategoryInput,
  type UpsertSecretInput,
} from "../../shared/dto";

export function registerSecretStorageHandlers(
  repository: SecretStorageRepository,
): void {
  ipcMain.handle(SECRET_IPC_CHANNELS.getSnapshot, () =>
    repository.getSnapshot(),
  );
  ipcMain.handle(
    SECRET_IPC_CHANNELS.upsertCategory,
    (_event, input: UpsertSecretCategoryInput) =>
      repository.upsertCategory(
        parseIpcDto(upsertSecretCategoryDtoSchema, input),
      ),
  );
  ipcMain.handle(SECRET_IPC_CHANNELS.copySecret, (_event, id: number) => {
    const secret = repository.getSecret(id);
    if (!secret) throw new Error("Секрет не найден");
    clipboard.writeText(secret.content);
  });
  ipcMain.handle(
    SECRET_IPC_CHANNELS.upsertSecret,
    (_event, input: UpsertSecretInput) =>
      repository.upsertSecret(parseIpcDto(upsertSecretDtoSchema, input)),
  );
  ipcMain.handle(SECRET_IPC_CHANNELS.deleteCategory, (_event, id: number) =>
    repository.deleteCategory(id),
  );
  ipcMain.handle(SECRET_IPC_CHANNELS.deleteSecret, (_event, id: number) =>
    repository.deleteSecret(id),
  );
}

export function removeSecretStorageHandlers(): void {
  for (const channel of Object.values(SECRET_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
