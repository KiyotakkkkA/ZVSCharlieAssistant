import { clipboard, ipcMain } from "electron";
import { SECRET_IPC_CHANNELS } from "../contracts";
import {
  entityIdSchema,
  parseIpcDto,
  upsertSecretCategoryDtoSchema,
  upsertSecretDtoSchema,
  type UpsertSecretCategoryInput,
  type UpsertSecretInput,
} from "../../shared/dto";
import { SecretStorageRepository } from "@host/infrastructure/database/secret-storage.repository";

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
  ipcMain.handle(SECRET_IPC_CHANNELS.copySecret, (_event, id: string) => {
    const secret = repository.findSecret(parseIpcDto(entityIdSchema, id));
    if (!secret) throw new Error("Секрет не найден");
    clipboard.writeText(secret.content);
  });
  ipcMain.handle(
    SECRET_IPC_CHANNELS.upsertSecret,
    (_event, input: UpsertSecretInput) =>
      repository.upsertSecret(parseIpcDto(upsertSecretDtoSchema, input)),
  );
  ipcMain.handle(SECRET_IPC_CHANNELS.deleteCategory, (_event, id: string) =>
    repository.deleteCategory(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(SECRET_IPC_CHANNELS.deleteSecret, (_event, id: string) =>
    repository.deleteSecret(parseIpcDto(entityIdSchema, id)),
  );
}

export function removeSecretStorageHandlers(): void {
  for (const channel of Object.values(SECRET_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
