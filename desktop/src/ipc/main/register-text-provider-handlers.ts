import { ipcMain } from "electron";
import type { ProviderConnectionService } from "../../host/infrastructure/text-generation/provider-connection.service";
import {
  TEXT_PROVIDER_IPC_CHANNELS,
  type TestTextProviderConnectionInput,
  type UpsertTextProviderInput,
} from "../contracts";

export function registerTextProviderHandlers(
  service: ProviderConnectionService,
): void {
  ipcMain.handle(TEXT_PROVIDER_IPC_CHANNELS.getSnapshot, () =>
    service.getSnapshot(),
  );
  ipcMain.handle(
    TEXT_PROVIDER_IPC_CHANNELS.testConnection,
    (_event, input: TestTextProviderConnectionInput) =>
      service.testConnection(input),
  );
  ipcMain.handle(
    TEXT_PROVIDER_IPC_CHANNELS.upsertProvider,
    (_event, input: UpsertTextProviderInput) => service.upsertProvider(input),
  );
  ipcMain.handle(
    TEXT_PROVIDER_IPC_CHANNELS.deleteProvider,
    (_event, id: number) => service.deleteProvider(id),
  );
}

export function removeTextProviderHandlers(): void {
  for (const channel of Object.values(TEXT_PROVIDER_IPC_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }
}
