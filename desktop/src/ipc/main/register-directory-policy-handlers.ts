import { app, ipcMain } from "electron";
import type { DirectoryPolicyDataSource } from "../../host/infrastructure/database/directory-policy.data-source";
import {
  parseIpcDto,
  upsertDirectoryPolicyDtoSchema,
  type UpsertDirectoryPolicyInput,
} from "../../shared/dto";
import { DIRECTORY_POLICY_IPC_CHANNELS } from "../contracts/directory-policy.contract";

export function registerDirectoryPolicyHandlers(data: DirectoryPolicyDataSource) {
  ipcMain.handle(DIRECTORY_POLICY_IPC_CHANNELS.get, () => data.get());
  ipcMain.handle(
    DIRECTORY_POLICY_IPC_CHANNELS.upsert,
    (_event, input: UpsertDirectoryPolicyInput) =>
      data.upsert(parseIpcDto(upsertDirectoryPolicyDtoSchema, input)),
  );
  ipcMain.handle(
    DIRECTORY_POLICY_IPC_CHANNELS.recommended,
    (): UpsertDirectoryPolicyInput => ({
      grants: [
        {
          path: app.getPath("documents"),
          recursive: true,
          permissions: ["read", "create", "modify"],
        },
        {
          path: app.getPath("downloads"),
          recursive: true,
          permissions: ["read"],
        },
      ],
    }),
  );
}

export function removeDirectoryPolicyHandlers() {
  for (const channel of Object.values(DIRECTORY_POLICY_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}

