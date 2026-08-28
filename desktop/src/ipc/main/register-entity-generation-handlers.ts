import { BrowserWindow, ipcMain } from "electron";
import type { EntityGenerationService } from "../../host/application/services/entity-generation.service";
import {
  parseIpcDto,
  startEntityGenerationDtoSchema,
  entityIdSchema,
  type StartEntityGenerationInput,
} from "../../shared/dto";
import { ENTITY_GENERATION_IPC_CHANNELS } from "../contracts/entity-generation.contract";

const broadcast = (channel: string, payload: unknown) => {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send(channel, payload);
};

export function registerEntityGenerationHandlers(
  service: EntityGenerationService,
) {
  service.watch((event) =>
    broadcast(ENTITY_GENERATION_IPC_CHANNELS.runEvent, event),
  );

  ipcMain.handle(ENTITY_GENERATION_IPC_CHANNELS.list, () => service.list());
  ipcMain.handle(
    ENTITY_GENERATION_IPC_CHANNELS.start,
    (_event, input: StartEntityGenerationInput) =>
      service.start(parseIpcDto(startEntityGenerationDtoSchema, input)),
  );
  ipcMain.handle(
    ENTITY_GENERATION_IPC_CHANNELS.getTranscript,
    (_event, runId: string) =>
      service.getTranscript(parseIpcDto(entityIdSchema, runId)),
  );
}

export function removeEntityGenerationHandlers() {
  for (const channel of Object.values(ENTITY_GENERATION_IPC_CHANNELS))
    if (channel !== ENTITY_GENERATION_IPC_CHANNELS.runEvent)
      ipcMain.removeHandler(channel);
}
