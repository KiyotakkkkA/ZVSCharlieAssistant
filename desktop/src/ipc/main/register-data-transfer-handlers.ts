import { ipcMain } from "electron";
import {
  commitImportDtoSchema,
  exportDataDtoSchema,
  parseIpcDto,
  prepareImportDtoSchema,
  type CommitImportInput,
  type ExportDataInput,
  type PrepareImportInput,
} from "../../shared/dto";
import { DATA_TRANSFER_IPC_CHANNELS } from "../contracts/data-transfer.contract";
import type { DataTransferService } from "../../host/infrastructure/data-transfer/data-transfer.service";

export function registerDataTransferHandlers(service: DataTransferService): void {
  ipcMain.handle(
    DATA_TRANSFER_IPC_CHANNELS.exportData,
    (_event, input: ExportDataInput) =>
      service.exportData(parseIpcDto(exportDataDtoSchema, input)),
  );
  ipcMain.handle(
    DATA_TRANSFER_IPC_CHANNELS.prepareImport,
    (_event, input: PrepareImportInput) =>
      service.prepareImport(parseIpcDto(prepareImportDtoSchema, input)),
  );
  ipcMain.handle(
    DATA_TRANSFER_IPC_CHANNELS.commitImport,
    (_event, input: CommitImportInput) =>
      service.commitImport(parseIpcDto(commitImportDtoSchema, input)),
  );
  ipcMain.handle(
    DATA_TRANSFER_IPC_CHANNELS.cancelImport,
    (_event, sessionId: string) => service.cancelImport(sessionId),
  );
}

export function removeDataTransferHandlers(): void {
  for (const channel of Object.values(DATA_TRANSFER_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}

