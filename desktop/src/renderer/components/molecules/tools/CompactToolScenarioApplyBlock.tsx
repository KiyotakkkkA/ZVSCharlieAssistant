import type { ChatToolCall } from "../../../../ipc/contracts";
import { SaveIcon } from "../../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

export function CompactToolScenarioApplyBlock({
  call,
}: {
  call: ChatToolCall;
}) {
  const output = isRecord(call.output) ? call.output : null;
  const rejected = call.status === "completed" && output?.ok === false;
  const status = rejected ? "failed" : call.status;

  return (
    <CompactToolStatus defaultExpanded={rejected}>
      <CompactToolStatus.Trigger
        icon={SaveIcon}
        running="Применяет граф сценария"
        completed="Граф сценария применён"
        failed="Граф сценария отклонён при проверке"
        status={status}
      />
      <CompactToolStatus.Expandable>
        <ScenarioApplyDetails call={call} output={output} />
      </CompactToolStatus.Expandable>
    </CompactToolStatus>
  );
}

function ScenarioApplyDetails({
  call,
  output,
}: {
  call: ChatToolCall;
  output: Record<string, unknown> | null;
}) {
  const errors = Array.isArray(output?.errors)
    ? output.errors.filter((item): item is string => typeof item === "string")
    : [];
  const summary = typeof output?.summary === "string" ? output.summary : null;

  if (errors.length)
    return (
      <ul className="list-disc space-y-1 pl-4 text-danger-light">
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    );
  if (summary) return <p>{summary}</p>;
  if (call.error) return <p className="text-danger-light">{call.error}</p>;
  return <p className="text-main-500">Ожидается результат применения графа</p>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
