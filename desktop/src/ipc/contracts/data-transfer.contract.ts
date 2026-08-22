import type {
  CommitImportInput,
  ExportDataInput,
  PrepareImportInput,
} from "../../shared/dto";
import type {
  ImportPreview,
  ImportResult,
} from "../../shared/models/data-transfer";

export interface DataTransferApi {
  exportData(input: ExportDataInput): Promise<boolean>;
  prepareImport(input: PrepareImportInput): Promise<ImportPreview | null>;
  commitImport(input: CommitImportInput): Promise<ImportResult>;
  cancelImport(sessionId: string): Promise<void>;
}

export const DATA_TRANSFER_IPC_CHANNELS = {
  exportData: "data-transfer:export",
  prepareImport: "data-transfer:prepare-import",
  commitImport: "data-transfer:commit-import",
  cancelImport: "data-transfer:cancel-import",
} as const;

