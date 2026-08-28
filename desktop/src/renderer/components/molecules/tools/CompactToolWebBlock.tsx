import type { ChatToolCall } from "../../../../ipc/contracts";
import { WebIcon } from "../../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

export function CompactToolWebBlock({ call }: { call: ChatToolCall }) {
  return (
    <CompactToolStatus>
      <CompactToolStatus.Trigger
        icon={WebIcon}
        running="Идёт поиск в интернете"
        completed="Выполнен поиск в интернете"
        status={call.status}
      />
    </CompactToolStatus>
  );
}
