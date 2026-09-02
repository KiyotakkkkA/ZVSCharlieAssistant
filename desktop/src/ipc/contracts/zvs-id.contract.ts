import type { ZvsIdConnection } from "../../shared/models/zvs-id";

export type * from "../../shared/models/zvs-id";

export interface ZvsIdApi {
  status(): Promise<ZvsIdConnection>;
  connect(): Promise<ZvsIdConnection>;
  cancelConnect(): Promise<void>;
  disconnect(): Promise<ZvsIdConnection>;
  subscribe(listener: (connection: ZvsIdConnection) => void): () => void;
}

export const ZVS_ID_IPC_CHANNELS = {
  status: "zvs-id:status",
  connect: "zvs-id:connect",
  cancelConnect: "zvs-id:cancel-connect",
  disconnect: "zvs-id:disconnect",
  changed: "zvs-id:changed",
} as const;
