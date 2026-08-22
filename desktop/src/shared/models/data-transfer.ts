export type DataTransferConflictPolicy = "skip" | "overwrite";

export interface DataTransferCounts {
  create: number;
  update: number;
  conflict: number;
}

export interface DataTransferConflict {
  kind: string;
  label: string;
  reason: string;
}

export interface ImportPreview {
  sessionId: string;
  fileName: string;
  categories: DataTransferCounts;
  secrets: DataTransferCounts;
  policies: {
    terminal: boolean;
    memory: boolean;
  };
  skills: DataTransferCounts;
  entities: Partial<
    Record<
      import("../dto/data-transfer.dto").DataTransferEntity,
      DataTransferCounts
    >
  >;
  missingDependencies: Array<{
    ownerKind: string;
    ownerId: string;
    dependencyKind: string;
    dependencyId: string;
  }>;
  conflicts: DataTransferConflict[];
}

export interface ImportResult {
  categories: Omit<DataTransferCounts, "conflict">;
  secrets: Omit<DataTransferCounts, "conflict">;
  policies: number;
  skills: Omit<DataTransferCounts, "conflict">;
  entities: Partial<
    Record<
      import("../dto/data-transfer.dto").DataTransferEntity,
      Omit<DataTransferCounts, "conflict">
    >
  >;
  skipped: number;
}
