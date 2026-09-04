import { describe, expect, it } from "vitest";
import {
  chunkDocument,
  detectHeading,
} from "../../src/host/infrastructure/vector-store/chunking";
import { estimateTextTokens } from "../../src/host/application/context/token-estimator";

const BODY =
  "Ответчик не представил доказательств исполнения обязательства по договору поставки. " +
  "Истец настаивал на взыскании неустойки за весь период просрочки платежа.";

describe("распознавание заголовков", () => {
  it("распознаёт нумерацию российских правовых документов", () => {
    expect(detectHeading("1.")).toMatchObject({ depth: 1 });
    expect(detectHeading("1.1.")).toMatchObject({ depth: 2 });
    expect(detectHeading("2.3.4. Порядок расчётов")).toMatchObject({
      depth: 3,
    });
    expect(detectHeading("Статья 5")).toMatchObject({ depth: 2 });
    expect(detectHeading("Раздел III")).toMatchObject({ depth: 1 });
    expect(detectHeading("Приложение №2")).toMatchObject({ depth: 1 });
    expect(detectHeading("Глава 7")).toMatchObject({ depth: 1 });
    expect(detectHeading("п. 4.2")).toMatchObject({ depth: 3 });
  });

  it("распознаёт строку в верхнем регистре", () => {
    expect(detectHeading("ОБЩИЕ ПОЛОЖЕНИЯ")).toMatchObject({ depth: 1 });
  });

  it("не считает заголовком обычное предложение", () => {
    expect(detectHeading(BODY)).toBeUndefined();
    expect(
      detectHeading("Суд установил, что ответчик уклонялся от исполнения."),
    ).toBeUndefined();
  });
});

describe("хлебные крошки в чанках", () => {
  it("чанк под «Статья 5» несёт её в крошке и в headingPath", () => {
    const chunks = chunkDocument(
      [
        {
          text: `Раздел III\n\nСтатья 5\n\n${BODY}`,
          pageNumber: 7,
        },
      ],
      200,
      0,
      "договор.pdf",
    );

    expect(chunks).toHaveLength(1);
    const chunk = chunks[0]!;
    expect(chunk.headingPath).toBe("Раздел III › Статья 5");
    expect(chunk.text.split("\n\n")[0]).toBe(
      "договор.pdf › Раздел III › Статья 5 › стр. 7",
    );
    expect(chunk.text).toContain(BODY.slice(0, 40));
  });

  it("заменяет заголовок того же уровня, а не накапливает", () => {
    const chunks = chunkDocument(
      [
        {
          text: `Статья 5\n\n${BODY}\n\nСтатья 6\n\n${BODY}`,
          pageNumber: 1,
        },
      ],
      60,
      0,
      "акт.pdf",
    );

    const paths = chunks.map((chunk) => chunk.headingPath);
    expect(paths).toContain("Статья 5");
    expect(paths).toContain("Статья 6");
    expect(paths.every((path) => !path.includes("Статья 5 › Статья 6"))).toBe(
      true,
    );
  });

  it("опускает путь заголовков, когда их нет", () => {
    const chunks = chunkDocument(
      [{ text: BODY, pageNumber: 3 }],
      200,
      0,
      "письмо.pdf",
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.headingPath).toBe("");
    expect(chunks[0]!.text.split("\n\n")[0]).toBe("письмо.pdf › стр. 3");
  });

  it("учитывает длину крошки в бюджете токенов", () => {
    const longName = `${"очень-длинное-имя-документа-".repeat(4)}.pdf`;
    const chunks = chunkDocument(
      [{ text: `Статья 5\n\n${BODY.repeat(6)}`, pageNumber: 12 }],
      100,
      0,
      longName,
    );

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks)
      expect(estimateTextTokens(chunk.text)).toBeLessThanOrEqual(100);
  });
});
