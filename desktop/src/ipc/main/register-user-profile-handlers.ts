import { ipcMain } from "electron";
import type { UserProfileRepository } from "../../host/infrastructure/database/user-profile.repository";
import {
  parseIpcDto,
  upsertUserProfileDtoSchema,
  type UpsertUserProfileInput,
} from "../../shared/dto";
import { USER_PROFILE_IPC_CHANNELS } from "../contracts/user-profile.contract";

export function registerUserProfileHandlers(data: UserProfileRepository) {
  ipcMain.handle(USER_PROFILE_IPC_CHANNELS.get, () => data.get());
  ipcMain.handle(
    USER_PROFILE_IPC_CHANNELS.upsert,
    (_event, input: UpsertUserProfileInput) =>
      data.upsert(parseIpcDto(upsertUserProfileDtoSchema, input)),
  );
}

export function removeUserProfileHandlers() {
  for (const channel of Object.values(USER_PROFILE_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
