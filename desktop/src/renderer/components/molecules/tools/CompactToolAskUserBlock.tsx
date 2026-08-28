import type { ChatToolCall } from "../../../../ipc/contracts";
import { QuestionIcon } from "../../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

export function CompactToolAskUserBlock({ call }: { call: ChatToolCall }) {
  return (
    <CompactToolStatus>
      <CompactToolStatus.Trigger
        icon={QuestionIcon}
        running="Идёт запрос информации у пользователя"
        completed="Информация от пользователя получена"
        status={call.status}
      />
      <CompactToolStatus.Expandable>
        <AskUserDetails call={call} />
      </CompactToolStatus.Expandable>
    </CompactToolStatus>
  );
}

function AskUserDetails({ call }: { call: ChatToolCall }) {
  const input = isRecord(call.input) ? call.input : null;
  const output = isRecord(call.output) ? call.output : null;
  const question = typeof input?.question === "string" ? input.question : null;
  const rawAnswer = output?.answer;
  const answer = Array.isArray(rawAnswer)
    ? rawAnswer
        .filter((item): item is string => typeof item === "string")
        .join(", ")
    : typeof rawAnswer === "string"
      ? rawAnswer
      : null;

  return (
    <div className="space-y-1">
      {question ? <p>{question}</p> : null}
      {answer ? (
        <p className="font-medium text-main-100">{answer}</p>
      ) : call.error ? (
        <p className="text-danger-light">{call.error}</p>
      ) : (
        <p className="text-main-500">Ожидается ответ пользователя</p>
      )}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
