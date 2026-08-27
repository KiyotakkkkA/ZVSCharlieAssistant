import { describe, expect, it } from "vitest";
import type { ChatToolCall } from "../../src/ipc/contracts";
import { collectChatArtifacts } from "../../src/renderer/components/organisms/chat/ChatArtifactPanel";

function toolCall(
  toolId: string,
  status: ChatToolCall["status"],
  output: unknown,
): ChatToolCall {
  return {
    id: `${toolId}-call`,
    toolId,
    status,
    input: {},
    output,
    error: null,
  };
}

describe("chat artifacts", () => {
  it("collects a DOCX produced by the staged reports_commit tool", () => {
    expect(
      collectChatArtifacts([
        toolCall("reports_begin", "completed", {
          sessionId: "session-1",
          fileName: "audit.docx",
        }),
        toolCall("reports_commit", "completed", {
          path: "C:/reports/audit.docx",
          fileName: "audit.docx",
          blocks: 8,
        }),
      ]),
    ).toEqual([
      {
        kind: "document",
        path: "C:/reports/audit.docx",
        fileName: "audit.docx",
      },
    ]);
  });

  it("keeps legacy reports_docx support and ignores failed commits", () => {
    expect(
      collectChatArtifacts([
        toolCall("reports_commit", "failed", {
          path: "C:/reports/failed.docx",
          fileName: "failed.docx",
        }),
        toolCall("reports_docx", "completed", {
          path: "C:/reports/legacy.docx",
          fileName: "legacy.docx",
        }),
      ]),
    ).toEqual([
      {
        kind: "document",
        path: "C:/reports/legacy.docx",
        fileName: "legacy.docx",
      },
    ]);
  });
});
