import type { ChatToolCall } from "../../../../ipc/contracts";
import { PlanIcon } from "../../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

export function CompactToolTasksPlanBlock({ call }: { call: ChatToolCall }) {
  return (
    <CompactToolStatus>
      <CompactToolStatus.Trigger
        icon={PlanIcon}
        running="Идёт создание плана"
        completed="План обновлён"
        status={call.status}
      />
    </CompactToolStatus>
  );
}
