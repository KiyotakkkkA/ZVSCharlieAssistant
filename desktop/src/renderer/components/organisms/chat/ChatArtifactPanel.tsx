import { ScrollArea, SlidedPanel } from "@kiyotakkkka/zvs-uikit-lib";
import { useState } from "react";
import type { ChatToolCall, ScenarioNodeRun } from "../../../../ipc/contracts";
import { DownloadIcon, WordIcon } from "../../atoms";

export interface ChatArtifact {
  kind: "document";
  path: string;
  fileName: string;
}

export function collectChatArtifacts(
  toolCalls?: ChatToolCall[],
  scenarioNodes?: ScenarioNodeRun[],
): ChatArtifact[] {
  const artifacts = new Map<string, ChatArtifact>();
  for (const call of toolCalls ?? []) {
    if (call.toolId === "reports.docx" && call.status === "completed")
      addArtifact(artifacts, call.output);
  }
  for (const node of scenarioNodes ?? []) {
    const output = record(node.output);
    const values = Array.isArray(output?.artifacts) ? output.artifacts : [];
    for (const value of values) addArtifact(artifacts, value);
  }
  return [...artifacts.values()];
}

export function ChatArtifactPanel({
  artifacts,
  onClose,
}: {
  artifacts: ChatArtifact[];
  onClose: () => void;
}) {
  const [savingPath, setSavingPath] = useState<string>();
  const [error, setError] = useState<string>();
  const save = async (artifact: ChatArtifact) => {
    setSavingPath(artifact.path);
    setError(undefined);
    try {
      await window.desktop.saveGeneratedArtifact(artifact);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить файл",
      );
    } finally {
      setSavingPath(undefined);
    }
  };

  return (
    <SlidedPanel
      open={artifacts.length > 0}
      onClose={onClose}
      panelPlacement="right"
      className="w-full max-w-xl bg-main-900"
    >
      <SlidedPanel.Header>
        <SlidedPanel.Title>Созданные файлы</SlidedPanel.Title>
        <SlidedPanel.Subtitle>
          Результаты, сформированные в этой итерации
        </SlidedPanel.Subtitle>
      </SlidedPanel.Header>
      <SlidedPanel.Content className="flex min-h-0 flex-col">
        {error ? (
          <p className="mb-3 rounded-lg bg-danger-medium/10 px-3 py-2 text-xs text-danger-light">
            {error}
          </p>
        ) : null}
        <ScrollArea className="space-y-2 pr-1">
          {artifacts.map((artifact) => (
            <button
              key={artifact.path}
              type="button"
              disabled={savingPath === artifact.path}
              className="group flex w-full items-center gap-3 rounded-xl bg-main-800/55 p-4 text-left ring-1 ring-main-700/35 transition-colors hover:bg-main-700/60 disabled:cursor-wait disabled:opacity-60"
              onClick={() => void save(artifact)}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-main-700/50 text-info-medium group-hover:text-main-50">
                <WordIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-main-100">
                  {artifact.fileName}
                </span>
                <span className="mt-1 block text-[11px] text-main-500">
                  {savingPath === artifact.path
                    ? "Сохранение…"
                    : "Нажмите, чтобы скачать документ"}
                </span>
              </span>
              <DownloadIcon className="size-4 shrink-0 text-main-500 transition-colors group-hover:text-accent-light" />
            </button>
          ))}
        </ScrollArea>
      </SlidedPanel.Content>
    </SlidedPanel>
  );
}

function addArtifact(target: Map<string, ChatArtifact>, value: unknown) {
  const candidate = record(value);
  if (
    typeof candidate?.path !== "string" ||
    typeof candidate.fileName !== "string"
  )
    return;
  target.set(candidate.path, {
    kind: "document",
    path: candidate.path,
    fileName: candidate.fileName,
  });
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
