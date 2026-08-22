export type DataTransferConflictPolicy = "skip" | "overwrite";

export interface DataTransferCounts {
  create: number;
  update: number;
  conflict: number;
}

export interface DataTransferConflict {
  kind: "category" | "secret";
  label: string;
  reason: string;
}

export interface ImportPreview {
  sessionId: string;
  fileName: string;
  categories: DataTransferCounts;
  secrets: DataTransferCounts;
  conflicts: DataTransferConflict[];
}

export interface ImportResult {
  categories: Omit<DataTransferCounts, "conflict">;
  secrets: Omit<DataTransferCounts, "conflict">;
  skipped: number;
}

