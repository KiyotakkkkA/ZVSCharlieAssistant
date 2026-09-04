import { describe, expect, it } from "vitest";
import { chunkDocument } from "../../src/host/infrastructure/vector-store/chunking";
import { estimateTextTokens } from "../../src/host/application/context/token-estimator";

const SENTENCES = [
  "Суд первой инстанции установил обстоятельства дела в полном объёме.",
  "Ответчик не представил доказательств исполнения обязательства.",
  "Истец настаивал на взыскании неустойки за весь период просрочки.",
  "Апелляционная коллегия согласилась с выводами районного суда.",
  "Доводы жалобы сводятся к переоценке исследованных доказательств.",
  "Оснований для отмены обжалуемого судебного акта не установлено.",
];

function prose(repeats: number): string {
  const out: string[] = [];
  for (let index = 0; index < repeats; index += 1) {
    const sentence = SENTENCES[index % SENTENCES.length]!;
    out.push(`${sentence.slice(0, -1)} по эпизоду ${index + 1}.`);
  }
  return out.join(" ");
}

describe("разбиение документа на чанки", () => {
  it("не разрывает абзац на границе страниц", () => {
    const chunks = chunkDocument(
      [
        { text: "Обязательство считается исполненным", pageNumber: 1 },
        {
          text: "с момента поступления средств на счёт кредитора.",
          pageNumber: 2,
        },
      ],
      200,
      0,
    );

    expect(chunks).toHaveLength(1);
    expect(bodyOf(chunks[0]!.text).replace(/\s+/g, " ")).toBe(
      "Обязательство считается исполненным с момента поступления средств на счёт кредитора.",
    );
    expect(chunks[0]!.pageNumber).toBe(1);
  });

  it("относит чанк к странице, на которой он начинается", () => {
    const chunks = chunkDocument(
      [
        { text: prose(6), pageNumber: 4 },
        { text: prose(6), pageNumber: 5 },
      ],
      40,
      0,
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.pageNumber).toBe(4);
    expect(new Set(chunks.map((chunk) => chunk.pageNumber))).toEqual(
      new Set([4, 5]),
    );
  });

  it("не начинает и не заканчивает чанк посреди слова", () => {
    const text = prose(40);
    const chunks = chunkDocument([{ text, pageNumber: 1 }], 60, 10);

    expect(chunks.length).toBeGreaterThan(3);
    const words = new Set(text.split(/\s+/));
    for (const chunk of chunks) {
      const parts = bodyOf(chunk.text).split(/\s+/);
      expect(words.has(parts[0]!)).toBe(true);
      expect(words.has(parts[parts.length - 1]!)).toBe(true);
    }
  });

  it("держит оценку токенов в пределах настроенного размера", () => {
    const chunks = chunkDocument([{ text: prose(60), pageNumber: 1 }], 80, 20);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks)
      expect(estimateTextTokens(chunk.text)).toBeLessThanOrEqual(80);
  });

  it("строит перекрытие из целых предложений", () => {
    const chunks = chunkDocument([{ text: prose(30), pageNumber: 1 }], 200, 80);

    expect(chunks.length).toBeGreaterThan(2);
    for (let index = 1; index < chunks.length; index += 1) {
      const previous = sentencesOf(bodyOf(chunks[index - 1]!.text));
      const current = sentencesOf(bodyOf(chunks[index]!.text));
      expect(sharedSentences(previous, current)).toBeGreaterThan(0);
    }
  });

  it("отбрасывает слишком короткие фрагменты", () => {
    expect(chunkDocument([{ text: "Да.", pageNumber: 1 }], 200, 0)).toEqual([]);
  });

  it("не зацикливается на предложении длиннее чанка", () => {
    const long = `${"слово ".repeat(400).trim()}.`;
    const chunks = chunkDocument([{ text: long, pageNumber: 1 }], 100, 50);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks)
      expect(estimateTextTokens(chunk.text)).toBeLessThanOrEqual(100);
  });
});

function bodyOf(text: string): string {
  const separator = text.indexOf("\n\n");
  return separator === -1 ? text : text.slice(separator + 2);
}

function sharedSentences(previous: string[], current: string[]): number {
  const max = Math.min(previous.length, current.length);
  for (let size = max; size > 0; size -= 1) {
    const tail = previous.slice(-size).join(" ");
    const head = current.slice(0, size).join(" ");
    if (tail === head) return size;
  }
  return 0;
}

function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}
