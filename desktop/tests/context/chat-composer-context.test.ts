import { describe, expect, it } from "vitest";
import { parseIpcDto, startRunDtoSchema } from "../../src/shared/dto";

describe("контекст из компоновщика чата", () => {
  it("передаёт вложения и несколько хранилищ через IPC DTO", () => {
    const data = new TextEncoder().encode("Содержимое документа").buffer;
    const input = parseIpcDto(startRunDtoSchema, {
      mode: "chat",
      modelId: "019cba09-8f30-7000-8000-000000000001",
      text: "Ответь по источникам",
      attachments: [
        {
          fileName: "source.txt",
          mimeType: "text/plain",
          data,
        },
      ],
      vectorStoreIds: [
        "019cba09-8f30-7000-8000-000000000002",
        "019cba09-8f30-7000-8000-000000000003",
      ],
    });

    expect(input.attachments?.[0]?.data.byteLength).toBe(data.byteLength);
    expect(input.vectorStoreIds).toHaveLength(2);
    expect(structuredClone(input)).toEqual(input);
  });
});
