import { ipcMain } from "electron";
import type { IntegrationProfileService } from "../../host/application/services/integration-profile.service";
import {
  parseIpcDto,
  upsertIntegrationProfileDtoSchema,
  type UpsertIntegrationProfileInput,
} from "../../shared/dto";
import { INTEGRATION_IPC_CHANNELS } from "../contracts/integration.contract";

export function registerIntegrationHandlers(
  service: IntegrationProfileService,
): void {
  ipcMain.handle(INTEGRATION_IPC_CHANNELS.getSnapshot, () =>
    service.snapshot(),
  );
  ipcMain.handle(
    INTEGRATION_IPC_CHANNELS.upsert,
    (_event, raw: UpsertIntegrationProfileInput) =>
      service.upsert(parseIpcDto(upsertIntegrationProfileDtoSchema, raw)),
  );
  ipcMain.handle(INTEGRATION_IPC_CHANNELS.delete, (_event, id: number) =>
    service.delete(id),
  );
  ipcMain.handle(
    INTEGRATION_IPC_CHANNELS.test,
    (_event, raw: UpsertIntegrationProfileInput) =>
      service.test(parseIpcDto(upsertIntegrationProfileDtoSchema, raw)),
  );
}

export function removeIntegrationHandlers(): void {
  for (const channel of Object.values(INTEGRATION_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
