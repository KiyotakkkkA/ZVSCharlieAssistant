import { BrowserWindow, ipcMain } from "electron";
import type { UpsertTerminalPolicyInput } from "../../shared/dto";
import type { TerminalPolicyRepository } from "../../host/infrastructure/database/terminal-policy.repository";
import type { CommandExecutionService } from "../../host/infrastructure/tools/command-execution.service";
import { TERMINAL_POLICY_IPC_CHANNELS } from "../contracts/terminal-policy.contract";
import {
  booleanFlagSchema,
  entityKeySchema,
  parseIpcDto,
  upsertTerminalPolicyDtoSchema,
} from "../../shared/dto";
import { TERMINAL_CAPABILITIES } from "../../shared/terminal-capabilities";

const recommendedCapabilityIds = new Set([
  "filesystem.browse",
  "document.read",
  "filesystem.create",
  "filesystem.modify",
  "system.inspect",
]);

export function registerTerminalPolicyHandlers(
  data: TerminalPolicyRepository,
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
      allowedCommands: TERMINAL_CAPABILITIES.filter((capability) =>
        recommendedCapabilityIds.has(capability.id),
      ).flatMap((capability) =>
        capability.commands.map((command) => command.name),
      ),
    }),
  );
  ipcMain.handle(TERMINAL_POLICY_IPC_CHANNELS.pendingApprovals, () =>
    commands.pendingApprovals(),
  );
  commands.watchApprovals(() => {
    for (const window of BrowserWindow.getAllWindows())
      if (!window.webContents.isDestroyed())
        window.webContents.send(TERMINAL_POLICY_IPC_CHANNELS.approvalsChanged);
  });
  ipcMain.handle(
    TERMINAL_POLICY_IPC_CHANNELS.decideApproval,
    (_event, id: string, approved: boolean) =>
      commands.decideApproval(
        parseIpcDto(entityKeySchema, id),
        parseIpcDto(booleanFlagSchema, approved),
      ),
  );
}

export function removeTerminalPolicyHandlers() {
  for (const channel of Object.values(TERMINAL_POLICY_IPC_CHANNELS))
    if (channel !== TERMINAL_POLICY_IPC_CHANNELS.approvalsChanged)
      ipcMain.removeHandler(channel);
}
