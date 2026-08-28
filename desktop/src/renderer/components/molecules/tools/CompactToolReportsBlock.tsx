import type { ChatToolCall } from "../../../../ipc/contracts";
import { WordIcon } from "../../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

const LABELS: Record<string, [string, string]> = {
  reports_docx: ["Идёт создание отчёта", "Отчёт DOCX создан"],
  reports_begin: ["Подготавливается отчёт", "Сборка отчёта начата"],
  reports_add_blocks: ["Добавляется часть отчёта", "Часть отчёта добавлена"],
  reports_commit: ["Собирается DOCX", "Отчёт DOCX создан"],
  reports_abort: ["Отменяется сборка отчёта", "Сборка отчёта отменена"],
};

export function CompactToolReportsBlock({ call }: { call: ChatToolCall }) {
  const [running, completed] = LABELS[call.toolId] ?? [
    call.toolId,
    call.toolId,
  ];
  return (
    <CompactToolStatus>
      <CompactToolStatus.Trigger
        icon={WordIcon}
        running={running}
        completed={completed}
        status={call.status}
      />
    </CompactToolStatus>
  );
}
