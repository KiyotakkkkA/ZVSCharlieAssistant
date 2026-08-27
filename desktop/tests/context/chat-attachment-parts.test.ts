import { describe, expect, it } from "vitest";
import { chatMessageContentDtoSchema } from "../../src/shared/dto";
import { buildContext } from "../../src/host/application/context/context-builder";
import type { ChatMessage } from "../../src/shared/models/chat";

describe("вложения в истории чата", () => {
  it("сериализует метаданные файла и не добавляет их в текст модели", () => {
    const parts = chatMessageContentDtoSchema.parse([
      {
        type: "attachment",
        fileName: "report.pdf",
        mimeType: "application/pdf",
        size: 2048,
      },
      { type: "text", text: "Изучи отчёт" },
    ]);
    const message = {
      id: "message-1",
      role: "user",
      status: "completed",
      parts,
      compactedInto: null,
    } as ChatMessage;

    const context = buildContext({
      system: "system",
      messages: [message],
      segments: [],
      budget: {
        contextLength: 8192,
        maxOutputTokens: 512,
        usable: 7680,
        compactAt: 6000,
        hardStop: 7400,
        estimated: false,
      },
    });

    expect(parts[0]).toMatchObject({
      type: "attachment",
      fileName: "report.pdf",
      size: 2048,
    });
    expect(context.messages).toEqual([
      { role: "user", content: "Изучи отчёт" },
    ]);
  });
});
