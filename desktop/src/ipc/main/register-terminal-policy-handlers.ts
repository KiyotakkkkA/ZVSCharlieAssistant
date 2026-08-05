import { app, ipcMain } from "electron";
import type { UpsertTerminalPolicyInput } from "../../shared/dto";
import type { TerminalPolicyDataSource } from "../../host/infrastructure/database/terminal-policy.data-source";
import type { CommandExecutionService } from "../../host/infrastructure/tools/command-execution.service";
import { TERMINAL_POLICY_IPC_CHANNELS } from "../contracts/terminal-policy.contract";
import {
  parseIpcDto,
  upsertTerminalPolicyDtoSchema,
} from "../../shared/dto";

export function registerTerminalPolicyHandlers(
  data: TerminalPolicyDataSource,
  commands: CommandExecutionService,
) {
  ipcMain.handle(TERMINAL_POLICY_IPC_CHANNELS.get, () => data.get());
  ipcMain.handle(
    TERMINAL_POLICY_IPC_CHANNELS.upsert,
    (_event, input: UpsertTerminalPolicyInput) =>
      data.upsert(parseIpcDto(upsertTerminalPolicyDtoSchema, input)),
  );
  ipcMain.handle(
    TERMINAL_POLICY_IPC_CHANNELS.recommended,
    (): UpsertTerminalPolicyInput => ({
      enabled: true,
      confirmationMode: "always",
      maxConcurrentSessions: 2,
      defaultTimeoutSeconds: 60,
      maxTimeoutSeconds: 300,
      maxOutputBytes: 1_048_576,
      allowNetwork: false,
      allowedCommands: [
        "Get-ChildItem",
        "Get-Content",
        "Get-Item",
        "Test-Path",
        "Select-String",
        "Measure-Object",
        "Select-Object",
        "Sort-Object",
        "New-Item",
        "Set-Content",
        "Add-Content",
      ],
      directoryGrants: [
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
  ipcMain.handle(TERMINAL_POLICY_IPC_CHANNELS.pendingApprovals, () =>
    commands.pendingApprovals(),
  );
  ipcMain.handle(
    TERMINAL_POLICY_IPC_CHANNELS.decideApproval,
    (_event, id: string, approved: boolean) =>
      commands.decideApproval(id, approved),
  );
}

export function removeTerminalPolicyHandlers() {
  for (const channel of Object.values(TERMINAL_POLICY_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
