import type { ChatToolCall } from "../../../../ipc/contracts";
import { StorageIcon } from "../../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

export function CompactToolVecdbSearchBlock({ call }: { call: ChatToolCall }) {
  return (
    <CompactToolStatus>
      <CompactToolStatus.Trigger
        icon={StorageIcon}
        running="Идёт поиск в хранилище"
        completed="Поиск в хранилище завершён"
        status={call.status}
      />
    </CompactToolStatus>
  );
}
