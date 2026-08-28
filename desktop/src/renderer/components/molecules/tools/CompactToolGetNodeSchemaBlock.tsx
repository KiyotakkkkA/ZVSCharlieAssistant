import type { ChatToolCall } from "../../../../ipc/contracts";
import { ScriptIcon } from "../../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

export function CompactToolGetNodeSchemaBlock({
  call,
}: {
  call: ChatToolCall;
}) {
  const kinds = requestedKinds(call.input);
  const label = kinds.length ? kinds.join(", ") : "узлов";
  return (
    <CompactToolStatus>
      <CompactToolStatus.Trigger
        icon={ScriptIcon}
        running={`Запрашивает схему: ${label}`}
        completed={`Получена схема: ${label}`}
        status={call.status}
      />
      <CompactToolStatus.Expandable className="p-0!">
        <NodeSchemaDetails call={call} />
      </CompactToolStatus.Expandable>
    </CompactToolStatus>
  );
}

function NodeSchemaDetails({ call }: { call: ChatToolCall }) {
  const output = isRecord(call.output) ? call.output : null;
  const nodes = Array.isArray(output?.nodes)
    ? output.nodes.filter(isRecord)
    : [];

  if (!nodes.length)
    return (
      <p className="px-4 py-3.5 text-xs text-main-500">
        {call.error ?? "Схема ещё не получена"}
      </p>
    );

  return (
    <ul className="divide-y divide-main-700/35">
      {nodes.map((node, index) => {
        const kind =
          typeof node.kind === "string" ? node.kind : `узел ${index + 1}`;
        const error = typeof node.error === "string" ? node.error : null;
        return (
          <li key={kind} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-main-800 px-1.5 py-0.5 font-mono text-[10px] text-accent-light ring-1 ring-main-700/50">
                {kind}
              </span>
              {typeof node.label === "string" ? (
                <span className="truncate text-xs font-medium text-main-200">
                  {node.label}
                </span>
              ) : null}
            </div>
            {error ? (
              <p className="mt-1 text-xs leading-5 text-danger-light">
                {error}
              </p>
            ) : typeof node.description === "string" ? (
              <p className="mt-1 text-xs leading-5 text-main-400">
                {node.description}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function requestedKinds(input: unknown): string[] {
  if (!isRecord(input) || !Array.isArray(input.kinds)) return [];
  return input.kinds.filter((item): item is string => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
