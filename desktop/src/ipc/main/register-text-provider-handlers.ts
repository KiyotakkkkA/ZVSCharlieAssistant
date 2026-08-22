import { ipcMain } from "electron";
import type { ProviderConnectionService } from "../../host/infrastructure/text-generation/provider-connection.service";
import { TEXT_PROVIDER_IPC_CHANNELS } from "../contracts";
import {
  parseIpcDto,
  testTextProviderConnectionDtoSchema,
  upsertTextProviderDtoSchema,
  type TestTextProviderConnectionInput,
  type UpsertTextProviderInput,
} from "../../shared/dto";

export function registerTextProviderHandlers(
  service: ProviderConnectionService,
): void {
  ipcMain.handle(TEXT_PROVIDER_IPC_CHANNELS.getSnapshot, () =>
    service.getSnapshot(),
  );
  ipcMain.handle(
    TEXT_PROVIDER_IPC_CHANNELS.testConnection,
    (_event, input: TestTextProviderConnectionInput) =>
      service.testConnection(
        parseIpcDto(testTextProviderConnectionDtoSchema, input),
      ),
  );
  ipcMain.handle(
    TEXT_PROVIDER_IPC_CHANNELS.upsertProvider,
    (_event, input: UpsertTextProviderInput) =>
      service.upsertProvider(parseIpcDto(upsertTextProviderDtoSchema, input)),
  );
  ipcMain.handle(
    TEXT_PROVIDER_IPC_CHANNELS.deleteProvider,
    (_event, id: string) => service.deleteProvider(id),
  );
}

export function removeTextProviderHandlers(): void {
  for (const channel of Object.values(TEXT_PROVIDER_IPC_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }
}
