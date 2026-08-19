import { ipcMain } from "electron";
import type { EntityGenerationService } from "../../host/application/services/entity-generation.service";
import {
  parseIpcDto,
  startEntityGenerationDtoSchema,
  type StartEntityGenerationInput,
} from "../../shared/dto";
import { ENTITY_GENERATION_IPC_CHANNELS } from "../contracts/entity-generation.contract";

export function registerEntityGenerationHandlers(
  service: EntityGenerationService,
) {
  ipcMain.handle(ENTITY_GENERATION_IPC_CHANNELS.list, () => service.list());
  ipcMain.handle(
    ENTITY_GENERATION_IPC_CHANNELS.start,
    (_event, input: StartEntityGenerationInput) =>
      service.start(parseIpcDto(startEntityGenerationDtoSchema, input)),
  );
}

export function removeEntityGenerationHandlers() {
  for (const channel of Object.values(ENTITY_GENERATION_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
